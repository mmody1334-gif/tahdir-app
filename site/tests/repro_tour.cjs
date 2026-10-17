// يتحقق من دليل الاستخدام (الجولة المصوّرة) وسلامة المنصة على Chrome وعلى التطبيق.
const PW = require('./_pw.cjs');
const USER = 'mohamed', PASS = 'Bio@2026x';
let pass = 0, fail = 0;
const ok = (n, c, extra) => { (c ? pass++ : fail++); console.log((c ? '  PASS  ' : '  FAIL  ') + n + (extra ? '  → ' + extra : '')); };
const APP_UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Mobile Safari/537.36 TahdirApp/1';

async function signin(p, B) {
  await p.goto(B + '/', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(900);
  if (await p.$('#setupForm')) {
    await p.fill('#name', 'أ. محمد مجدي'); await p.fill('#username', USER);
    await p.fill('#password', PASS); await p.fill('#password2', PASS);
    await p.click('#setupForm button[type=submit]'); await p.waitForTimeout(1800);
    await p.goto(B + '/', { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(700);
  }
  if (await p.$('#loginForm')) {
    await p.fill('#username', USER); await p.fill('#password', PASS);
    await p.click('#loginBtn'); await p.waitForTimeout(2500);
  }
}

(async () => {
  const srv = await PW.boot();
  const { chromium, findChrome, BASE: B } = srv;
  const b = await chromium.launch({ executablePath: findChrome(), headless: true });
  const errs = [];

  // ---------- Chrome العادي ----------
  const c1 = await b.newContext({ viewport: { width: 1500, height: 950 }, locale: 'ar-OM' });
  const p1 = await c1.newPage();
  p1.on('pageerror', e => errs.push('chrome: ' + e.message));
  await signin(p1, B);
  // نصفّر أعلام الترحيب/الجولة ثم نفتح صفحة الدروس
  await p1.evaluate(() => { try { localStorage.removeItem('tahdir_tour_v1'); localStorage.removeItem('kbs_welcome_v1'); localStorage.setItem('tahdir_force_tour','1'); } catch (e) { } });
  await p1.goto(B + '/app', { waitUntil: 'domcontentloaded' });
  await p1.waitForTimeout(1500);
  // نغلق نافذة الترحيب إن ظهرت (الجولة تنتظر إغلاقها)
  await p1.evaluate(async () => {
    const ov = document.getElementById('modal');
    if (ov && !ov.hidden) { const b = ov.querySelector('#mOk, .m-actions .btn.primary, .m-actions .btn'); if (b) b.click(); }
    await new Promise(x => setTimeout(x, 900));
  });
  await p1.waitForTimeout(2200);

  // الجولة تظهر تلقائيًّا
  const t1 = await p1.evaluate(() => {
    const ov = document.getElementById('tourOv');
    return ov ? { tip: (document.getElementById('tourTip') || {}).textContent || '', hasSpot: !!document.getElementById('tourSpot') } : null;
  });
  console.log('الجولة: ' + (t1 ? JSON.stringify(t1.tip.slice(0, 90)) : 'لم تظهر'));
  ok('الجولة تظهر تلقائيًّا في أول دخول', !!t1 && /أهلًا/.test(t1.tip), t1 ? 'ظهرت' : 'لم تظهر');

  // نتنقّل في الخطوات
  const walk = await p1.evaluate(async () => {
    const out = [];
    for (let i = 0; i < 8; i++) {
      const nxt = document.getElementById('tourNext');
      if (!nxt) break;
      const tip = document.getElementById('tourTip');
      const spot = document.getElementById('tourSpot');
      out.push({ n: (document.getElementById('tourN') || {}).textContent || '',
                 head: (tip.querySelector('.tour-h') || {}).textContent || '',
                 spot: spot && !spot.hidden });
      nxt.click(); await new Promise(x => setTimeout(x, 420));
      if (!document.getElementById('tourOv')) { out.push({ done: true }); break; }
    }
    return out;
  });
  console.log('خطوات: ' + JSON.stringify(walk.map(x => x.done ? 'انتهت' : (x.head + (x.spot ? ' ⬚' : '')))));
  ok('الجولة تتنقّل خطوةً خطوة', walk.filter(x => x.head).length >= 3, walk.filter(x => x.head).length + ' خطوة');
  ok('الجولة تُظلّل عناصر الصفحة', walk.some(x => x.spot === true), 'بقعة مضيئة ظهرت');
  ok('الجولة تُغلق عند النهاية', walk.some(x => x.done) || !(await p1.$('#tourOv')), 'أُغلقت');

  // لا تعود تلقائيًّا بعد الإغلاق
  await p1.goto(B + '/app', { waitUntil: 'domcontentloaded' });
  await p1.waitForTimeout(2600);
  ok('لا تعود تلقائيًّا بعد إتمامها', !(await p1.$('#tourOv')), 'لا جولة');

  // زر «؟ دليل» يعيدها
  const reopen = await p1.evaluate(async () => {
    const btn = document.getElementById('tourBtn');
    if (!btn) return { err: 'لا زر دليل' };
    btn.click(); await new Promise(x => setTimeout(x, 700));
    return { shown: !!document.getElementById('tourOv'), label: btn.textContent.trim() };
  });
  ok('زر «؟ دليل» يعيد الجولة', !reopen.err && reopen.shown, reopen.err || reopen.label);
  await p1.evaluate(() => { const s = document.getElementById('tourSkip'); if (s) s.click(); });

  // ---------- وضع التطبيق (TahdirApp) ----------
  const c2 = await b.newContext({ viewport: { width: 420, height: 900 }, locale: 'ar-OM', userAgent: APP_UA });
  const p2 = await c2.newPage();
  p2.on('pageerror', e => errs.push('app: ' + e.message));
  await signin(p2, B);
  await p2.goto(B + '/app', { waitUntil: 'domcontentloaded' });
  await p2.waitForTimeout(3000);
  const app = await p2.evaluate(async () => {
    const btn = document.getElementById('toolBtn');
    const detected = /TahdirApp/.test(navigator.userAgent);
    // حوار الأداة في التطبيق يجب أن يقول إنها مدمجة
    let msg = '';
    try {
      if (typeof toolDialog === 'function') { toolDialog(''); await new Promise(x => setTimeout(x, 500)); }
      const box = document.getElementById('modalBox');
      msg = box ? box.textContent : '';
    } catch (e) { msg = 'ERR ' + e.message; }
    return { detected, btnHidden: !btn || btn.hidden, msg: msg.slice(0, 120) };
  });
  console.log('التطبيق: ' + JSON.stringify(app));
  ok('التطبيق يُتعرَّف عليه', app.detected, 'UA فيه TahdirApp');
  ok('زر الأداة مخفي في التطبيق', app.btnHidden, 'مخفي');
  ok('التطبيق يوضّح أن الأداة مدمجة', /مدمجة|لا تحتاج تثبيت/.test(app.msg), app.msg || '—');

  await p1.screenshot({ path: require('path').join(__dirname, 'tour.png') });
  await b.close(); srv.stop();
  const real = [...new Set(errs)];
  console.log('\nأخطاء JavaScript: ' + (real.length ? real.join('\n') : '(لا شيء)'));
  ok('لا أخطاء JavaScript', real.length === 0, real.slice(0, 3).join(' | ') || 'نظيف');
  console.log('\n=== ' + pass + ' ناجح، ' + fail + ' فاشل ===');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
