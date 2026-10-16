// يتحقق من ظهور مادة الرياضيات (الصف الخامس) بتحضيرها الكامل.
const PW = require('./_pw.cjs');
const USER = 'mohamed', PASS = 'Bio@2026x';
let pass = 0, fail = 0;
const ok = (n, c, extra) => { (c ? pass++ : fail++); console.log((c ? '  PASS  ' : '  FAIL  ') + n + (extra ? '  → ' + extra : '')); };
const F = ['concepts', 'pre_learning', 'outcomes', 'strategies', 'activities_teach', 'resources', 'formative', 'closing', 'homework'];

(async () => {
  const srv = await PW.boot();
  const { chromium, findChrome, BASE: B } = srv;
  const b = await chromium.launch({ executablePath: findChrome(), headless: true });
  const c = await b.newContext({ viewport: { width: 1400, height: 1000 }, locale: 'ar-OM' });
  const p = await c.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto(B + '/', { waitUntil: 'domcontentloaded' });
  if (await p.$('#setupForm')) {
    await p.fill('#name', 'أ. محمد مجدي'); await p.fill('#username', USER);
    await p.fill('#password', PASS); await p.fill('#password2', PASS);
    await p.click('#setupForm button[type=submit]'); await p.waitForTimeout(1800);
  }
  await p.goto(B + '/', { waitUntil: 'domcontentloaded' });
  if (await p.$('#loginForm')) {
    await p.fill('#username', USER); await p.fill('#password', PASS);
    await p.click('#loginBtn'); await p.waitForTimeout(2500);
  }
  await p.goto(B + '/app', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(3500);

  // 1) هل الرياضيات ظاهرة في قائمة المواد؟
  const subs = await p.evaluate(() => { const s = document.getElementById('subjSel'); return s ? [...s.options].map(o => o.value) : []; });
  console.log('المواد المتاحة: ' + JSON.stringify(subs));
  ok('مادة الرياضيات ظاهرة', subs.some(x => /رياض/.test(x)), subs.filter(x => /رياض/.test(x)).join(','));

  // 2) نفتح درس رياضيات ونتحقق من الحقول
  const r = await p.evaluate(async () => {
    const sel = document.getElementById('subjSel');
    const o = [...sel.options].find(x => /رياض/.test(x.value));
    if (!o) return { err: 'لا مادة رياضيات' };
    sel.value = o.value; sel.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise(x => setTimeout(x, 900));
    const g = [...document.querySelectorAll('.g-btn')].find(x => /الخامس/.test(x.textContent));
    if (!g) return { err: 'لا صف خامس' };
    if (!g.parentElement.querySelector('.g-body.open')) { g.click(); await new Promise(x => setTimeout(x, 800)); }
    const units = [...document.querySelectorAll('.u-name')].map(x => x.textContent.trim());
    const u = [...document.querySelectorAll('.u-btn')].find(x => x.offsetParent !== null);
    if (u) { u.click(); await new Promise(x => setTimeout(x, 800)); }
    const ls = [...document.querySelectorAll('.l-list button')].filter(x => x.offsetParent !== null);
    if (!ls.length) return { err: 'لا دروس', units };
    const title = ls[0].textContent.trim().slice(0, 40);
    ls[0].click(); await new Promise(x => setTimeout(x, 1400));
    const shown = [], empty = [];
    for (const k of ['concepts', 'pre_learning', 'outcomes', 'strategies', 'activities_teach', 'resources', 'formative', 'closing', 'homework']) {
      const el = document.getElementById('f_' + k);
      if (el) shown.push(k);
      if (!el || !String(el.value).trim()) empty.push(k);
    }
    return { title, units, shown, empty, count: ls.length };
  });
  console.log('\nالوحدات: ' + JSON.stringify(r.units));
  console.log('الدرس المفتوح: ' + r.title + ' | دروس الوحدة: ' + r.count);
  console.log('الحقول الظاهرة: ' + JSON.stringify(r.shown));
  console.log('الفارغة: ' + JSON.stringify(r.empty));
  ok('الوحدات الأربع ظاهرة', (r.units || []).length >= 4, JSON.stringify(r.units));
  ok('الحقول التسعة ظاهرة', (r.shown || []).length >= 9, (r.shown || []).length + ' حقلًا');
  ok('التحضير مملوء (لا فراغ)', (r.empty || []).length === 0, JSON.stringify(r.empty));
  await p.screenshot({ path: require('path').join(__dirname, 'math_g5.png'), fullPage: false });
  await b.close(); srv.stop();
  const real = [...new Set(errs)];
  console.log('\nأخطاء JavaScript:', real.length ? real.join('\n') : '(لا شيء)');
  ok('لا أخطاء JavaScript', real.length === 0, real.join(' | ') || 'نظيف');
  console.log('\n=== ' + pass + ' ناجح، ' + fail + ' فاشل ===');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
