// site/server/arena_room.js
// Durable Object مع WebSocket Hibernation لإدارة غرف ساحة التحدي المباشرة
// متوافق تماماً مع Cloudflare Workers DO SQLite & WebSocket Hibernation API.

const { ArenaEngine, ENGINE_STATES } = require('./arena_engine.js');

class ArenaRoom {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
    this.engine = null; // يُحمّل من التخزين (ctx.storage) عند الحاجة
    this.hostToken = null;
    this.playerTokens = new Map(); // token -> { playerId, name, avatar, classId, registeredAt }
  }

  // تحميل أو استعادة المحرك والرموز من التخزين الدائم
  async getEngine() {
    if (this.engine) return this.engine;
    const [savedState, savedHostToken, savedPlayerTokens] = await Promise.all([
      this.ctx.storage.get('engine_state'),
      this.ctx.storage.get('host_token'),
      this.ctx.storage.get('player_tokens')
    ]);

    if (savedState) {
      this.engine = ArenaEngine.deserialize(savedState);

      // دمج إجابات السؤال الحالي من مرفقات مقابس الطلاب (WebSocket Hibernation attachments)
      // لحماية النقاط من الضياع عند سبات الـ DO قبل انتهاء وقت السؤال (Zero storage writes)
      if (this.engine && this.engine.state === ENGINE_STATES.QUESTION && this.ctx && typeof this.ctx.getWebSockets === 'function') {
        try {
          const sockets = this.ctx.getWebSockets();
          for (const s of sockets) {
            const att = s.deserializeAttachment ? s.deserializeAttachment() : null;
            if (att && att.role === 'student' && att.playerId && att.answers) {
              const ans = att.answers[this.engine.currentQIndex];
              if (ans && ans.choice !== undefined && !this.engine.roundAnswers.has(att.playerId)) {
                this.engine.submitAnswer(att.playerId, ans.choice, ans.atMs || Date.now());
              }
            }
          }
        } catch (e) {}
      }
    }
    if (savedHostToken) {
      this.hostToken = savedHostToken;
    }
    if (savedPlayerTokens && Array.isArray(savedPlayerTokens)) {
      this.playerTokens = new Map(savedPlayerTokens);
    }
    return this.engine;
  }

  // حفظ المحرك والرموز إلى التخزين الدائم وضبط المنبه (Alarm)
  async saveEngine() {
    if (!this.engine) return;
    await Promise.all([
      this.ctx.storage.put('engine_state', this.engine.serialize()),
      this.hostToken ? this.ctx.storage.put('host_token', this.hostToken) : Promise.resolve(),
      this.ctx.storage.put('player_tokens', Array.from(this.playerTokens.entries()))
    ]);
    if (this.engine.deadlineAt && this.engine.deadlineAt > Date.now()) {
      await this.ctx.storage.setAlarm(this.engine.deadlineAt);
    }
  }

  // معالجة طلبات HTTP والترقية إلى WebSocket
  async fetch(request) {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // 1) نقطة إنشاء/تهيئة الغرفة عبر HTTP (تصدر رمز المضيف السري وتمنع تكرار الغرف النشطة)
    if (pathname === '/init' && request.method === 'POST') {
      const existingEngine = await this.getEngine();
      if (existingEngine && existingEngine.state !== ENGINE_STATES.PODIUM) {
        return new Response(JSON.stringify({ error: 'الغرفة نشطة بالفعل' }), {
          status: 409,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      const config = await request.json();
      this.engine = new ArenaEngine(config);
      this.hostToken = String(config.hostToken || '');
      this.playerTokens = new Map();
      this._persistedToD1 = false;
      await this.saveEngine();
      return new Response(JSON.stringify({ ok: true, code: this.engine.code }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 2) نقطة تسجيل لاعب وإصدار رمز موقّع للـ WebSocket
    if (pathname === '/register-player' && request.method === 'POST') {
      const engine = await this.getEngine();
      if (!engine) return new Response(JSON.stringify({ error: 'الغرفة غير موجودة' }), { status: 404 });
      if (engine.state !== ENGINE_STATES.LOBBY) return new Response(JSON.stringify({ error: 'اللعبة بدأت بالفعل' }), { status: 400 });
      if (engine.locked) return new Response(JSON.stringify({ error: 'الغرفة مغلقة' }), { status: 400 });

      const { playerId, playerToken, name, avatar, classId, did } = await request.json();
      if (!playerId || !playerToken) return new Response(JSON.stringify({ error: 'بيانات ناقصة' }), { status: 400 });

      // تنظيف الاسم وحد أقصى 30 حرفاً
      const cleanName = String(name || '').replace(/<[^>]*>/g, '').trim().slice(0, 30);
      if (!cleanName) return new Response(JSON.stringify({ error: 'الاسم مطلوب' }), { status: 400 });

      this.playerTokens.set(playerToken, {
        playerId,
        name: cleanName,
        avatar: String(avatar || '🦅').slice(0, 10),
        classId: classId ? String(classId).trim() : null,
        did: did ? String(did).trim() : null,
        registeredAt: Date.now()
      });

      await this.saveEngine();
      return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
    }

    // 3) نقطة الاستعلام عن حالة الغرفة عبر HTTP
    if (pathname === '/info' && request.method === 'GET') {
      const engine = await this.getEngine();
      if (!engine) return new Response(JSON.stringify({ error: 'الغرفة غير موجودة' }), { status: 404 });
      return new Response(JSON.stringify({
        ok: true,
        code: engine.code,
        state: engine.state,
        playersCount: [...engine.players.values()].filter(p => !p.isHost).length,
        locked: engine.locked
      }), { headers: { 'Content-Type': 'application/json' } });
    }

    // 4) ترقية الاتصال إلى WebSocket مع التحقق الصارم من الرموز (حظر أخذ role أو playerId من query string)
    if (request.headers.get('Upgrade')?.toLowerCase() === 'websocket') {
      const engine = await this.getEngine();
      if (!engine) {
        return new Response('الغرفة غير مهيأة', { status: 404 });
      }

      const token = url.searchParams.get('token');
      if (!token) {
        return new Response('رمز المصادقة مطلوب للاتصال بالساحة المباشرة', { status: 401 });
      }

      let role = null, playerId = null, name = null, avatar = null, classId = null, did = null;
      if (this.hostToken && token === this.hostToken) {
        // مصادقة المضيف (المعلم)
        role = 'host';
        playerId = engine.hostId;
        name = engine.hostName;
        avatar = '👑';
      } else if (this.playerTokens.has(token)) {
        // مصادقة الطالب عبر رمزه الموقّع
        const reg = this.playerTokens.get(token);
        role = 'student';
        playerId = reg.playerId;
        name = reg.name;
        avatar = reg.avatar;
        classId = reg.classId || null;
        did = reg.did || null;
      } else {
        return new Response('رمز المصادقة غير صالح أو منتهي الصلاحية', { status: 401 });
      }

      const pair = new WebSocketPair();
      const [client, server] = [pair[0], pair[1]];

      // حفظ بيانات اللاعب داخل المرفق المتسلسل للـ WebSocket (يصمد أثناء السبات ولا يُحفظ في الذاكرة العشوائية للكلاس)
      const attachment = { playerId, role, name, avatar, classId, did, joinedAt: Date.now() };
      server.serializeAttachment(attachment);

      // قبول المقبس في نظام السبات
      this.ctx.acceptWebSocket(server, [role, `player:${playerId}`]);

      // تسجيل انضمام اللاعب في المحرك
      const joinRes = engine.join(playerId, { name, avatar, classId, did });
      if (!joinRes.ok && !joinRes.reconnected) {
        server.send(JSON.stringify({ type: 'error', error: joinRes.error }));
        server.close(4003, joinRes.error);
        return new Response(null, { status: 101, webSocket: client });
      }

      await this.saveEngine();

      // إرسال الحالة الحالية للعميل المتصل فوراً
      server.send(JSON.stringify({
        type: 'sync',
        state: engine.getStateFor(playerId)
      }));

      // إشعار جميع المتصلين بوجود تحديث
      await this.broadcastState();

      return new Response(null, { status: 101, webSocket: client });
    }

    return new Response('Not found', { status: 404 });
  }

  // وصول رسالة من عميل (تُوقظ الـ DO تلقائياً عبر Hibernation)
  async webSocketMessage(ws, message) {
    const engine = await this.getEngine();
    if (!engine) return;

    const attachment = ws.deserializeAttachment();
    if (!attachment || !attachment.playerId) return;

    let data;
    try {
      data = JSON.parse(typeof message === 'string' ? message : new TextDecoder().decode(message));
    } catch (e) {
      ws.send(JSON.stringify({ type: 'error', error: 'تنسيق رسالة غير صالح' }));
      return;
    }

    const { playerId, role } = attachment;
    const isHost = role === 'host';
    const nowMs = Date.now();
    let stateChanged = false;

    switch (data.action) {
      case 'ping':
        ws.send(JSON.stringify({ type: 'pong', at: nowMs }));
        break;

      case 'start':
        if (isHost) {
          const res = engine.start(playerId, nowMs);
          if (res.ok) stateChanged = true;
          else ws.send(JSON.stringify({ type: 'error', error: res.error }));
        }
        break;

      case 'answer':
        if (!isHost) {
          // حساب سرعة الإجابة بوقت الخادم فقط (nowMs)
          const res = engine.submitAnswer(playerId, data.choiceIndex, nowMs);
          if (res.ok) {
            // حفظ الإجابة في مرفق المقبس (WebSocket Hibernation attachment)
            // لحمايتها من الضياع عند سبات الـ DO (Zero storage cost)
            try {
              const att = ws.deserializeAttachment ? ws.deserializeAttachment() : null;
              if (att) {
                att.answers = att.answers || {};
                att.answers[engine.currentQIndex] = {
                  choice: data.choiceIndex,
                  atMs: nowMs
                };
                if (typeof ws.serializeAttachment === 'function') {
                  ws.serializeAttachment(att);
                }
              }
            } catch (e) {}

            ws.send(JSON.stringify({
              type: 'answer_ack',
              choiceIndex: data.choiceIndex,
              isCorrect: res.isCorrect,
              pointsAwarded: res.pointsAwarded
            }));
            // حماية DO: لا نحفظ في storage عند كل إجابة فردية (تبقى في الذاكرة ومرفق المقبس)
            // إذا أجاب الجميع ننتقل لطور REVEAL فوراً (وهذا انتقال حالة يستوجب الحفظ)
            if (res.allAnswered) {
              engine.revealQuestion(nowMs);
              stateChanged = true;
            } else {
              // بث التحديث للمتصلين دون كتابة إلى SQLite
              await this.broadcastState();
            }
          } else {
            ws.send(JSON.stringify({ type: 'error', error: res.error }));
          }
        }
        break;

      case 'pause':
        if (isHost) {
          const res = engine.pause(playerId, nowMs);
          if (res.ok) stateChanged = true;
        }
        break;

      case 'resume':
        if (isHost) {
          const res = engine.resume(playerId, nowMs);
          if (res.ok) stateChanged = true;
        }
        break;

      case 'skip':
        if (isHost) {
          const res = engine.skip(playerId, nowMs);
          if (res.ok) stateChanged = true;
        }
        break;

      case 'kick':
        if (isHost && data.targetPlayerId) {
          const res = engine.kick(data.targetPlayerId, playerId);
          if (res.ok) {
            // طرد مقبس اللاعب المستهدف وإغلاقه
            const targetSockets = this.ctx.getWebSockets(`player:${data.targetPlayerId}`);
            for (const s of targetSockets) {
              s.send(JSON.stringify({ type: 'kicked', reason: 'تم استبعادك من قبل المعلم' }));
              s.close(4001, 'kicked');
            }
            stateChanged = true;
          }
        }
        break;

      case 'lock':
        if (isHost) {
          engine.setLock(!!data.locked, playerId);
          stateChanged = true;
        }
        break;

      default:
        ws.send(JSON.stringify({ type: 'error', error: 'إجراء غير معروف' }));
    }

    if (stateChanged) {
      if (engine.state === ENGINE_STATES.PODIUM) {
        await this.persistLiveResultsToD1();
        await this.saveEngine();
        await this.broadcastState();
        await this.ctx.storage.setAlarm(Date.now() + 3600000); // تنظيف التخزين بعد ساعة
        return;
      }
      await this.saveEngine();
      await this.broadcastState();
    }
  }

  // انقطاع الاتصال (Hibernation close)
  async webSocketClose(ws, code, reason, wasClean) {
    const attachment = ws.deserializeAttachment();
    if (attachment && attachment.playerId) {
      const engine = await this.getEngine();
      if (engine) {
        engine.leave(attachment.playerId);
        await this.saveEngine();
        await this.broadcastState();
      }
    }
  }

  async webSocketError(ws, error) {
    await this.webSocketClose(ws, 1006, 'error', false);
  }

  // منبه المؤقتات الدقيق بدون setTimeout (Durable Object Alarms)
  async alarm() {
    const engine = await this.getEngine();
    if (!engine) return;

    if (engine.state === ENGINE_STATES.PODIUM) {
      // حذف بيانات التخزين بالكامل بعد انتهاء اللعبة بساعة واحدة
      await this.ctx.storage.deleteAll();
      this.engine = null;
      this.hostToken = null;
      this.playerTokens.clear();
      return;
    }

    const res = engine.tick(Date.now());
    if (res.transitioned) {
      if (engine.state === ENGINE_STATES.PODIUM) {
        await this.persistLiveResultsToD1();
        await this.saveEngine();
        await this.broadcastState();
        await this.ctx.storage.setAlarm(Date.now() + 3600000); // تنظيف التخزين بعد ساعة
        return;
      }
      await this.saveEngine();
      await this.broadcastState();
    } else if (res.nextAlarmAt && res.nextAlarmAt > Date.now()) {
      await this.ctx.storage.setAlarm(res.nextAlarmAt);
    }
  }

  // 3هـ: حفظ نتائج اللعبة الحية في D1 من الخادم مباشرة وتحديث محفظة الطلاب مع مراعاة حد الطوارئ
  async persistLiveResultsToD1() {
    if (!this.env || !this.env.DB || !this.engine) return;
    if (this._persistedToD1) return;
    this._persistedToD1 = true;

    try {
      const DB = this.env.DB;
      const nowSec = Math.floor(Date.now() / 1000);
      const dayKey = new Date().toISOString().slice(0, 10);

      // فحص حد الطوارئ اليومي (20,000 جلسة كحد أقصى)
      const usageRow = await DB.prepare('SELECT session_count FROM arena_daily_usage WHERE day_key = ?').bind(dayKey).first();
      const currentCount = usageRow ? (usageRow.session_count || 0) : 0;
      if (currentCount >= 20000) return;

      const nonHostStudents = [...this.engine.players.values()].filter(p => !p.isHost);
      if (!nonHostStudents.length) return;

      const sessionsToInsert = [];
      const walletUpdates = [];
      let savedCount = 0;

      for (const st of nonHostStudents) {
        if (currentCount + savedCount >= 20000) break;
        const sid = 'as_live_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
        const answersList = (st.rounds || []).map(r => ({
          qid: String(r.qid || '').trim(),
          chosen: r.choiceIndex !== undefined ? +r.choiceIndex : -1,
          ok: r.isCorrect ? 1 : 0
        }));
        const answersJson = JSON.stringify(answersList);
        const totalQ = this.engine.questions.length;
        const correctQ = st.correctCount || 0;
        const durSec = Math.max(0, Math.floor((Date.now() - (st.joinedAt || Date.now())) / 1000));
        const courseKey = this.engine.courseKey || 'arena_live';
        const classCode = st.classId || null;
        const did = st.did || null;
        const score = Math.min(1000, st.score || 0);
        const gold = Math.min(200, Math.floor(score / 10));

        const hostUserId = parseInt(String(this.engine.hostId || '').replace(/^u_/, ''), 10) || null;
        sessionsToInsert.push(
          DB.prepare(
            'INSERT INTO arena_sessions (id, user_id, student_name, class_id, course_key, mode, score, gold, total_q, correct_q, duration_sec, answers_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
          ).bind(sid, hostUserId, st.name, classCode, courseKey, 'live', score, gold, totalQ, correctQ, durSec, answersJson, nowSec)
        );

        if (classCode && did && gold > 0) {
          const studentKey = classCode + ':' + did;
          walletUpdates.push(
            DB.prepare(
              "INSERT INTO arena_student_wallet (student_key, class_id, did, balance, total_earned, active_avatar, updated_at) VALUES (?, ?, ?, ?, ?, 'falcon', ?) ON CONFLICT(student_key) DO UPDATE SET balance = balance + ?, total_earned = total_earned + ?, updated_at = ?"
            ).bind(studentKey, classCode, did, gold, gold, nowSec, gold, gold, nowSec)
          );
        }
        savedCount++;
      }

      if (sessionsToInsert.length) {
        const incUsage = DB.prepare(
          'INSERT INTO arena_daily_usage (day_key, session_count, updated_at) VALUES (?, ?, ?) ON CONFLICT(day_key) DO UPDATE SET session_count = session_count + ?, updated_at = ?'
        ).bind(dayKey, savedCount, nowSec, savedCount, nowSec);

        await DB.batch([...sessionsToInsert, ...walletUpdates, incUsage]);
      }
    } catch (e) {
      // لا نوقف عمل الغرفة أو المقابس في حال تعثرت كتابة D1
    }
  }

  // بث الحالة المنقحة لكل مقبس وفق صلاحياته
  async broadcastState() {
    const engine = await this.getEngine();
    if (!engine) return;

    const sockets = this.ctx.getWebSockets();
    const nowMs = Date.now();

    for (const ws of sockets) {
      try {
        const attachment = ws.deserializeAttachment();
        const pId = attachment ? attachment.playerId : 'guest';
        // getStateFor ينقح السؤال تلقائياً ويخفي الإجابة الصحيحة أثناء طور السؤال
        const state = engine.getStateFor(pId, nowMs);
        ws.send(JSON.stringify({ type: 'sync', state }));
      } catch (err) {
        // مقبس متعثر
      }
    }
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ArenaRoom };
}
