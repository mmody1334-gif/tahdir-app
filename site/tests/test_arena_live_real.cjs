// site/tests/test_arena_live_real.cjs
// فحص شامل للغلاف الحقيقي عبر wrangler dev (Miniflare)
// يختبر: معلم (Host) + 5 طلاب عبر WebSocket حقيقي
// يغطي: إنشاء الغرفة، رموز المصادقة (hostToken/playerToken)، التحقق الصارم، سرية الأسئلة،
// تقديم الإجابات بوقت الخادم، كشف الإجابات، منصة التتويج، وإعادة الاتصال بعد القطع (Reconnection).

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

let pass = 0, fail = 0;
const ok = (n, c, extra) => {
  if (c) pass++; else fail++;
  console.log((c ? '  PASS  ' : '  FAIL  ') + n + (extra ? '  → ' + extra : ''));
};

const PORT = 8794;
const BASE = `http://127.0.0.1:${PORT}`;
const WS_BASE = `ws://127.0.0.1:${PORT}`;
const tempPersist = fs.mkdtempSync(path.join(os.tmpdir(), 'wrangler-arena-test-'));

(async () => {
  console.log('=== تشغيل wrangler dev (Miniflare) لاختبار الغلاف الحقيقي مع Durable Object ===');
  
  // تشغيل خادم wrangler dev المحلي مع تفعيل ARENA_LIVE_ENABLED=true وقاعدة بيانات نظيفة
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

  proc.stderr.on('data', d => {
    const s = d.toString();
    if (s.includes('ERROR') || s.includes('Error')) console.error('Wrangler stderr:', s);
  });

  // انتظار جاهزية الخادم
  let ready = false;
  for (let i = 0; i < 40; i++) {
    await new Promise(r => setTimeout(r, 500));
    try {
      const res = await fetch(`${BASE}/api/arena/courses`);
      if (res.ok) { ready = true; break; }
    } catch (e) {}
  }

  if (!ready) {
    console.error('تعذر تشغيل wrangler dev في الوقت المحدد.');
    proc.kill();
    process.exit(1);
  }
  ok('خادم wrangler dev يعمل ومتصل بمحاكي Durable Object وقاعدة نظيفة', true);

  try {
    // 1. تهيئة مدير النظام وحساب المعلم
    const sRes = await fetch(`${BASE}/api/setup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'المدير', username: 'boss_live', password: 'Live@2026admin', password2: 'Live@2026admin' })
    });
    ok('تهيئة النظام وإنشاء حساب المدير', sRes.status === 200);

    const lAdmin = await fetch(`${BASE}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'boss_live', password: 'Live@2026admin' })
    });
    const adminData = await lAdmin.json();
    const adminSid = adminData.sid;
    const adminDid = adminData.did;
    const adminH = {
      'Content-Type': 'application/json',
      'Cookie': `sid=${adminSid}; did=${adminDid}`,
      'X-Tahdir-Sid': adminSid,
      'X-Tahdir-Did': adminDid
    };

    const addTRes = await fetch(`${BASE}/api/admin/teachers`, {
      method: 'POST',
      headers: adminH,
      body: JSON.stringify({ name: 'أ. طارق المعلم', username: 'teacher_tariq', password: 'Tariq@2026live', role: 'teacher' })
    });
    ok('مدير النظام ينشئ حساب المعلم بنجاح', addTRes.status === 200);

    const lTeacher = await fetch(`${BASE}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'teacher_tariq', password: 'Tariq@2026live' })
    });
    const teacherData = await lTeacher.json();
    const teacherSid = teacherData.sid;
    const teacherDid = teacherData.did;
    const teacherH = {
      'Content-Type': 'application/json',
      'Cookie': `sid=${teacherSid}; did=${teacherDid}`,
      'X-Tahdir-Sid': teacherSid,
      'X-Tahdir-Did': teacherDid
    };
    ok('تسجيل دخول المعلم (حساب معلم حقيقي) ناجح', lTeacher.status === 200 && !!teacherSid);

    // إنشاء فصل للمعلم لربط الطلاب بالمحفظة
    const classRes = await fetch(`${BASE}/api/classes`, {
      method: 'POST',
      headers: teacherH,
      body: JSON.stringify({ name: 'تاسع أول', course: 'الأحياء|التاسع' })
    });
    const classData = await classRes.json();
    const teacherClassCode = classData.code;
    ok('إنشاء فصل للمعلم بنجاح لربط المحفظة', classRes.status === 200 && !!teacherClassCode);

    // 2. إنشاء غرفة تحدٍّ مباشر بواسطة المعلم
    const createRes = await fetch(`${BASE}/api/arena/live/create`, {
      method: 'POST',
      headers: teacherH,
      body: JSON.stringify({
        course_key: 'الأحياء|التاسع',
        mode: 'gold_rush',
        question_count: 2,
        time_limit: 4,
        reveal_duration: 3
      })
    });
    const createJson = await createRes.json();
    const code = createJson.code;
    const hostToken = createJson.hostToken;
    ok('إنشاء غرفة التحدي المباشر وإصدار رمز المضيف السري hostToken', createRes.status === 200 && !!code && !!hostToken && hostToken.startsWith('ht_'), 'الغرفة: ' + code);

    // التحقق من أمن الرموز: محاولة اتصال WebSocket بدون رمز تُرفض
    const noTokenRes = await fetch(`${BASE}/api/arena/live/ws?code=${code}`);
    ok('التحقق الصارم: حظر الاتصال بدون رمز مصادقة (HTTP 401)', noTokenRes.status === 401);

    // 3. انضمام 5 طلاب والحصول على رموز موقّعة (playerToken)
    const students = [];
    for (let i = 1; i <= 5; i++) {
      const joinHeaders = { 'Content-Type': 'application/json' };
      if (i === 1) {
        joinHeaders['Cookie'] = 'did=did_real_cookie_123';
      }
      const joinBody = {
        code,
        name: `<b>طالب ${i}</b>`, // اختبار تنظيف HTML وحد 30 حرفاً
        avatar: i % 2 === 0 ? 'falcon' : 'wolf'
      };
      if (i === 1) {
        joinBody.class_id = teacherClassCode;
        joinBody.device_id = 'spoofed_device_id_999'; // يجب تجاهله تماماً
      }

      const joinRes = await fetch(`${BASE}/api/arena/live/join`, {
        method: 'POST',
        headers: joinHeaders,
        body: JSON.stringify(joinBody)
      });
      const joinJson = await joinRes.json();
      ok(`انضمام الطالب ${i} وإصدار رمز لاعب موقّع وتنظيف اسمه`, joinRes.status === 200 && joinJson.playerToken && joinJson.name === `طالب ${i}`);
      students.push(joinJson);
    }

    // 4. فتح مقابس WebSocket حقيقية (1 معلّم + 5 طلاب)
    console.log('\n=== الاتصال عبر مقابس WebSocket الحقيقية ===');
    
    // مقبس المعلم
    const hostWs = new WebSocket(`${WS_BASE}/api/arena/live/ws?code=${code}&token=${hostToken}`);
    const hostMessages = [];
    hostWs.onmessage = e => hostMessages.push(JSON.parse(e.data));

    // مقابس الطلاب الخمسة
    const studentSockets = [];
    const studentMessages = [[], [], [], [], []];
    for (let i = 0; i < 5; i++) {
      const sws = new WebSocket(`${WS_BASE}/api/arena/live/ws?code=${code}&token=${students[i].playerToken}`);
      const idx = i;
      sws.onmessage = e => studentMessages[idx].push(JSON.parse(e.data));
      studentSockets.push(sws);
    }

    // انتظار فتح جميع المقابس
    await new Promise(resolve => {
      let openCount = 0;
      const check = () => { openCount++; if (openCount === 6) resolve(); };
      hostWs.onopen = check;
      studentSockets.forEach(s => { s.onopen = check; });
    });
    ok('اتصال مقبس المعلم وجميع مقابس الطلاب الـ 5 بنجاح', true);

    // انتظار بث حالة البهو (LOBBY)
    await new Promise(r => setTimeout(r, 600));
    const lastHostMsg = hostMessages[hostMessages.length - 1];
    ok('المعلم يستقبل حالة البهو (LOBBY) وتظهر إحصائيات الطلاب الخمسة', lastHostMsg && lastHostMsg.type === 'sync' && lastHostMsg.state.state === 'LOBBY' && lastHostMsg.state.playersCount === 5);

    // 5. بدء اللعبة بواسطة المعلم (Game Start)
    console.log('\n=== بدء المنافسة وفحص سرية الأسئلة ===');
    hostWs.send(JSON.stringify({ action: 'start' }));

    // انتظار الانتقال إلى حالة QUESTION 1
    let s1QuestionState = null;
    for (let t = 0; t < 25; t++) {
      await new Promise(r => setTimeout(r, 300));
      const sMsgs = studentMessages[0];
      const qMsg = sMsgs.find(m => m.type === 'sync' && m.state && m.state.state === 'QUESTION');
      if (qMsg) { s1QuestionState = qMsg.state; break; }
    }
    ok('بدء اللعبة وانتقال جميع الطلاب لطور السؤال الأول (QUESTION)', !!s1QuestionState);

    // التحقق الصارم من سرية الإجابة: لا يُرسل رقم الإجابة الصحيحة أو نصها للطالب إطلاقاً
    const qData = s1QuestionState ? s1QuestionState.question : null;
    const isSecret = qData && qData.correct === undefined && qData.answer === undefined;
    ok('سرية الأسئلة: الإجابة الصحيحة محجوبة تماماً عن جميع الطلاب أثناء التفكير', isSecret);

    // 6. تقديم إجابات الطلاب متزامنة بوقت الخادم
    console.log('\n=== إرسال إجابات الطلاب وحساب زمن الخادم ===');
    const hostQ = hostMessages.find(m => m.state && m.state.question && m.state.question.hostHintCorrect !== undefined);
    const correctIdx = hostQ ? hostQ.state.question.hostHintCorrect : 0;
    studentSockets[0].send(JSON.stringify({ action: 'answer', choiceIndex: correctIdx }));
    studentSockets[1].send(JSON.stringify({ action: 'answer', choiceIndex: (correctIdx + 1) % 4 }));
    studentSockets[2].send(JSON.stringify({ action: 'answer', choiceIndex: correctIdx }));
    studentSockets[3].send(JSON.stringify({ action: 'answer', choiceIndex: (correctIdx + 2) % 4 }));
    studentSockets[4].send(JSON.stringify({ action: 'answer', choiceIndex: correctIdx }));

    // انتظار رسائل التأكيد answer_ack
    await new Promise(r => setTimeout(r, 500));
    const ack1 = studentMessages[0].find(m => m.type === 'answer_ack');
    ok('الخادم يعالج الإجابة بوقت الخادم ويرجع تأكيد الإجابة answer_ack', !!ack1 && ack1.choiceIndex === correctIdx);

    // 7. طور كشف الإجابات (REVEAL)
    console.log('\n=== كشف الإجابات بعد انتهاء الوقت أو إجابة الجميع ===');
    let revealState = null;
    for (let t = 0; t < 20; t++) {
      await new Promise(r => setTimeout(r, 400));
      const sMsgs = studentMessages[0];
      const rMsg = sMsgs.find(m => m.type === 'sync' && m.state && m.state.state === 'REVEAL');
      if (rMsg) { revealState = rMsg.state; break; }
    }
    ok('الانتقال التلقائي لطور كشف الإجابات (REVEAL)', !!revealState);
    ok('ظهور الإجابة الصحيحة ونتائج الجولة فقط في طور REVEAL', revealState && revealState.question && typeof revealState.question.correct === 'number');

    // 8. فحص قطع الاتصال وإعادة الاتصال (Disconnection & Reconnection)
    console.log('\n=== فحص قطع الاتصال وإعادة الاتصال للطالب 1 ===');
    const s1Token = students[0].playerToken;
    studentSockets[0].close(); // قطع الاتصال عمداً
    await new Promise(r => setTimeout(r, 600));

    // إعادة الاتصال بنفس الرمز الموقّع
    const s1ReconnectedWs = new WebSocket(`${WS_BASE}/api/arena/live/ws?code=${code}&token=${s1Token}`);
    const reconMsgs = [];
    s1ReconnectedWs.onmessage = e => reconMsgs.push(JSON.parse(e.data));

    await new Promise(resolve => { s1ReconnectedWs.onopen = resolve; });
    await new Promise(r => setTimeout(r, 600));
    const reconSync = reconMsgs.find(m => m.type === 'sync');
    ok('إعادة اتصال الطالب 1 بنفس الرمز تنجح وتستعيد مزامنة الحالة الحالية فوراً', !!reconSync && reconSync.state.code === code);

    // 9. انتظار انتهاء السؤال الثاني والوصول لمنصة التتويج (PODIUM)
    console.log('\n=== انتظار اكتمال الجولة والوصول لمنصة التتويج ===');
    let podiumState = null;
    for (let t = 0; t < 35; t++) {
      await new Promise(r => setTimeout(r, 500));
      const hMsgs = hostMessages;
      const pMsg = hMsgs.find(m => m.type === 'sync' && m.state && m.state.state === 'PODIUM');
      if (pMsg) { podiumState = pMsg.state; break; }
    }
    ok('اكتمال منافسة الغرفة المباشرة والوصول لمنصة التتويج (PODIUM)', !!podiumState);
    ok('لوحة التتويج تتضمن ترتيب المراكز والنقاط لجميع الطلاب', podiumState && Array.isArray(podiumState.leaderboard) && podiumState.leaderboard.length >= 5);

    // 10. فحص المرحلة 3هـ: التحقق من حفظ نتائج اللعبة الحية تلقائياً في D1
    console.log('\n=== فحص المرحلة 3هـ: حفظ نتائج اللعبة الحية تلقائياً في D1 ===');
    await new Promise(r => setTimeout(r, 1200));
    const liveReportRes = await fetch(`${BASE}/api/arena/reports`, { headers: teacherH });
    const liveReportJson = await liveReportRes.json();
    const liveSessions = (liveReportJson.recent || []).filter(s => s.mode === 'live');
    ok('حفظ جولات اللعبة الحية تلقائياً في D1 من الخادم (بدون طلبات من العميل)', liveSessions.length >= 5);
    ok('جولات اللعبة الحية في التقارير تحمل أسماء الطلاب ونقاطهم الحقيقية', liveSessions.some(s => s.student_name === 'طالب 1'));

    // فحص المحفظة لتأكيد أن did أُخذ من الكوكي حصراً وليس من body
    const s1WalletRes = await fetch(`${BASE}/api/arena/wallet?class_id=${teacherClassCode}`, {
      headers: { 'Cookie': 'did=did_real_cookie_123' }
    });
    const s1Wallet = await s1WalletRes.json();
    ok('did في اللعب الحي يؤخذ من الكوكي حصراً ويحدث رصيد المحفظة الصحيح', s1Wallet.balance > 0);

    const spoofedWalletRes = await fetch(`${BASE}/api/arena/wallet?class_id=${teacherClassCode}`, {
      headers: { 'Cookie': 'did=spoofed_device_id_999' }
    });
    const spoofedWallet = await spoofedWalletRes.json();
    ok('الجهاز المزور المعطى في جسم الطلب لا رصيد له في المحفظة', spoofedWallet.balance === 0);

    // إغلاق جميع المقابس
    hostWs.close();
    studentSockets.forEach(s => { try { s.close(); } catch(e){} });
    s1ReconnectedWs.close();

  } finally {
    // إيقاف wrangler dev وتنظيف المجلد المؤقت
    proc.kill('SIGINT');
    await new Promise(r => setTimeout(r, 1000));
    try { process.kill(proc.pid); } catch(e){}
    try { fs.rmSync(tempPersist, { recursive: true, force: true }); } catch(e){}
  }

  console.log(`\n=== النتيجة النهائية لفحص الغلاف الحي: ${pass} ناجح، ${fail} فاشل ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => {
  console.error('FATAL LIVE TEST ERROR:', e);
  process.exit(1);
});
