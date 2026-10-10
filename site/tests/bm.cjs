// زر «أداة نور» في شريط الإشارات: إعداد من الموقع ← إرسال ← ضغطتان في نور
const { chromium } = require('playwright');
const B = 'http://localhost:8787';
const HOME = `<html><body><h1>الرئيسية</h1><nav id=sb></nav><script>setTimeout(()=>{sb.innerHTML='<a href="/teacher/courses/browse_content/cid:111">الاحياء / التاسع</a><a href="/teacher/courses/browse_content/cid:222">الاحياء / العاشر</a>'},800)</script></body></html>`;
const PREP = `<html><body><h2>إضافة تحضير</h2><form><textarea id="weekly_study_plan_comments"></textarea></form></body></html>`;
(async () => {
  const b = await chromium.launch(); const errs = [];
  const c = await b.newContext({ viewport: { width: 1300, height: 850 }, bypassCSP: true });
  await c.route('https://lms.moe.gov.om/**', r => r.fulfill({ contentType: 'text/html; charset=utf-8', body: /add_preparation/.test(r.request().url()) ? PREP : HOME }));
  const p = await c.newPage(); p.on('pageerror', e => errs.push(e.message));
  await p.goto(B + '/'); await p.fill('#username', 'mohamed'); await p.fill('#password', 'Bio@2026x'); await p.fill('#password2', 'Bio@2026x'); await p.click('#setupForm button[type=submit]');
  await p.waitForURL(B + '/'); await p.fill('#username', 'mohamed'); await p.fill('#password', 'Bio@2026x'); await p.click('#loginBtn'); await p.waitForURL(B + '/admin');
  await p.goto(B + '/app'); await p.waitForTimeout(800);
  // no tool at all → send opens the setup dialog
  await p.evaluate(() => { const el = [...document.querySelectorAll('.tree *')].find(x => x.textContent.trim() === 'الصف العاشر'); el && el.click(); });
  await p.waitForTimeout(300);
  await p.evaluate(() => { const el = [...document.querySelectorAll('.tree *')].find(x => x.textContent.trim() === 'القلب'); el && el.click(); });
  await p.waitForSelector('#sendPrepBtn'); await p.click('#sendPrepBtn'); await p.waitForSelector('#bmLink');
  await p.waitForTimeout(800);
  const href = await p.getAttribute('#bmLink', 'href'); console.log('bookmark link ready:', href.startsWith('javascript:'), href.length);
  await p.screenshot({ path: __dirname + '/bm_dialog.png' });
  await p.click('#mOk'); console.log('bm_ok:', await p.evaluate(() => localStorage.getItem('tahdir_bm_ok')));
  await p.waitForTimeout(400);
  const np = c.waitForEvent('page'); await p.click('#sendPrepBtn'); const n = await np; await n.waitForLoadState();
  console.log('nour opened with payload:', n.url().slice(0, 60), n.url().length);
  await p.screenshot({ path: __dirname + '/bm_sent.png' });
  const code = decodeURIComponent(href.slice('javascript:'.length));
  const click = async () => { await n.evaluate(code).catch(e => errs.push('bm ' + e.message)); };
  await n.waitForTimeout(300); await click();
  await n.waitForURL(/add_preparation/, { timeout: 15000 }).catch(() => {}); console.log('after 1st click:', n.url());
  await n.waitForTimeout(300); await click(); await n.waitForTimeout(2500);
  console.log('after 2nd click: pending left =', await n.evaluate(() => localStorage.getItem('tahdir_bm_tahdir_pending_prep')), '| textarea:', (await n.inputValue('#weekly_study_plan_comments')).slice(0, 60));
  await n.screenshot({ path: __dirname + '/bm_nour.png' });
  // pressing it with nothing sent
  await n.goto('https://lms.moe.gov.om/teacher'); await click(); await n.waitForTimeout(300); console.log('nothing sent toast:', await n.evaluate(() => [...document.querySelectorAll('div')].map(d => d.textContent).find(t => /لا يوجد شيء/.test(t)) || ''));
  console.log('errors', errs); await b.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
