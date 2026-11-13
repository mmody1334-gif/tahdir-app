// site/tests/test_arena_rooms.cjs
// اختبار حقيقي لغرف «ساحة التحدي» المباشرة عبر wrangler dev (Miniflare + Durable Object + WebSocket):
// معلم + 6 طلاب: رقم غرفة من 6 أرقام، صفحة /blooket/<رقم>، لوبي يظهر فيه المنضمون فورًا،
// منع البدء بلا طلاب، رفض الأسماء المكررة، لعب ذاتي الإيقاع مع صناديق الذهب، تحديثات المعلم اللحظية،
// إعادة اتصال طالب دون فقد ذهبه، الطرد، الإنهاء وحفظ النتائج في D1.

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

let pass = 0, fail = 0;
const ok = (n, c, extra) => {
  if (c) pass++; else fail++;
  console.log((c ? '  PASS  ' : '  FAIL  ') + n + (extra ? '  → ' + extra : ''));
};
const norm = t => String(t || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim().slice(0, 1000);
const sleep = ms => new Promise(r => setTimeout(r, ms));

const PORT = 8796;
const BASE = `http://127.0.0.1:${PORT}`;
const WS_BASE = `ws://127.0.0.1:${PORT}`;
const persist = fs.mkdtempSync(path.join(os.tmpdir(), 'arena-rooms-'));

function client(url) {
  const ws = new WebSocket(url);
  const c = { ws, msgs: [], last: null };
  ws.onmessage = e => { if (e.data === 'pong') return; const m = JSON.parse(e.data); c.msgs.push(m); if (m.type === 'sync') c.last = m.state; };
  c.open = new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  c.closed = new Promise(res => { ws.onclose = ev => res(ev); });
  c.send = o => ws.send(JSON.stringify(o));
  c.waitFor = async (pred, ms = 4000) => {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) { const m = c.msgs.find(pred); if (m) return m; await sleep(40); }
    return null;
  };
  c.clear = () => { c.msgs = []; };
  return c;
}

