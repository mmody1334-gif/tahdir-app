// site/tests/test_arena_engine.cjs
// فحص شامل لمحرك ساحة التحدي النقي (ArenaEngine) ومحاكاة 12 لاعباً متزامنين

const assert = require('assert');
const { ArenaEngine, ENGINE_STATES } = require('../server/arena_engine.js');

let pass = 0, fail = 0;
function test(name, fn) {
  try {
    fn();
    console.log(`  PASS  ${name}`);
    pass++;
  } catch (e) {
    console.error(`  FAIL  ${name} -> ${e.message}`);
    fail++;
  }
}

console.log('=== اختبارات محرك ساحة التحدي النقي (ArenaEngine) ===');

// عينة أسئلة حقيقية
const sampleQuestions = [
  {
    qid: 'q1',
    stem: 'ما هي عاصمة سلطنة عمان؟',
    choices: ['صلالة', 'مسقط', 'صحار', 'نزوى'],
    correct: 1,
    difficulty: 'سهلة'
  },
  {
    qid: 'q2',
    stem: 'ما هو العضو المسؤول عن ضخ الدم في جسم الإنسان؟',
    choices: ['الكبد', 'الرئة', 'القلب', 'المعدة'],
    correct: 2,
    difficulty: 'متوسطة'
  },
  {
    qid: 'q3',
    stem: 'كم عدد أضلاع المثلث؟',
    choices: ['3', '4', '5', '6'],
    correct: 0,
    difficulty: 'سهلة'
  }
];

const config = {
  code: 'ARENA1',
  hostId: 'teacher_99',
  hostName: 'أ. محمد',
  mode: 'gold_rush',
  timePerQuestion: 15,
  revealDuration: 5,
  startingDuration: 3,
  maxPlayers: 20,
  questions: sampleQuestions
};

const engine = new ArenaEngine(config);

test('1. تهيئة المحرك في حالة LOBBY', () => {
  assert.strictEqual(engine.state, ENGINE_STATES.LOBBY);
  assert.strictEqual(engine.code, 'ARENA1');
  assert.strictEqual(engine.questions.length, 3);
});

test('2. انضمام المضيف و12 طالباً في اللوبي', () => {
  const hostJoin = engine.join('teacher_99', { name: 'أ. محمد', avatar: '👑' });
  assert.strictEqual(hostJoin.ok, true);
  assert.strictEqual(hostJoin.player.isHost, true);

  for (let i = 1; i <= 12; i++) {
    const res = engine.join(`student_${i}`, { name: `طالب ${i}`, avatar: '🦅' });
    assert.strictEqual(res.ok, true);
  }
  assert.strictEqual(engine.players.size, 13); // مضيف + 12 طالب
});

test('3. سرية الإجابة: التحقق من خلو حالة الطالب من الإجابة الصحيحة أثناء اللوبي', () => {
  const stState = engine.getStateFor('student_1');
  assert.strictEqual(stState.question, null);
});

test('4. تجربة طرد لاعب من قبل المضيف', () => {
  const kickRes = engine.kick('student_12', 'teacher_99');
  assert.strictEqual(kickRes.ok, true);
  assert.strictEqual(engine.players.has('student_12'), false);

  // الطالب المطرود لا يمكنه العودة
  const reJoin = engine.join('student_12', { name: 'طالب 12' });
  assert.strictEqual(reJoin.ok, false);
  assert.strictEqual(engine.players.size, 12); // مضيف + 11 طالب
});

test('5. منع غير المضيف من بدء اللعبة', () => {
  const badStart = engine.start('student_1');
  assert.strictEqual(badStart.ok, false);
});

let startTime = 1000000;
test('6. بدء اللعبة بواسطة المضيف والدخول في طور STARTING', () => {
  const startRes = engine.start('teacher_99', startTime);
  assert.strictEqual(startRes.ok, true);
  assert.strictEqual(engine.state, ENGINE_STATES.STARTING);
  assert.strictEqual(engine.deadlineAt, startTime + 3000);
});

