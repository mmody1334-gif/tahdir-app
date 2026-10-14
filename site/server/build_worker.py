# -*- coding: utf-8 -*-
# يبني worker.js واحدًا من مصادر الموقع. يُشغَّل محليًا أو من GitHub Actions.
import json, os, re, subprocess, datetime
HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, '..', 'data')
DIST = os.path.join(HERE, '..', 'dist')
os.makedirs(DIST, exist_ok=True)
theme = json.load(open(os.path.join(DATA, 'theme.json'), encoding='utf-8'))
base_css, HELIX, CELL, LOGO = theme['css'], theme['HELIX'], theme['CELL'], theme['LOGO']
# هوية «الكبسولة»: الشعار وشعارا البانر (الوزارة ورؤية عُمان 2040) وألوان فاتحة متناسقة
import base64 as _b64
_BR = os.path.join(DATA, 'brand')
LOGO = open(os.path.join(_BR, 'logo.svg'), encoding='utf-8').read().replace('<svg ', '<svg class="kb-logo" aria-hidden="true" ', 1)
_img = lambda f: '/brand/' + f
BRAND_ICONS = {'/brand/' + f: _b64.b64encode(open(os.path.join(_BR, f), 'rb').read()).decode() for f in ('moe.png', 'vision.png')}
BANNER = f'''<div class="kb-banner"><img class="kb-moe" src="{_img('moe.png')}" alt="وزارة التعليم"><div class="kb-mid"><div class="kb-mark">{LOGO}</div><div class="kb-name"><b>الكبسولة</b><span>مدرسة حذيفة بن محصن</span></div></div><img class="kb-vis" src="{_img('vision.png')}" alt="رؤية عُمان 2040"></div>'''
base_css = base_css.replace('--bg:#f1f7f4; --paper:#ffffff; --ink:#10261f; --mute:#58726a; --line:#d4e5de;', '--bg:#f6f4ee; --paper:#ffffff; --ink:#10261f; --mute:#5b6d67; --line:#e2e0d6;', 1)
base_css = base_css.replace('--main:#0c7a63; --main-d:#08503f; --main-l:#e1f3ec; --leaf:#5fae3c; --accent:#c4861a; --accent-l:#fbf0db', '--main:#1f8a70; --main-d:#0b3b33; --main-l:#e3f1eb; --leaf:#e0a93b; --accent:#c98a1e; --accent-l:#fbf0db', 1)
lessons = json.load(open(os.path.join(DATA, 'lessons.json'), encoding='utf-8'))
qbank = json.load(open(os.path.join(DATA, 'quiz_bank.json'), encoding='utf-8'))
# أسئلة الاختبارات النهائية (بصورتها الأصلية) تدخل بنك الاختبارات القصيرة للعلوم، بأهداف تقويم مطابقة للوثيقة
def fin_items():
    p = os.path.join(DATA, 'finals.json')
    if not os.path.exists(p): return []
    F = json.load(open(p, encoding='utf-8'))
    GN = {'الخامس': 5, 'السادس': 6, 'السابع': 7, 'الثامن': 8, 'التاسع': 9, 'العاشر': 10, 'الحادي عشر': 11, 'الثاني عشر': 12}
    LO = {'AO1': 'معرفة', 'AO2': 'تطبيق', 'AO3': 'استدلال', 'معرفة': 'معرفة', 'تطبيق': 'تطبيق', 'استدلال': 'استدلال'}
    HI = {'AO1': 'AO1', 'AO2': 'AO2', 'AO3': 'AO2', 'معرفة': 'AO1', 'تطبيق': 'AO2', 'استدلال': 'AO2'}
    out = []
    for key, G in F.items():
        subj, grade = key.split('|')
        if subj in ('تقنية المعلومات', 'اللغة الإنجليزية'): continue
        g = GN.get(grade, 0); hi = g >= 11
        smax = 3 if hi else 2; lrange = (4, 5) if hi else ((3, 4) if g >= 9 else ())
        for q in G['q']:
            ao = (HI if hi else LO).get(str(q.get('ao') or '').strip())
            m = q.get('m')
            if not ao or not q.get('l') or not isinstance(m, (int, float)) or m != int(m): continue
            m = int(m); t = q.get('t')
            if t == 'mcq':
                if m != 1: continue
                typ = 'mcq'
            elif m <= smax: typ = 'short'
            elif lrange and m in lrange and ao not in ('معرفة', 'AO1'): typ = 'long'
            else: continue
            pa = G['papers'].get(q['p'], {})
            out.append({'qid': 'f' + q['id'], 'lesson_id': q['l'], 'type': typ, 'stem': q.get('x', ''), 'img': q['im'], 'iw': q.get('w'), 'ih': q.get('h'),
                        'src': 'امتحان الوزارة ' + str(pa.get('year', '')) + (' - ' + pa['session'] if pa.get('session') else ''),
                        'answer': q.get('a', ''), 'choices': [], 'marks': m, 'ao': ao, 'difficulty': '', 'outcome': q.get('c', ''), 'notes': ''})
    return out
try:
    sha = subprocess.run(['git', 'rev-parse', '--short', 'HEAD'], cwd=HERE, capture_output=True, text=True).stdout.strip()
except Exception:
    sha = ''