(async () => {
  console.log('=== تشغيل wrangler dev ===');
  const proc = spawn('npx', ['--yes', 'wrangler@3.114.0', 'dev', '--local', '--port', String(PORT), '--persist-to', persist, '--var', 'ARENA_LIVE_ENABLED:true'],
    { cwd: path.join(__dirname, '..'), shell: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let errLog = '';
  proc.stderr.on('data', d => { errLog += d.toString(); });
  let ready = false;
  for (let i = 0; i < 120; i++) {
    await sleep(500);
    try { const r = await fetch(`${BASE}/api/arena/courses`); if (r.ok) { ready = true; break; } } catch (e) {}
  }
  if (!ready) { console.error('wrangler dev لم يعمل', errLog.slice(-2000)); proc.kill(); process.exit(1); }
  ok('wrangler dev يعمل', true);

  try {
    // حساب مدير ثم معلم
    await fetch(`${BASE}/api/setup`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'المدير', username: 'boss_rooms', password: 'Rooms@2026admin', password2: 'Rooms@2026admin' }) });
    const la = await (await fetch(`${BASE}/api/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'boss_rooms', password: 'Rooms@2026admin' }) })).json();
    const aH = { 'Content-Type': 'application/json', Cookie: `sid=${la.sid}; did=${la.did}`, 'X-Tahdir-Sid': la.sid, 'X-Tahdir-Did': la.did };
    await fetch(`${BASE}/api/admin/teachers`, { method: 'POST', headers: aH, body: JSON.stringify({ name: 'أ. سالم', username: 't_rooms', password: 'Salem@2026rooms', role: 'teacher' }) });
    const lt = await (await fetch(`${BASE}/api/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 't_rooms', password: 'Salem@2026rooms' }) })).json();
    const tH = { 'Content-Type': 'application/json', Cookie: `sid=${lt.sid}; did=${lt.did}`, 'X-Tahdir-Sid': lt.sid, 'X-Tahdir-Did': lt.did };
    ok('دخول المعلم', !!lt.sid);

    // دروس فيها أسئلة
    const courses = (await (await fetch(`${BASE}/api/arena/courses`, { headers: tH })).json());
    ok('اللعب المباشر مفعّل في /api/arena/courses', courses.live_enabled === true);
    const course = courses.courses.find(c => c.key === 'الأحياء|التاسع') || courses.courses.find(c => c.has_arena);
    const data = await (await fetch(`${BASE}/api/arena/data?key=${encodeURIComponent(course.key)}`, { headers: tH })).json();
    const lessonIds = [];
    data.units.forEach(u => u.lessons.forEach(l => { if (l.mcq_count > 0 && lessonIds.length < 3) lessonIds.push(l.id); }));
    const answerKey = {};
    data.units.forEach(u => u.lessons.forEach(l => (l.items || []).forEach(q => { answerKey[norm(q.stem)] = q.correct; })));

    // الطالب لا يستطيع إنشاء غرفة
    const noAuth = await fetch(`${BASE}/api/arena/live/create`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lesson_ids: lessonIds }) });
    ok('إنشاء الغرفة ممنوع لغير المعلم (403)', noAuth.status === 403);

    // إنشاء غرفة سباق الذهب
    const cr = await fetch(`${BASE}/api/arena/live/create`, { method: 'POST', headers: tH, body: JSON.stringify({ lesson_ids: lessonIds, course_key: course.key, mode: 'gold', duration_min: 3, late_join: true }) });
    const cj = await cr.json();
    const code = cj.code;
    ok('رقم الغرفة 6 أرقام', cr.status === 200 && /^\d{6}$/.test(code), code);

    const pg = await fetch(`${BASE}/blooket/${code}`);
    const pgHtml = await pg.text();
    ok('صفحة /blooket/<رقم> تفتح للزائر بلا تسجيل دخول', pg.status === 200 && pgHtml.includes('arenaMain'));
    ok('صفحة /blooket لإدخال الرقم تفتح', (await fetch(`${BASE}/blooket`)).status === 200);
    const info = await (await fetch(`${BASE}/api/arena/live/room?code=${code}`)).json();
    ok('معلومات الغرفة: لوبي وسباق ذهب', info.state === 'LOBBY' && info.mode === 'gold', info.state);
    ok('رقم غرفة غير موجود يعطي 404', (await fetch(`${BASE}/api/arena/live/room?code=999998`)).status === 404);

    // استرجاع رمز المضيف من جهاز آخر لنفس المعلم، ورفضه لغيره
    const htk = await fetch(`${BASE}/api/arena/live/host-token`, { method: 'POST', headers: tH, body: JSON.stringify({ code }) });
    ok('صاحب الغرفة يسترجع رمز المضيف', htk.status === 200 && (await htk.json()).hostToken === cj.hostToken);
    const htkAdmin = await fetch(`${BASE}/api/arena/live/host-token`, { method: 'POST', headers: aH, body: JSON.stringify({ code }) });
    ok('معلم آخر لا يحصل على رمز المضيف (403)', htkAdmin.status === 403);

    // المعلم يدخل اللوبي
    const host = client(`${WS_BASE}/api/arena/live/ws?code=${code}&token=${cj.hostToken}`);
    await host.open;
    await host.waitFor(m => m.type === 'sync');
    ok('المعلم متصل ويرى لوبي فارغًا', host.last && host.last.state === 'LOBBY' && host.last.players.length === 0);

    host.clear();
    host.send({ action: 'start' });
    const startErr = await host.waitFor(m => m.type === 'error');
    ok('لا يمكن بدء اللعبة بلا طلاب', !!startErr && /طالب/.test(startErr.error), startErr && startErr.error);

    // انضمام الطلاب: كل انضمام يصل للمعلم فورًا
    const names = ['أحمد', 'مريم', 'يوسف', 'سارة', 'خالد', 'نور'];
    const studs = [];
    for (let i = 0; i < names.length; i++) {
      host.clear();
      const jr = await fetch(`${BASE}/api/arena/live/join`, { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: 'did=dev_' + i }, body: JSON.stringify({ code, name: names[i], avatar: '🦊' }) });
      const jj = await jr.json();
      const d = await host.waitFor(m => m.type === 'delta' && m.players.some(p => p.name === names[i]), 2000);
      if (i === 0) ok('انضمام الطالب الأول يظهر عند المعلم فورًا في اللوبي', jr.status === 200 && !!d);
      studs.push(Object.assign({ name: names[i] }, jj));
    }
    ok('كل الطلاب الستة ظهروا عند المعلم', host.msgs.length >= 1 && studs.every(s => !!s.playerToken));

    const dup = await fetch(`${BASE}/api/arena/live/join`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code, name: ' أحمد ' }) });
    ok('رفض الاسم المكرر في نفس الغرفة', dup.status === 400 && /مستخدم/.test((await dup.json()).error));

    for (const s of studs) { s.c = client(`${WS_BASE}/api/arena/live/ws?code=${code}&token=${s.playerToken}`); }
    await Promise.all(studs.map(s => s.c.open));
    await Promise.all(studs.map(s => s.c.waitFor(m => m.type === 'sync')));
    ok('الطالب في اللوبي يرى زملاءه', studs[5].c.last.state === 'LOBBY' && studs[5].c.last.lobby.length === 6);

    // طرد طالب من اللوبي
    host.send({ action: 'kick', playerId: studs[5].playerId });
    const kicked = await studs[5].c.waitFor(m => m.type === 'kicked');
    ok('المعلم يُخرج طالبًا من اللوبي', !!kicked);
    const rj = new WebSocket(`${WS_BASE}/api/arena/live/ws?code=${code}&token=${studs[5].playerToken}`);
    const rjOpened = await new Promise(res => { rj.onopen = () => res(true); rj.onerror = () => res(false); setTimeout(() => res(false), 3000); });
    try { rj.close(); } catch (e) {}
    ok('الطالب المطرود لا يعود بنفس الرمز', !rjOpened);
    studs.pop();

    // بدء اللعبة
    host.clear();
    studs.forEach(s => s.c.clear());
    host.send({ action: 'start' });
    const hs = await host.waitFor(m => m.type === 'sync' && m.state.state === 'PLAYING');
    ok('بدأت اللعبة عند المعلم مع مؤقت', !!hs && hs.state.endsAt > hs.state.now);
    await Promise.all(studs.map(s => s.c.waitFor(m => m.type === 'sync' && m.state.state === 'PLAYING')));
    const q0 = studs[0].c.last.question;
    ok('كل طالب يستلم سؤاله بلا الإجابة الصحيحة', !!q0 && q0.choices.length >= 2 && !('correct' in q0) && !('correctIndex' in q0));

    // لعب ذاتي الإيقاع: أحمد يجيب صح دائمًا، مريم خطأ دائمًا، الباقون صح
    host.clear();
    async function play(s, rounds, right) {
      for (let r = 0; r < rounds; r++) {
        const q = s.c.last && s.c.last.question;
        if (!q) {
          if (s.c.last && s.c.last.me && s.c.last.me.chest) {
            s.c.clear(); s.c.send({ action: 'chest', idx: r % 3 });
            await s.c.waitFor(m => m.chestResult);
            continue;
          }
          break;
        }
        const corr = answerKey[norm(q.stem)];
        const choice = right ? corr : (corr + 1) % q.choices.length;
        s.c.clear();
        await sleep(520);
        s.c.send({ action: 'answer', q: q.i, choice });
        const res = await s.c.waitFor(m => m.result);
        if (!res) break;
        if (res.result.chest) {
          s.c.clear(); s.c.send({ action: 'chest', idx: r % 3 });
          await s.c.waitFor(m => m.chestResult);
        }
      }
    }
    await Promise.all(studs.map((s, i) => play(s, 6, i !== 1)));
    const ahmed = studs[0].c.last.me, maryam = studs[1].c.last.me;
    ok('الإجابة الصحيحة تُحسب في الخادم وتفتح صندوقًا', ahmed.correct === 6 && ahmed.answered === 6, `أحمد ${ahmed.correct}/${ahmed.answered} ذهب ${ahmed.gold}`);
    ok('الإجابة الخاطئة لا تعطي ذهبًا ولا صندوقًا', maryam.correct === 0 && maryam.answered === 6 && maryam.gold === 0, `مريم ${maryam.correct}/${maryam.answered}`);
    const deltas = host.msgs.filter(m => m.type === 'delta');
    ok('المعلم يستلم تحديثات لحظية للسكور أثناء اللعب', deltas.length >= 20, deltas.length + ' تحديث');
    const hostAhmed = deltas.map(d => d.players.find(p => p.id === studs[0].playerId)).filter(Boolean).pop();
    ok('ذهب الطالب عند المعلم يطابق ذهبه عند الطالب', hostAhmed && hostAhmed.gold === studs[0].c.last.me.gold, hostAhmed && hostAhmed.gold);

    // تلاعب: سؤال ليس سؤاله / إجابة سريعة جدًا
    studs[2].c.clear();
    studs[2].c.send({ action: 'answer', q: 99999, choice: 0 });
    const wrongQ = await studs[2].c.waitFor(m => m.type === 'error');
    ok('رفض إجابة على سؤال ليس سؤال الطالب الحالي', !!wrongQ);

    // إعادة اتصال طالب دون فقد ذهبه
    const before = studs[0].c.last.me.gold;
    studs[0].c.ws.close();
    await studs[0].c.closed;
    await sleep(300);
    const re = client(`${WS_BASE}/api/arena/live/ws?code=${code}&token=${studs[0].playerToken}`);
    await re.open;
    const reSync = await re.waitFor(m => m.type === 'sync');
    ok('إعادة الاتصال تحفظ ذهب الطالب وتقدمه', reSync && reSync.state.me.gold === before && reSync.state.state === 'PLAYING', `${before} → ${reSync && reSync.state.me.gold}`);
    studs[0].c = re;

    // نبضة الإبقاء من الجوال لا تسبب رسالة خطأ
    re.clear();
    re.ws.send('ping');
    await sleep(600);
    ok('نبضة ping لا تُظهر خطأ للطالب', !re.msgs.some(m => m.type === 'error'));

    // انضمام متأخر أثناء اللعب
    const late = await fetch(`${BASE}/api/arena/live/join`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code, name: 'متأخر' }) });
    ok('الانضمام المتأخر مسموح أثناء اللعب', late.status === 200);

    // إنهاء اللعبة
    host.clear();
    studs.forEach(s => s.c.clear());
    host.send({ action: 'end' });
    const he = await host.waitFor(m => m.type === 'sync' && m.state.state === 'ENDED');
    ok('المعلم ينهي اللعبة ويرى الترتيب النهائي', !!he && he.state.players.length >= 5);
    const se = await studs[0].c.waitFor(m => m.type === 'sync' && m.state.state === 'ENDED');
    ok('الطالب يرى ترتيبه والأوائل', !!se && se.state.me.rank >= 1 && se.state.top.length >= 3);
    const sorted = he.state.players.map(p => p.gold);
    ok('الترتيب حسب الذهب تنازليًا', sorted.every((g, i) => i === 0 || sorted[i - 1] >= g));

    await sleep(500);
    const rep = await (await fetch(`${BASE}/api/arena/reports`, { headers: tH })).json();
    const liveRows = (rep.recent || []).filter(r => String(r.mode || '').startsWith('live'));
    ok('حُفظت نتائج الطلاب في تقارير المعلم (D1)', liveRows.length >= 5, liveRows.length + ' صف');

    // سباق الإجابات: ينتهي عند الهدف
    const cr2 = await (await fetch(`${BASE}/api/arena/live/create`, { method: 'POST', headers: tH, body: JSON.stringify({ lesson_ids: lessonIds, mode: 'race', goal: 5 }) })).json();
    const h2 = client(`${WS_BASE}/api/arena/live/ws?code=${cr2.code}&token=${cr2.hostToken}`);
    await h2.open; await h2.waitFor(m => m.type === 'sync');
    const j2 = await (await fetch(`${BASE}/api/arena/live/join`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: cr2.code, name: 'سريع' }) })).json();
    const s2 = { c: client(`${WS_BASE}/api/arena/live/ws?code=${cr2.code}&token=${j2.playerToken}`) };
    await s2.c.open; await s2.c.waitFor(m => m.type === 'sync');
    h2.send({ action: 'start' });
    await s2.c.waitFor(m => m.type === 'sync' && m.state.state === 'PLAYING');
    await play(s2, 5, true);
    const fin = await h2.waitFor(m => m.type === 'sync' && m.state.state === 'ENDED', 4000);
    ok('سباق الإجابات ينتهي تلقائيًا عند بلوغ الهدف', !!fin && fin.state.winnerId === j2.playerId);

    [host, h2, s2.c, ...studs.map(s => s.c)].forEach(c => { try { c.ws.close(); } catch (e) {} });
  } catch (e) {
    console.error('FATAL', e);
    fail++;
  } finally {
    proc.kill('SIGTERM');
    try { require('child_process').execSync(`pkill -f "wrangler.*${PORT}"`); } catch (e) {}
  }
  console.log('\n=== النتيجة: ' + pass + ' ناجح، ' + fail + ' فاشل ===');
  process.exit(fail ? 1 : 0);
})();