test('7. انقضاء عد تنازلي البداية والانتقال إلى QUESTION 1', () => {
  startTime += 3000;
  const tickRes = engine.tick(startTime);
  assert.strictEqual(tickRes.transitioned, true);
  assert.strictEqual(engine.state, ENGINE_STATES.QUESTION);
  assert.strictEqual(engine.currentQIndex, 0);
});

test('8. سرية السؤال الأول: الطالب لا يرى correct أو answer إطلاقاً', () => {
  const stState = engine.getStateFor('student_1', startTime);
  assert.ok(stState.question);
  assert.strictEqual(stState.question.stem, 'ما هي عاصمة سلطنة عمان؟');
  assert.strictEqual(stState.question.correct, undefined, 'الإجابة الصحيحة ممنوعة عن الطالب');
  assert.strictEqual(stState.question.answer, undefined, 'نص الإجابة ممنوع عن الطالب');

  // المضيف يرى hostHintCorrect للإرشاد
  const hostState = engine.getStateFor('teacher_99', startTime);
  assert.strictEqual(hostState.question.hostHintCorrect, 1);
});

test('9. محاكاة إجابات 11 طالباً: 8 صحيحة بسرعات متفاوتة و3 خاطئة', () => {
  // الطلاب 1-8 يجيبون بالإجابة الصحيحة (1 = مسقط)
  for (let i = 1; i <= 8; i++) {
    const answerTime = startTime + i * 1000; // سرعات مختلفة
    const res = engine.submitAnswer(`student_${i}`, 1, answerTime);
    assert.strictEqual(res.ok, true);
    assert.strictEqual(res.isCorrect, true);
    assert.ok(res.pointsAwarded >= 500, 'النقاط تتضمن 500 أساس + سرعة');
  }

  // الطلاب 9-11 يجيبون إجابة خاطئة (0 = صلالة)
  for (let i = 9; i <= 11; i++) {
    const answerTime = startTime + 9000;
    const res = engine.submitAnswer(`student_${i}`, 0, answerTime);
    assert.strictEqual(res.ok, true);
    assert.strictEqual(res.isCorrect, false);
    assert.strictEqual(res.pointsAwarded, 0);
  }

  // منع الطالب من الإجابة مرتين
  const doubleAns = engine.submitAnswer('student_1', 1, startTime + 10000);
  assert.strictEqual(doubleAns.ok, false);
});

test('10. انقضاء وقت السؤال والانتقال التلقائي إلى REVEAL وكشف الإجابات', () => {
  startTime += 15000; // انقضاء مهلة السؤال (15 ثانية)
  const tickRes = engine.tick(startTime);
  assert.strictEqual(tickRes.transitioned, true);
  assert.strictEqual(engine.state, ENGINE_STATES.REVEAL);

  // الآن في طور REVEAL: السؤال يحمل الإجابة الصحيحة رسمياً
  const stState = engine.getStateFor('student_1', startTime);
  assert.strictEqual(stState.question.correct, 1);
  assert.strictEqual(stState.question.answer, 'مسقط');
  assert.strictEqual(stState.myRoundResult.isCorrect, true);

  // إحصائيات المعلم تظهر 8 اختاروا مسقط و3 صلالة
  const hostState = engine.getStateFor('teacher_99', startTime);
  assert.strictEqual(hostState.choiceCounts[1], 8);
  assert.strictEqual(hostState.choiceCounts[0], 3);
});

test('11. لوحة المتصدرين وتتالي النقاط (Streaks)', () => {
  const lb = engine.getLeaderboard();
  assert.strictEqual(lb.length, 11);
  assert.strictEqual(lb[0].rank, 1);
  // الطالب 1 كان الأسرع، فيجب أن يكون في الصدارة
  assert.strictEqual(lb[0].id, 'student_1');
  assert.strictEqual(lb[0].streak, 1);
  assert.ok(lb[0].score > lb[7].score, 'الأسرع حصل على نقاط سرعة أعلى');
  assert.strictEqual(lb[10].score, 0, 'الإجابة الخاطئة 0 نقاط');
});

