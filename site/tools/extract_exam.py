# -*- coding: utf-8 -*-
"""يقصّ أسئلة ورقة امتحان إلى صور webp منظّفة ويكتب ملف مراجعة.

- يعمل على أوراق Q النصية (يحدّد رقم السؤال ودرجته من الطبقة النصية).
- ينظّف كل صورة بـ clean_array من clean_fin.py (يزيل الأشرطة والإطار وصناديق الدرجات).
- يكتب questions.json + review.md ليراجعها المعلم ويعتمد ربطها بالدروس.

الاستخدام:
  python3 extract_exam.py <Q.pdf> --slug sci7 --out <مجلد> --pages 2-9 --year 2025-2026 --session "الدور الأول - الفترة الصباحية"
"""
import argparse, hashlib, json, os, re, sys

import numpy as np
import pymupdf
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from clean_fin import clean_array  # إعادة استخدام أداة التنظيف نفسها

MARK_RE = re.compile(r'^[\[\(]\s*(\d{1,2})\s*[\]\)]$')
QNUM_RE = re.compile(r'^(\d{1,2})\s*[\)\u002e]\s*(.*)$', re.S)
BARE_NUM_RE = re.compile(r'^(\d{1,2})$')
CLOSE_RE = re.compile(r'^[\)\u002e]')
HEADER_RE = re.compile(r'امتحان|الفصل الدراس|الدور ال|الفترة|العام الدراس|الصفحة|تابع')


def spans_of(page, scale):
    out = []
    for b in page.get_text('dict')['blocks']:
        if b.get('type') != 0:
            continue
        for l in b['lines']:
            for s in l['spans']:
                t = (s['text'] or '').replace('\u200f', '').strip()
                if t:
                    x0, y0, x1, y1 = s['bbox']
                    out.append({'x0': x0 * scale, 'x1': x1 * scale, 'y0': y0 * scale,
                                'y1': y1 * scale, 'text': t})
    return out


def rows_of(spans, tol=4.0):
    rows = []
    for s in sorted(spans, key=lambda z: (z['y0'], -z['x0'])):
        for r in rows:
            if abs(r['y'] - s['y0']) <= tol:
                r['items'].append(s)
                break
        else:
            rows.append({'y': s['y0'], 'items': [s]})
    rows.sort(key=lambda r: r['y'])
    for r in rows:
        r['items'].sort(key=lambda z: -z['x0'])   # RTL: من اليمين لليسار
        r['text'] = ' '.join(i['text'] for i in r['items'])
    return rows


def norm_ar(t):
    t = re.sub(r'\s+', ' ', t or '').strip()
    return t


def mark_anchors(rows, page_h):
    """يعيد مواضع علامات الدرجة [n] كمَراسٍ لبدايات الأسئلة.

    في أوراق الوزارة تُطبع علامة الدرجة [n] في الهامش الأيسر على مستوى بداية
    كل سؤال. فحدود السؤال = من علامته إلى العلامة التالية. هذا أوثق من البحث
    عن رقم السؤال، لأن الترقيم يختلف في مكانه (مدمجًا، منفصلًا، أو في جدول).
    """
    out = []
    for r in rows:
        t = r['items'][0]['text']
        m = MARK_RE.match(t)
        if not m:
            continue
        if not (page_h * 0.035 < r['y'] < page_h * 0.95):
            continue
        out.append({'marks': int(m.group(1)), 'y': r['y']})
    out.sort(key=lambda z: z['y'])
    return out


def number_for_y(rows, page_w, y):
    """رقم السؤال الأقرب لمستوى y من عمود اليمين (للتسمية والترتيب)."""
    best, bn = 1e9, None
    for r in rows:
        if abs(r['y'] - y) > 30:
            continue
        for it in r['items']:
            if it['x0'] < page_w * 0.62:
                continue
            m = QNUM_RE.match(it['text'])
            if m:
                v = int(m.group(1))
                if 1 <= v <= 60:
                    d = abs(r['y'] - y)
                    if d < best:
                        best, bn = d, v
    return bn