BUILD = {'at': datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%d %H:%M UTC'), 'sha': sha}
for l in lessons:
    l.setdefault('ai_filled', [])
rd = lambda f: open(os.path.join(HERE, f), encoding='utf-8').read()
common = rd('common.js')
TOOL_VER = re.search(r'@version\s+(\S+)', rd('tahdir-noor.user.js')).group(1)
TOOL_FORCE = re.search(r"MIN_REQUIRED = '([^']+)'", rd('tahdir-noor.user.js')).group(1)
common = common.replace('__TOOLVER__', TOOL_VER).replace('__TOOLFORCE__', TOOL_FORCE)

extra_css = '''
/* ---------- هوية الكبسولة: بانر فاتح وألوان متناسقة ---------- */
.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.kb-banner{display:flex;align-items:center;justify-content:space-between;gap:12px;max-width:1200px;margin:0 auto;padding:10px 16px;box-sizing:border-box}
.kb-banner img{height:clamp(44px,8vw,78px);width:auto;display:block}
.kb-mid{display:flex;align-items:center;gap:12px;min-width:0}
.kb-mark .kb-logo{width:clamp(62px,10vw,104px);height:auto;display:block}
.kb-name{display:flex;flex-direction:column;align-items:center;line-height:1.1}
.kb-name b{font-family:"Cairo",var(--f-display);font-weight:800;font-size:clamp(1.6rem,4.6vw,2.7rem);color:#0b3b33}
.kb-name span{font-size:clamp(.78rem,1.8vw,1rem);font-weight:700;color:#c98a1e;margin-top:4px}
.top{color:#10261f!important;background:#fff!important;border-bottom:3px solid #e0a93b!important}
.top .helix{display:none}
.top .top-in{border-top:1px solid #ece9df;padding-block:10px 12px}
.top .by{color:#5b6d67}
.top .stat{background:#f6f4ee;border-color:#e2e0d6;color:#0b3b33}
.top .btn.ghost{background:#f6f4ee;border-color:#d9d6ca;color:#0b3b33}
.top .btn.ghost:hover{background:#e3f1eb;border-color:#1f8a70}
.whobar .btn[aria-current]{background:#e3f1eb!important;border-color:#1f8a70!important;color:#0b3b33}
.top .menu-btn{background:#0b3b33;color:#fff;border-color:#0b3b33}
.top .menu-btn:hover{background:#1f8a70}
.top .btn.pulse{color:#0b3b33}
.auth{color:#10261f!important;background:radial-gradient(900px 500px at 85% -10%,rgba(224,169,59,.18),transparent 60%),#f6f4ee!important}
.auth{grid-template-rows:auto 1fr}
.kb-band{grid-column:1/-1;background:#fff;border-bottom:3px solid #e0a93b}
.auth-brand h1{display:none}
.auth-brand .logo{width:auto;height:auto;background:none!important;border:0!important;margin-bottom:6px}
.auth-brand .logo .kb-logo{width:150px;height:auto}
.auth-brand h1{color:#0b3b33}
.auth-brand .school{border-color:#e0a93b;background:#fff;color:#0b3b33}
.auth-facts span{background:#fff;border-color:#e2e0d6;color:#0b3b33}
.auth-card{box-shadow:0 20px 60px rgba(11,59,51,.14)}
@media (max-width:860px){.auth-brand .logo .kb-logo{width:96px}}
@media (max-width:520px){.kb-banner{padding:8px 10px;gap:6px}.kb-mid{gap:6px}}
@media print{.kb-banner{display:none}}
.whobar{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.who{font-size:.86rem;opacity:.95;padding-inline-end:4px}
.ltr{direction:ltr;unicode-bidi:isolate}
.m-text.ltr{direction:ltr;text-align:left}
.modal-box h4{margin:16px 0 6px;font-size:.92rem;color:var(--main-d)}

/* ---------- lesson tabs ---------- */
.ltabs{display:flex;gap:6px;border-bottom:1px solid var(--line);margin:4px 0 14px}
.ltab{font:inherit;font-weight:700;font-size:.92rem;background:transparent;border:0;border-bottom:3px solid transparent;padding:8px 14px;color:var(--mute);cursor:pointer}
.ltab.on{color:var(--main-d);border-bottom-color:var(--main)}
.hw-mark{display:flex;align-items:center;gap:10px;margin:0 0 12px;font-size:.88rem}
.hw-mark input{width:90px;font:inherit;padding:6px 10px;border-radius:9px;border:1px solid var(--line);background:var(--bg);color:var(--ink);text-align:center}


/* ---------- get the app (highlighted) ---------- */
@keyframes glow{0%,100%{box-shadow:0 0 0 0 rgba(118,214,160,.55),0 10px 30px rgba(0,0,0,.18)}50%{box-shadow:0 0 0 7px rgba(118,214,160,0),0 10px 30px rgba(0,0,0,.18)}}
.get-app{width:min(420px,100%);border-radius:20px;padding:16px 18px;background:linear-gradient(135deg,#fff7d6,#e9fbf1);color:#10352c;border:2px solid #36b37e;animation:glow 2.2s ease-in-out infinite}
.get-app h3{margin:0 0 2px;font-size:1.05rem;display:flex;align-items:center;gap:8px}
.get-app p{margin:0 0 10px;font-size:.84rem;color:#3c5a52}
.get-app .ga-btns{display:flex;flex-wrap:wrap;gap:8px}
.get-app .ga-btn{display:inline-flex;align-items:center;gap:6px;font:inherit;font-weight:700;font-size:.88rem;padding:9px 14px;border-radius:12px;border:0;cursor:pointer;text-decoration:none;background:#0e7c66;color:#fff}
.get-app .ga-btn.alt{background:#fff;color:#0e7c66;border:1.5px solid #0e7c66}
.get-app details{margin-top:8px;font-size:.84rem}
.get-app summary{cursor:pointer;font-weight:700;color:#0e7c66}
.get-app ol{margin:6px 0 0;padding-inline-start:1.2em;line-height:1.9}
.auth-panel{gap:16px;align-content:center}
.app-bar{margin:14px auto 0;max-width:var(--maxw,1200px);padding:0 16px}
.app-bar .get-app{width:auto;display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap}
.app-bar .get-app p{margin:0}
.btn.pulse{animation:glow 2.2s ease-in-out infinite;border-color:#76d6a0!important;color:#fff}
@media (prefers-reduced-motion:reduce){.get-app,.btn.pulse{animation:none}}

/* ---------- login ---------- */
.auth{min-height:100vh;min-height:100dvh;display:grid;grid-template-columns:1.1fr 1fr;color:#fff;
  background:radial-gradient(1200px 600px at 85% -10%,rgba(95,174,60,.35),transparent 60%),linear-gradient(150deg,#042a22 0%,#07493b 45%,#0b6b56 100%)}
.auth-art{position:relative;overflow:hidden;display:flex;flex-direction:column;justify-content:center;padding:48px clamp(24px,5vw,72px);gap:18px}
.auth-art .big-helix{position:absolute;inset-inline-start:-6%;top:-10%;height:120%;width:auto;opacity:.5;pointer-events:none}
.big-helix path{fill:none;stroke:#bdf2dc;stroke-width:3;stroke-linecap:round}
.big-helix .s2{stroke:#8fd06a}
.big-helix .rg path{stroke:#ffffff;stroke-width:1.6;opacity:.55}
.auth-brand{position:relative;max-width:30rem}
.auth-brand .logo{width:60px;height:60px;border-radius:18px;margin-bottom:16px}
.auth-brand h1{font-family:var(--f-display);font-size:clamp(2.4rem,6vw,4rem);line-height:1.05;margin:0;font-weight:700}
.auth-brand p{margin:12px 0 0;font-size:1.02rem;opacity:.9;line-height:1.8}
.auth-brand .school{display:inline-block;margin-top:14px;padding:5px 14px;border-radius:999px;border:1px solid rgba(255,255,255,.3);background:rgba(255,255,255,.08);font-size:.86rem}
.auth-facts{position:relative;display:flex;flex-wrap:wrap;gap:8px;margin-top:6px}
.auth-facts span{font-size:.8rem;padding:4px 12px;border-radius:999px;background:rgba(0,0,0,.18);border:1px solid rgba(255,255,255,.14)}
.auth-panel{display:grid;place-items:center;padding:32px 16px}
.auth-card{width:min(420px,100%);background:var(--paper);color:var(--ink);border-radius:24px;padding:30px 26px 26px;box-shadow:0 30px 80px rgba(0,0,0,.35);border:1px solid rgba(255,255,255,.4)}
.auth-card h2{font-family:var(--f-display);font-weight:600;font-size:1.6rem;margin:0 0 4px}
.auth-card .lead{margin:0 0 20px;color:var(--mute);font-size:.9rem}
.fld{display:grid;gap:6px;margin-bottom:14px}
.fld label{font-size:.85rem;font-weight:600}
.fld input{font:inherit;font-size:1rem;padding:11px 14px;border-radius:12px;border:1.5px solid var(--line);background:var(--bg);color:var(--ink);width:100%}
.fld input:focus{outline:none;border-color:var(--main);box-shadow:0 0 0 4px color-mix(in srgb,var(--main) 18%,transparent)}
.pw{position:relative}
.pw input{padding-inline-end:76px}
.pw button{position:absolute;inset-inline-end:8px;top:50%;transform:translateY(-50%);border:0;background:transparent;color:var(--main-d);font:inherit;font-size:.8rem;cursor:pointer;padding:4px 8px}
.go{width:100%;justify-content:center;padding:12px;font-size:1rem;border-radius:12px;margin-top:4px}
.err{background:color-mix(in srgb,var(--danger) 12%,var(--paper));color:var(--danger);border-radius:10px;padding:9px 12px;font-size:.86rem;margin-bottom:12px;border:1px solid color-mix(in srgb,var(--danger) 35%,transparent)}
.auth-foot{margin-top:16px;font-size:.78rem;color:var(--mute);text-align:center}
.shake{animation:shake .35s}
@keyframes shake{20%,60%{transform:translateX(-7px)}40%,80%{transform:translateX(7px)}}
@media (prefers-reduced-motion:no-preference){
  .big-helix path{stroke-dasharray:2400;stroke-dashoffset:2400;animation:draw 2.2s cubic-bezier(.6,.1,.2,1) forwards}
  .big-helix .s2{animation-delay:.25s}
  .big-helix .rg path{stroke-dasharray:none;stroke-dashoffset:0;opacity:0;animation:fadeIn .8s 1.3s forwards}
  .auth-brand>*,.auth-facts{opacity:0;transform:translateY(14px);animation:rise .7s cubic-bezier(.2,.7,.2,1) forwards}
  .auth-brand>*:nth-child(1){animation-delay:.15s}.auth-brand>*:nth-child(2){animation-delay:.3s}.auth-brand>*:nth-child(3){animation-delay:.42s}.auth-brand>*:nth-child(4){animation-delay:.54s}
  .auth-facts{animation-delay:.7s}
  .auth-card{opacity:0;transform:translateY(24px) scale(.98);animation:rise .8s .45s cubic-bezier(.2,.7,.2,1) forwards}
  body.leaving .auth{transition:opacity .4s;opacity:0}
}
@keyframes draw{to{stroke-dashoffset:0}}
@keyframes fadeIn{to{opacity:.55}}
@keyframes rise{to{opacity:1;transform:none}}
@media (max-width:860px){
  .auth{grid-template-columns:1fr}
  .auth-art{padding:36px 20px 8px;min-height:auto}
  .auth-art .big-helix{inset-inline-start:auto;inset-inline-end:-20%;height:150%;opacity:.28}
  .auth-brand p{font-size:.95rem}
  .auth-panel{padding:18px 16px 36px;align-items:start}
}

/* ---------- admin ---------- */
.dash{padding-block:22px 60px;display:grid;gap:18px}
.kpis{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px}
.kpi{background:var(--paper);border:1px solid var(--line);border-radius:16px;padding:14px 16px;display:flex;flex-direction:column;gap:2px;box-shadow:var(--shadow)}
.kpi-n{font-family:var(--f-display);font-size:2rem;font-weight:700;color:var(--main-d);font-variant-numeric:tabular-nums;line-height:1.1}
.kpi-l{font-size:.82rem;color:var(--mute)}
.kpi.warn .kpi-n{color:var(--danger)}
.tabs{display:flex;gap:6px;border-bottom:1px solid var(--line)}
.tab{font:inherit;font-weight:600;font-size:.92rem;background:transparent;border:0;border-bottom:3px solid transparent;padding:8px 14px;color:var(--mute);cursor:pointer}
.tab.on{color:var(--main-d);border-bottom-color:var(--main)}
.toolbar{display:flex;gap:10px;flex-wrap:wrap;align-items:center}
.toolbar input{flex:1 1 220px;min-width:0;font:inherit;padding:9px 12px;border-radius:10px;border:1px solid var(--line);background:var(--paper);color:var(--ink)}
.t-wrap{overflow-x:auto;background:var(--paper);border:1px solid var(--line);border-radius:16px;box-shadow:var(--shadow)}
.tbl{width:100%;border-collapse:collapse;font-size:.88rem;min-width:820px}
.tbl th{text-align:right;font-weight:700;font-size:.78rem;color:var(--mute);padding:10px 12px;border-bottom:1px solid var(--line);background:color-mix(in srgb,var(--main-l) 50%,var(--paper))}
.tbl td{padding:10px 12px;border-bottom:1px solid var(--line);vertical-align:top}
.tbl tr:last-child td{border-bottom:0}
.num{font-variant-numeric:tabular-nums;font-weight:700}
.sub{font-size:.76rem;color:var(--mute);font-weight:400}
.link-btn{background:none;border:0;padding:0;font:inherit;color:var(--ink);cursor:pointer;text-align:right}
.link-btn:hover b{color:var(--main-d);text-decoration:underline}
.pill{display:inline-block;font-size:.7rem;font-weight:700;padding:1px 9px;border-radius:999px;vertical-align:middle}
.pill.off{background:color-mix(in srgb,var(--danger) 14%,var(--paper));color:var(--danger)}
.pill.adm{background:var(--main-l);color:var(--main-d)}
.pill.warn{background:color-mix(in srgb,var(--danger) 14%,var(--paper));color:var(--danger)}
.chip-s{display:inline-block;font-size:.74rem;padding:1px 8px;margin:1px;border-radius:999px;background:var(--main-l);color:var(--main-d)}
.empty-state{background:var(--paper);border:1px dashed var(--line);border-radius:16px;padding:28px;text-align:center;color:var(--mute)}
.two{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.card{background:var(--paper);border:1px solid var(--line);border-radius:16px;padding:14px 16px;box-shadow:var(--shadow);min-width:0}
.card h3{margin:0 0 6px;font-size:1rem}
.feed{list-style:none;margin:0;padding:0;max-height:560px;overflow:auto;font-size:.84rem}
.feed li{padding:7px 0;border-bottom:1px solid var(--line);line-height:1.6}
.feed li.bad{background:color-mix(in srgb,var(--danger) 9%,transparent);border-radius:8px;padding-inline:8px}
.ev-t{display:inline-block;min-width:8.5em;color:var(--mute);font-size:.76rem;font-variant-numeric:tabular-nums}
.dev{font-size:.72rem;color:var(--mute);border:1px solid var(--line);border-radius:999px;padding:0 7px}
.t-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:6px 0 4px}
.t-stats div{background:var(--main-l);border-radius:12px;padding:8px;text-align:center;display:flex;flex-direction:column}
.t-stats b{font-size:1.3rem;color:var(--main-d);font-variant-numeric:tabular-nums}
.t-stats span{font-size:.74rem;color:var(--mute)}
.alert{margin-top:10px;background:color-mix(in srgb,var(--danger) 12%,var(--paper));color:var(--danger);border-radius:10px;padding:8px 12px;font-size:.84rem}
.devs,.toplist{list-style:none;margin:0;padding:0;font-size:.86rem}
.devs li{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--line)}
.toplist li{padding:4px 0}
.acts{display:flex;flex-wrap:wrap;gap:6px}
@media (max-width:900px){.kpis{grid-template-columns:repeat(2,minmax(0,1fr))}.two{grid-template-columns:1fr}.t-stats{grid-template-columns:repeat(2,1fr)}}

/* ---------- admin report ---------- */
.seg-r{display:flex;gap:6px;flex-wrap:wrap;flex:1}
.bars{display:flex;align-items:flex-end;gap:3px;height:120px;padding:6px 0;border-bottom:1px solid var(--line);direction:ltr}
.bar{flex:1;height:100%;display:flex;align-items:flex-end}
.bar span{display:block;width:100%;background:var(--main);border-radius:3px 3px 0 0;min-height:3px}
.bar:hover span{background:var(--accent)}

/* ---------- games ---------- */
.btn.games-link{background:#e9e1ff;border-color:#b9a4f5;color:#3b1d8f;font-weight:700}
.btn.games-link:hover{background:#ddd0ff}
.g-home{display:grid;gap:14px}
.g-intro{background:linear-gradient(120deg,#2b1166,#5b2bb8 55%,#0c7a63);color:#fff;border-radius:20px;padding:18px 20px;box-shadow:var(--shadow)}
.g-intro h2{margin:0 0 4px;font-family:var(--f-display);font-size:1.5rem}
.g-intro p{margin:0;opacity:.92;font-size:.92rem}
.g-cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:12px}
.g-card{display:flex;flex-direction:column;gap:6px;text-align:right;font:inherit;color:var(--ink);background:var(--paper);border:1px solid var(--line);border-radius:18px;padding:14px;cursor:pointer;box-shadow:var(--shadow);transition:transform .15s,border-color .15s}
.g-card:hover{transform:translateY(-2px);border-color:var(--main)}
.g-card.off{opacity:.55}
.g-ic{font-size:2rem;line-height:1}
.g-card b{font-size:1.02rem}
.g-desc{font-size:.82rem;color:var(--mute);line-height:1.6;flex:1}
.g-tags{display:flex;flex-wrap:wrap;gap:4px}
.tag{font-size:.7rem;font-weight:700;border-radius:999px;padding:1px 9px;background:var(--main-l);color:var(--main-d)}
.tag.good{background:#e1f7e7;color:#13723a}
.tag.warn{background:var(--accent-l);color:var(--accent)}
.teams-ed{display:grid;gap:6px}
.team-row{display:flex;align-items:center;gap:6px}
.team-row input{flex:1;min-width:0;font:inherit;font-size:.86rem;padding:5px 9px;border-radius:9px;border:1px solid var(--line);background:var(--bg);color:var(--ink)}
.team-row .x{border:0;background:transparent;color:var(--danger);font-size:1.1rem;cursor:pointer}
.tdot{width:12px;height:12px;border-radius:50%;flex:0 0 12px}
.lp-uh label{display:flex;gap:6px;align-items:center;cursor:pointer}
.g-stage{background:var(--paper);border:1px solid var(--line);border-radius:20px;box-shadow:var(--shadow);overflow:auto;min-height:70vh;display:flex;flex-direction:column}
.g-stage:fullscreen{border-radius:0;padding:10px 20px;font-size:1.25rem}
.g-bar{display:flex;align-items:center;gap:10px;padding:10px 14px;border-bottom:1px solid var(--line)}
.g-title{flex:1;text-align:center;font-family:var(--f-display);font-size:1.1rem}
.g-score{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;padding:8px 10px 0}
.g-score:empty{display:none}
.sc{display:flex;align-items:center;gap:8px;border-radius:14px;padding:6px 12px;background:color-mix(in srgb,var(--tc) 14%,var(--paper));border:2px solid var(--tc)}
.sc-n{font-weight:700}
.sc-v{font-family:var(--f-display);font-size:1.4rem;font-weight:700;color:var(--tc);min-width:2ch;text-align:center;font-variant-numeric:tabular-nums}
.sc-b{display:flex;gap:4px}
.sc-b button{font:inherit;font-weight:700;border:0;border-radius:8px;padding:4px 8px;cursor:pointer;background:var(--tc);color:#fff}
.sc-b button+button{background:#888}
.gm-body{padding:16px;flex:1}
.g-setup{max-width:460px;margin:20px auto;display:grid;gap:10px}
.g-setup input,.wh-left input{width:90px;font:inherit;padding:6px 10px;border-radius:9px;border:1px solid var(--line);background:var(--bg);color:var(--ink);text-align:center}
.btn.big{font-size:1.1rem;padding:12px 26px;justify-content:center}
.g-stem{font-size:clamp(1.1rem,2.2vw,1.6rem);font-weight:700;line-height:1.7;margin:6px 0 12px;text-align:start}
.g-table{border-collapse:collapse;margin:6px auto 12px;font-size:.95em}
.g-table th,.g-table td{border:1px solid var(--line);padding:5px 12px;text-align:center}
.g-table th{background:var(--main-l)}
.g-table caption{font-weight:700;padding:3px}
.lv-top{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:6px}
.lv-n,.jp-v{font-weight:700;color:var(--mute)}
.lv-ans{font-weight:700;color:var(--main-d)}
.g-timer{position:relative;width:62px;height:62px}
.g-timer svg{width:100%;height:100%;transform:rotate(-90deg)}
.tr-bg{fill:none;stroke:var(--line);stroke-width:3.5}
.tr-fg{fill:none;stroke:var(--main);stroke-width:3.5;stroke-linecap:round;transition:stroke-dasharray .2s linear}
.g-timer span{position:absolute;inset:0;display:grid;place-items:center;font-family:var(--f-display);font-size:1.3rem;font-weight:700}
.lv-opts{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:10px 0}
.lv-opt{display:flex;align-items:center;gap:10px;font:inherit;font-size:clamp(1rem,1.8vw,1.3rem);font-weight:700;color:#fff;text-align:start;border:0;border-radius:14px;padding:14px 16px;min-height:64px;position:relative;cursor:default}
button.lv-opt{cursor:pointer}
.lv-opt .sh{font-size:1.3em;opacity:.9}
.o0{background:#e21b3c}.o1{background:#1368ce}.o2{background:#c78a00}.o3{background:#26890c}
.lv-opt.right{outline:5px solid #fff;box-shadow:0 0 0 9px #26b04a}
.lv-opts.rev .lv-opt.wrong,.lv-opt.gone{opacity:.35}
.lv-opt.pick{outline:4px dashed #fff}
.lv-opt.wrongpick{filter:grayscale(.6);outline:5px solid #222}
.lv-bar{position:absolute;inset-inline:12px;bottom:6px;height:8px;background:rgba(255,255,255,.3);border-radius:6px;display:flex;align-items:center}
.lv-bar i{display:block;height:100%;background:#fff;border-radius:6px}
.lv-bar em{position:absolute;inset-inline-end:-2px;bottom:10px;font-style:normal;font-size:.8rem}
.lv-lobby{display:grid;gap:16px;justify-items:center;text-align:center}
.lv-join{display:flex;gap:24px;align-items:center;flex-wrap:wrap;justify-content:center}
.lv-qr{background:#fff;padding:8px;border-radius:14px;box-shadow:var(--shadow)}
.lv-url{font-size:1.4rem;font-weight:700;color:var(--main-d);margin:0}
.lv-code{font-family:var(--f-display);font-size:clamp(2.6rem,7vw,4.5rem);font-weight:700;letter-spacing:6px;margin:0;color:#3b1d8f}
.lv-players .chips{display:flex;flex-wrap:wrap;gap:6px;justify-content:center;margin-top:6px;max-width:900px}
.lv-lead{max-width:520px;margin:10px auto;display:grid;gap:4px}
.lv-lead.full{max-height:40vh;overflow:auto}
.lr{display:grid;grid-template-columns:34px 1fr auto;gap:8px;align-items:center;background:var(--bg);border-radius:10px;padding:6px 12px}
.lr span:first-child{font-weight:700;color:var(--mute)}
.podium{display:flex;align-items:flex-end;justify-content:center;gap:10px;margin:10px 0 16px}
.pd{display:flex;flex-direction:column;align-items:center;gap:4px;width:150px}
.pd-n{font-weight:700;font-size:1.1rem}
.pd-s{color:var(--mute)}
.pd-b{width:100%;border-radius:12px 12px 0 0;color:#fff;font-family:var(--f-display);font-size:2rem;display:grid;place-items:center}
.p0 .pd-b{height:150px;background:#d4a017}.p1 .pd-b{height:110px;background:#9aa4ad}.p2 .pd-b{height:80px;background:#b0703c}
.jp{display:grid;grid-template-columns:repeat(var(--cols),minmax(0,1fr));gap:8px}
.jp-h{background:#3b1d8f;color:#fff;border-radius:12px;padding:10px 8px;text-align:center;font-weight:700;font-size:.92rem;display:grid;place-items:center;min-height:64px}
.jp-t{font:inherit;font-family:var(--f-display);font-size:clamp(1.4rem,3vw,2.2rem);font-weight:700;color:#ffd84d;background:#1d3fa0;border:0;border-radius:12px;min-height:76px;cursor:pointer;box-shadow:inset 0 -4px 0 rgba(0,0,0,.25)}
.jp-t:hover{background:#2850c4}
.jp-t.done{background:var(--bg);box-shadow:none;cursor:default}
.jp-q{max-width:980px;margin:0 auto}
.jp-ans{background:#e1f7e7;color:#0f4d2a;border-radius:12px;padding:10px 14px;margin:10px 0;font-size:1.05rem}
.jp-act{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}
.g-win{text-align:center;font-size:3rem;padding:30px 10px}
.g-win h2{font-family:var(--f-display);font-size:1.8rem;margin:6px 0}
.g-win p{font-size:1.1rem}
.g-win.small{font-size:1.2rem;padding:10px;display:flex;gap:12px;justify-content:center;align-items:center;background:var(--accent-l);border-radius:14px;margin-bottom:10px}
.mil{display:grid;grid-template-columns:1fr 180px;gap:16px}
.ladder{list-style:none;margin:0;padding:0;display:grid;gap:3px;align-content:start}
.ladder li{padding:5px 12px;border-radius:8px;font-weight:700;color:var(--mute);background:var(--bg);font-variant-numeric:tabular-nums}
.ladder li.safe{color:#b07800}
.ladder li.won{color:#26890c}
.ladder li.on{background:#d89e00;color:#fff}
.life{display:flex;gap:8px;flex-wrap:wrap}
.esc-story{font-weight:700;color:var(--main-d);flex:1}
.locks{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin:10px 0}
.lock{display:flex;flex-direction:column;align-items:center;gap:2px;font:inherit;background:#2a2f3a;color:#fff;border:0;border-radius:14px;padding:10px 16px;min-width:100px;cursor:pointer}
.lock.open{background:#26890c}
.lock .lk{font-size:2rem}
.lock .dg{font-family:var(--f-display);font-size:1.8rem}
.esc-final{text-align:center;margin-top:12px}
.esc-final input{font:inherit;font-size:2rem;letter-spacing:10px;width:220px;text-align:center;border-radius:12px;border:2px solid var(--line);background:var(--bg);color:var(--ink);padding:6px}
.g-hint{text-align:center;font-size:1.05rem}
.mem{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px}
.mc{font:inherit;border:0;border-radius:14px;min-height:120px;cursor:pointer;background:#3b1d8f;color:#fff;padding:10px;position:relative;font-size:.92rem;line-height:1.5}
.mc.a{background:#0c6b56}
.mc .mc-b{display:none}
.mc .mc-f{font-size:2rem}
.mc.up{background:#fff;color:var(--ink);border:2px solid #3b1d8f}
.mc.up .mc-f{display:none}
.mc.up .mc-b{display:block}
.mc.done{border-color:var(--tc);background:color-mix(in srgb,var(--tc) 12%,#fff);opacity:.8}
.ws{display:grid;grid-template-columns:auto minmax(180px,1fr);gap:16px;align-items:start;justify-content:center}
.ws-grid{display:grid;grid-template-columns:repeat(var(--n),minmax(26px,42px));gap:3px}
.ws-c{font:inherit;font-weight:700;font-size:clamp(.95rem,1.8vw,1.35rem);aspect-ratio:1;border:1px solid var(--line);border-radius:6px;background:var(--bg);color:var(--ink);cursor:pointer;padding:0}
.ws-c.s{background:#ffd84d;color:#000}
.ws-c.f{background:#26890c;color:#fff;border-color:#26890c}
.ws-list{display:flex;flex-wrap:wrap;gap:6px;align-content:start}
.ws-list b{width:100%}
.ws-list span.w{background:var(--main-l);border-radius:999px;padding:2px 10px;font-weight:700}
.ws-list span.w.got{text-decoration:line-through;opacity:.5}
.wh{display:grid;grid-template-columns:minmax(260px,380px) 1fr;gap:20px;align-items:start}
.wh-left{display:grid;gap:10px;justify-items:center}
.wh-wrap{position:relative;width:100%;max-width:360px}
.wh-svg{width:100%;height:auto;display:block}
.wh-ptr{position:absolute;top:-6px;left:50%;transform:translateX(-50%);font-size:1.8rem;color:#10261f}
.wh-who{font-size:1.4rem;margin-bottom:8px}
.wh-who b{font-family:var(--f-display);font-size:2rem;color:#3b1d8f}
.fc-wrap{max-width:820px;margin:0 auto;display:grid;gap:10px}
.fc-n{text-align:center;color:var(--mute)}
.fc{font:inherit;color:var(--ink);text-align:start;min-height:260px;border-radius:20px;border:2px solid #3b1d8f;background:var(--paper);padding:20px;cursor:pointer;box-shadow:var(--shadow)}
.fc .fc-back{display:none}
.fc.flip .fc-front{display:none}
.fc.flip .fc-back{display:block;font-size:1.2rem;line-height:1.8}
.fc.flip{background:#e1f7e7;border-color:#26890c;color:#0f4d2a}
.fc-ch{margin:0 0 8px;font-size:1.05rem}
.fc-act{display:flex;gap:10px;justify-content:center}
@media (max-width:900px){.mil,.wh,.ws{grid-template-columns:1fr}.lv-opts{grid-template-columns:1fr}.jp-t{min-height:56px}}

/* ---------- teen games ---------- */
.g-sec{margin:6px 0 -4px;font-size:1rem;color:#3b1d8f;grid-column:1/-1}
.claim{font-size:clamp(1.2rem,2.4vw,1.8rem);font-weight:700;line-height:1.8;background:var(--bg);border-inline-start:6px solid #3b1d8f;border-radius:12px;margin:10px 0 14px;padding:16px 20px}
.tp{display:grid;gap:8px;margin:10px 0}
.tp-row{display:flex;align-items:center;gap:10px;flex-wrap:wrap;border:2px solid var(--tc);border-radius:14px;padding:8px 12px;background:color-mix(in srgb,var(--tc) 8%,var(--paper))}
.tp-n{font-weight:700;min-width:110px;color:var(--tc)}
.tp-o,.tp-bet{display:flex;gap:6px;flex-wrap:wrap}
.tp-bet{margin-inline-start:auto;align-items:center;font-size:.85rem;color:var(--mute)}
.tp button{font:inherit;font-weight:700;border:2px solid var(--line);background:var(--paper);color:var(--ink);border-radius:10px;padding:6px 14px;cursor:pointer;min-width:52px}
.tp button.on{background:var(--tc);border-color:var(--tc);color:#fff}
.tp button.right{box-shadow:0 0 0 3px #26b04a}
.jp-ans.myth-x{background:#fde8e6;color:#7a1d12}
.seq-pool{display:grid;gap:8px;margin:10px 0}
.seq-c{display:flex;align-items:center;gap:10px;font:inherit;font-size:clamp(1rem,1.7vw,1.2rem);text-align:start;border:2px solid var(--line);background:var(--paper);color:var(--ink);border-radius:12px;padding:10px 14px;cursor:pointer;line-height:1.6}
.seq-c.on{border-color:#3b1d8f;background:#efe9ff}
.seq-c.ok{border-color:#26890c;background:#e1f7e7}
.seq-c.no{border-color:#e21b3c;background:#fde8e6}
.seq-n{flex:0 0 30px;height:30px;border-radius:50%;display:grid;place-items:center;background:#3b1d8f;color:#fff;font-weight:700}
.case-pts{font-size:1.1rem}.case-pts b{color:#b07800;font-size:1.4rem}
.clues{display:grid;gap:6px;margin:8px 0}
.clue{background:#fff8e1;border-inline-start:5px solid #d89e00;border-radius:10px;padding:8px 12px;color:#4a3b00}
.lk-pair{display:flex;align-items:stretch;justify-content:center;gap:14px;flex-wrap:wrap;margin:24px 0 10px}
.lk-a{background:#3b1d8f;color:#fff;border-radius:18px;padding:22px 26px;font-size:clamp(1.3rem,2.6vw,2rem);font-weight:700;min-width:220px;text-align:center;display:grid;place-items:center}
.lk-a.b{background:#0c6b56}
.lk-mid{font-size:2.4rem;display:grid;place-items:center;color:var(--mute)}

/* ---------- play (students' phones) ---------- */
.pl{min-height:100vh;min-height:100dvh;background:linear-gradient(160deg,#2b1166,#5b2bb8 60%,#0c7a63);padding:14px;display:flex;flex-direction:column;gap:12px}
.pl-card{background:#fff;color:#10261f;border-radius:20px;padding:20px;max-width:460px;width:100%;margin:auto;display:grid;gap:12px;box-shadow:0 20px 50px rgba(0,0,0,.3)}
.pl-card.c{text-align:center}
.pl-card h1{margin:0;font-family:var(--f-display);font-size:1.5rem;text-align:center}
.pl-card h2{margin:0;font-family:var(--f-display)}
.pl-card label{display:grid;gap:4px;font-weight:700}
.pl-card input{font:inherit;font-size:1.3rem;padding:12px;border-radius:12px;border:2px solid #d4e5de;text-align:center}
.pl-go{font:inherit;font-size:1.2rem;font-weight:700;border:0;border-radius:14px;padding:14px;background:#26890c;color:#fff;cursor:pointer}
.pl-err{background:#fde8e6;color:#b23a2b;border-radius:10px;padding:8px;margin:0}
.pl-big{font-size:3.5rem;line-height:1}
.pl-card.ok{border:4px solid #26890c}.pl-card.bad{border:4px solid #e21b3c}
.pl-rank{font-size:1.3rem;font-weight:700;color:#3b1d8f}
.pl-head{display:flex;justify-content:space-between;color:#fff;font-weight:700;background:rgba(0,0,0,.2);border-radius:12px;padding:8px 14px}
.pl-q{display:grid;gap:10px;color:#fff}
.pl-meta{text-align:center;opacity:.9}
.pl-stem{background:#fff;color:#10261f;border-radius:14px;padding:12px 14px;font-weight:700;line-height:1.7}
.pl-q .g-table{background:#fff;color:#10261f}
.pl-opts{display:grid;gap:10px}
.pl-o{display:flex;align-items:center;gap:10px;font:inherit;font-size:1.1rem;font-weight:700;color:#fff;border:0;border-radius:14px;padding:16px;min-height:70px;text-align:start;cursor:pointer}
.pl-o span{font-size:1.4rem}
.pl-o:disabled{opacity:.5}.pl-o.sel{opacity:1;outline:4px solid #fff}

/* ---------- subject switch ---------- */
.subj-pick{display:flex;align-items:center;gap:8px;margin:0 2px 12px;background:var(--bg);border:1px solid var(--line);border-radius:14px;padding:6px 10px}
.subj-pick .subj-ic{font-size:1.35rem}
.subj-pick .subj-l{font-size:.78rem;color:var(--mute);font-weight:700}
.subj-pick select{flex:1;min-width:0;font:inherit;font-weight:700;font-size:.92rem;border:0;background:transparent;color:var(--ink);padding:4px 2px;cursor:pointer}
.subj-sw{display:flex;gap:4px;margin:0 2px 12px;background:var(--bg);border:1px solid var(--line);border-radius:12px;padding:3px}
.subj-sw button{flex:1;font:inherit;font-size:.86rem;font-weight:700;border:0;border-radius:9px;padding:8px 6px;background:transparent;color:var(--mute);cursor:pointer}
.subj-sw button.on{background:var(--main);color:#fff}
.field[dir=auto]{text-align:start}

/* ---------- nav to assessment ---------- */
.btn.quiz-link{background:#fff4d6;border-color:#f2c66d;color:#5b3d00;font-weight:700}
.btn.quiz-link:hover{background:#ffe9ad}

/* ---------- assessment page ---------- */
.qlayout{display:grid;grid-template-columns:340px minmax(0,1fr);gap:22px;align-items:start;padding-block:22px 60px}
.qside{display:grid;gap:12px;position:sticky;top:12px;max-height:calc(100vh - 24px);overflow:auto;padding-bottom:4px}
.qcard{background:var(--paper);border:1px solid var(--line);border-radius:16px;padding:12px 14px;box-shadow:var(--shadow)}
.qcard h3{margin:0 0 8px;font-size:.95rem;color:var(--main-d)}
.qsel,.hdr-f input,.hdr-f select,.ed input,.ed select,.ed textarea{width:100%;font:inherit;font-size:.88rem;padding:7px 10px;border-radius:10px;border:1px solid var(--line);background:var(--bg);color:var(--ink)}
.ed textarea{resize:vertical;line-height:1.7}
.qsel.sm{width:auto;min-width:90px}
.cpick{display:flex;flex-wrap:wrap;gap:8px}.cp-l{flex:1 1 150px;display:flex;flex-direction:column;gap:3px;font-size:.8rem;color:var(--muted)}.cp-l[hidden]{display:none}.cp-l .qsel{width:100%;min-width:0;font-weight:600}.gr-row .cpick{flex:1 1 320px}
.qrow{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:8px 0;font-size:.88rem}
.small{font-size:.78rem}
.seg{display:flex;gap:4px;margin-top:10px;background:var(--bg);border:1px solid var(--line);border-radius:12px;padding:3px}
.seg button{flex:1;font:inherit;font-size:.84rem;font-weight:700;border:0;border-radius:9px;padding:7px 6px;background:transparent;color:var(--mute);cursor:pointer}
.seg button.on{background:var(--main);color:#fff}
.seg.sm{margin:0 0 10px}
.lpick{max-height:46vh;overflow:auto;margin:0 -4px;padding:0 4px}
.lp-uh{font-size:.8rem;font-weight:700;color:var(--mute);margin:8px 0 2px}
.lp-l{display:flex;align-items:center;gap:8px;font-size:.86rem;padding:4px 6px;border-radius:8px;cursor:pointer;line-height:1.4}
.lp-l:hover{background:var(--main-l)}
.lp-l span:nth-child(2){flex:1}
.lp-l.dim{opacity:.5;cursor:default}
.lp-l input{accent-color:var(--main);width:17px;height:17px}
.go-btn{width:100%;justify-content:center;margin-top:8px;padding:10px}
.hdr-f{display:grid;gap:8px}
.hdr-f label{display:grid;gap:3px;font-size:.78rem;color:var(--mute)}
.saved{list-style:none;margin:0;padding:0;font-size:.85rem;max-height:240px;overflow:auto}
.saved li{display:flex;align-items:center;gap:6px;padding:6px 0;border-bottom:1px solid var(--line)}
.saved li .link-btn{flex:1;min-width:0;text-align:right}
.saved .x{border:0;background:transparent;color:var(--danger);font-size:1.1rem;cursor:pointer;padding:0 4px}
.qwel{text-align:center}
.qbar{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;background:var(--paper);border:1px solid var(--line);border-radius:16px;padding:10px 14px;box-shadow:var(--shadow);margin-bottom:10px}
.qbar-t{flex:1 1 260px;min-width:0}
.title-in.sm{font-size:1.05rem;width:100%;margin:0}
.qbar-b{display:flex;gap:6px;flex-wrap:wrap}
.checks{border-radius:14px;padding:8px 14px;margin-bottom:10px;font-size:.84rem;border:1px solid}
.checks.ok{background:color-mix(in srgb,var(--main-l) 70%,var(--paper));border-color:color-mix(in srgb,var(--main) 35%,transparent)}
.checks.warn{background:var(--accent-l);border-color:color-mix(in srgb,var(--accent) 45%,transparent)}
.checks ul{list-style:none;margin:4px 0 0;padding:0;display:flex;flex-wrap:wrap;gap:4px 16px}
.checks li.n{color:var(--danger);font-weight:700}
.ptabs{display:flex;gap:6px;margin:4px 0 0}
.paper{background:#fff;color:#000;border-radius:4px;box-shadow:0 2px 14px rgba(0,0,0,.18);padding:28px 34px 36px;font-family:"Simplified Arabic","Traditional Arabic","Cairo",Tahoma,serif;font-size:16px;line-height:1.75;-webkit-user-select:text;user-select:text;max-width:900px;margin:0 auto}
.paper .oval,#printArea .oval{display:inline-block;width:22px;height:13px;border:1.5px solid #555;border-radius:8px;vertical-align:middle}
.qi{position:relative;border-radius:8px}
.paper .qi:hover{outline:2px dashed #b9d8cf;outline-offset:6px}
.qctl{display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;background:#f1f7f4;border-radius:8px;padding:3px 8px;margin:0 0 6px;font-family:var(--f-body);font-size:.74rem;color:#58726a}
.qctl .qbtns{display:flex;gap:4px;flex-wrap:wrap}
.qctl .btn.small{padding:2px 8px;font-size:.74rem;background:#fff;color:#10261f}
.qctl .btn.danger{color:#b23a2b}
.modal-box.wide{width:min(760px,96vw);max-height:90vh;overflow:auto}
.ed{display:grid;gap:10px}
.ed label{display:grid;gap:3px;font-size:.8rem;color:var(--mute)}
.ed-row{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px}
.ed-row .grow{grid-column:span 2}
.ed-ch{display:flex;align-items:center;gap:8px;margin:4px 0}
.ed-ch input[type=radio]{width:18px;height:18px;accent-color:var(--main)}
.picker{list-style:none;margin:0;padding:0;max-height:60vh;overflow:auto}
.pk{display:block;width:100%;text-align:right;font:inherit;font-size:.88rem;line-height:1.6;background:var(--bg);border:1px solid var(--line);border-radius:10px;padding:8px 10px;margin:0 0 6px;cursor:pointer;color:var(--ink)}
.pk:hover{border-color:var(--main)}
.pk-m{display:block;font-size:.74rem;color:var(--mute)}
.parts{display:grid;gap:8px;margin:8px 0}
.parts label{display:flex;gap:8px;align-items:center;font-size:.92rem}
#printArea{display:none}
.pseudo-fs{position:fixed!important;inset:0!important;z-index:9999!important;width:100vw!important;height:100vh!important;max-width:none!important;margin:0!important;border-radius:0!important;overflow:auto!important;background:var(--bg,#fff)}body.pseudo-fs-on{overflow:hidden}
.fin-units{display:flex;flex-direction:column;gap:6px}.fin-u{display:grid;grid-template-columns:auto 1fr auto;gap:8px;align-items:center;text-align:start;font:inherit;font-size:.86rem;padding:8px 10px;border:1px solid var(--line);border-radius:10px;background:var(--bg);color:var(--ink);cursor:pointer}
.fin-u span{color:var(--muted)}.fin-u em{font-style:normal;font-size:.78rem;color:var(--muted)}.fin-u.on{border-color:var(--brand,#0e7c66);background:color-mix(in srgb,var(--brand,#0e7c66) 10%,var(--bg));}
.fin-head h2{margin:0 0 2px}.fin-lesson h3{margin:18px 0 8px;font-size:1rem;border-inline-start:4px solid var(--brand,#0e7c66);padding-inline-start:8px}
.fin-q{border:1px solid var(--line);border-radius:12px;padding:10px;margin:0 0 12px;background:var(--card,#fff)}.fin-q header{display:flex;flex-wrap:wrap;gap:5px;align-items:center;margin-bottom:8px}
.fin-q .chip{font-size:.74rem;padding:2px 8px;border-radius:999px;background:var(--bg);border:1px solid var(--line);color:var(--muted)}.fin-q .chip.strong{color:var(--ink);font-weight:700}.fin-q .chip.lesson{color:var(--brand,#0e7c66)}
.fin-q img{display:block;width:100%;max-width:780px;margin:0 auto;height:auto;background:#fff;border-radius:6px}.fin-pick{margin-inline-end:4px}
.fin-ans{margin-top:8px;font-size:.9rem}.fin-ans summary{cursor:pointer;font-weight:700;color:var(--brand,#0e7c66)}.fin-a{padding:6px 10px;border-inline-start:3px solid var(--line);margin-top:6px;line-height:1.7}
#printArea .fin-pq{page-break-inside:avoid;margin:0 0 10px}#printArea .fin-pq img{max-width:100%}#printArea .fin-pn{font-weight:bold;font-size:12pt}#printArea .fin-pn small{font-weight:normal;font-size:9pt;color:#555}
@media print{
  @page{size:A4;margin:0}
  #printArea .prw{width:100%;border-collapse:collapse}#printArea .prw>thead>tr>td,#printArea .prw>tfoot>tr>td,#printArea .prw>tbody>tr>td{padding:0 12mm;border:0}#printArea .prsp{height:11mm}
  body.printing>*:not(#printArea){display:none!important}
  body.printing #printArea{display:block!important;color:#000;font-family:"Simplified Arabic","Traditional Arabic","Cairo",Tahoma,serif;font-size:14pt;line-height:1.6}
  body.printing{background:#fff!important}
  #printArea .ppage+.ppage{page-break-before:always}
  .no-print{display:none!important}
}
@media (max-width:900px){.qlayout{grid-template-columns:1fr}.qside{position:static;max-height:none}.paper{padding:18px 14px;font-size:15px}}
'''
extra_css += '''
/* ---------- header nav: essentials + menu ---------- */
.whobar .btn[aria-current]{background:rgba(255,255,255,.26);border-color:rgba(255,255,255,.7)}
.whobar a.btn{text-decoration:none}
.navmenu{position:relative}
.menu-btn{background:#fff;color:#07493b;border-color:#fff;font-weight:700}
.menu-btn:hover{background:#eafff6}
.menu-list{position:fixed;z-index:80;min-width:250px;background:var(--paper,#fff);color:var(--ink,#10261f);border:1px solid var(--line);border-radius:14px;box-shadow:0 14px 40px rgba(0,0,0,.22);padding:6px;display:grid;gap:2px}
.menu-list[hidden]{display:none}
.menu-list a,.menu-list button{display:flex;align-items:center;gap:10px;width:100%;text-align:start;font:inherit;font-size:.92rem;font-weight:600;color:inherit;text-decoration:none;background:none;border:0;border-radius:10px;padding:9px 12px;cursor:pointer}
.menu-list a:hover,.menu-list button:hover,.menu-list a[aria-current]{background:var(--main-l,#e6f4ef);color:var(--main-d,#07493b)}
.menu-list .mi{width:22px;text-align:center}
.menu-list hr{border:0;border-top:1px solid var(--line);margin:4px 2px}
.menu-list #logoutBtn{color:var(--danger,#b23a2b)}
.modal.locked{backdrop-filter:blur(3px)}
/* ---------- grading page ---------- */
.gr{padding-block:22px 60px;display:grid;gap:14px}
.gr-card{background:var(--paper);border:1px solid var(--line);border-radius:16px;padding:14px 16px;box-shadow:var(--shadow)}
.gr-card h3{margin:0 0 6px;font-size:1rem;color:var(--main-d)}
.gr-steps{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0 0;padding:0;list-style:none;font-size:.82rem}
.gr-steps li{background:var(--main-l);border-radius:999px;padding:4px 10px}
.gr-row{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
.gr-row .qsel{width:auto;min-width:220px}
.gr-tasks{width:100%;border-collapse:collapse;font-size:.9rem}
.gr-tasks th,.gr-tasks td{padding:8px 10px;border-bottom:1px solid var(--line);text-align:start}
.gr-tasks th{font-size:.78rem;color:var(--mute);font-weight:700}
.gr-tasks td.num{font-variant-numeric:tabular-nums;white-space:nowrap}
.gr-note{font-size:.82rem;background:var(--accent-l,#fff8e6);border-radius:10px;padding:8px 12px}
.gr-empty{color:var(--mute);text-align:center;padding:18px}
/* ---------- study pages ---------- */
.edit-hint{font-size:.82rem;color:var(--mute);background:var(--accent-l,#fff8e6);border-radius:10px;padding:6px 12px;margin-bottom:8px}
.study-paper{outline:none;font-size:15px}
.study-paper:focus{box-shadow:0 0 0 3px #b9d8cf,0 2px 14px rgba(0,0,0,.18)}
.study-paper .cb{user-select:none;font-size:1.1em}
@media (max-width:700px){.menu-list{top:auto!important;left:0!important;bottom:0;inset-inline:0;border-radius:18px 18px 0 0;min-width:0;padding:10px 10px calc(10px + env(safe-area-inset-bottom))}}
'''
CSS = base_css + extra_css

FONTS = '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&family=Reem+Kufi:wght@600;700&display=swap" rel="stylesheet">'

import base64 as _b64, secrets as _sec
def pack(js):
    js = chr(10).join(l.strip() for l in js.split(chr(10)) if l.strip())
    key = _sec.token_hex(8)
    raw = js.encode('utf-8'); kb = key.encode()
    enc = _b64.b64encode(bytes(c ^ kb[i % len(kb)] for i, c in enumerate(raw))).decode()
    return ('(function(){var s=document.currentScript,n=s.nonce,k="' + key + '",b=atob("' + enc + '"),u=new Uint8Array(b.length);'
            'for(var i=0;i<b.length;i++)u[i]=b.charCodeAt(i)^k.charCodeAt(i%k.length);'
            'var e=document.createElement("script");e.nonce=n;e.textContent=new TextDecoder().decode(u);document.body.appendChild(e);e.remove();s.remove();})();')

def page(title, body, script):
    return ('<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8">'
            '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
            '<meta name="robots" content="noindex,nofollow"><meta name="theme-color" content="#f6f4ee">'
            '<link rel="manifest" href="/manifest.webmanifest"><link rel="apple-touch-icon" href="/apple-touch-icon.png">'
            '<meta name="apple-mobile-web-app-capable" content="yes"><meta name="mobile-web-app-capable" content="yes">'
            '<meta name="apple-mobile-web-app-title" content="الكبسولة"><meta name="apple-mobile-web-app-status-bar-style" content="default">'
            f'<title>{title}</title>{FONTS}<style>%CSS%</style></head><body>{body}'
            '<div class="modal" id="modal" hidden><div class="modal-box" id="modalBox" role="dialog" aria-modal="true" aria-labelledby="mTitle"></div></div>'
            '<div class="toast" id="toast" role="status" aria-live="polite"></div>'
            f'<script nonce="%NONCE%">{pack(common + chr(10) + script)}</script></body></html>')

import math
def _helix():
    pts1=[];pts2=[];rungs=[]
    for k in range(0,181):
        y=k*5; ph=y/900*2*math.pi*3
        pts1.append((150+95*math.sin(ph),y)); pts2.append((150-95*math.sin(ph),y))
        if k%6==3:
            x1=150+95*math.sin(ph); x2=150-95*math.sin(ph)
            if abs(x1-x2)>40: rungs.append(f"M{x1:.1f} {y}H{x2:.1f}")
    d=lambda P:"M"+" L".join(f"{x:.1f} {y}" for x,y in P)
    return f'''<svg class="big-helix" viewBox="0 0 300 900" aria-hidden="true"><path class="s1" d="{d(pts1)}"/><path class="s2" d="{d(pts2)}"/><g class="rg"><path d="{' '.join(rungs)}"/></g></svg>'''
BIG_HELIX = _helix()

PROMO = '''<aside class="get-app" id="getApp" aria-label="حمّل التطبيق">
  <h3>📱 حمّل تطبيق «الكبسولة»</h3>
  <p>على موبايلك: التحضير والواجب يتبعتوا لنور بضغطة، والأداة مدمجة بدون أي إعداد.</p>
  <div class="ga-btns"><a class="ga-btn" href="/download/tahdir.apk" download>⬇ تحميل للأندرويد</a></div>
  <details><summary>📲 على الآيفون</summary><ol><li>افتح الموقع من متصفح Safari.</li><li>اضغط زر «مشاركة» ⬆ أسفل الشاشة.</li><li>اختر «إضافة إلى الشاشة الرئيسية» ثم «إضافة».</li></ol></details>
  <details><summary>💻 على الكمبيوتر</summary><ol><li>سجّل الدخول.</li><li>اضغط زر «ثبّت أداة نور» أعلى صفحة الدروس واتبع الخطوتين.</li></ol></details>
</aside>'''

def auth_shell(card):
    return f'''<main class="auth"><div class="kb-band">{BANNER}</div>
<section class="auth-art">
  <div class="auth-brand">
    <div class="logo">{LOGO}</div>
    <h1>الكبسولة</h1>
    <p>تحضير الدروس جاهز للإرسال إلى منصة نور، مرتّب حسب فهرس الكتاب المدرسي: العلوم، والأحياء، والكيمياء، والعلوم البيئية، وتقنية المعلومات، واللغة الإنجليزية.</p>
    <span class="school">إعداد أ. محمد مجدي · معلم الأحياء · مدرسة حذيفة بن محصن</span>
  </div>
  <div class="auth-facts"><span>مواد متعددة</span><span>الفصل الدراسي الأول</span><span>نسخ بضغطة واحدة</span></div>
</section>
<section class="auth-panel">{PROMO}{card}</section>
</main>'''

LOGIN = auth_shell('''<form class="auth-card" id="loginForm" novalidate>
  <h2>تسجيل الدخول</h2>
  <p class="lead">ادخل باسم المستخدم وكلمة المرور اللي أرسلها لك أ. محمد مجدي.</p>
  <div class="err" id="loginErr" role="alert" hidden></div>
  <div class="fld"><label for="username">اسم المستخدم</label><input id="username" name="username" class="ltr" autocomplete="username" autocapitalize="none" spellcheck="false" required></div>
  <div class="fld"><label for="password">كلمة المرور</label><div class="pw"><input id="password" name="password" type="password" class="ltr" autocomplete="current-password" required><button type="button" id="togglePass" aria-pressed="false">إظهار</button></div></div>
  <button class="btn primary go" id="loginBtn" type="submit">دخول</button>
  <p class="auth-foot">الحساب يعمل على جهازين فقط لكل معلم.</p>
</form>''')

SETUP = auth_shell('''<form class="auth-card" id="setupForm" novalidate>
  <h2>إنشاء حساب المدير</h2>
  <p class="lead">هذه الصفحة تظهر مرة واحدة فقط. الحساب اللي تنشئه الآن هو حساب لوحة التحكم.</p>
  <div class="err" id="loginErr" role="alert" hidden></div>
  <div class="fld"><label for="name">الاسم</label><input id="name" value="أ. محمد مجدي" required></div>
  <div class="fld"><label for="username">اسم المستخدم (إنجليزي)</label><input id="username" class="ltr" autocomplete="username" autocapitalize="none" required></div>
  <div class="fld"><label for="password">كلمة المرور</label><input id="password" type="password" class="ltr" autocomplete="new-password" required></div>
  <div class="fld"><label for="password2">تأكيد كلمة المرور</label><input id="password2" type="password" class="ltr" autocomplete="new-password" required></div>
  <button class="btn primary go" type="submit">إنشاء الحساب</button>
</form>''')

TOP = lambda extra: f'''<header class="top">{BANNER}<div class="wrap top-in">
  <div class="brand"><div><h1 class="sr-only">الكبسولة</h1>
  <p class="by">إعداد أستاذ <b>محمد مجدي</b>، معلم الأحياء، مدرسة حذيفة بن محصن</p>{extra}</div></div>
  <div class="actions whobar">%BTNS%</div></div></header>'''

MENU_ITEMS = [('quiz', '/quiz', '📝', 'التقويم والاختبارات'), ('games', '/games', '🎲', 'الألعاب التعليمية'),
              ('remedial', '/remedial', '🩹', 'الخطط العلاجية والأنشطة الصفية'), ('summaries', '/summaries', '📚', 'ملخصات الدروس والوحدات'), ('finals', '/finals', '🗂', 'الاختبارات النهائية السابقة'),
              ('grading', '/grading', '✅', 'تصحيح الواجبات تلقائيًا')
              ('searcher', 'https://hudhifa-searcher.onrender.com/', '🔎', 'باحث المدرسة')]
def NAV(active, extra=''):
    cur = lambda k: ' aria-current="page"' if k == active else ''
    h = '<span class="who" id="who"></span>'
    h += f'<a class="btn ghost small" href="/app"{cur("app")}>التحضير</a>'
    h += '<button type="button" class="btn ghost small" id="settingsBtn">القيم الثابتة</button>' if active == 'app' else '<a class="btn ghost small" href="/app#settings">القيم الثابتة</a>'
    h += '<button type="button" class="btn ghost small pulse" id="toolBtn">أداة نور</button>'
    h += '<div class="navmenu"><button type="button" class="btn small menu-btn" id="menuBtn" aria-haspopup="true" aria-expanded="false">☰ المزيد</button><div class="menu-list" id="menuList" role="menu" hidden>'
    for k, href, ic, t in MENU_ITEMS:
        ext = ' target="_blank" rel="noopener"' if href.startswith('http') else ''
        h += f'<a role="menuitem" href="{href}"{ext}{cur(k)}><span class="mi">{ic}</span>{t}</a>'
    h += f'<a role="menuitem" class="admin-only" id="adminLink" href="/admin"{cur("admin")} hidden><span class="mi">⚙</span>لوحة التحكم</a>'
    h += extra
    h += '<hr><button type="button" role="menuitem" id="logoutBtn"><span class="mi">⎋</span>تسجيل الخروج</button></div></div>'
    return h

APP = TOP('<div class="stats"><span class="stat"><span id="statLessons">0</span> درسًا</span><span class="stat"><span id="statFilled">0</span> بتحضير جاهز</span><span class="stat">الفصل الدراسي الأول</span></div>').replace('%BTNS%',
  NAV('app')) + f'''
<div class="app-bar" id="appBar"><div class="get-app"><div><h3>📱 تطبيق «الكبسولة» على الموبايل</h3><p>أرسل التحضير والواجب لنور من موبايلك بضغطة. الأداة مدمجة بدون Tampermonkey.</p></div><div class="ga-btns"><a class="ga-btn" href="/download/tahdir.apk" download>⬇ أندرويد</a><button type="button" class="ga-btn alt" id="iosBtn">📲 آيفون</button><button type="button" class="ga-btn alt" id="pcBtn">💻 أداة الكمبيوتر</button></div></div></div>
<div class="wrap layout"><aside class="tree" id="tree" aria-label="الصفوف والوحدات والدروس"></aside>
<main class="panel" id="panel"><div class="welcome">{CELL}<h2>جارٍ تحميل الدروس…</h2></div></main></div>
<p class="foot">الكبسولة، إعداد أ. محمد مجدي</p><div id="cellArt" hidden>{CELL}</div>'''

QUIZ = TOP('<div class="stats"><span class="stat">التقويم: الاختبارات القصيرة ومراجعات الوحدات</span><span class="stat">وفق وثيقة تقويم تعلم الطلبة</span></div>').replace('%BTNS%',
  NAV('quiz')) + '''
<div class="wrap qlayout"><aside class="qside" id="qside" aria-label="إعداد الاختبار"></aside>
<main class="panel" id="qmain"><div class="welcome"><h2>جارٍ التحميل…</h2></div></main></div>
<div id="printArea"></div>'''

GAMES = TOP('<div class="stats"><span class="stat">ركن الألعاب التعليمية</span><span class="stat">لكل درس ولكل صف</span></div>').replace('%BTNS%',
  NAV('games')) + '''
<div class="wrap qlayout"><aside class="qside" id="gside" aria-label="اختيار الدروس"></aside>
<main class="panel" id="gmain"><div class="welcome"><h2>جارٍ التحميل…</h2></div></main></div>'''
REMEDIAL = TOP('<div class="stats"><span class="stat">الخطط العلاجية والأنشطة الصفية</span><span class="stat">للطلاب دون المستوى</span></div>').replace('%BTNS%', NAV('remedial')) + '''
<div class="wrap qlayout"><aside class="qside" id="qside" aria-label="إعداد الخطة"></aside>
<main class="panel" id="qmain"><div class="welcome"><h2>جارٍ التحميل…</h2></div></main></div>
<div id="printArea"></div>'''
SUMMARIES = TOP('<div class="stats"><span class="stat">ملخصات الدروس والوحدات</span><span class="stat">وفق مخرجات التعلم</span></div>').replace('%BTNS%', NAV('summaries')) + '''
<div class="wrap qlayout"><aside class="qside" id="qside" aria-label="اختيار الملخص"></aside>
<main class="panel" id="qmain"><div class="welcome"><h2>جارٍ التحميل…</h2></div></main></div>
<div id="printArea"></div>'''
FINALS_PAGE = TOP('<div class="stats"><span class="stat">الاختبارات النهائية السابقة</span><span class="stat">أسئلة الوزارة مصنّفة حسب الوحدة والدرس</span></div>').replace('%BTNS%', NAV('finals')) + '''
<div class="wrap qlayout"><aside class="qside" id="fside" aria-label="اختيار الوحدة"></aside>
<main class="panel" id="fmain"><div class="welcome"><h2>جارٍ التحميل…</h2></div></main></div>
<div id="printArea"></div>'''
GRADING = TOP('<div class="stats"><span class="stat">تصحيح الواجبات تلقائيًا</span><span class="stat">تجريبي</span></div>').replace('%BTNS%', NAV('grading')) + '''
<main class="wrap gr" id="gr"><div class="welcome"><h2>جارٍ التحميل…</h2></div></main>'''
PLAY = '<main class="pl" id="pl"></main>'

ADMIN = TOP('<div class="stats"><span class="stat">لوحة التحكم</span></div>').replace('%BTNS%',
  NAV('admin', '<button type="button" role="menuitem" id="refreshBtn"><span class="mi">↻</span>تحديث البيانات</button>')) + '''
<main class="wrap dash" id="dash"><div class="empty-state">جارٍ تحميل البيانات…</div></main>'''

FIN = json.load(open(os.path.join(DATA, 'finals.json'), encoding='utf-8')) if os.path.exists(os.path.join(DATA, 'finals.json')) else {}
PAGES = {
  'css': CSS,
  'login': page('الكبسولة', LOGIN, rd('client_login.js')),
  'setup': page('إعداد الكبسولة', SETUP, rd('client_login.js')),
  'app': page('الكبسولة', APP, rd('client_app.js')),
  'admin': page('لوحة التحكم · الكبسولة', ADMIN, rd('client_admin.js')),
  'quiz': page('التقويم · الكبسولة', QUIZ, rd('client_quiz.js')),
  'games': page('الألعاب التعليمية · الكبسولة', GAMES, rd('vendor/qr.js') + chr(10) + rd('client_games.js')),
  'play': page('تحدي الكبسولة', PLAY, rd('client_play.js')),
  'grading': page('تصحيح الواجبات · الكبسولة', GRADING, rd('client_grading.js')),
  'remedial': page('الخطط العلاجية · الكبسولة', REMEDIAL, "window.PAGE_KIND='remedial';" + chr(10) + rd('client_study.js')),
  'finals': page('الاختبارات النهائية · الكبسولة', FINALS_PAGE, 'window.FIN_INDEX=' + json.dumps({k: len(v['q']) for k, v in FIN.items()}, ensure_ascii=False) + ';' + chr(10) + rd('client_finals.js')),
  'summaries': page('ملخصات الدروس · الكبسولة', SUMMARIES, "window.PAGE_KIND='summaries';" + chr(10) + rd('client_study.js')),
}
src = rd('worker_src.js')
src = src.replace('__LESSONS__', json.dumps(lessons, ensure_ascii=False, separators=(',', ':')))
src = src.replace('__PAGES__', json.dumps(PAGES, ensure_ascii=False, separators=(',', ':')))
src = src.replace('__TOOL__', json.dumps(rd('tahdir-noor.user.js'), ensure_ascii=False))
src = src.replace('__ICONS__', json.dumps({**json.loads(rd('icons.json')), **BRAND_ICONS}))
# الحزم الكبيرة (الملخصات والألعاب والاختبارات النهائية) تُنشر ملفات ثابتة باسم مشتق من محتواها، ويحمّلها العامل عند الحاجة
import hashlib as _hl
_PK = {'study': json.load(open(os.path.join(DATA, 'study_pack.json'), encoding='utf-8')), 'games': json.load(open(os.path.join(DATA, 'games_pack.json'), encoding='utf-8')), 'finals': FIN}
_PB = {k: json.dumps(v, ensure_ascii=False, separators=(',', ':')).encode('utf-8') for k, v in _PK.items()}
_PH = _hl.sha256(b''.join(_PB.values())).hexdigest()[:24]
import shutil as _sh
if os.path.isdir(os.path.join(DIST, 'assets', 'd')):
    for _o in os.listdir(os.path.join(DIST, 'assets', 'd')):
        if _o != _PH: _sh.rmtree(os.path.join(DIST, 'assets', 'd', _o), ignore_errors=True)
_PD = os.path.join(DIST, 'assets', 'd', _PH); os.makedirs(_PD, exist_ok=True)
for k, b in _PB.items(): open(os.path.join(_PD, k + '.json'), 'wb').write(b)
src = src.replace('__PACKDIR__', json.dumps('/d/' + _PH + '/'))
src = src.replace('__QBANK__', json.dumps(qbank, ensure_ascii=False, separators=(',', ':')))
src = src.replace('__BUILD__', json.dumps(BUILD))
src = src.replace('__PRIVACY__', json.dumps(rd('privacy.html'), ensure_ascii=False))
import base64 as _b64
src = src.replace('__APK__', json.dumps(_b64.b64encode(open(os.path.join(os.path.dirname(os.path.abspath(__file__)),'tahdir.apk'),'rb').read()).decode()))
out = os.path.join(DIST, 'worker.js')
open(out, 'w', encoding='utf-8').write(src)
print('worker.js', round(len(src.encode('utf-8')) / 1024), 'KB')
