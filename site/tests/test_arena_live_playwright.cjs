// site/tests/test_arena_live_playwright.cjs
// اختبار Playwright الشامل للمرحلة 4 (شاشات اللعب المباشر للمعلم والطلاب)
// يُشغّل wrangler dev حقيقي ويحاكي: معلم على سطح المكتب + طالب على سطح المكتب + طالب على هاتف جوال
// يلتقط صور شاشات للجوال والكمبيوتر لكل شاشة ويتحقق من الوصول لمنصة التتويج

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const PW = require('./_pw.cjs');

const PORT = 8798;
const BASE = `http://127.0.0.1:${PORT}`;
const tempPersist = fs.mkdtempSync(path.join(os.tmpdir(), 'wrangler-arena-pw-'));
const screensDir = path.join(__dirname, '../../docs/arena_screens');
if (!fs.existsSync(screensDir)) fs.mkdirSync(screensDir, { recursive: true });

let pass = 0, fail = 0;
const ok = (n, c, extra) => {
  if (c) pass++; else fail++;
  console.log((c ? '  PASS  ' : '  FAIL  ') + n + (extra ? '  → ' + extra : ''));
};

(async () => {
  console.log('=== بدء اختبار Playwright للمرحلة 4 (معلم + طالبان حتى المنصة) ===');

  // تشغيل خادم wrangler dev مع ARENA_LIVE_ENABLED=true
  const proc = spawn('npx', [
    '--yes', 'wrangler@3.114.0', 'dev',
    '--local',
    '--port', String(PORT),
    '--persist-to', tempPersist,
    '--var', 'ARENA_LIVE_ENABLED:true'
  ], {
    cwd: path.join(__dirname, '..'),
    shell: true,
    stdio: ['ignore', 'pipe', 'pipe']
  });

  let stdoutLogs = '';
  let stderrLogs = '';
  proc.stdout.on('data', d => { stdoutLogs += d.toString(); });
  proc.stderr.on('data', d => {
    const s = d.toString();
    stderrLogs += s;
    if (s.includes('ERROR') || s.includes('Error')) console.error('Wrangler stderr:', s);
  });

  // انتظار إقلاع السيرفر
  let ready = false;
  for (let i = 0; i < 60; i++) {
    await new Promise(r => setTimeout(r, 500));
    try {
      const res = await fetch(`${BASE}/api/arena/courses`);
      if (res.ok) { ready = true; break; }
    } catch (e) {}
  }
  if (!ready) {
    console.error('تعذر إقلاع wrangler dev.');
    console.error('STDOUT:\n', stdoutLogs);
    console.error('STDERR:\n', stderrLogs);
    proc.kill();
    process.exit(1);
  }
  ok('خادم wrangler dev يعمل مع بيئة تفاعلية حقيقية', true);

  const pw = PW.loadPlaywright();
  const chromePath = PW.findChrome();
  const browser = await pw.chromium.launch({
    executablePath: chromePath,
    headless: true,
    args: ['--no-sandbox', '--disable-gpu']
  });

  try {
    // 1. تهيئة مدير النظام وحساب المعلم وفصل دراسي
    await fetch(`${BASE}/api/setup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'المدير', username: 'boss_pw', password: 'Live@2026pw', password2: 'Live@2026pw' })
    });
    const lAdmin = await fetch(`${BASE}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'boss_pw', password: 'Live@2026pw' })
    });
    const adminData = await lAdmin.json();
    const adminH = { 'Content-Type': 'application/json', 'Cookie': `sid=${adminData.sid}; did=${adminData.did}`, 'X-Tahdir-Sid': adminData.sid };

    await fetch(`${BASE}/api/admin/teachers`, {
      method: 'POST',
      headers: adminH,
      body: JSON.stringify({ name: 'أ. طارق المعلم', username: 'teacher_tariq_pw', password: 'Tariq@2026pw', role: 'teacher' })
    });

    const lTeacher = await fetch(`${BASE}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'teacher_tariq_pw', password: 'Tariq@2026pw' })
    });
    const teacherData = await lTeacher.json();
    const teacherSid = teacherData.sid;
    const teacherDid = teacherData.did;
    const teacherH = { 'Content-Type': 'application/json', 'Cookie': `sid=${teacherSid}; did=${teacherDid}`, 'X-Tahdir-Sid': teacherSid };

    const classRes = await fetch(`${BASE}/api/classes`, {
      method: 'POST',
      headers: teacherH,
      body: JSON.stringify({ name: 'تاسع أول', course: 'الأحياء|التاسع' })
    });
    const classData = await classRes.json();
    const teacherClassCode = classData.code;
    ok('إنشاء حساب المعلم وفصله الدراسي بنجاح', !!teacherSid && !!teacherClassCode);

    // 2. سياق المعلم (سطح المكتب - 1280x800)
    console.log('\n=== تشغيل سياق المعلم (Desktop) وإنشاء الغرفة ===');
    const teacherCtx = await browser.newContext({
      viewport: { width: 1280, height: 800 }
    });
    await teacherCtx.addCookies([
      { name: 'sid', value: teacherSid, domain: '127.0.0.1', path: '/' },
      { name: 'did', value: teacherDid, domain: '127.0.0.1', path: '/' }
    ]);
    const teacherPage = await teacherCtx.newPage();
    const teacherErrors = [];
    teacherPage.on('pageerror', err => teacherErrors.push(err.message));

    await teacherPage.goto(`${BASE}/arena`, { waitUntil: 'networkidle' });
    await teacherPage.waitForSelector('#arLiveBtn', { timeout: 6000 });
    ok('زر «لعبة مباشرة» ظاهر للمعلم لأن ARENA_LIVE_ENABLED=true', true);

    // فتح نافذة إعداد الغرفة
    await teacherPage.click('#arLiveBtn');
    await teacherPage.waitForSelector('#arLiveSetupModal');
    ok('نافذة إعداد المسابقة المباشرة تفتح بنجاح', true);

    // ضبط الوقت إلى 5 ثوانٍ وسؤال واحد للتسريع الفائق
    await teacherPage.selectOption('#arLiveTimeSel', '5');
    await teacherPage.selectOption('#arLiveCountSel', '1');
    await teacherPage.click('#arSubmitLiveCreateBtn');

    // انتظار الانتقال لشاشة البهو (Lobby)
    await teacherPage.waitForSelector('#arRoomCodeVal', { timeout: 8000 });
    const code = (await teacherPage.textContent('#arRoomCodeVal')).trim();
    ok('المعلم ينشئ الغرفة وينتقل للبهو برمز 6 أحرف', code.length === 6, 'كود الغرفة: ' + code);

    // لقطة شاشة بهو المعلم (كمبيوتر وجوال)
    await teacherPage.screenshot({ path: path.join(screensDir, '01_teacher_lobby_desktop.png') });
    await teacherPage.setViewportSize({ width: 390, height: 844 });
    await teacherPage.screenshot({ path: path.join(screensDir, '01_teacher_lobby_mobile.png') });
    await teacherPage.setViewportSize({ width: 1280, height: 800 });

    // 3. سياق الطالب 1 (كمبيوتر - 1280x800)
    console.log('\n=== انضمام الطالب 1 (Desktop) ===');
    const student1Ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const student1Page = await student1Ctx.newPage();
    const s1Errors = [];
    student1Page.on('pageerror', err => s1Errors.push(err.message));

    await student1Page.goto(`${BASE}/arena?code=${code}`, { waitUntil: 'networkidle' });
    await student1Page.waitForSelector('#arLiveNameInput');
    await student1Page.fill('#arLiveNameInput', 'أحمد العماني');
    await student1Page.fill('#arLiveClassInput', teacherClassCode);
    await student1Page.screenshot({ path: path.join(screensDir, '02_student1_join_desktop.png') });
    await student1Page.click('#arSubmitJoinBtn');

    await student1Page.waitForSelector('#arStudentLeaveLobby', { timeout: 6000 });
    ok('الطالب 1 ينضم للغرفة ويدخل شاشة انتظار البهو', true);
    await student1Page.screenshot({ path: path.join(screensDir, '03_student1_lobby_desktop.png') });

    // 4. سياق الطالب 2 (جوال - 390x844 - iPhone)
    console.log('\n=== انضمام الطالب 2 (Mobile Viewport) ===');
    const student2Ctx = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true
    });
    const student2Page = await student2Ctx.newPage();
    const s2Errors = [];
    student2Page.on('pageerror', err => s2Errors.push(err.message));

    await student2Page.goto(`${BASE}/arena?code=${code}`, { waitUntil: 'networkidle' });
    await student2Page.waitForSelector('#arLiveNameInput');
    await student2Page.fill('#arLiveNameInput', 'سارة البلوشية');
    await student2Page.screenshot({ path: path.join(screensDir, '04_student2_join_mobile.png') });
    await student2Page.click('#arSubmitJoinBtn');

    await student2Page.waitForSelector('#arStudentLeaveLobby', { timeout: 6000 });
    ok('الطالب 2 ينضم عبر هاتف الجوال ويستقر في البهو', true);
    await student2Page.screenshot({ path: path.join(screensDir, '05_student2_lobby_mobile.png') });

    // 5. المعلم يرى الطالبين في البهو ويبدأ المنافسة
    console.log('\n=== فحص قائمة المنضمين وبدء المنافسة ===');
    await teacherPage.waitForFunction(() => {
      const el = document.getElementById('arPlayerCount');
      return el && parseInt(el.textContent, 10) >= 2;
    }, { timeout: 5000 });
    ok('شاشة المعلم تحدث عدد المنضمين تلقائياً (طالبان)', true);

    await teacherPage.click('#arHostStartBtn');

    // 6. انتقال المعلم والطلاب لطور السؤال (QUESTION)
    console.log('\n=== طور السؤال وحجب الإجابات عن الطلاب ===');
    await teacherPage.waitForSelector('.ar-live-q-stem', { timeout: 8000 });
    await student1Page.waitForSelector('.ar-live-q-stem', { timeout: 8000 });
    await student2Page.waitForSelector('.ar-live-q-stem', { timeout: 8000 });
    ok('المعلم وجميع الطلاب ينتقلون لشاشة السؤال متزامنين', true);

    // فحص أزرار التحكم: التنسيق الصريح والتباين والنصوص والأبعاد (عرض > 70px وارتفاع >= 44px)
    const ctrlButtons = ['#arHostPauseBtn', '#arHostSkipBtn', '#arHostEndBtn', '#arHostToggleHintBtn'];
    for (const sel of ctrlButtons) {
      const btnInfo = await teacherPage.evaluate((s) => {
        const el = document.querySelector(s);
        if (!el) return null;
        const cs = window.getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        return {
          text: el.innerText || el.textContent,
          color: cs.color,
          bgColor: cs.backgroundColor,
          width: rect.width,
          height: rect.height,
          border: cs.borderWidth
        };
      }, sel);

      ok(`زر ${sel} موجود وظاهر`, !!btnInfo);
      ok(`زر ${sel} لون نصه (${btnInfo.color}) يختلف عن لون الخلفية (${btnInfo.bgColor}) وغير أبيض`, btnInfo.color !== btnInfo.bgColor && btnInfo.color !== 'rgb(255, 255, 255)');
      ok(`زر ${sel} بعرض صريح (${Math.round(btnInfo.width)}px) أكبر من 70px وارتفاع 44px على الأقل`, btnInfo.width > 70 && btnInfo.height >= 44);
    }

    // التحقق من احتواء نصوص الأزرار الصريحة
    const pauseText = await teacherPage.innerText('#arHostPauseBtn');
    ok('زر الإيقاف يحتوي نص "إيقاف"', pauseText.includes('إيقاف'));

    const skipText = await teacherPage.innerText('#arHostSkipBtn');
    ok('زر التخطي يحتوي نص "تخطي"', skipText.includes('تخطي'));

    const endText = await teacherPage.innerText('#arHostEndBtn');
    ok('زر الإنهاء يحتوي نص "إنهاء"', endText.includes('إنهاء'));

    // فحص تموضع التنبيه (toast) تحت الترويسة
    const toastTop = await teacherPage.evaluate(() => {
      const t = document.getElementById('toast');
      return t ? parseInt(window.getComputedStyle(t).top, 10) : 0;
    });
    ok('رسالة التنبيه (toast) متموضعة تحت الترويسة (top >= 90px)', toastTop >= 90);

    // فحص إخفاء الإجابة الصحيحة افتراضياً عن المعلم وزر التبديل
    const defaultHintCount = await teacherPage.locator('.ar-host-hint-label').count();
    ok('الإجابة الصحيحة مخفية افتراضياً على شاشة المعلم أثناء السؤال', defaultHintCount === 0);
    const toggleBtn = teacherPage.locator('#arHostToggleHintBtn');
    ok('زر «إظهار الإجابة لي» متاح ومرئي للمعلم', await toggleBtn.isVisible());

    // اختبار زر إظهار الإجابة ثم إعادة إخفائها
    await teacherPage.click('#arHostToggleHintBtn');
    const toggledHintCount = await teacherPage.locator('.ar-host-hint-label').count();
    ok('النقر على «إظهار الإجابة لي» يُظهر وسم الإجابة الصحيحة للمعلم مؤقتاً', toggledHintCount > 0);
    await teacherPage.click('#arHostToggleHintBtn');
    const hiddenAgainCount = await teacherPage.locator('.ar-host-hint-label').count();
    ok('النقر مرة ثانية يُعيد إخفاء الإجابة الصحيحة بنجاح', hiddenAgainCount === 0);

    // التقاط لقطات شاشة السؤال
    await teacherPage.screenshot({ path: path.join(screensDir, '06_teacher_question_desktop.png') });
    await teacherPage.setViewportSize({ width: 390, height: 844 });
    await teacherPage.screenshot({ path: path.join(screensDir, '06_teacher_question_mobile.png') });
    await teacherPage.setViewportSize({ width: 1280, height: 800 });

    await student1Page.screenshot({ path: path.join(screensDir, '07_student1_question_desktop.png') });
    await student2Page.screenshot({ path: path.join(screensDir, '08_student2_question_mobile.png') });

    // 7. إجابة طالب صحيحاً وطالب خطأ
    console.log('\n=== تقديم إجابات الطلاب: طالب صحيح وطالب خطأ ===');
    const correctIdx = await teacherPage.evaluate(() => {
      return (window.__arenaLive && window.__arenaLive.state && window.__arenaLive.state.question)
        ? window.__arenaLive.state.question.hostHintCorrect
        : 0;
    });
    const wrongIdx = (correctIdx + 1) % 4;

    await student1Page.click(`.ar-live-btn.opt-${correctIdx}`);
    await student2Page.click(`.ar-live-btn.opt-${wrongIdx}`);

    // التحقق من تعطيل الأزرار فور الضغط
    const s1Disabled = await student1Page.evaluate(() => {
      const btns = document.querySelectorAll('.ar-live-btn');
      return Array.from(btns).every(b => b.disabled);
    });
    ok('أزرار الطالب تُعطّل وتُثبّت الاختيار فور الضغط لمنع الإجابة المزدوجة', s1Disabled);

    // 8. طور كشف الإجابات (REVEAL) وفحص إحصائيات الاختيارات
    console.log('\n=== طور كشف الإجابات والإحصائيات والنتائج ===');
    await teacherPage.waitForSelector('.ar-bars-dist', { timeout: 12000 });
    await student1Page.waitForSelector('.ar-reveal-card', { timeout: 12000 });
    await student2Page.waitForSelector('.ar-reveal-card', { timeout: 12000 });
    ok('انتقال تلقائي لطور كشف الإجابات (REVEAL) عند انتهاء الوقت أو إجابة الكل', true);

    // فحص إحصائيات الاختيارات عند المعلم
    const cntCorrText = await teacherPage.locator(`.ar-bar-cnt[data-cidx="${correctIdx}"]`).textContent();
    ok('عدّاد الخيار الصحيح في إحصائيات المعلم = 1 (50%)', cntCorrText.includes('1'));
    const cntWrongText = await teacherPage.locator(`.ar-bar-cnt[data-cidx="${wrongIdx}"]`).textContent();
    ok('عدّاد الخيار الخاطئ في إحصائيات المعلم = 1 (50%)', cntWrongText.includes('1'));

    // فحص إشعارات صحة الإجابة للطلاب
    const s1Status = await student1Page.locator('.ar-reveal-status').textContent();
    ok('الطالب 1 تظهر له رسالة الإجابة الصحيحة والممتازة', s1Status.includes('صحيحة'));
    const s2Status = await student2Page.locator('.ar-reveal-status').textContent();
    ok('الطالب 2 تظهر له رسالة الإجابة الخاطئة دون نقاط', s2Status.includes('خاطئة'));

    await teacherPage.screenshot({ path: path.join(screensDir, '09_teacher_reveal_desktop.png') });
    await student1Page.screenshot({ path: path.join(screensDir, '10_student1_reveal_desktop.png') });
    await student2Page.screenshot({ path: path.join(screensDir, '11_student2_reveal_mobile.png') });

    // 9. انتظار اكتمال الأسئلة والوصول لمنصة التتويج (PODIUM)
    console.log('\n=== منصة التتويج والترتيب النهائي (PODIUM) ===');
    await teacherPage.waitForSelector('.ar-podium-wrap', { timeout: 25000 });
    await student1Page.waitForSelector('.ar-podium-wrap', { timeout: 25000 });
    await student2Page.waitForSelector('.ar-podium-wrap', { timeout: 25000 });
    ok('المعلم وجميع الطلاب يصلون لمنصة التتويج (PODIUM) بنجاح تام', true);

    // فحص المنصة ولوحة المتصدرين: عدم ظهور falcon كنص وظهور الرمز 🦅، وترتيب الطلاب
    const podiumWrapText = await teacherPage.locator('.ar-podium-wrap').textContent();
    ok('المنصة لا تعرض كلمة "falcon" كنص خام بل تستعمل رمز الشخصية', !podiumWrapText.includes('falcon'));
    const podiumHtml = await teacherPage.locator('.ar-podium-wrap').innerHTML();
    ok('المنصة تعرض أيقونة الشخصية 🦅', podiumHtml.includes('🦅'));

    const rank1Text = await teacherPage.locator('.ar-podium-col.rank-1').textContent();
    const s1ScoreMatch = rank1Text.match(/(\d+)\s*نقطة/);
    const s1ScoreNum = s1ScoreMatch ? parseInt(s1ScoreMatch[1], 10) : 0;
    ok('الطالب 1 المتفوق في المركز الأول ونقاطه أكبر من الصفر بصيغة نقطة', rank1Text.includes('أحمد العماني') && s1ScoreNum > 0);

    const rank2Text = await teacherPage.locator('.ar-podium-col.rank-2').textContent();
    const s2ScoreMatch = rank2Text.match(/(\d+)\s*نقطة/);
    const s2ScoreNum = s2ScoreMatch ? parseInt(s2ScoreMatch[1], 10) : -1;
    ok('الطالب 2 في المركز الثاني برصيد 0 نقطة بصيغة نقطة', rank2Text.includes('سارة البلوشية') && s2ScoreNum === 0);

    // لقطات شاشة منصة التتويج
    await teacherPage.screenshot({ path: path.join(screensDir, '12_teacher_podium_desktop.png') });
    await teacherPage.setViewportSize({ width: 390, height: 844 });
    await teacherPage.screenshot({ path: path.join(screensDir, '12_teacher_podium_mobile.png') });
    await teacherPage.setViewportSize({ width: 1280, height: 800 });

    await student1Page.screenshot({ path: path.join(screensDir, '13_student1_podium_desktop.png') });
    await student2Page.screenshot({ path: path.join(screensDir, '14_student2_podium_mobile.png') });

    // 10. فحص خلو جميع المتصفحات من أي أخطاء JavaScript
    const allErrors = [...teacherErrors, ...s1Errors, ...s2Errors];
    ok('خلو متصفحات المعلم والطلاب من أي أخطاء JavaScript', allErrors.length === 0, allErrors.join(' | '));

    // إغلاق المتصفحات
    await teacherCtx.close();
    await student1Ctx.close();
    await student2Ctx.close();

  } finally {
    await browser.close();
    proc.kill('SIGINT');
    await new Promise(r => setTimeout(r, 1000));
    try { process.kill(proc.pid); } catch (e) {}
    try { fs.rmSync(tempPersist, { recursive: true, force: true }); } catch (e) {}
  }

  console.log(`\n=== نتيجة اختبار Playwright للمرحلة 4: ${pass} ناجح، ${fail} فاشل ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => {
  console.error('FATAL PLAYWRIGHT ERROR:', e);
  process.exit(1);
});
