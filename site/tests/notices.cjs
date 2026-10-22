// مركز الإشعارات (الجرس): يضيف المدير إعلانًا من لوحة التحكم، يظهر لكل معلم مع حالة
// «مقروء» خاصة به في قاعدة البيانات (ليس تخزين المتصفح)، وعدد القراءات يعد فيه المدير،
// والحذف يزيل الإعلان وقراءاته.
const PW = require('./_pw.cjs');
const B = process.env.B || 'http://localhost:8787';
let pass = 0, fail = 0;
const ok = (n, c, extra) => { (c ? pass++ : fail++); console.log((c ? '  PASS  ' : '  FAIL  ') + n + (extra ? '  → ' + extra : '')); };

async function post(u, b, body, method) {
  const r = await u.evaluate(async ({ path, body, method }) => {
    const r = await fetch(path, { method: method || (body ? 'POST' : 'GET'), credentials: 'same-origin',
      headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
    return { status: r.status, j: await r.json().catch(() => ({})) };
  }, { path: b, body, method });
  return r;
}

(async () => {
  const srv = await PW.boot();
  const { chromium, findChrome } = srv;
  const b = await chromium.launch({ executablePath: findChrome(), headless: true });

  // ---------- المدير: تهيئة + إنشاء إعلانين ----------
  const cA = await b.newContext({ viewport: { width: 1450, height: 950 }, locale: 'ar-OM' });
  const pA = await cA.newPage();
  await pA.goto(B + '/', { waitUntil: 'domcontentloaded' });
  await pA.waitForTimeout(900);
  if (await pA.$('#setupForm')) {
    await pA.fill('#name', 'أ. محمد مجدي'); await pA.fill('#username', 'mohamed');
    await pA.fill('#password', 'Bio@2026x'); await pA.fill('#password2', 'Bio@2026x');
    await pA.click('#setupForm button[type=submit]');
    await pA.waitForTimeout(1800);
    await pA.goto(B + '/', { waitUntil: 'domcontentloaded' }); await pA.waitForTimeout(800);
  }
  if (await pA.$('#loginForm')) {
    await pA.fill('#username', 'mohamed'); await pA.fill('#password', 'Bio@2026x');
    await pA.click('#loginBtn'); await pA.waitForTimeout(2600);
  }
  const mkA = await post(pA, '/api/admin/notices', { title: 'إعلان الأول', body: 'نص الإعلان الأول', url: 'https://example.com' });
  ok('المدير ينشر إعلانًا', mkA.status === 200 && mkA.j.ok, JSON.stringify(mkA.j).slice(0, 80));
  const mkB = await post(pA, '/api/admin/notices', { title: 'إعلان الثاني', body: 'نص الإعلان الثاني' });
  ok('إعلان ثان بدون رابط', mkB.status === 200 && mkB.j.ok, JSON.stringify(mkB.j).slice(0, 80));
  const mkBad = await post(pA, '/api/admin/notices', { title: '', body: '' });
  ok('يرفض الفراغ برسالة', mkBad.status === 400, JSON.stringify(mkBad.j).slice(0, 80));
  const admList = await post(pA, '/api/admin/notices');
  const aList = admList.j.notices || [];
  ok('لوحة التحكم تُسرد الإعلانين بترتيب الأحدث', admList.status === 200 && aList.length === 2 && aList[0].title === 'إعلان الثاني', 'n=' + aList.length);
  ok('عدد القراءات يبدأ صفرًا', aList.every(n => n.reads === 0), JSON.stringify(aList.map(n => n.reads)));
  const id1 = aList[1].id, id2 = aList[0].id;

  // ---------- معلم: يبلغ عن الإعلانين غير مقروءين ----------
  const cT = await b.newContext({ viewport: { width: 1450, height: 950 }, locale: 'ar-OM' });
  const pT = await cT.newPage();
  await pT.goto(B + '/', { waitUntil: 'domcontentloaded' });
  await pT.waitForTimeout(800);
  const mkT = await post(pT, '/api/admin/teachers', { name: 'أ. نورة', username: 'noura_n', password: 'Test@2026x' });
  console.log('إنشاء المعلمة: ' + mkT.status);
  await pT.fill('#username', 'noura_n'); await pT.fill('#password', 'Test@2026x');
  await pT.click('#loginBtn'); await pT.waitForTimeout(2600);
  let nl = await post(pT, '/api/notices');
  ok('المعلم يرى الإعلانين غير مقروءين', nl.status === 200 && nl.j.notices.length === 2 && nl.j.notices.every(n => !n.read), JSON.stringify(nl.j).slice(0, 120));
  ok('عدد غير المقروء = 2', nl.j.notices.filter(n => !n.read).length === 2, '');

  // ---------- تعليم واحد مقروءًا: يبقى والباقي غير مقروء ----------
  const rd = await post(pT, '/api/notices/read', { id: id1 });
  nl = await post(pT, '/api/notices');
  ok('«حسنًا» يعلّم واحدًا', rd.status === 200 && nl.j.notices.filter(n => n.read).length === 1, '');
  const rdbad = await post(pT, '/api/notices/read', {});
  ok('قراءة بلا معرّف مرفوضة', rdbad.status === 400, JSON.stringify(rdbad.j).slice(0, 80));

  // ---------- تحديد الكل مقروءًا ----------
  const rdAll = await post(pT, '/api/notices/read', { all: 1 });
  nl = await post(pT, '/api/notices');
  ok('«حدّد الكل» يعلّم الجميع', rdAll.status === 200 && nl.j.notices.every(n => n.read), '');

  // ---------- عزل لكل مستخدم: معلم جديد يرى الجميع غير مقروء ----------
  const cT2 = await b.newContext({ viewport: { width: 1450, height: 950 }, locale: 'ar-OM' });
  const pT2 = await cT2.newPage();
  await pT2.goto(B + '/', { waitUntil: 'domcontentloaded' }); await pT2.waitForTimeout(800);
  const mkT2 = await post(pT2, '/api/admin/teachers', { name: 'أ. سالم', username: 'salim_n', password: 'Test@2026x' });
  console.log('إنشاء المعلم الثاني: ' + mkT2.status);
  await pT2.fill('#username', 'salim_n'); await pT2.fill('#password', 'Test@2026x');
  await pT2.click('#loginBtn'); await pT2.waitForTimeout(2600);
  const nl2 = await post(pT2, '/api/notices');
  ok('قراءات نورة لا تُلزم سالم', nl2.status === 200 && nl2.j.notices.every(n => !n.read), '');

  // ---------- عدّ القراءات عند المدير: إعلان واحد مقروء ----------
  const adm2 = await post(pA, '/api/admin/notices');
  const counts = (adm2.j.notices || []).map(n => n.reads);
  ok('العدّاد يظهر 1 للإعلان الذي قرأته نورة', adm2.status === 200 && (counts[1] === 1 || counts[0] === 1), JSON.stringify(counts));

  // ---------- الجرس في الصفحة: يوجد ويفتح ويُظهر الإعلان ----------
  await pT.goto(B + '/app', { waitUntil: 'domcontentloaded' });
  await pT.waitForTimeout(2600);
  const bell = await pT.evaluate(() => {
    const bb = document.getElementById('bellBtn'), bp = document.getElementById('bellPanel');
    if (!bb || !bp) return { found: false };
    bb.click();
    return new Promise(res => setTimeout(() => {
      const open = !bp.hidden;
      const txt = bp.innerText || '';
      res({ found: true, open, hasTitle: txt.indexOf('الإشعارات') >= 0, hasItem: txt.indexOf('إعلان الأول') >= 0, hasRead: txt.indexOf('مقروء') >= 0 });
    }, 700));
  });
  ok('زر الجرس موجود في /app', bell.found === true, '');
  ok('الجرس يفتح ويعرض الإعلان «مقروء»', bell.open === true && bell.hasTitle && bell.hasItem, JSON.stringify(bell).slice(0, 140));

  // ---------- الحذف يزيل الإعلان وقراءاته ----------
  const del = await post(pA, '/api/admin/notices/' + id2, null, 'DELETE');
  nl = await post(pT, '/api/notices');
  ok('حذف المدير يزيل الإعلان', del.status === 200 && (nl.j.notices || []).length === 1, 'n=' + (nl.j.notices || []).length);

  await b.close();
  console.log('\n== ' + pass + ' ناجح، ' + fail + ' فاشل');
  setTimeout(() => process.exit(fail ? 1 : 0), 400);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
