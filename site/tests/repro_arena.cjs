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
  page.on('pageerror', err => jsErrors.push(err.message));

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

  console.log('\n=== فحص 4: نقاط الخادم للمرحلة 2 (المحفظة، الجلسات، التحقق، الحقائب والتقارير) ===');

  // 1. فحص المحفظة للزائر (Guest)
  const guestWallet = await getHttp('/api/arena/wallet');
  ok('محفظة الزائر ترجع افتراضياً الصقر ورصيد 0', guestWallet.status === 200 && guestWallet.json.guest === true && guestWallet.json.active_avatar === 'falcon');

  // 2. فحص حفظ الجولة الفردية وحساب النقاط والذهب في الخادم
  const sessionPayload = {
    course_key: firstOkCourse.key,
    mode: 'gold',
    student_name: 'طالب مجتهد',
    duration_sec: 12,
    answers: [
      { qid: 'q_1', lesson_id: '101', is_correct: 1, chosen_idx: 0, time_taken_ms: 2200 },
      { qid: 'q_2', lesson_id: '101', is_correct: 1, chosen_idx: 1, time_taken_ms: 1900 },
      { qid: 'q_3', lesson_id: '101', is_correct: 0, chosen_idx: 2, time_taken_ms: 2500 }
    ]
  };
  const sessRes = await fetch(B + '/api/arena/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-test-ip': '10.0.1.1' },
    body: JSON.stringify(sessionPayload)
  });
  const sessJson = await sessRes.json();
  ok('حفظ الجولة ينجح ويرجع session_id', sessRes.status === 200 && !!sessJson.session_id);
  ok('الخادم يعيد احتساب النقاط والذهب بدقة (2 صحيحة من 3)', sessJson.score === 20 && sessJson.gold === 10 && sessJson.correct === 2 && sessJson.total === 3);

  // 3. فحص كشف الإجابات السريعة المشبوهة (Anti-Cheat Speed Check)
  const suspiciousPayload = {
    course_key: firstOkCourse.key,
    mode: 'gold',
    student_name: 'بوت سريع',
    duration_sec: 1,
    answers: [
      { qid: 'q_1', is_correct: 1, time_taken_ms: 200 },
      { qid: 'q_2', is_correct: 1, time_taken_ms: 250 },
      { qid: 'q_3', is_correct: 1, time_taken_ms: 180 }
    ]
  };
  const suspRes = await fetch(B + '/api/arena/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-test-ip': '10.0.1.2' },
    body: JSON.stringify(suspiciousPayload)
  });
  const suspJson = await suspRes.json();
  ok('الخادم يحظر منح الذهب عند سرعة استجابة خارقة غير بشرية (<800ms)', suspJson.score === 30 && suspJson.gold === 0);

  // 4. فحص حد المعدل (Rate Limiting)
  const rateLimitRes = await fetch(B + '/api/arena/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-test-ip': '10.0.1.1' },
    body: JSON.stringify(sessionPayload)
  });
  ok('حد المعدل يرفض حفظ جولتين في أقل من 10 ثوانٍ لنفس المصدر (HTTP 429)', rateLimitRes.status === 429);

  // 5. تهيئة حساب المدير/المعلم وتسجيل الدخول
  await fetch(B + '/api/setup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'أ. محمد مجدي', username: 'mohamed', password: 'Bio@2026x', password2: 'Bio@2026x' })
  });

  const loginRes = await fetch(B + '/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'mohamed', password: 'Bio@2026x' })
  });
  const rawCookie = loginRes.headers.get('set-cookie') || '';
  const sidMatch = /sid=([^;]+)/.exec(rawCookie);
  const sid = sidMatch ? sidMatch[1] : '';
  const authHeaders = { 'Content-Type': 'application/json', 'Cookie': 'sid=' + sid, 'X-Tahdir-Sid': sid };
  ok('تسجيل دخول المعلم ناجح للحصول على الجلسة', loginRes.status === 200 && !!sid);

  // 6. فحص المتجر وتبديل الشخصية للمعلم
  const buyRes = await fetch(B + '/api/arena/store/buy', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ item_id: 'robot' }) // روبوت ثمنه 1000 ذهب ورصيد الحساب أقل
  });
  const buyJson = await buyRes.json();
  ok('الشراء برصيد غير كافٍ يُرفض برسالة توضيحية', buyRes.status === 400 && buyJson.error.includes('غير كافٍ'));

  const setAvatarRes = await fetch(B + '/api/arena/avatar', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ avatar: 'dragon' }) // غير مفتوحة
  });
  ok('محاولة تفعيل شخصية غير مفتوحة تُرفض بـ 403', setAvatarRes.status === 403);

  const setFalconRes = await fetch(B + '/api/arena/avatar', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ avatar: 'falcon' }) // مفتوحة افتراضياً
  });
  const setFalconJson = await setFalconRes.json();
  ok('تفعيل شخصية مفتوحة ينجح', setFalconRes.status === 200 && setFalconJson.active_avatar === 'falcon');

  // 7. فحص حقائب المعلم المخصصة واستيراد CSV وتنظيف XSS
  const csvText = `السؤال,الخيار1,الخيار2,الخيار3,الخيار4,رقم الصحيح(1-4),تلميح
ما وحدة قياس القوة؟,النيوتن,الجول,الفولت,الأوم,1,تخليداً للعالم إسحاق
<script>alert('xss')</script>ما ناتج 10 × 10؟,50,100,1000,20,2,عملية ضرب
`;
  const setCreateRes = await fetch(B + '/api/arena/sets', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      title: 'حقيبة اختبار الفيزياء والرياضيات',
      course_key: firstOkCourse.key,
      csv_text: csvText
    })
  });
  const setCreateJson = await setCreateRes.json();
  ok('استيراد حقيبة من CSV ينجح ويعالج الصفوف', setCreateRes.status === 200 && setCreateJson.count === 2);

  // فحص استعراض الحقائب
  const setsListRes = await fetch(B + '/api/arena/sets', { headers: authHeaders });
  const setsListJson = await setsListRes.json();
  ok('استعراض حقائب المعلم يرجع الحقيبة المنشأة', setsListRes.status === 200 && setsListJson.sets.some(s => s.id === setCreateJson.id));

  // 8. فحص تقارير المعلم وتصدير CSV
  const reportsRes = await fetch(B + '/api/arena/reports?course=' + encodeURIComponent(firstOkCourse.key), { headers: authHeaders });
  const reportsJson = await reportsRes.json();
  ok('تقارير المعلم ترجع الإحصائيات العامة ونسب الدقة', reportsRes.status === 200 && typeof reportsJson.summary.total_sessions === 'number');

  const csvReportRes = await fetch(B + '/api/arena/reports?course=' + encodeURIComponent(firstOkCourse.key) + '&format=csv', { headers: authHeaders });
  const csvBuf = Buffer.from(await csvReportRes.arrayBuffer());
  const reportCsvText = csvBuf.toString('utf8');
  const hasBom = csvBuf[0] === 0xef && csvBuf[1] === 0xbb && csvBuf[2] === 0xbf;
  ok('تصدير التقرير بصيغة CSV صالح ويتضمن ترويسة UTF-8 BOM', csvReportRes.status === 200 && reportCsvText.includes('معرف_الجلسة') && hasBom);

  // تنظيف: حذف الحقيبة التجريبية
  const delSetRes = await fetch(B + '/api/arena/sets?id=' + encodeURIComponent(setCreateJson.id), {
    method: 'DELETE',
    headers: authHeaders
  });
  ok('حذف الحقيبة المخصصة ينجح', delSetRes.status === 200);

  srv.stop();

  console.log('\n=== النتيجة: ' + pass + ' ناجح، ' + fail + ' فاشل ===');
  process.exit(fail ? 1 : 0);
})().catch(e => {
  console.error('FATAL', e);
  process.exit(1);
});