def question_rows(rows, page_w, page_h):
    """يعيد صفوفًا مرشّحة لبداية سؤال، بترتيب عمودي.

    علامات الدرجة [n] في الهامش الأيسر هي المراسي الموثوقة: كل بديل/جزئية
    لها قوس. فنتجاهلها عند البحث عن أرقام الأسئلة (وهي في عمود اليمين).
    """
    marks = [r for r in rows if MARK_RE.match(r['items'][0]['text'])]
    right = page_w * 0.70          # عمود أرقام الأسئلة في أقصى اليمين
    skip = re.compile(r'الدرجة الكلية|تنبيه|المصحح|المراجع|انتهت|الصفحة|امتحان|الفصل الدراس|الدور|الفترة|العام الدراس')
    cands = []
    for r in rows:
        if r['y'] < page_h * 0.035 or r['y'] > page_h * 0.945:
            continue
        if skip.search(r['text']):
            continue
        items = [i for i in r['items'] if i['x0'] >= right]
        if not items:
            continue
        n = None
        for idx, it in enumerate(items):
            m = QNUM_RE.match(it['text'])
            if m:
                num = int(m.group(1))
                if 1 <= num <= 60:
                    n = num
                    break
            b = BARE_NUM_RE.match(it['text'])
            if not b:
                continue
            num = int(b.group(1))
            if not 1 <= num <= 60:
                continue
            rest = items[idx + 1:]
            if any(CLOSE_RE.match(x['text']) for x in rest):
                n = num
                break
        if n is not None:
            cands.append({'n': n, 'y': r['y']})
    # إزالة التكرار مع الحفاظ على الترتيب العمودي
    seen, out = set(), []
    for c in cands:
        if c['n'] in seen:
            continue
        seen.add(c['n'])
        out.append(c)
    # الأسئلة تتصاعد مع النزول. نبحث عن أفضل تتابع تصاعدي (LIS) بدل التتابع الحرفي،
    # حتى لا يسقط سؤال بسبب رقم شاذ أو ترقيم متقطع في الورقة.
    if not out:
        return [], marks
    ys = [c['y'] for c in out]
    n = len(out)
    best = [1] * n
    prev = [-1] * n
    for i in range(n):
        for j in range(i):
            if out[j]['n'] < out[i]['n'] and best[j] + 1 > best[i]:
                best[i] = best[j] + 1
                prev[i] = j
    end = max(range(n), key=lambda i: best[i])
    chain = []
    while end >= 0:
        chain.append(out[end])
        end = prev[end]
    chain.reverse()
    return chain, marks


def build_text(rows, y0, y1):
    parts = []
    for r in rows:
        if not (y0 - 1 <= r['y'] < y1):
            continue
        if MARK_RE.match(r['items'][0]['text']):
            continue
        t = norm_ar(r['text'])
        if HEADER_RE.search(t) and r['y'] < y0 + 26:
            continue
        parts.append(t)
    return ' '.join(p for p in parts if p)


