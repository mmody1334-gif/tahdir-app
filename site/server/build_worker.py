# -*- coding: utf-8 -*-
# يبني worker.js واحدًا من مصادر الموقع. يُشغَّل محليًا أو من GitHub Actions.
import json, os, re, subprocess, datetime
HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, '..', 'data')
DIST = os.path.join(HERE, '..', 'dist')
os.makedirs(DIST, exist_ok=True)
theme = json.load(open(os.path.join(DATA, 'theme.json'), encoding='utf-8'))
base_css, HELIX, CELL, LOGO = theme['css'], theme['HELIX'], theme['CELL'], theme['LOGO']
lessons = json.load(open(os.path.join(DATA, 'lessons.json'), encoding='utf-8'))
qbank = json.load(open(os.path.join(DATA, 'quiz_bank.json'), encoding='utf-8'))
try:
    sha = subprocess.run(['git', 'rev-parse', '--short', 'HEAD'], cwd=HERE, capture_output=True, text=True).stdout.strip()
except Exception:
    sha = ''
BUILD = {'at': datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%d %H:%M UTC'), 'sha': sha}
for l in lessons:
    l.setdefault('ai_filled', [])
rd = lambda f: open(os.path.join(HERE, f), encoding='utf-8').read()
common = rd('common.js')

extra_css = '''
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

/* ---------- subject switch ---------- */
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
@media print{
  @page{size:A4;margin:12mm}
  body.printing>*:not(#printArea){display:none!important}
  body.printing #printArea{display:block!important;color:#000;font-family:"Simplified Arabic","Traditional Arabic","Cairo",Tahoma,serif;font-size:14pt;line-height:1.6}
  body.printing{background:#fff!important}
  #printArea .ppage+.ppage{page-break-before:always}
  .no-print{display:none!important}
}
@media (max-width:900px){.qlayout{grid-template-columns:1fr}.qside{position:static;max-height:none}.paper{padding:18px 14px;font-size:15px}}
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
            '<meta name="robots" content="noindex,nofollow"><meta name="theme-color" content="#07493b">'
            '<link rel="manifest" href="/manifest.webmanifest"><link rel="apple-touch-icon" href="/apple-touch-icon.png">'
            '<meta name="apple-mobile-web-app-capable" content="yes"><meta name="mobile-web-app-capable" content="yes">'
            '<meta name="apple-mobile-web-app-title" content="التحضير الآلي"><meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">'
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
  <h3>📱 حمّل تطبيق «التحضير الآلي»</h3>
  <p>على موبايلك: التحضير والواجب يتبعتوا لنور بضغطة، والأداة مدمجة بدون أي إعداد.</p>
  <div class="ga-btns"><a class="ga-btn" href="/download/tahdir.apk" download>⬇ تحميل للأندرويد</a></div>
  <details><summary>📲 على الآيفون</summary><ol><li>افتح الموقع من متصفح Safari.</li><li>اضغط زر «مشاركة» ⬆ أسفل الشاشة.</li><li>اختر «إضافة إلى الشاشة الرئيسية» ثم «إضافة».</li></ol></details>
  <details><summary>💻 على الكمبيوتر</summary><ol><li>سجّل الدخول.</li><li>اضغط زر «ثبّت أداة نور» أعلى صفحة الدروس واتبع الخطوتين.</li></ol></details>
</aside>'''

def auth_shell(card):
    return f'''<main class="auth">
<section class="auth-art">{BIG_HELIX}
  <div class="auth-brand">
    <div class="logo">{LOGO}</div>
    <h1>التحضير الآلي</h1>
    <p>تحضير الدروس جاهز للإرسال إلى منصة نور، مرتّب حسب فهرس الكتاب: العلوم للصف الخامس، والأحياء من التاسع إلى الثاني عشر.</p>
    <span class="school">إعداد أ. محمد مجدي · معلم الأحياء · مدرسة حذيفة بن محصن</span>
  </div>
  <div class="auth-facts"><span>5 صفوف</span><span>الفصل الدراسي الأول</span><span>نسخ بضغطة واحدة</span></div>
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

TOP = lambda extra: f'''<header class="top">{HELIX}<div class="wrap top-in">
  <div class="brand"><div class="logo">{LOGO}</div><div><h1>التحضير الآلي</h1>
  <p class="by">إعداد أستاذ <b>محمد مجدي</b>، معلم الأحياء، مدرسة حذيفة بن محصن</p>{extra}</div></div>
  <div class="actions whobar">%BTNS%</div></div></header>'''

APP = TOP('<div class="stats"><span class="stat"><span id="statLessons">0</span> درسًا</span><span class="stat"><span id="statFilled">0</span> بتحضير جاهز</span><span class="stat">الفصل الدراسي الأول</span></div>').replace('%BTNS%',
  '<span class="who" id="who"></span><a class="btn small quiz-link" href="/quiz">📝 التقويم والاختبارات</a><a class="btn ghost small" id="adminLink" href="/admin" hidden>لوحة التحكم</a><button type="button" class="btn ghost small pulse" id="toolBtn">⬇ ثبّت أداة نور</button><button type="button" class="btn ghost small" id="settingsBtn">القيم الثابتة</button><button type="button" class="btn ghost small" id="logoutBtn">خروج</button>') + f'''
<div class="app-bar" id="appBar"><div class="get-app"><div><h3>📱 تطبيق «التحضير الآلي» على الموبايل</h3><p>أرسل التحضير والواجب لنور من موبايلك بضغطة. الأداة مدمجة بدون Tampermonkey.</p></div><div class="ga-btns"><a class="ga-btn" href="/download/tahdir.apk" download>⬇ أندرويد</a><button type="button" class="ga-btn alt" id="iosBtn">📲 آيفون</button><button type="button" class="ga-btn alt" id="pcBtn">💻 أداة الكمبيوتر</button></div></div></div>
<div class="wrap layout"><aside class="tree" id="tree" aria-label="الصفوف والوحدات والدروس"></aside>
<main class="panel" id="panel"><div class="welcome">{CELL}<h2>جارٍ تحميل الدروس…</h2></div></main></div>
<p class="foot">التحضير الآلي لمادتي الأحياء والعلوم، إعداد أ. محمد مجدي</p><div id="cellArt" hidden>{CELL}</div>'''

QUIZ = TOP('<div class="stats"><span class="stat">التقويم: الاختبارات القصيرة ومراجعات الوحدات</span><span class="stat">وفق وثيقة تقويم تعلم الطلبة</span></div>').replace('%BTNS%',
  '<span class="who" id="who"></span><a class="btn ghost small" href="/app">التحضير والواجب</a><a class="btn ghost small" id="adminLink" href="/admin" hidden>لوحة التحكم</a><button type="button" class="btn ghost small" id="logoutBtn">خروج</button>') + '''
<div class="wrap qlayout"><aside class="qside" id="qside" aria-label="إعداد الاختبار"></aside>
<main class="panel" id="qmain"><div class="welcome"><h2>جارٍ التحميل…</h2></div></main></div>
<div id="printArea"></div>'''

ADMIN = TOP('<div class="stats"><span class="stat">لوحة التحكم</span></div>').replace('%BTNS%',
  '<span class="who" id="who"></span><a class="btn ghost small" href="/app">صفحة الدروس</a><a class="btn ghost small" href="/quiz">التقويم</a><button type="button" class="btn ghost small" id="refreshBtn">تحديث</button><button type="button" class="btn ghost small" id="logoutBtn">خروج</button>') + '''
<main class="wrap dash" id="dash"><div class="empty-state">جارٍ تحميل البيانات…</div></main>'''

PAGES = {
  'css': CSS,
  'login': page('التحضير الآلي', LOGIN, rd('client_login.js')),
  'setup': page('إعداد التحضير الآلي', SETUP, rd('client_login.js')),
  'app': page('التحضير الآلي', APP, rd('client_app.js')),
  'admin': page('لوحة التحكم · التحضير الآلي', ADMIN, rd('client_admin.js')),
  'quiz': page('التقويم · التحضير الآلي', QUIZ, rd('client_quiz.js')),
}
src = rd('worker_src.js')
src = src.replace('__LESSONS__', json.dumps(lessons, ensure_ascii=False, separators=(',', ':')))
src = src.replace('__PAGES__', json.dumps(PAGES, ensure_ascii=False, separators=(',', ':')))
src = src.replace('__TOOL__', json.dumps(rd('tahdir-noor.user.js'), ensure_ascii=False))
src = src.replace('__ICONS__', rd('icons.json'))
src = src.replace('__QBANK__', json.dumps(qbank, ensure_ascii=False, separators=(',', ':')))
src = src.replace('__BUILD__', json.dumps(BUILD))
src = src.replace('__PRIVACY__', json.dumps(rd('privacy.html'), ensure_ascii=False))
import base64 as _b64
src = src.replace('__APK__', json.dumps(_b64.b64encode(open(os.path.join(os.path.dirname(os.path.abspath(__file__)),'tahdir.apk'),'rb').read()).decode()))
out = os.path.join(DIST, 'worker.js')
open(out, 'w', encoding='utf-8').write(src)
print('worker.js', round(len(src.encode('utf-8')) / 1024), 'KB')
