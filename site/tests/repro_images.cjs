// يتحقق أن صور أسئلة الوزارة تظهر فعلًا في الصفحات (تُحمَّل وتُرسم) لا مجرد وجود وسم img.
const PW = require('./_pw.cjs');
const USER = 'mohamed', PASS = 'Bio@2026x';
let pass = 0, fail = 0;
const ok = (n, c, extra) => { (c ? pass++ : fail++); console.log((c ? '  PASS  ' : '  FAIL  ') + n + (extra ? '  → ' + extra : '')); };

(async () => {
  const srv = await PW.boot();
  const { chromium, findChrome, BASE: B } = srv;
  const b = await chromium.launch({ executablePath: findChrome(), headless: true });
  const c = await b.newContext({ viewport: { width: 1400, height: 1000 }, locale: 'ar-OM', permissions: ['clipboard-read', 'clipboard-write'] });
  const p = await c.newPage();
  const errs = [], failedReqs = [];
  p.on('pageerror', e => errs.push(e.message));
  p.on('requestfailed', r => { if (/\/fin\//.test(r.url())) failedReqs.push(r.url()); });
  p.on('response', r => { if (/\/fin\//.test(r.url()) && r.status() >= 400) failedReqs.push(r.status() + ' ' + r.url()); });

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

  // --- (1) صفحة الاختبارات النهائية: كل صورة تُرسم ---
  await p.goto(B + '/finals', { waitUntil: 'domcontentloaded' });
  await p.waitForSelector('.fin-q', { timeout: 30000 });
  await p.waitForTimeout(3000);
  // الصور بـ loading="lazy" فلا تُحمَّل إلا عند ظهورها في الشاشة: ننزل بالصفحة لتحميلها كلها
  await p.evaluate(async () => {
    const step = Math.round(window.innerHeight * 0.8);
    for (let y = 0; y < document.body.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise(r => setTimeout(r, 120));
    }
    window.scrollTo(0, 0);
  });
  await p.waitForTimeout(3000);
  const fin = await p.evaluate(async () => {
    const imgs = [...document.querySelectorAll('.fin-q img')].slice(0, 40);
    // ننتظر كل الصور بمهلة محدودة حتى لا يتعلّق الفحص
    await Promise.all(imgs.map(im => im.complete ? null : new Promise(r => { var t=setTimeout(r,4000); im.onload=im.onerror=function(){clearTimeout(t);r();}; })));
    return {
      total: imgs.length,
      loaded: imgs.filter(i => i.complete && i.naturalWidth > 0).length,
      broken: imgs.filter(i => i.complete && i.naturalWidth === 0).length,
      sample: imgs.slice(0, 3).map(i => ({ w: i.naturalWidth, src: i.getAttribute('src').slice(-28) })),
    };
  });
  console.log('صفحة الاختبارات النهائية: ' + JSON.stringify(fin));
  ok('صور الامتحانات موجودة في الصفحة', fin.total > 0, fin.total + ' صورة');
  ok('كل صور الامتحانات تُرسم فعلًا', fin.loaded === fin.total && fin.broken === 0,
    `محمّلة ${fin.loaded}/${fin.total}، مكسورة ${fin.broken}`);

  // --- (2) الاختبار القصير: أسئلة الوزارة بصورها ---
  await p.goto(B + '/quiz', { waitUntil: 'domcontentloaded' });
  await p.waitForSelector('#courseSel', { timeout: 25000 });
  await p.waitForTimeout(1500);
  const quiz = await p.evaluate(async () => {
    // نختار مقررًا له امتحانات نهائية
    const subj = document.getElementById('courseSelSubj'), sel = document.getElementById('courseSel');
    for (const w of ['العلوم|الثامن', 'الأحياء|التاسع', 'الأحياء|العاشر']) {
      const s = w.split('|')[0];
      if (subj) { const o = [...subj.options].find(x => x.value === s); if (o) { subj.value = s; subj.dispatchEvent(new Event('change', { bubbles: true })); await new Promise(r => setTimeout(r, 1100)); } }
      if ([...sel.options].some(x => x.value === w)) { sel.value = w; sel.dispatchEvent(new Event('change', { bubbles: true })); await new Promise(r => setTimeout(r, 2400)); break; }
    }
    [...document.querySelectorAll('[data-lid]')].slice(0, 3).forEach(x => x.click());
    await new Promise(r => setTimeout(r, 400));
    const mk = document.getElementById('makeBtn'); if (mk) mk.click();
    await new Promise(r => setTimeout(r, 2800));
    const imgs = [...document.querySelectorAll('#paper .qi img')];
    await Promise.all(imgs.map(im => im.complete ? null : new Promise(r => { var t=setTimeout(r,4000); im.onload=im.onerror=function(){clearTimeout(t);r();}; })));
    return {
      paperImgCount: imgs.length,
      loaded: imgs.filter(i => i.complete && i.naturalWidth > 0).length,
      broken: imgs.filter(i => i.complete && i.naturalWidth === 0).length,
      brokenSrc: imgs.filter(i => i.complete && i.naturalWidth === 0).slice(0, 3).map(i => i.getAttribute('src')),
    };
  });
  console.log('ورقة الاختبار القصير: ' + JSON.stringify(quiz));
  ok('الورقة فيها أسئلة بصور', quiz.paperImgCount > 0, quiz.paperImgCount + ' صورة');
  ok('كل صور الورقة تُرسم فعلًا', quiz.loaded === quiz.paperImgCount && quiz.broken === 0,
    `محمّلة ${quiz.loaded}/${quiz.paperImgCount}، مكسورة ${quiz.broken} ${JSON.stringify(quiz.brokenSrc)}`);

  // --- (3) الأنشطة الصفية (remedial): أسئلة الوزارة بالرسوم ---
  await p.goto(B + '/remedial', { waitUntil: 'domcontentloaded' });
  await p.waitForSelector('#courseSel', { timeout: 25000 });
  await p.waitForTimeout(1500);
  const rem = await p.evaluate(async () => {
    const subj = document.getElementById('courseSelSubj'), sel = document.getElementById('courseSel');
    for (const w of ['العلوم|الثامن', 'الأحياء|التاسع']) {
      const s = w.split('|')[0];
      if (subj) { const o = [...subj.options].find(x => x.value === s); if (o) { subj.value = s; subj.dispatchEvent(new Event('change', { bubbles: true })); await new Promise(r => setTimeout(r, 1100)); } }
      if ([...sel.options].some(x => x.value === w)) { sel.value = w; sel.dispatchEvent(new Event('change', { bubbles: true })); await new Promise(r => setTimeout(r, 2400)); break; }
    }
    const boxes = [...document.querySelectorAll('[data-lid]:not([disabled])')];
    boxes.slice(0, 2).forEach(x => x.click());
    await new Promise(r => setTimeout(r, 500));
    const mk = document.getElementById('makeBtn'); if (mk) mk.click();
    await new Promise(r => setTimeout(r, 3000));
    // نفتح تبويب «الأنشطة الصفية»
    const tab = [...document.querySelectorAll('[data-part]')].find(b => (b.getAttribute('data-part') || '') === 'cls');
    if (tab) { tab.click(); await new Promise(r => setTimeout(r, 1200)); }
    const paper = document.getElementById('paper');
    const imgs = paper ? [...paper.querySelectorAll('img')] : [];
    await Promise.all(imgs.map(im => im.complete ? null : new Promise(r => { var t=setTimeout(r,4000); im.onload=im.onerror=function(){clearTimeout(t);r();}; })));
    return {
      tabFound: !!tab,
      imgCount: imgs.length,
      loaded: imgs.filter(i => i.complete && i.naturalWidth > 0).length,
      broken: imgs.filter(i => i.complete && i.naturalWidth === 0).length,
      hasCls: !!document.querySelector('[data-part="cls"]'),
    };
  });
  console.log('الأنشطة الصفية: ' + JSON.stringify(rem));
  if (rem.imgCount > 0) {
    ok('صور الأنشطة الصفية تُرسم فعلًا', rem.loaded === rem.imgCount && rem.broken === 0,
      `محمّلة ${rem.loaded}/${rem.imgCount}، مكسورة ${rem.broken}`);
  } else {
    ok('الأنشطة الصفية تُبنى بلا صور مكسورة', rem.broken === 0, 'لا صور في هذا الدرس (مقبول)');
  }

  ok('لا طلبات صور فاشلة', failedReqs.length === 0, failedReqs.slice(0, 3).join(' | ') || 'لا شيء');
  await p.screenshot({ path: require('path').join(__dirname, 'images_check.png'), fullPage: true });
  await b.close(); srv.stop();
  const real = [...new Set(errs)];
  console.log('\nأخطاء JavaScript:', real.length ? real.join('\n') : '(لا شيء)');
  ok('لا أخطاء JavaScript', real.length === 0, real.join(' | ') || 'نظيف');
  console.log('\n=== ' + pass + ' ناجح، ' + fail + ' فاشل ===');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
