// site/tests/test_arena_rooms_ui.cjs
// تجربة الواجهة الكاملة لغرف «ساحة التحدي» في متصفحات حقيقية (Playwright) على wrangler dev:
// المعلم يحدد دروسًا من /arena ويستضيف ← ينتقل إلى /blooket/<رقم> (اللوبي)
// طالبان (كمبيوتر وجوال) يدخلان من /blooket برقم الغرفة ← يظهران في اللوبي ← البدء ← اللعب والصناديق ← لوحة حية ← النتائج.
// اللقطات تُحفظ في مجلد يُمرَّر كوسيط أول (افتراضيًا مجلد مؤقت، ولا تُرفع إلى المستودع).

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { chromium, devices } = require('playwright');

const OUT = path.resolve(process.argv[2] || path.join(os.tmpdir(), 'arena_screens'));
fs.mkdirSync(OUT, { recursive: true });
let pass = 0, fail = 0;
const ok = (n, c, extra) => { if (c) pass++; else fail++; console.log((c ? '  PASS  ' : '  FAIL  ') + n + (extra ? '  → ' + extra : '')); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const PORT = 8797, BASE = `http://127.0.0.1:${PORT}`;
const persist = fs.mkdtempSync(path.join(os.tmpdir(), 'arena-ui-'));

(async () => {
  const proc = spawn('npx', ['--yes', 'wrangler@3.114.0', 'dev', '--local', '--port', String(PORT), '--persist-to', persist, '--var', 'ARENA_LIVE_ENABLED:true'],
    { cwd: path.join(__dirname, '..'), shell: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let ready = false;
  for (let i = 0; i < 120; i++) { await sleep(500); try { if ((await fetch(`${BASE}/api/arena/courses`)).ok) { ready = true; break; } } catch (e) {} }
  if (!ready) { console.error('wrangler dev لم يعمل'); proc.kill(); process.exit(1); }

  const browser = await chromium.launch();
  const errors = [];
  const shot = async (pg, name) => { await sleep(350); await pg.screenshot({ path: path.join(OUT, name + '.png'), fullPage: false }); };
  try {
    await fetch(`${BASE}/api/setup`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'المدير', username: 'boss_ui', password: 'Ui@2026admin!', password2: 'Ui@2026admin!' }) });
    const la = await (await fetch(`${BASE}/api/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'boss_ui', password: 'Ui@2026admin!' }) })).json();
    const aH = { 'Content-Type': 'application/json', Cookie: `sid=${la.sid}; did=${la.did}`, 'X-Tahdir-Sid': la.sid, 'X-Tahdir-Did': la.did };
    await fetch(`${BASE}/api/admin/teachers`, { method: 'POST', headers: aH, body: JSON.stringify({ name: 'أ. محمد', username: 't_ui', password: 'Mohamed@2026ui', role: 'teacher' }) });
    const lt = await (await fetch(`${BASE}/api/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 't_ui', password: 'Mohamed@2026ui' }) })).json();

    // المعلم (كمبيوتر)
    const tctx = await browser.newContext({ viewport: { width: 1366, height: 860 }, deviceScaleFactor: 1, locale: 'ar' });
    await tctx.addCookies([{ name: 'sid', value: lt.sid, url: BASE }, { name: 'did', value: lt.did, url: BASE }]);
    await tctx.addInitScript(([s, d]) => { try { localStorage.setItem('tahdir_sid_v1', s); localStorage.setItem('tahdir_did_v1', d); } catch (e) {} }, [lt.sid, lt.did]);
    const T = await tctx.newPage();
    T.on('pageerror', e => errors.push('T: ' + e.message));
    T.on('dialog', d => d.accept().catch(() => {}));

    // الرئيسية: بطاقة ساحة التحدي ظاهرة
    await T.goto(`${BASE}/app`);
    await T.waitForSelector('[data-home="arena"]', { timeout: 15000 }).catch(() => {});
    ok('بطاقة «ساحة التحدي» ظاهرة في الرئيسية', await T.locator('[data-home="arena"]').count() === 1);
    await shot(T, '00_home_card');

    await T.goto(`${BASE}/arena`);
    await T.waitForSelector('#arStartBtn', { timeout: 15000 });
    await T.waitForSelector('#arLiveBtn', { timeout: 8000 }).catch(() => {});
    ok('زر «استضف لعبة مباشرة» ظاهر للمعلم', await T.locator('#arLiveBtn').count() === 1);
    // أزرار الخيارات غير المحددة يجب أن تكون مقروءة (ليست أبيض على أبيض)
    const pill = await T.locator('#arQCountPills .btn.ghost').first().evaluate(el => {
      const cs = getComputedStyle(el); return { c: cs.color, b: cs.backgroundColor, t: el.innerText };
    });
    ok('أزرار عدد الأسئلة غير المختارة مقروءة', pill.c !== pill.b && !/255, 255, 255\)$/.test(pill.c) && pill.t.length > 0, `لون ${pill.c} على ${pill.b}`);
    await shot(T, '01_arena_setup');

    await T.click('#arLiveBtn');
    await T.waitForSelector('#arCreateRoom');
    await shot(T, '02_host_setup_modal');
    await T.click('#arCreateRoom');
    await T.waitForURL(/\/blooket\/\d{6}$/, { timeout: 15000 });
    const code = T.url().match(/(\d{6})$/)[1];
    ok('المعلم انتقل إلى رابط الغرفة /blooket/<رقم>', /^\d{6}$/.test(code), T.url());
    await T.waitForSelector('#arStartLive');
    ok('زر البدء معطّل واللوبي فارغ', await T.locator('#arStartLive').isDisabled());
    await shot(T, '03_host_lobby_empty');

    // الطالب 1 (كمبيوتر) يدخل من /blooket
    const s1ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: 'ar' });
    const S1 = await s1ctx.newPage();
    S1.on('pageerror', e => errors.push('S1: ' + e.message));
    await S1.goto(`${BASE}/blooket`);
    await S1.waitForSelector('#arCodeIn');
    ok('صفحة إدخال الرقم بلا قوائم المعلم', await S1.locator('header.top').isHidden());
    await S1.fill('#arCodeIn', code);
    await shot(S1, '04_student_enter_code');
    await S1.click('#arCodeForm button[type=submit]');
    await S1.waitForSelector('#arNameIn');
    await S1.fill('#arNameIn', 'أحمد العماني');
    await S1.locator('.ar-av-opt').nth(2).click();
    await shot(S1, '05_student_join_form');
    await S1.click('#arJoinBtn');
    await S1.waitForSelector('.ar-lobby-me');
    await shot(S1, '06_student_lobby');

    // الطالب 2 (جوال)
    const s2ctx = await browser.newContext({ ...devices['iPhone 13'], locale: 'ar' });
    const S2 = await s2ctx.newPage();
    S2.on('pageerror', e => errors.push('S2: ' + e.message));
    await S2.goto(`${BASE}/blooket/${code}`);
    await S2.waitForSelector('#arNameIn');
    await S2.fill('#arNameIn', 'سارة');
    await S2.click('#arJoinBtn');
    await S2.waitForSelector('.ar-lobby-me');
    await shot(S2, '07_student2_lobby_mobile');

    await T.waitForFunction(() => document.querySelectorAll('.ar-lobby-p').length === 2, null, { timeout: 5000 });
    ok('الطالبان ظهرا في لوبي المعلم فورًا', await T.locator('.ar-lobby-p').count() === 2);
    ok('زر البدء صار متاحًا', !(await T.locator('#arStartLive').isDisabled()));
    await shot(T, '08_host_lobby_2');

    await T.click('#arStartLive');
    await T.waitForSelector('.ar-board', { timeout: 6000 });
    await S1.waitForSelector('.ar-ans', { timeout: 6000 });
    await S2.waitForSelector('.ar-ans', { timeout: 6000 });
    await shot(S1, '09_student_question');
    await shot(S2, '10_student2_question_mobile');

    // الطالب 1 يجيب صح (من الإجابات الصحيحة في البنك)، الطالب 2 خطأ
    const data = await (await fetch(`${BASE}/api/arena/data?key=${encodeURIComponent('الأحياء|التاسع')}`, { headers: { Cookie: `sid=${lt.sid}` } })).json();
    const norm = t => String(t || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    const key = {};
    (data.units || []).forEach(u => u.lessons.forEach(l => (l.items || []).forEach(q => { key[norm(q.stem)] = q.correct; })));
    async function answer(pg, right) {
      await pg.waitForSelector('.ar-ans:not([disabled])', { timeout: 6000 });
      const stem = norm(await pg.locator('.ar-q-stem').innerText());
      const c = key[stem];
      const idx = right ? (c == null ? 0 : c) : ((c == null ? 0 : c) + 1) % (await pg.locator('.ar-ans').count());
      await pg.locator('.ar-ans').nth(idx).click();
    }
    let gotChest = false;
    for (let r = 0; r < 4; r++) {
      await answer(S1, true);
      const ch = await S1.waitForSelector('.ar-chest', { timeout: 4000 }).catch(() => null);
      if (ch) {
        if (!gotChest) await shot(S1, '11_student_chests');
        gotChest = true;
        await S1.locator('.ar-chest').nth(r % 3).click();
        await S1.waitForSelector('#arChestNext', { timeout: 4000 });
        if (r === 0) await shot(S1, '12_student_chest_result');
        await S1.click('#arChestNext');
      } else {
        await sleep(1700);
      }
      if (r < 2) {
        await answer(S2, false);
        if (r === 0) { await S2.waitForSelector('.ar-fb.bad', { timeout: 3000 }).catch(() => {}); await shot(S2, '13_student2_wrong_mobile'); }
        await sleep(1700);
      }
    }
    ok('الإجابة الصحيحة تفتح صناديق الذهب', gotChest);
    await sleep(600);
    const rows = await T.locator('.ar-row').allInnerTexts();
    ok('لوحة المعلم الحية تعرض الطالبين وأحمد في الصدارة', rows.length === 2 && /أحمد/.test(rows[0]), rows.map(x => x.replace(/\s+/g, ' ')).join(' | '));
    await shot(T, '14_host_live_board');

    await T.click('#arEndBtn');
    await T.waitForSelector('.ar-podium', { timeout: 6000 }).catch(() => {});
    ok('النتائج النهائية والمنصة عند المعلم', await T.locator('.ar-podium').count() === 1);
    await shot(T, '15_host_results');
    await S1.waitForSelector('.ar-end-me', { timeout: 6000 });
    await shot(S1, '16_student_result');
    await S2.waitForSelector('.ar-end-me', { timeout: 6000 });
    await shot(S2, '17_student2_result_mobile');

    // الجوال: صفحة إدخال الرقم ولوبي المعلم على الجوال
    const mctx = await browser.newContext({ ...devices['iPhone 13'], locale: 'ar' });
    const M = await mctx.newPage();
    await M.goto(`${BASE}/blooket`);
    await M.waitForSelector('#arCodeIn');
    await shot(M, '18_enter_code_mobile');
    const hasHScroll = await M.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    ok('لا تمرير أفقي على الجوال', !hasHScroll);

    ok('لا أخطاء JavaScript في الصفحات', errors.length === 0, errors.join(' ; '));
  } catch (e) {
    console.error('FATAL', e); fail++;
  } finally {
    await browser.close();
    proc.kill('SIGTERM');
    try { require('child_process').execSync(`pkill -f "wrangler.*${PORT}"`); } catch (e) {}
  }
  console.log('\n=== النتيجة: ' + pass + ' ناجح، ' + fail + ' فاشل ===');
  process.exit(fail ? 1 : 0);
})();