def marks_in(marks, y0, y1, default=1):
    inside = []
    for m in marks:
        if y0 - 2 <= m['y'] < y1:
            v = int(MARK_RE.match(m['items'][0]['text']).group(1))
            if 1 <= v <= 10:
                inside.append(v)
    return max(inside) if inside else default


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('pdf')
    ap.add_argument('--slug', required=True)
    ap.add_argument('--out', required=True)
    ap.add_argument('--pages', default='')
    ap.add_argument('--dpi', type=int, default=200)
    ap.add_argument('--year', default='')
    ap.add_argument('--session', default='')
    ap.add_argument('--region', default='')
    ap.add_argument('--num-from', type=int, default=0, help='أول رقم سؤال للترقيم المتسلسل (0 = رقم الورقة)')
    ap.add_argument('--anchor', default='marks', choices=['marks', 'numbers'],
                    help='marks: حدود الأسئلة من علامات الدرجة [n] (أكمل) | numbers: من أرقام الأسئلة')
    a = ap.parse_args()

    doc = pymupdf.open(a.pdf)
    pages = list(range(doc.page_count))
    if a.pages:
        lo, _, hi = a.pages.partition('-')
        pages = list(range(int(lo) - 1, int(hi or lo)))
    imgdir = os.path.join(a.out, 'img')
    os.makedirs(imgdir, exist_ok=True)
    scale = a.dpi / 72.0

    items = []
    for pi in pages:
        page = doc[pi]
        H = page.rect.height * scale
        W = page.rect.width * scale
        rows = rows_of(spans_of(page, scale))
        if a.anchor == 'marks':
            starts = mark_anchors(rows, H)
            for s in starts:
                n = number_for_y(rows, W, s['y'])
                s['n'] = n if n else None
        else:
            starts, _ = question_rows(rows, W, H)
            for s in starts:
                s['marks'] = None
        marks = [r for r in rows if MARK_RE.match(r['items'][0]['text'])]
        if not starts:
            continue
        pix = page.get_pixmap(dpi=a.dpi)
        arr = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, pix.n)
        if pix.n == 4:
            arr = arr[:, :, :3]
        footer = H * 0.955
        for i, s in enumerate(starts):
            y0 = max(0.0, s['y'] - 7)
            y1 = (starts[i + 1]['y'] - 7) if i + 1 < len(starts) else footer
            # سقف الارتفاع: يمنع امتداد السؤال إلى تذييل الصفحة (رقم الصفحة/الترويسة)
            y1 = min(y1, y0 + 0.80 * H, footer)
            y1 = min(max(y1, y0 + 26), H)
            # القصّ: عمود المحتوى فقط، مع استثناء عمود الدرجات على اليسار عند وجوده
            x0 = 0.012 * W
            x1 = W - 0.012 * W
            crop = arr[int(y0):int(y1), int(x0):int(x1)]
            if crop.size == 0 or crop.shape[0] < 20:
                continue
            gray = np.array(Image.fromarray(crop).convert('L'))
            cleaned, done = clean_array(gray)
            rgb = crop.copy()
            mask = (cleaned == 255) & (gray != 255)
            rgb[mask] = 255
            im = Image.fromarray(rgb)
            if im.width > 1000:
                im = im.resize((1000, int(im.height * 1000 / im.width)), Image.LANCZOS)
            qid = hashlib.md5(('%s|%d|%s|%d' % (a.slug, pi, s['n'], int(s['y']))).encode()).hexdigest()[:10]
            fn = os.path.join(imgdir, qid + '.webp')
            im.save(fn, 'WEBP', quality=58, method=6)
            mk = s.get('marks') if a.anchor == 'marks' else marks_in(marks, y0, y1)
            items.append({
                'n': s['n'], 'qid': qid, 'src_page': pi + 1,
                'marks': int(mk or 1),
                'text': build_text(rows, y0, y1)[:1200],
                'img': '%s/%s.webp' % (a.slug, qid), 'file': fn,
                'w': im.width, 'h': im.height, 'cleaned': done,
            })
    # ترقيم متسلسل إن طُلب
    if a.num_from:
        for i, it in enumerate(items):
            it['n'] = a.num_from + i
    meta = {'slug': a.slug, 'pdf': os.path.basename(a.pdf), 'year': a.year,
            'session': a.session, 'region': a.region, 'pages': a.pages,
            'anchor': a.anchor, 'count': len(items),
            'marks_total': sum(i['marks'] for i in items),
            'numbers': [i['n'] for i in items if i['n'] is not None]}
    out = os.path.join(a.out, 'questions_%s_%s_%s.json' %
                       (a.slug, a.anchor, (a.pages or 'all').replace('-', '_')))
    with open(out, 'w', encoding='utf-8') as f:
        json.dump({'meta': meta, 'items': items}, f, ensure_ascii=False, indent=1)
    print('%s[%s]: %d مفردة | مجموع الدرجات %d | أرقام: %s' %
          (a.slug, a.anchor, len(items), meta['marks_total'], meta['numbers']))
    print('  كُتب %s' % out)
    return items


if __name__ == '__main__':
    main()