test('12. تجربة الإيقاف المؤقت (Pause) والاستئناف (Resume) في السؤال 2', () => {
  startTime += 5000; // انقضاء مهلة REVEAL (5 ثوانٍ)
  engine.tick(startTime);
  assert.strictEqual(engine.state, ENGINE_STATES.QUESTION);
  assert.strictEqual(engine.currentQIndex, 1);

  // إيقاف مؤقت بواسطة المعلم
  const pauseRes = engine.pause('teacher_99', startTime + 2000);
  assert.strictEqual(pauseRes.ok, true);
  assert.strictEqual(engine.state, ENGINE_STATES.PAUSED);

  // منع الإجابة أثناء الإيقاف المؤقت
  const ansDuringPause = engine.submitAnswer('student_1', 2, startTime + 3000);
  assert.strictEqual(ansDuringPause.ok, false);

  // استئناف اللعبة
  const resumeRes = engine.resume('teacher_99', startTime + 4000);
  assert.strictEqual(resumeRes.ok, true);
  assert.strictEqual(engine.state, ENGINE_STATES.QUESTION);
});

test('13. تجربة التخطي الفوري (Skip) للسؤال بواسطة المعلم', () => {
  startTime += 5000;
  const skipRes = engine.skip('teacher_99', startTime);
  assert.strictEqual(skipRes.ok, true);
  assert.strictEqual(engine.state, ENGINE_STATES.REVEAL);
});

test('14. تسلسل الحالة واستعادتها (Serialize / Deserialize) للتخزين الدائم', () => {
  const serialized = engine.serialize();
  assert.strictEqual(serialized.code, 'ARENA1');
  assert.strictEqual(serialized.currentQIndex, 1);
  assert.strictEqual(serialized.players.length, 12);

  const restored = ArenaEngine.deserialize(serialized);
  assert.strictEqual(restored.code, engine.code);
  assert.strictEqual(restored.state, engine.state);
  assert.strictEqual(restored.players.size, engine.players.size);
  assert.strictEqual(restored.getLeaderboard()[0].id, engine.getLeaderboard()[0].id);
});

test('15. إكمال السؤال الأخير والوصول إلى منصة التتويج (PODIUM)', () => {
  startTime += 5100; // الانتقال من REVEAL إلى السؤال 3
  const t1 = engine.tick(startTime);
  assert.strictEqual(t1.transitioned, true);
  assert.strictEqual(engine.state, ENGINE_STATES.QUESTION);
  assert.strictEqual(engine.currentQIndex, 2);

  // الطلاب يجيبون على السؤال الأخير
  for (let i = 1; i <= 5; i++) {
    engine.submitAnswer(`student_${i}`, 0, startTime + 1000); // إجابة صحيحة
  }

  startTime += 15100;
  const t2 = engine.tick(startTime); // كشف السؤال 3
  assert.strictEqual(t2.transitioned, true);
  assert.strictEqual(engine.state, ENGINE_STATES.REVEAL);

  startTime += 5100;
  const finishTick = engine.tick(startTime); // إنهاء اللعبة
  assert.strictEqual(finishTick.transitioned, true);
  assert.strictEqual(engine.state, ENGINE_STATES.PODIUM);
  assert.strictEqual(finishTick.finished, true);

  const finalLeaderboard = engine.getLeaderboard();
  assert.strictEqual(finalLeaderboard[0].rank, 1);
  assert.ok(finalLeaderboard[0].score > 0);
  console.log(`  🏆 المتصدر النهائي: ${finalLeaderboard[0].name} بنقاط ${finalLeaderboard[0].score} وتتالي ${finalLeaderboard[0].maxStreak}`);
});

console.log(`\n=== نتيجة الفحص: ${pass} ناجح، ${fail} فاشل ===`);
process.exit(fail ? 1 : 0);
