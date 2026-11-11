# -*- coding: utf-8 -*-
"""يقصّ أسئلة ورقة فيزياء 12 (دبلوم) إلى صور: سؤال كامل لكل رقم «N)».
usage: cut.py <pdf> <first> <last> <paper_id> <outdir> [manual.json]
"""
import sys, os, re, json
import pymupdf, numpy as np
from PIL import Image
SC = 2.0
def page_img(p):
    pm = p.get_pixmap(matrix=pymupdf.Matrix(SC, SC), colorspace=pymupdf.csGRAY)
    return np.frombuffer(pm.samples, np.uint8).reshape(pm.height, pm.width).copy()
def content_box(a):
    """حدود المحتوى: يستبعد الشريط الرمادي الجانبي والسفلي والترويسة."""
    H, W = a.shape
    gray = (a > 175) & (a < 240)
    colg = gray[int(H*0.1):int(H*0.85)].mean(0)      # أعمدة الشريط الجانبي
    x0, x1 = 0, W
    band = np.where(colg > 0.6)[0]
    if len(band):
        if band.mean() < W/2: x0 = band.max() + 4
        else: x1 = band.min() - 4
    rowg = gray[:, x0+20:x1-20].mean(1)
    g = rowg > 0.6; y1 = int(H*0.94); run = 0
    for yy in range(int(H*0.86), H):
        run = run + 1 if g[yy] else 0
        if run >= 18: y1 = yy - run - 3; break
    # الترويسة: خط أفقي أسود قرب الأعلى
    dark = (a[:int(H*0.08), x0:x1] < 110).mean(1)
    ln = np.where(dark > 0.5)[0]
    y0 = ln[ln <= ln.min() + 6].max() + 4 if len(ln) else int(H*0.035)
    return x0, y0, x1, y1
def find_q(p):
    ws = p.get_text('words'); out = []; marks = []
    for i, w in enumerate(ws):
        t = w[4].strip()
        if re.fullmatch(r'\]\d{1,2}\[', t) or re.fullmatch(r'\[\d{1,2}\]', t):
            marks.append((w[1], int(re.sub(r'\D', '', t))))
        tt = t.translate(str.maketrans('٠١٢٣٤٥٦٧٨٩', '0123456789'))
        core = re.sub(r'[\(\)\.]', '', tt)
        if re.fullmatch(r'\d{1,2}', core) and w[2] > 530 and w[3] < p.rect.height - 60:
            ok = ('(' in tt or ')' in tt)
            if not ok:
                for v in ws:
                    if v is not w and ('(' in v[4] or ')' in v[4]) and (abs(v[2]-w[0]) < 2.5 or abs(v[0]-w[2]) < 2.5 or abs(v[0]-w[0]) < 8) and abs(v[1]-w[1]) < 3: ok = True; break
            if ok: out.append((w[1], w[2], int(core)))
    if out:
        mx = max(o[1] for o in out); out = [o for o in out if o[1] > mx - 3]
    return sorted(out), sorted(marks)
def trim(a):
    ink = a < 150
    rows = np.where(ink.any(1))[0]; cols = np.where(ink.any(0))[0]
    if not len(rows): return None
    return a[max(0, rows.min()-6):rows.max()+8, :]
def main():
    pdf, f, l, pid, out = sys.argv[1:6]; f, l = int(f), int(l)
    man = json.load(open(sys.argv[6])) if len(sys.argv) > 6 else {}
    os.makedirs(out, exist_ok=True)
    d = pymupdf.open(pdf); pages = []
    for pn in range(f-1, l):
        p = d[pn]; a = page_img(p); box = content_box(a); qs, mk = find_q(p)
        if str(pn+1) in man:   # [[y_frac, n, marks], ...] لصفحات ممسوحة
            qs = [(y*p.rect.height, 0, n) for y, n, m in man[str(pn+1)]]
            mk = [(y*p.rect.height+1, m) for y, n, m in man[str(pn+1)] if m]
        pages.append({'pn': pn+1, 'a': a, 'box': box, 'qs': qs, 'mk': mk, 'text': p.get_text()})
    # تسلسل البدايات
    starts = []
    for i, P in enumerate(pages):
        for y, x, n in P['qs']: starts.append((i, int((y+5)*SC), n))
    items = []
    for k, (pi, y, n) in enumerate(starts):
        e = starts[k+1] if k+1 < len(starts) else (len(pages)-1, 10**6, None)
        parts = []; marks = 0; txt = ''
        for j in range(pi, e[0]+1):
            P = pages[j]; x0, y0, x1, y1 = P['box']
            ya = max(y0, y - 6) if j == pi else y0
            yb = min(y1, e[1] - 8) if j == e[0] else y1
            if yb - ya < 25: continue
            t = trim(P['a'][ya:yb, x0:x1])
            if t is None or t.shape[0] < 20: continue
            # صفحة كاملة لا نص فيها غير «لا تكتب» (مسودة) تُستبعد
            parts.append(t)
            marks += sum(m for (my, m) in P['mk'] if ya/SC - 14 <= my + 14 <= yb/SC + 16)
        if not parts: continue
        w = max(t.shape[1] for t in parts)
        can = np.full((sum(t.shape[0] for t in parts) + 6*(len(parts)-1), w), 255, np.uint8); yy = 0
        for t in parts:
            can[yy:yy+t.shape[0], w-t.shape[1]:] = t; yy += t.shape[0] + 6
        # قص الهوامش الأفقية البيضاء
        cols = np.where((can < 150).any(0))[0]
        can = can[:, max(0, cols.min()-10):min(w, cols.max()+12)]
        name = f'{pid}-q{n:02d}'
        Image.fromarray(can).save(os.path.join(out, name + '.png'))
        # نص السؤال من الطبقة النصية
        P = pages[pi]
        items.append({'n': n, 'm': marks, 'page': P['pn'], 'file': name + '.png', 'w': int(can.shape[1]), 'h': int(can.shape[0]), 'parts': len(parts)})
    json.dump(items, open(os.path.join(out, pid + '.json'), 'w'), ensure_ascii=False, indent=0)
    print(pid, 'questions', len(items), 'marks', sum(i['m'] for i in items))
    print(' '.join(f"{i['n']}:{i['m']}" for i in items))
main()
