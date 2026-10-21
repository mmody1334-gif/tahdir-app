// نقل المنصة إلى elkabsula.site:
//  (أ) تحويل الرابط القديم (workers.dev) — ومتى لا يُحوَّل (/teqany، الموارد، التطبيقات، قبل ربط النطاق)
//  (ب) نقل الجلسة بلا دخول جديد + رسالة «تم نقل المنصة»
//  (ج) الأدوات على النطاق الجديد بنسخها الحقيقية غير المعدّلة:
//      إضافة كروم/إيدج · Tampermonkey (فايرفوكس) · Userscripts (آيفون: GM.* غير متزامنة)
// المتصفح يفتح https://elkabsula.site و https://tahdir.hudhaifa-bio.workers.dev فعلًا،
// ونمرّر الطلبات للسيرفر المحلي مع ترويسة X-Test-Host.
const PW = require('./_pw.cjs');
const fs = require('fs'), os = require('os'), path = require('path');
const NEW = 'https://elkabsula.site', OLD = 'https://tahdir.hudhaifa-bio.workers.dev';
const TOOL = fs.readFileSync(path.join(__dirname, '../server/tahdir-noor.user.js'), 'utf8'); // بلا أي تعديل
const EXT = path.join(__dirname, '../dist/ext');
const USER = 'mohamed', PASS = 'Bio@2026x';
let pass = 0, fail = 0;
const ok = (n, c, x) => { (c ? pass++ : fail++); console.log((c ? '  PASS  ' : '  FAIL  ') + n + (x !== undefined ? '  → ' + x : '')); };
const NOUR = '<html><body><h1>نور</h1></body></html>';

