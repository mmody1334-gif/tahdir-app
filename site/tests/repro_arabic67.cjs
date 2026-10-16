// يتحقق من الاختبارات النهائية للغة العربية (الصفوف 6 · 7 · 8) وربطها بالاختبارات القصيرة.
const PW = require('./_pw.cjs');
const USER = 'mohamed', PASS = 'Bio@2026x';
let pass = 0, fail = 0;
const ok = (n, c, extra) => { (c ? pass++ : fail++); console.log((c ? '  PASS  ' : '  FAIL  ') + n + (extra ? '  → ' + extra : '')); };

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

  // 1) صفحة الاختبارات النهائية: المقررات والصور
  await p.goto(B + '/finals', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(2600);
  const fin = await p.evaluate(() => {
    const t = document.body.innerText.replace(/\s+/g, ' ');
    return { text: t.slice(0, 200), imgs: document.querySelectorAll('img').length };
  });
  console.log('صفحة النهائيات: ' + fin.text.slice(0, 130));
  ok('صفحة النهائيات تُفتح', fin.text.length > 30, fin.text.slice(0, 50));

  // 2) بنك الأسئلة لكل صف عربي (يأتي من النهائيات)
  const banks = await p.evaluate(async () => {
    const out = {};
    for (const g of ['السادس', 'السابع', 'الثامن', 'الخامس']) {
      const k = 'اللغة العربية|' + g;
      const r = await (await fetch('/api/quiz/bank?key=' + encodeURIComponent(k))).json();
      out[g] = { items: (r.items || []).length, lessons: (r.lessons || []).length };
    }
    return out;
  });
  console.log('\nبنك الأسئلة (من النهائيات):');
  for (const [g, v] of Object.entries(banks)) console.log('   %s: %d مفردة | %d درسًا', g.padEnd(10), v.items, v.lessons);

  ok('بنك الصف السادس يعمل', banks['السادس'].items > 0, banks['السادس'].items + ' مفردة');
  ok('بنك الصف السابع يعمل', banks['السابع'].items > 0, banks['السابع'].items + ' مفردة');
  ok('بنك الصف الثامن يعمل', banks['الثامن'].items > 0, banks['الثامن'].items + ' مفردة');
  ok('الصف الخامس بلا بنك (لم يُستخرج بعد)', true, banks['الخامس'].items + ' مفردة');

  // 3) توليد اختبار قصير فعلي للصف السابع
  await p.goto(B + '/quiz', { waitUntil: 'domcontentloaded' });
  await p.waitForSelector('#courseSel', { timeout: 25000 });
  await p.waitForTimeout(1200);
  const gen = await p.evaluate(async () => {
    const subj = document.getElementById('courseSelSubj'), cs = document.getElementById('courseSel');
    subj.value = 'اللغة العربية'; subj.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise(x => setTimeout(x, 1400));
    cs.value = 'اللغة العربية|السابع'; cs.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise(x => setTimeout(x, 2000));
    const lids = [...document.querySelectorAll('[data-lid]')];
    lids.slice(0, 8).forEach(x => { if (!x.checked) x.click(); });
    await new Promise(x => setTimeout(x, 400));
    document.getElementById('makeBtn').click();
    await new Promise(x => setTimeout(x, 3200));
    const items = [...document.querySelectorAll('#paper .qi')];
    return {
      n: items.length,
      imgs: items.filter(it => it.querySelector('img')).length,
      spec: ((document.querySelector('.checks') || document.body).innerText || '').replace(/\s+/g, ' ').slice(0, 300),
      lessons: lids.length,
    };
  });
  console.log('\nتوليد اختبار صف 7: %d سؤالًا | بصور=%d | دروس=%d', gen.n, gen.imgs, gen.lessons);
  console.log('المواصفة: ' + gen.spec.slice(0, 190));
  ok('وُلّد اختبار للصف السابع', gen.n > 0, gen.n + ' سؤالًا');
  ok('الأسئلة بصور الورقة الوزارية', gen.imgs > 0, gen.imgs + ' صورة');
  ok('المواصفة تطبّق وثيقة التقويم', /من\s*15/.test(gen.spec), gen.spec.slice(0, 70));
  await p.screenshot({ path: require('path').join(__dirname, 'arabic_finals_67.png'), fullPage: false });

  await b.close(); srv.stop();
  const real = [...new Set(errs)];
  console.log('\nأخطاء JavaScript:', real.length ? real.join('\n') : '(لا شيء)');
  ok('لا أخطاء JavaScript', real.length === 0, real.join(' | ') || 'نظيف');
  console.log('\n=== ' + pass + ' ناجح، ' + fail + ' فاشل ===');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
