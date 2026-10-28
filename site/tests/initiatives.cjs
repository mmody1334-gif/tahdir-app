// المبادرات (تقني حذيفة فقط): معلم يرفع مبادرة بصورة وPDF ← معلم آخر لا يراها ← المدير يراها باسم صاحبها ← غير موجودة في الكبسولة
const PW = require('./_pw.cjs');
const OUT = process.env.OUT || __dirname;
let pass = 0, fail = 0;
const ok = (n, c, x) => { (c ? pass++ : fail++); console.log((c ? '  PASS  ' : '  FAIL  ') + n + (x !== undefined ? '  → ' + x : '')); };
const fs = require('fs'), path = require('path'), zlib = require('zlib');
function png(w, h) { // صورة PNG حقيقية بسيطة
  const raw = Buffer.alloc((w * 3 + 1) * h); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const o = y * (w * 3 + 1) + 1 + x * 3; raw[o] = x % 256; raw[o + 1] = y % 256; raw[o + 2] = 120; }
  const crc = b => { let c, t = []; for (let n = 0; n < 256; n++) { c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } c = 0xffffffff; for (const x of b) c = t[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const ch = (ty, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(ty), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), ch('IHDR', ih), ch('IDAT', zlib.deflateSync(raw)), ch('IEND', Buffer.alloc(0))]);
}
(async () => {
  const s = await PW.boot({ port: +(process.env.PORT || 8811) }); const B = s.BASE;
  const D = fs.mkdtempSync(path.join(require('os').tmpdir(), 'init-'));
  fs.writeFileSync(D + '/big1.png', png(2400, 1600)); fs.writeFileSync(D + '/b.png', png(300, 200));
  fs.writeFileSync(D + '/report.pdf', Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n' + 'x'.repeat(1500000)));
  const b = await PW.chromium.launch({ headless: true });
  const errs = [];
  async function ctx(vp) { const c = await b.newContext({ viewport: vp || { width: 1300, height: 950 }, locale: 'ar-OM' }); await c.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort()); const p = await c.newPage(); p.on('pageerror', e => errs.push(e.message)); return p; }
  const shut = p => p.evaluate(() => { const m = document.getElementById('modal'); if (m && !m.hidden) { const x = document.getElementById('mCancel') || document.getElementById('mOk'); x && x.click(); } });
  const login = async (p, u, pw) => { await p.goto(B + '/teqany/login', { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(600); await shut(p); await p.fill('#username', u); await p.fill('#password', pw); await p.click('#loginBtn'); await p.waitForTimeout(2000); };
  // المدير
  const a = await ctx();
  await a.goto(B + '/', { waitUntil: 'domcontentloaded' }); await a.waitForTimeout(800); await shut(a);
  if (await a.$('#setupForm')) { await a.fill('#name', 'أ. محمد مجدي'); await a.fill('#username', 'mohamed'); await a.fill('#password', 'Bio@2026x'); await a.fill('#password2', 'Bio@2026x'); await a.click('#setupForm button[type=submit]'); await a.waitForTimeout(1500); }
  await login(a, 'mohamed', 'Bio@2026x');
  for (const [n, u] of [['أ. سالم الكعبي', 'salem'], ['أ. مريم البلوشي', 'maryam']])
    await a.evaluate(([n, u]) => api('/api/admin/teachers', { name: n, username: u, password: 'Teach@2026' }).catch(() => {}), [n, u]);
  // الكبسولة لا تحتوي القسم
  await a.goto(B + '/app', { waitUntil: 'domcontentloaded' }); await a.waitForTimeout(800);
  ok('الكبسولة: لا يوجد «المبادرات» في القائمة', !(await a.content()).includes('المبادرات'));
  const r404 = await a.evaluate(() => fetch('/initiatives').then(r => r.url + ' ' + r.status));
  ok('الكبسولة: /initiatives ليست صفحة', !/\/initiatives 200$/.test(r404), r404);
  // واجهة تقني فيها الكارت
  await a.goto(B + '/teqany', { waitUntil: 'domcontentloaded' });
  ok('كارت المبادرات في واجهة تقني', !!(await a.$('a.tq-c[href="/teqany/initiatives"]')));
  // المعلم سالم يرفع مبادرة
  const t = await ctx();
  await login(t, 'salem', 'Teach@2026');
  await t.goto(B + '/teqany/tahdir', { waitUntil: 'domcontentloaded' }); await t.waitForTimeout(800);
  ok('رابط المبادرات في «المزيد» داخل تقني', !!(await t.$('#menuList a[href="/teqany/initiatives"]')));
  await t.goto(B + '/teqany/initiatives', { waitUntil: 'domcontentloaded' }); await t.waitForTimeout(1500); await shut(t);
  ok('صفحة المعلم: «مبادراتي» فارغة', /مبادراتي/.test(await t.textContent('#inMain')) && !!(await t.$('.in-empty')));
  await t.click('#inNew'); await t.waitForTimeout(300);
  await t.click('#inSave'); await t.waitForTimeout(300);
  ok('العنوان إجباري', !(await t.$eval('#inErr', e => e.hidden)));
  await t.fill('#inTitle', 'مبادرة قارئ الأحياء الصغير');
  await t.fill('#inSum', 'نبذة: قراءة يومية لمدة عشر دقائق.\nسطر ثانٍ.');
  await t.fill('#inGoals', 'تنمية القراءة\nرفع التحصيل');
  await t.evaluate(() => { const i = document.getElementById('inFile'); i.addEventListener('change', () => { window.__f = [...i.files].map(f => f.name + ':' + f.type + ':' + f.size).join(' | '); }, true); });
  await t.setInputFiles('#inFile', [D + '/big1.png', D + '/b.png', D + '/report.pdf']);
  await t.waitForTimeout(400);
  ok('معاينة 3 ملفات قبل الرفع', (await t.$$('.in-pi.new')).length === 3);
  await t.click('#inSave'); await t.waitForSelector('.in-card', { timeout: 20000 }); await t.waitForTimeout(1500);
  const card = await t.evaluate(() => ({ h: document.querySelector('.in-card h3').textContent, imgs: [...document.querySelectorAll('.in-th img')].filter(i => i.naturalWidth > 0).map(i => i.naturalWidth), docs: document.querySelectorAll('[data-doc]').length, br: document.querySelector('.in-card p').innerHTML.includes('<br>') }));
  ok('المبادرة محفوظة بالعنوان', card.h === 'مبادرة قارئ الأحياء الصغير');
  ok('صورتان معروضتان + PDF', card.imgs.length === 2 && card.docs === 1, JSON.stringify(card));
  ok('الصورة الكبيرة صُغّرت قبل الرفع (≤1800px)', Math.max(...card.imgs) <= 1800, card.imgs.join(','));
  ok('الأسطر محفوظة', card.br);
  await t.click('.in-th'); await t.waitForTimeout(800);
  ok('عارض الصور يفتح', await t.evaluate(() => { const i = document.querySelector('.in-view img'); return !!i && i.naturalWidth > 0; }));
  await t.screenshot({ path: OUT + '/init_viewer.png' });
  await t.keyboard.press('Escape'); await t.waitForTimeout(200);
  ok('العارض يُغلق بـ Esc', !(await t.$('.in-view')));
  await t.screenshot({ path: OUT + '/init_teacher.png', fullPage: true });
  // تعديل: حذف صورة وإضافة عنوان جديد
  await t.click('[data-ed]'); await t.waitForTimeout(800);
  await t.fill('#inTitle', 'مبادرة قارئ الأحياء'); await t.click('[data-rm-old]'); await t.click('#inSave'); await t.waitForTimeout(2500);
  const e2 = await t.evaluate(() => ({ h: document.querySelector('.in-card h3').textContent, n: document.querySelectorAll('.in-th,[data-doc]').length }));
  ok('التعديل وحذف إثبات', e2.h === 'مبادرة قارئ الأحياء' && e2.n === 2, JSON.stringify(e2));
  const fid = await t.evaluate(() => api('/api/init').then(r => r.items[0].files[0].id));
  // الطباعة
  await t.evaluate(() => { window.print = () => { window.__p = document.getElementById('printArea').innerHTML; }; });
  await t.click('[data-pr]'); await t.waitForFunction(() => window.__p, null, { timeout: 8000 });
  ok('الطباعة بالترويسة الرسمية', await t.evaluate(() => /class="ohead"/.test(window.__p) && /مبادرة قارئ الأحياء/.test(window.__p)));
  // معلم آخر
  const m2 = await ctx({ width: 390, height: 844 });
  await login(m2, 'maryam', 'Teach@2026');
  await m2.goto(B + '/teqany/initiatives', { waitUntil: 'domcontentloaded' }); await m2.waitForTimeout(1500); await shut(m2);
  ok('معلم آخر لا يرى مبادرات غيره', !(await m2.$('.in-card')));
  const st = await m2.evaluate(id => fetch('/api/init/file/' + id, { headers: { 'X-Tahdir-Sid': sidGet() } }).then(r => r.status), fid);
  ok('معلم آخر لا يفتح ملفات غيره', st === 404, st);
  const st2 = await m2.evaluate(() => api('/api/init/1', null, 'DELETE').then(() => 'ok', e => e.message));
  ok('معلم آخر لا يحذف مبادرة غيره', st2 !== 'ok', st2);
  await m2.screenshot({ path: OUT + '/init_mobile_empty.png' });
  // المدير يرى الكل
  await a.goto(B + '/teqany/initiatives', { waitUntil: 'domcontentloaded' }); await a.waitForTimeout(2000); await shut(a);
  const ad = await a.evaluate(() => ({ head: document.querySelector('.an-head h2').textContent, who: (document.querySelector('.in-who') || {}).textContent, sel: !!document.getElementById('inT'), imgs: [...document.querySelectorAll('.in-th img')].filter(i => i.naturalWidth > 0).length, ed: !!document.querySelector('[data-ed]') }));
  ok('المدير يرى «مبادرات المعلمين» باسم صاحبها', /مبادرات المعلمين/.test(ad.head) && ad.who === 'أ. سالم الكعبي', JSON.stringify(ad));
  ok('المدير يرى الإثباتات وفلتر المعلم', ad.imgs === 1 && ad.sel);
  await a.screenshot({ path: OUT + '/init_admin.png', fullPage: true });
  const pdf = await a.evaluate(id => api('/api/init').then(r => r.items[0].files.find(f => f.mime === 'application/pdf')).then(f => fetch('/api/init/file/' + f.id, { headers: { 'X-Tahdir-Sid': sidGet() } })).then(r => r.arrayBuffer().then(b => r.headers.get('content-type') + ' ' + b.byteLength)));
  ok('المدير يفتح الـPDF كاملًا', /^application\/pdf \d+$/.test(pdf) && +pdf.split(' ')[1] > 1500000, pdf);
  // رفض نوع غير مسموح
  const bad = await t.evaluate(() => api('/api/init').then(r => fetch('/api/init/' + r.items[0].id + '/file', { method: 'POST', headers: { 'Content-Type': 'text/html', 'X-Tahdir-Sid': sidGet() }, body: '<script>' }).then(x => x.status)));
  ok('رفض ملف HTML', bad === 400, bad);
  // حذف من المدير
  await a.evaluate(() => api('/api/init').then(r => api('/api/init/' + r.items[0].id, null, 'DELETE')));
  const left = await t.evaluate(() => api('/api/init').then(r => r.items.length));
  ok('حذف المدير للمبادرة', left === 0, left);
  ok('بلا أخطاء جافاسكربت', errs.length === 0, errs.join(' | '));
  console.log(`\n${pass} pass, ${fail} fail`); await b.close(); s.stop && s.stop(); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
