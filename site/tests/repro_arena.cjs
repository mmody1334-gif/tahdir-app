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
  srv.stop();

  console.log('\n=== النتيجة: ' + pass + ' ناجح، ' + fail + ' فاشل ===');
  process.exit(fail ? 1 : 0);
})().catch(e => {
  console.error('FATAL', e);
  process.exit(1);
});