(async () => {
  const srv = await PW.boot({ port: 8795 });
  const B = srv.BASE;
  const get = (host, p, h = {}) => fetch(B + p, { redirect: 'manual', headers: { 'x-test-host': host, 'sec-fetch-dest': 'document', accept: 'text/html', ...h } });

  // ---------- (أ) قبل ربط النطاق: لا تحويل ----------
  let r = await get('tahdir.hudhaifa-bio.workers.dev', '/quiz');
  ok('قبل ربط النطاق: الرابط القديم لا يُحوَّل', !String(r.headers.get('location') || '').includes('elkabsula'), r.headers.get('location'));
  r = await get('www.elkabsula.site', '/app?x=1');
  ok('www يُحوَّل إلى النطاق المجرد', r.status === 301 && r.headers.get('location') === NEW + '/app?x=1');
  await get('elkabsula.site', '/version');   // أول طلب حقيقي عبر النطاق الجديد = الربط اكتمل
  r = await get('tahdir.hudhaifa-bio.workers.dev', '/quiz?u=2');
  ok('بعد الربط: صفحة قديمة → النطاق الجديد', r.status === 302 && (r.headers.get('location') || '').startsWith(NEW + '/__move?to=%2Fquiz%3Fu%3D2'), r.headers.get('location'));
  for (const p of ['/teqany', '/teqany/', '/teqany/research', '/teqany/login', '/teqany/tahdir?x=1']) {
    r = await get('tahdir.hudhaifa-bio.workers.dev', p);
    ok('لا تحويل: ' + p, !String(r.headers.get('location') || '').includes('elkabsula'), r.status + ' ' + (r.headers.get('location') || ''));
  }
  for (const p of ['/tool/tahdir-noor.user.js', '/tool/tahdir-noor.meta.js', '/version', '/download/tahdir.apk', '/manifest.webmanifest']) {
    r = await get('tahdir.hudhaifa-bio.workers.dev', p, { 'sec-fetch-dest': 'empty' });
    ok('المورد يبقى على الرابط القديم: ' + p, r.status === 200, r.status);
  }
  r = await get('tahdir.hudhaifa-bio.workers.dev', '/api/me', { 'sec-fetch-dest': 'empty', accept: 'application/json' });
  ok('/api لا يُحوَّل', r.status === 401, r.status);
  r = await get('tahdir.hudhaifa-bio.workers.dev', '/app', { 'user-agent': 'Mozilla/5.0 (Linux; Android 14) wv TahdirApp/1' });
  ok('تطبيق الموبايل المثبت لا يُحوَّل', !String(r.headers.get('location') || '').includes('elkabsula'), r.headers.get('location'));
  r = await get('elkabsula.site', '/__move?to=//evil.com');
  ok('/__move لا يقبل وجهة خارجية', r.headers.get('location') === '/', r.headers.get('location'));

  // ---------- نقل الجلسة (معلم مسجّل على الرابط القديم) ----------
  {
    const OH = { 'x-test-host': 'tahdir.hudhaifa-bio.workers.dev' };
    await fetch(B + '/api/setup', { method: 'POST', headers: { ...OH, 'content-type': 'application/json' }, body: JSON.stringify({ name: 'أ. محمد مجدي', username: USER, password: PASS }) });
    let x = await fetch(B + '/api/login', { method: 'POST', headers: { ...OH, 'content-type': 'application/json', origin: OLD }, body: JSON.stringify({ username: USER, password: PASS }) });
    const oldCk = x.headers.getSetCookie().map(v => v.split(';')[0]).join('; ');
    const oldSid = (oldCk.match(/sid=([a-f0-9]+)/) || [])[1];
    x = await get('tahdir.hudhaifa-bio.workers.dev', '/games', { cookie: oldCk });
    const loc = x.headers.get('location') || '';
    ok('التحويل يحمل رمز نقل الجلسة', /^https:\/\/elkabsula\.site\/__move\?to=%2Fgames&c=[a-f0-9]{48}$/.test(loc), loc);
    const lp = new URL(loc);
    x = await get('elkabsula.site', lp.pathname + lp.search);
    const newCk = x.headers.getSetCookie();
    ok('النطاق الجديد يضع نفس الجلسة ثم يفتح الصفحة المطلوبة', newCk.some(v => v.startsWith('sid=' + oldSid)) && newCk.some(v => v.startsWith('kmoved=1')) && x.headers.get('location') === '/games', x.headers.get('location'));
    x = await get('elkabsula.site', lp.pathname + lp.search);
    ok('رمز النقل لمرة واحدة فقط', !x.headers.getSetCookie().some(v => v.startsWith('sid=')));
    x = await get('elkabsula.site', '/games', { cookie: newCk.map(v => v.split(';')[0]).join('; ') });
    ok('المعلم داخل مباشرة على النطاق الجديد', x.status === 200, x.status);
  }

  // ---------- المتصفح ----------
  const proxy = async (route) => {
    const rq = route.request(), u = new URL(rq.url());
    if (u.hostname === 'lms.moe.gov.om') return route.fulfill({ contentType: 'text/html; charset=utf-8', body: NOUR });
    try {
      const hs = { ...(await rq.allHeaders()), 'x-test-host': u.hostname }; delete hs.host;
      const body = rq.postDataBuffer();
      const r = await fetch(B + u.pathname + u.search, { method: rq.method(), headers: hs, body: body && rq.method() !== 'GET' ? body : undefined, redirect: 'manual' });
      const out = {}; r.headers.forEach((v, k) => { if (k !== 'set-cookie' && k !== 'content-encoding' && k !== 'content-length') out[k] = v; });
      const sc = r.headers.getSetCookie(); if (sc.length) out['set-cookie'] = sc.join('\n');
      // Chromium لا يمرّر طلب ما بعد التحويل (3xx من fulfill) على route فيذهب للشبكة؛
      // فنُحاكي التحويل بصفحة تنتقل فورًا للعنوان نفسه (مع إبقاء Set-Cookie)
      if (r.status >= 300 && r.status < 400 && out.location && rq.isNavigationRequest()) {
        const to = new URL(out.location, u.href).href; delete out.location;
        out['content-type'] = 'text/html; charset=utf-8';
        return route.fulfill({ status: 200, headers: out, body: '<script>location.replace(' + JSON.stringify(to) + ')</script>' });
      }
      return route.fulfill({ status: r.status, headers: out, body: Buffer.from(await r.arrayBuffer()) });
    } catch (e) { console.log('proxy error', u.href, e.message); return route.abort(); }
  };
  const wire = async (c) => { for (const h of [NEW, OLD, 'https://www.elkabsula.site', 'https://lms.moe.gov.om']) await c.route(h + '/**', proxy); };
  const shut = (p) => p.evaluate(() => { const m = document.getElementById('modal'); if (m && !m.hidden) { m.dataset.seen = m.textContent.slice(0, 120); const b = document.getElementById('mCancel') || document.getElementById('mOk'); b && b.click(); } });
  const login = async (p, base) => {
    await p.goto(base + '/', { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(1200); await shut(p);
    if (await p.$('#setupForm')) {
      await p.fill('#name', 'أ. محمد مجدي'); await p.fill('#username', USER); await p.fill('#password', PASS); await p.fill('#password2', PASS);
      await shut(p); await p.click('#setupForm button[type=submit]'); await p.waitForTimeout(1500);
      await p.goto(base + '/', { waitUntil: 'domcontentloaded' });
    }
    if (await p.$('#loginForm')) { await p.waitForTimeout(1200); await shut(p); await p.fill('#username', USER); await p.fill('#password', PASS); await p.click('#loginBtn'); await p.waitForTimeout(2500); }
  };
  const openLesson = async (p) => {
    await p.goto(NEW + '/app', { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(2500);
    await p.evaluate(() => { const m = document.getElementById('modal'); if (m && !m.hidden) { const b = document.getElementById('mOk') || document.getElementById('mCancel'); b && b.click(); } });
    await p.evaluate(() => { const el = [...document.querySelectorAll('.tree *')].find(x => x.textContent.trim() === 'الصف العاشر'); el && el.click(); });
    await p.waitForTimeout(300);
    await p.evaluate(() => { const el = [...document.querySelectorAll('.tree *')].find(x => x.textContent.trim() === 'القلب'); el && el.click(); });
    await p.waitForSelector('#sendPrepBtn', { timeout: 8000 });
  };

  // (ب)+(ج-1) إضافة كروم/إيدج الحقيقية
  {
    const dir = fs.mkdtempSync(os.tmpdir() + '/ext-');
    const c = await PW.chromium.launchPersistentContext(dir, { channel: 'chromium', headless: true, viewport: { width: 1280, height: 850 }, locale: 'ar-OM', args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`] });
    await wire(c);
    const p = await c.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await login(p, OLD);   // المعلم مسجّل دخوله على الرابط القديم
    // (بعد بدء التحويل صار الدخول نفسه يتم على النطاق الجديد) نُعيد حالة «لم يرَ الرسالة» لنختبر ظهورها
    await p.evaluate(() => localStorage.removeItem('kabsula_moved_seen_v1'));
    // (بعد بدء التحويل صار الدخول نفسه يتم على النطاق الجديد) نُعيد حالة «لم يرَ الرسالة» لنختبر ظهورها
    await p.evaluate(() => localStorage.removeItem('kabsula_moved_seen_v1'));
    await p.goto(OLD + '/app', { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(6000);
    ok('كتابة الرابط القديم تفتح النطاق الجديد', p.url() === NEW + '/app', p.url());
    ok('الجلسة انتقلت (بلا صفحة دخول)', !(await p.$('#loginForm')));
    const msg = await p.evaluate(() => { const m = document.getElementById('modal'); return m && !m.hidden ? m.textContent : ''; });
    ok('رسالة «تم نقل المنصة» تظهر', /elkabsula\.site/.test(msg) && /نقل/.test(msg), msg.slice(0, 80));
    await p.screenshot({ path: path.join(__dirname, 'domain_move_msg.png') });
    await p.evaluate(() => document.getElementById('mOk').click());
    await p.goto(OLD + '/quiz', { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(1500);
    const again = await p.evaluate(() => { const m = document.getElementById('modal'); return !!(m && !m.hidden && /elkabsula\.site/.test(m.textContent)); });
    ok('الرسالة لا تتكرر', !again && p.url() === NEW + '/quiz', p.url());
    await p.goto(OLD + '/teqany/login', { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(1000); await shut(p);
    ok('/teqany/login يبقى على الرابط القديم', p.url() === OLD + '/teqany/login', p.url());
    if (await p.$('#loginForm')) { await p.fill('#username', USER); await p.fill('#password', PASS); await p.click('#loginForm button[type=submit], #loginBtn'); await p.waitForTimeout(2500); }
    await p.goto(OLD + '/teqany/research', { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(1500);
    ok('/teqany/research يبقى على الرابط القديم ويعمل', p.url() === OLD + '/teqany/research' && /تقني حذيفة/.test(await p.title()) && !!(await p.$('.rs-card')), p.url() + ' · ' + await p.title());
    await p.goto(OLD + '/teqany', { waitUntil: 'domcontentloaded' });
    ok('بطاقة «البحوث الإجرائية» في واجهة تقني', !!(await p.$('a.tq-c[href="/teqany/research"]')));
    await openLesson(p);
    const at = await p.evaluate(() => [document.documentElement.getAttribute('data-tahdir-tool'), document.documentElement.getAttribute('data-tahdir-ext')]);
    ok('إضافة كروم/إيدج تعمل على elkabsula.site', !!at[0] && !!at[1], JSON.stringify(at));
    // تبويب تفتحه الإضافة لا يمر على route (قيد في Playwright) فيفشل تحميله هنا؛ نلتقط عنوانه المطلوب
    const tried = []; c.on('requestfailed', q => tried.push(q.url())); c.on('request', q => tried.push(q.url()));
    const np = c.waitForEvent('page', { timeout: 10000 }).catch(() => null);
    await p.click('#sendPrepBtn');
    const n = await np; await p.waitForTimeout(2000);
    const lms = tried.find(u => /lms\.moe\.gov\.om/.test(u)) || (n && n.url());
    ok('إضافة كروم: «إرسال إلى نور» يفتح نور', /lms\.moe\.gov\.om/.test(lms || ''), lms);
    ok('بلا أخطاء صفحة (كروم)', !errs.length, errs.join(' | '));
    await c.close();
  }

  // (ج-2) Tampermonkey على فايرفوكس: GM_* متزامنة + السكربت كما هو
  // (ج-3) Userscripts على آيفون (سفاري): GM.* غير متزامنة فقط، بشاشة iPhone
  for (const kind of ['tampermonkey', 'iphone']) {
    const b = await PW.chromium.launch({ executablePath: PW.findChrome(), headless: true });
    const dev = kind === 'iphone' ? require('playwright-core').devices['iPhone 13'] : { viewport: { width: 1300, height: 900 } };
    const c = await b.newContext({ ...dev, locale: 'ar-OM' });
    await wire(c);
    const shim = kind === 'tampermonkey'
      ? "var S={};window.GM_getValue=function(k,d){return k in S?S[k]:d};window.GM_setValue=function(k,v){S[k]=v};window.GM_deleteValue=function(k){delete S[k]};window.GM_registerMenuCommand=function(){};window.__opened='';window.GM_openInTab=function(u){window.__opened=String(u)};window.unsafeWindow=window;"
      : "var S={};window.GM={getValue:function(k,d){return Promise.resolve(k in S?S[k]:d)},setValue:function(k,v){S[k]=v;return Promise.resolve()},deleteValue:function(k){delete S[k];return Promise.resolve()},listValues:function(){return Promise.resolve(Object.keys(S))},openInTab:function(u){window.__opened=String(u);return Promise.resolve({})}};window.__opened='';";
    // مدير السكربتات يحقن فقط حيث تطابق @match: نتحقق من ذلك هنا بنفس قائمة الرأس
    const matches = [...TOOL.slice(0, TOOL.indexOf('==/UserScript==')).matchAll(/@match\s+(\S+)/g)].map(m => m[1]);
    ok(kind + ': @match يشمل https://elkabsula.site/*', matches.includes('https://elkabsula.site/*'));
    await c.addInitScript(`(function(){ if (!/^(elkabsula\\.site|lms\\.moe\\.gov\\.om)$/.test(location.hostname)) return; ${shim} try { ${TOOL} } catch (e) { window.__toolErr = String(e && e.message); } })();`);
    const p = await c.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await login(p, NEW);
    await openLesson(p);
    const at = await p.evaluate(() => [document.documentElement.getAttribute('data-tahdir-tool'), window.__toolErr || '']);
    ok(kind + ': الأداة تعمل على elkabsula.site', !!at[0] && !at[1], JSON.stringify(at));
    const pop = c.waitForEvent('page', { timeout: 6000 }).catch(() => null);
    await p.click('#sendPrepBtn'); await p.waitForTimeout(2500);
    const opened = await p.evaluate(() => window.__opened || '');
    const pp = await pop;
    const target = opened || (pp && pp.url()) || '';
    ok(kind + ': «إرسال إلى نور» يفتح نور', /lms\.moe\.gov\.om/.test(target), target.slice(0, 90));
    ok(kind + ': بلا أخطاء صفحة', !errs.length, errs.join(' | '));
    await b.close();
  }

  console.log(`\n${pass} PASS / ${fail} FAIL`);
  srv.stop(); process.exit(fail ? 1 : 0);
})().catch(e => { console.error('ERROR', e); process.exit(2); });
