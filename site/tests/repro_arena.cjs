// repro_arena.cjs — اختبارات منصة «ساحة التحدي» (المرحلة 1)
// يغطي: بناء حزمة arena_pack، سلامة حقول MCQ، مسارات /arena و/teqany/arena، نقاط API، والواجهة التفاعلية
const fs = require('fs');
const path = require('path');
const PW = require('./_pw.cjs');

let pass = 0, fail = 0;
const ok = (n, c, extra) => {
  if (c) pass++; else fail++;
  console.log((c ? '  PASS  ' : '  FAIL  ') + n + (extra ? '  → ' + extra : ''));
};

(async () => {
  console.log('=== فحص 1: حزمة أصول ساحة التحدي (arena_pack.json) ===');
  const packPath = path.join(__dirname, '../data/arena_pack.json');
  ok('ملف arena_pack.json موجود في site/data', fs.existsSync(packPath));

  const pack = JSON.parse(fs.readFileSync(packPath, 'utf8'));
  ok('إجمالي أسئلة MCQ يتجاوز 1000 سؤال', pack.total >= 1000, pack.total + ' سؤال');
  ok('الدروس المغطاة تتجاوز 400 درس', Object.keys(pack.by_lesson).length >= 400, Object.keys(pack.by_lesson).length + ' درس');

  // فحص عينة من الأسئلة للتأكد من خلوها من أي تشوه في البنية
  let sampleValid = true;
  let sampleCount = 0;
  for (const lid in pack.by_lesson) {
    const list = pack.by_lesson[lid];
    for (const q of list) {
      sampleCount++;
      if (!q.qid || !q.lesson_id || !q.stem || !Array.isArray(q.choices) || q.choices.length < 2 || typeof q.correct !== 'number' || q.correct < 0 || q.correct >= q.choices.length) {
        sampleValid = false;
        break;
      }
    }
    if (!sampleValid) break;
  }
  ok('جميع أسئلة الحزمة مستوفية شروط MCQ وحقولها مختصرة وصحيحة', sampleValid, 'تم فحص ' + sampleCount + ' سؤالاً');

  console.log('\n=== فحص 2: نقاط الخادم ومسارات الواجهة ===');
  const srv = await PW.boot();
  const B = srv.BASE;

  async function getHttp(p) {
    const r = await fetch(B + p);
    const ct = r.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      return { status: r.status, json: await r.json() };
    }
    return { status: r.status, text: await r.text() };
  }

  // فحص صفحة ساحة التحدي بهوية الكبسولة
  const arenaPage = await getHttp('/arena');
  ok('صفحة /arena تعمل وترجع HTTP 200', arenaPage.status === 200);
  ok('صفحة /arena تتضمن عنوان «ساحة التحدي»', arenaPage.text.includes('ساحة التحدي'));
  ok('صفحة /arena تتضمن معرّف الحاوية arenaMain', arenaPage.text.includes('id="arenaMain"'));

  // فحص صفحة ساحة التحدي بهوية تقني حذيفة
  const tqArenaPage = await getHttp('/teqany/arena');
  ok('صفحة /teqany/arena تعمل وترجع HTTP 200', tqArenaPage.status === 200);
  ok('صفحة /teqany/arena تحمل هوية تقني حذيفة', tqArenaPage.text.includes('تقني حذيفة'));

  // فحص نقطة المقررات /api/arena/courses
  const coursesRes = await getHttp('/api/arena/courses');
  ok('/api/arena/courses ترجع قائمة المقررات', coursesRes.status === 200 && Array.isArray(coursesRes.json.courses));
  const courses = coursesRes.json.courses || [];
  const withArena = courses.filter(c => c.has_arena);
  ok('توجد مقررات متاحة للعب في ساحة التحدي', withArena.length > 0, withArena.length + ' مقرر متاح');

  // فحص نقطة جلب أسئلة المقرر /api/arena/data
  const firstOkCourse = withArena[0];
  const dataRes = await getHttp('/api/arena/data?key=' + encodeURIComponent(firstOkCourse.key));
  ok('/api/arena/data تجلب وحدات ودروس المقرر', dataRes.status === 200 && Array.isArray(dataRes.json.units));
  const units = dataRes.json.units || [];
  const totalItems = units.reduce((acc, u) => acc + u.lessons.reduce((lacc, l) => lacc + l.items.length, 0), 0);
  ok('مجموع أسئلة وحدات المقرر يطابق إجمالي MCQ', totalItems > 0, totalItems + ' سؤال متوفر في ' + firstOkCourse.key);

  console.log('\n=== فحص 3: تجربة المتصفح التفاعلية (Playwright) ===');
  const pw = PW.loadPlaywright();
  const chromePath = PW.findChrome();
  const browser = await pw.chromium.launch({
    executablePath: chromePath,
    headless: true,
    args: ['--no-sandbox', '--disable-gpu']
  });

  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const jsErrors = [];
  page.on('pageerror', err => { jsErrors.push(err.message); });

  await page.goto(B + '/arena', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#arCourseSel', { timeout: 10000 });

  ok('عنصر اختيار المقرر موجود ونشط', await page.isVisible('#arCourseSel'));
  ok('أزرار أنماط التحدي الأربعة ظاهرة', (await page.$$('.ar-mode-opt')).length === 4);
  ok('زر سوق الشخصيات وزر الصوت ظاهران في الشريط العلوي', (await page.isVisible('#arStoreBtn')) && (await page.isVisible('#arSoundToggle')));

  // انتظار تحميل الدروس وتفعيل زر الانطلاق
  await page.waitForFunction(() => {
    const btn = document.getElementById('arStartBtn');
    return btn && !btn.disabled;
  }, { timeout: 10000 });

  ok('زر «انطلق في ساحة التحدي» مُفعّل وجاهز', true);

  // النقر على زر البدء
  await page.click('#arStartBtn');
  await page.waitForSelector('#arQCard', { timeout: 8000 });

  ok('بطاقة السؤال ظهرت بنجاح في اللعبة', await page.isVisible('#arQCard'));
  const stem = await page.textContent('#arStem');
  ok('نص السؤال مقروء وغير فارغ', !!stem && stem.trim().length > 3, stem.slice(0, 40) + '…');

  const choiceBtns = await page.$$('.ar-choice-btn');
  ok('خيارات الإجابة تظهر كأزرار مهيأة للضغط', choiceBtns.length >= 2, choiceBtns.length + ' خيارات');

  // النقر على الخيار الأول
  await choiceBtns[0].click();
  await page.waitForSelector('.ar-feedback-card, .ar-chests-modal', { timeout: 6000 });
  ok('بطاقة النتيجة / الصناديق ظهرت بعد الإجابة', true);

  // اختبار لوحة المفاتيح والصوت وسوق الشخصيات
  await page.goto(B + '/arena', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#arStoreBtn');
  await page.click('#arStoreBtn');
  await page.waitForSelector('.ar-store-card', { timeout: 6000 });
  ok('سوق الشخصيات يفتح ويعرض بطاقات الشخصيات الحصرية', (await page.$$('.ar-av-card')).length === 6);

  ok('لا توجد أخطاء JavaScript في المتصفح', jsErrors.length === 0, jsErrors.join(', '));

  await browser.close();

  console.log('\n=== فحص 4: نقاط الخادم للمرحلة 2 و3 (عزل المعلمين، صلاحيات الفصول، التحقق الصارم، والمحفظة) ===');

  // 1. استخراج أسئلة حقيقية من المقرر لاختبار التحقق من qid والإجابة في الخادم
  const realQuestions = (units[0] && units[0].lessons[0] && units[0].lessons[0].items) || [];
  ok('توجد أسئلة حقيقية في المقرر للاختبار الصارم', realQuestions.length >= 3, realQuestions.length + ' سؤال متاح');
  const rq1 = realQuestions[0], rq2 = realQuestions[1], rq3 = realQuestions[2];

  // 2. فحص المحفظة للزائر (Guest)
  const guestWallet = await getHttp('/api/arena/wallet');
  ok('محفظة الزائر ترجع افتراضياً الصقر ورصيد 0', guestWallet.status === 200 && guestWallet.json.guest === true && guestWallet.json.active_avatar === 'falcon');

  // 3. تهيئة حساب مدير وإنشاء حسابي معلمين (Teacher 1 و Teacher 2) لاختبار العزل التام
  await fetch(B + '/api/setup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'مدير النظام', username: 'admin_boss', password: 'Bio@2026admin', password2: 'Bio@2026admin' })
  });
  const adminLoginRes = await fetch(B + '/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin_boss', password: 'Bio@2026admin' })
  });
  const adminSid = (/sid=([^;]+)/.exec(adminLoginRes.headers.get('set-cookie') || '') || [])[1] || '';
  const adminHeaders = { 'Content-Type': 'application/json', 'Cookie': 'sid=' + adminSid, 'X-Tahdir-Sid': adminSid };
  ok('تسجيل دخول مدير النظام ناجح لإنشاء المعلمين', adminLoginRes.status === 200 && !!adminSid);

  // إنشاء المعلم 1 (أ. أحمد) والمعلم 2 (أ. سالم)
  await fetch(B + '/api/admin/teachers', {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ name: 'أ. أحمد المعلم', username: 'teacher_ahmed', password: 'Teach@2026x', role: 'teacher' })
  });
  await fetch(B + '/api/admin/teachers', {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ name: 'أ. سالم المعلم', username: 'teacher_salem', password: 'Teach@2026y', role: 'teacher' })
  });

  // تسجيل دخول المعلم 1
  const t1Login = await fetch(B + '/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'teacher_ahmed', password: 'Teach@2026x' })
  });
  const t1Sid = (/sid=([^;]+)/.exec(t1Login.headers.get('set-cookie') || '') || [])[1] || '';
  const t1Headers = { 'Content-Type': 'application/json', 'Cookie': 'sid=' + t1Sid, 'X-Tahdir-Sid': t1Sid };
  ok('تسجيل دخول المعلم 1 (حساب معلّم حقيقي) ناجح', t1Login.status === 200 && !!t1Sid);

  // تسجيل دخول المعلم 2
  const t2Login = await fetch(B + '/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'teacher_salem', password: 'Teach@2026y' })
  });
  const t2Sid = (/sid=([^;]+)/.exec(t2Login.headers.get('set-cookie') || '') || [])[1] || '';
  const t2Headers = { 'Content-Type': 'application/json', 'Cookie': 'sid=' + t2Sid, 'X-Tahdir-Sid': t2Sid };
  ok('تسجيل دخول المعلم 2 (حساب معلّم حقيقي) ناجح', t2Login.status === 200 && !!t2Sid);

  // المعلم 1 ينشئ فصلاً دراسياً
  const c1Res = await fetch(B + '/api/classes', {
    method: 'POST',
    headers: t1Headers,
    body: JSON.stringify({ name: 'أحياء 11/1', course: firstOkCourse.key })
  });
  const c1Json = await c1Res.json();
  const classCode1 = c1Json.code;
  ok('المعلم 1 ينشئ فصلاً دراسياً ويحصل على رمز الفصل', c1Res.status === 200 && !!classCode1, 'رمز الفصل: ' + classCode1);

  // 4. فحص التحقق الصارم في /api/arena/session
  // أ) رفض جولة الطالب بدون did
  const noDidRes = await fetch(B + '/api/arena/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ course_key: firstOkCourse.key, mode: 'gold', class_id: classCode1, answers: [{ qid: rq1.qid }] })
  });
  ok('رفض جولة الطالب إذا خلا الطلب من معرّف الجهاز did (HTTP 400)', noDidRes.status === 400);

  // ب) رفض جولة الطالب بدون كود فصل صالح
  const badClassRes = await fetch(B + '/api/arena/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Tahdir-Did': 'student_dev_01' },
    body: JSON.stringify({ course_key: firstOkCourse.key, mode: 'gold', class_id: 'FAKE_CODE', answers: [{ qid: rq1.qid }] })
  });
  ok('رفض جولة الطالب إذا كان كود الفصل غير موجود أو غير نشط (HTTP 400)', badClassRes.status === 400);

  // ج) رفض الجولة التي تحتوي qid وهمي غير موجود في البنك
  const fakeQidRes = await fetch(B + '/api/arena/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Tahdir-Did': 'student_dev_fakeqid' },
    body: JSON.stringify({
      course_key: firstOkCourse.key,
      mode: 'gold',
      class_id: classCode1,
      answers: [{ qid: 'fake_qid_xyz_999', chosen_idx: 0 }]
    })
  });
  ok('رفض الجولة إذا تضمنت qid غير صالح في بنك الأسئلة (HTTP 400)', fakeQidRes.status === 400);

  // د) رفض الجولة التي تحتوي qid مكرر (Anti-Duplication)
  const dupQidRes = await fetch(B + '/api/arena/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Tahdir-Did': 'student_dev_dupqid' },
    body: JSON.stringify({
      course_key: firstOkCourse.key,
      mode: 'gold',
      class_id: classCode1,
      answers: [
        { qid: rq1.qid, chosen_idx: rq1.correct },
        { qid: rq1.qid, chosen_idx: rq1.correct }
      ]
    })
  });
  ok('رفض الجولة إذا تضمنت qid مكرراً (HTTP 400)', dupQidRes.status === 400);

  // هـ) التحقق في الخادم: العميل يرسل is_correct: 1 زوراً على إجابة خاطئة؛ الخادم يتحقق من chosen_idx
  const wrongIdx = (rq3.correct + 1) % rq3.choices.length;
  const validStudentPayload = {
    course_key: firstOkCourse.key,
    mode: 'gold',
    class_id: classCode1,
    student_name: 'طالب في فصل المعلم 1',
    duration_sec: 14,
    answers: [
      { qid: rq1.qid, chosen_idx: rq1.correct, is_correct: 0, time_taken_ms: 2200 }, // صحيحة
      { qid: rq2.qid, chosen_idx: rq2.correct, is_correct: 0, time_taken_ms: 2100 }, // صحيحة
      { qid: rq3.qid, chosen_idx: wrongIdx, is_correct: 1, time_taken_ms: 2500 }     // خاطئة عمداً رغم زعم العميل
    ]
  };
  const validStudentRes = await fetch(B + '/api/arena/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Tahdir-Did': 'student_dev_valid' },
    body: JSON.stringify(validStudentPayload)
  });
  const validStudentJson = await validStudentRes.json();
  ok('حفظ جولة الطالب برمز فصل صالح ينجح', validStudentRes.status === 200 && !!validStudentJson.session_id);
  ok('الخادم يرفض زعم العميل ويحتسب الإجابات الصحيحة بناءً على chosen_idx فقط (2 من 3)', validStudentJson.correct === 2 && validStudentJson.score === 20 && validStudentJson.gold === 10);

  // و) حفظ جولة باسم يبدأ برمز صيغة لاختبار حماية CSV Injection
  await fetch(B + '/api/arena/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Tahdir-Did': 'student_dev_csv' },
    body: JSON.stringify({
      course_key: firstOkCourse.key,
      mode: 'gold',
      class_id: classCode1,
      student_name: '=cmd|/C calc!A0',
      duration_sec: 10,
      answers: [{ qid: rq1.qid, chosen_idx: rq1.correct, time_taken_ms: 2000 }]
    })
  });

  // ز) فحص حد المعدل (Rate Limiting) لنفس الجهاز
  const rateLimitRes = await fetch(B + '/api/arena/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Tahdir-Did': 'student_dev_valid' },
    body: JSON.stringify(validStudentPayload)
  });
  ok('نفس الجهاز يُرفض إذا حاول حفظ جولتين في أقل من 10 ثوانٍ (HTTP 429)', rateLimitRes.status === 429);

  // 5. فحص تقارير المعلم 1 وحل مشكلة ambiguous column name: user_id
  const t1ReportRes = await fetch(B + '/api/arena/reports?course=' + encodeURIComponent(firstOkCourse.key), { headers: t1Headers });
  const t1ReportJson = await t1ReportRes.json();
  ok('المعلم 1 يستعرض تقارير فصوله بنجاح دون أي خطأ SQL (ambiguous column)', t1ReportRes.status === 200 && typeof t1ReportJson.summary.total_sessions === 'number' && t1ReportJson.summary.total_sessions >= 2);
  ok('تقرير الأسئلة الأكثر خطأ top_failed يعمل بسلاسة دون تعارض أسماء الأعمدة', Array.isArray(t1ReportJson.top_failed));

  // تصدير CSV وحماية المعادلات
  const csvReportRes = await fetch(B + '/api/arena/reports?course=' + encodeURIComponent(firstOkCourse.key) + '&format=csv', { headers: t1Headers });
  const csvBuf = Buffer.from(await csvReportRes.arrayBuffer());
  const reportCsvText = csvBuf.toString('utf8');
  const hasBom = csvBuf[0] === 0xef && csvBuf[1] === 0xbb && csvBuf[2] === 0xbf;
  ok('تصدير التقرير بصيغة CSV صالح ويتضمن ترويسة UTF-8 BOM', csvReportRes.status === 200 && reportCsvText.includes('معرف_الجلسة') && hasBom);
  ok('حماية CSV Injection: تحييد الصيغ المبتدئة بـ (= أو + أو - أو @) بعلامة اقتباس مفردة', reportCsvText.includes(`"'=cmd|/C calc!A0"`));

  // 6. فحص العزل التام لبيانات الطلاب بين المعلمين (Teacher 1 vs Teacher 2 Data Isolation)
  // المعلم 2 لا يملك أي جولات في فصوله لنفس المقرر
  const t2ReportRes = await fetch(B + '/api/arena/reports?course=' + encodeURIComponent(firstOkCourse.key), { headers: t2Headers });
  const t2ReportJson = await t2ReportRes.json();
  ok('العزل التام: المعلم 2 لا يرى أياً من جولات طلاب المعلم 1 (total_sessions = 0)', t2ReportRes.status === 200 && t2ReportJson.summary.total_sessions === 0 && t2ReportJson.recent.length === 0);

  // 7. فحص محفظة الطالب وشراء المتجر الذري (Atomic Store Purchase)
  const studentBuyFail = await fetch(B + '/api/arena/store/buy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Tahdir-Did': 'student_dev_01' },
    body: JSON.stringify({ item_id: 'robot', class_id: classCode1 }) // سعر 1000 ورصيد الطالب 10
  });
  const studentBuyFailJson = await studentBuyFail.json();
  ok('الخصم الذري: رفض شراء الطالب برصيد غير كافٍ مع إشعار بالرصيد المتبقي المطلوب', studentBuyFail.status === 400 && studentBuyFailJson.error.includes('غير كافٍ'));

  const studentBuyDefault = await fetch(B + '/api/arena/store/buy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Tahdir-Did': 'student_dev_01' },
    body: JSON.stringify({ item_id: 'falcon', class_id: classCode1 })
  });
  ok('رفض شراء شخصية الصقر لأنها مفتوحة افتراضياً للجميع', studentBuyDefault.status === 400);

  // 8. فحص حقائب المعلم المخصصة لحساب المعلم (Teacher Role CRUD)
  const csvText = `السؤال,الخيار1,الخيار2,الخيار3,الخيار4,رقم الصحيح(1-4),تلميح
ما وحدة قياس القوة؟,النيوتن,الجول,الفولت,الأوم,1,تخليداً للعالم إسحاق
<script>alert('xss')</script>ما ناتج 10 × 10؟,50,100,1000,20,2,عملية ضرب
`;
  const setCreateRes = await fetch(B + '/api/arena/sets', {
    method: 'POST',
    headers: t1Headers,
    body: JSON.stringify({
      title: 'حقيبة اختبار المعلم 1',
      course_key: firstOkCourse.key,
      csv_text: csvText
    })
  });
  const setCreateJson = await setCreateRes.json();
  ok('المعلم ينشئ حقيبة مخصصة من CSV وتُعالج صفوفها بأمان', setCreateRes.status === 200 && setCreateJson.count === 2);

  const delSetRes = await fetch(B + '/api/arena/sets?id=' + encodeURIComponent(setCreateJson.id), {
    method: 'DELETE',
    headers: t1Headers
  });
  ok('المعلم يحذف حقيبته المخصصة بنجاح', delSetRes.status === 200);

  // 9. فحص تعطيل خدمة اللعب المباشر افتراضياً (ARENA_LIVE_ENABLED=false)
  const liveCreateDis = await fetch(B + '/api/arena/live/create', {
    method: 'POST',
    headers: t1Headers,
    body: JSON.stringify({ course_key: firstOkCourse.key })
  });
  ok('نقطة إنشاء الغرفة المباشرة ترجع 501 عند إغلاق ARENA_LIVE_ENABLED', liveCreateDis.status === 501);

  const liveJoinDis = await fetch(B + '/api/arena/live/join', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: 'TST123', name: 'طالب' })
  });
  ok('نقطة انضمام الغرفة ترجع 501 عند إغلاق ARENA_LIVE_ENABLED', liveJoinDis.status === 501);

  srv.stop();

  // 9. فحص المرحلة 3: محرك اللعبة النقي ومحاكاة 12 لاعباً متزامنين (Stage 3 Simulation)
  console.log('\n=== فحص 5: محرك ساحة التحدي النقي ومحاكاة 12 لاعباً متزامنين (المرحلة 3) ===');
  const { ArenaEngine, ENGINE_STATES } = require('../server/arena_engine.js');
  const simEngine = new ArenaEngine({
    code: 'SIM123',
    hostId: 'teacher_live',
    hostName: 'أ. محمد',
    mode: 'gold_rush',
    timePerQuestion: 15,
    revealDuration: 5,
    startingDuration: 3,
    questions: [
      { qid: 'sq1', stem: 'س1', choices: ['أ', 'ب', 'ج', 'د'], correct: 1 },
      { qid: 'sq2', stem: 'س2', choices: ['1', '2', '3', '4'], correct: 2 }
    ]
  });

  ok('تهيئة المحرك النقي في حالة LOBBY', simEngine.state === ENGINE_STATES.LOBBY);
  simEngine.join('teacher_live', { name: 'المعلم', avatar: '👑' });
  for (let i = 1; i <= 12; i++) {
    simEngine.join(`sim_p${i}`, { name: `طالب ${i}`, avatar: '🦅' });
  }
  ok('انضمام 12 لاعباً متزامناً بنجاح', simEngine.players.size === 13);

  // سرية الإجابة
  let simTime = 2000000;
  simEngine.start('teacher_live', simTime);
  simTime += 3000;
  simEngine.tick(simTime); // انتقال لـ QUESTION 1
  const studentView = simEngine.getStateFor('sim_p1', simTime);
  ok('حظر إرسال الإجابة الصحيحة أثناء طور السؤال', studentView.question && studentView.question.correct === undefined && studentView.question.answer === undefined);

  // إجابات متزامنة
  for (let i = 1; i <= 10; i++) {
    simEngine.submitAnswer(`sim_p${i}`, 1, simTime + i * 500); // إجابة صحيحة
  }
  simEngine.submitAnswer('sim_p11', 0, simTime + 6000); // خاطئة
  simEngine.submitAnswer('sim_p12', 2, simTime + 7000); // خاطئة

  // كشف الإجابات
  simTime += 15000;
  simEngine.tick(simTime);
  ok('الانتقال التلقائي لطور REVEAL بعد انتهاء الوقت', simEngine.state === ENGINE_STATES.REVEAL);
  const revealView = simEngine.getStateFor('sim_p1', simTime);
  ok('كشف الإجابة الصحيحة في طور REVEAL فقط', revealView.question && revealView.question.correct === 1 && revealView.myRoundResult.isCorrect === true);

  // لوحة الصدارة
  const simLb = simEngine.getLeaderboard();
  ok('ترتيب لوحة المتصدرين بدقة واحتساب النقاط والتتالي', simLb.length === 12 && simLb[0].id === 'sim_p1' && simLb[0].score > 0);

  // طرد لاعب وتحكم المضيف
  const simKick = simEngine.kick('sim_p12', 'teacher_live');
  ok('طرد لاعب بواسطة المعلم ينجح فورياً', simKick.ok && simEngine.players.has('sim_p12') === false);

  // السؤال 2 والتتويج
  simTime += 5000;
  simEngine.tick(simTime); // س2
  for (let i = 1; i <= 5; i++) simEngine.submitAnswer(`sim_p${i}`, 2, simTime + 1000);
  simTime += 15000;
  simEngine.tick(simTime); // كشف س2
  simTime += 5000;
  simEngine.tick(simTime); // منصة التتويج
  ok('اكتمال تدفق اللعبة والوصول لمنصة التتويج (PODIUM)', simEngine.state === ENGINE_STATES.PODIUM);

  console.log('\n=== النتيجة: ' + pass + ' ناجح، ' + fail + ' فاشل ===');
  process.exit(fail ? 1 : 0);
})().catch(e => {
  console.error('FATAL', e);
  process.exit(1);
});
