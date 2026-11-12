// site/server/arena_room.js
// Durable Object مع WebSocket Hibernation لإدارة غرف ساحة التحدي المباشرة
// متوافق تماماً مع Cloudflare Workers DO SQLite & WebSocket Hibernation API.

const { ArenaEngine, ENGINE_STATES } = require('./arena_engine.js');

class ArenaRoom {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
    this.engine = null; // يُحمّل من التخزين (ctx.storage) عند الحاجة
  }

  // تحميل أو استعادة المحرك من التخزين الدائم
  async getEngine() {
    if (this.engine) return this.engine;
    const saved = await this.ctx.storage.get('engine_state');
    if (saved) {
      this.engine = ArenaEngine.deserialize(saved);
    }
    return this.engine;
  }

  // حفظ المحرك إلى التخزين الدائم وضبط المنبه (Alarm)
  async saveEngine() {
    if (!this.engine) return;
    await this.ctx.storage.put('engine_state', this.engine.serialize());
    if (this.engine.deadlineAt && this.engine.deadlineAt > Date.now()) {
      await this.ctx.storage.setAlarm(this.engine.deadlineAt);
    }
  }

  // معالجة طلبات HTTP والترقية إلى WebSocket
  async fetch(request) {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // 1) نقطة إنشاء/تهيئة الغرفة عبر HTTP
    if (pathname === '/init' && request.method === 'POST') {
      const config = await request.json();
      this.engine = new ArenaEngine(config);
      await this.saveEngine();
      return new Response(JSON.stringify({ ok: true, code: this.engine.code }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 2) نقطة الاستعلام عن حالة الغرفة عبر HTTP
    if (pathname === '/info' && request.method === 'GET') {
      const engine = await this.getEngine();
      if (!engine) return new Response(JSON.stringify({ error: 'الغرفة غير موجودة' }), { status: 404 });
      return new Response(JSON.stringify({
        ok: true,
        code: engine.code,
        state: engine.state,
        playersCount: engine.players.size,
        locked: engine.locked
      }), { headers: { 'Content-Type': 'application/json' } });
    }

    // 3) ترقية الاتصال إلى WebSocket مع تفعيل السبات (Hibernation)
    if (request.headers.get('Upgrade')?.toLowerCase() === 'websocket') {
      const engine = await this.getEngine();
      if (!engine) {
        return new Response('الغرفة غير مهيأة', { status: 404 });
      }

      const playerId = url.searchParams.get('playerId') || `p_${Math.random().toString(36).slice(2, 9)}`;
      const role = url.searchParams.get('role') === 'host' ? 'host' : 'student';
      const name = url.searchParams.get('name') || (role === 'host' ? engine.hostName : 'طالب');
      const avatar = url.searchParams.get('avatar') || (role === 'host' ? '👑' : '🦅');

      const pair = new WebSocketPair();
      const [client, server] = [pair[0], pair[1]];

      // حفظ بيانات اللاعب داخل المرفق المتسلسل للـ WebSocket (يصمد أثناء السبات ولا يُحفظ في الذاكرة العشوائية للكلاس)
      const attachment = { playerId, role, name, avatar, joinedAt: Date.now() };
      server.serializeAttachment(attachment);

      // قبول المقبس في نظام السبات
      this.ctx.acceptWebSocket(server, [role, `player:${playerId}`]);

      // تسجيل انضمام اللاعب في المحرك
      const joinRes = engine.join(playerId, { name, avatar });
      if (!joinRes.ok) {
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
    const isHost = role === 'host' || playerId === engine.hostId;
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
          const res = engine.submitAnswer(playerId, data.choiceIndex, nowMs);
          if (res.ok) {
            ws.send(JSON.stringify({
              type: 'answer_ack',
              choiceIndex: data.choiceIndex,
              isCorrect: res.isCorrect,
              pointsAwarded: res.pointsAwarded
            }));
            stateChanged = true;
            // إذا أجاب الجميع فوراً ننتقل للنتيجة دون انتظار المؤقت
            if (res.allAnswered) {
              engine.revealQuestion(nowMs);
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
    // معالجة الخطأ مثل الانقطاع
    await this.webSocketClose(ws, 1006, 'error', false);
  }

  // منبه المؤقتات الدقيق بدون setTimeout (Durable Object Alarms)
  async alarm() {
    const engine = await this.getEngine();
    if (!engine) return;

    const res = engine.tick(Date.now());
    if (res.transitioned) {
      await this.saveEngine();
      await this.broadcastState();
    } else if (res.nextAlarmAt && res.nextAlarmAt > Date.now()) {
      await this.ctx.storage.setAlarm(res.nextAlarmAt);
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
        //getStateFor ينقح السؤال تلقائياً ويخفي الإجابة الصحيحة أثناء طور السؤال
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
