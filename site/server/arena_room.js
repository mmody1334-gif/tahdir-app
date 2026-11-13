// site/server/arena_room.js
// Durable Object لغرف «ساحة التحدي» المباشرة مع WebSocket Hibernation.
// - حالة كل لاعب تُنسخ في مرفق مقبسه (serializeAttachment) عند كل تغيير، فلا تضيع عند سبات الغرفة.
// - الحفظ في التخزين مجمّع (كل بضع ثوانٍ عبر المنبه) لتوفير حصة الخطة المجانية.
// - المنبه الواحد يخدم: الحفظ المؤجل، انتهاء الوقت، وتنظيف الغرفة بعد انتهائها.

const { ArenaEngine, ENGINE_STATES } = require('./arena_engine.js');

const ROOM_FLUSH_MS = 8000;              // أقصى تأخير لحفظ الحالة في التخزين
const ROOM_IDLE_TTL_MS = 6 * 3600000;    // غرفة لم تبدأ تُحذف بعد 6 ساعات
const ROOM_ENDED_TTL_MS = 2 * 3600000;   // غرفة منتهية تُحذف بعد ساعتين

function jres(obj, status) {
  return new Response(JSON.stringify(obj), { status: status || 200, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
}

class ArenaRoom {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
    this.engine = null;
    this.hostToken = null;
    this.tokens = null;        // playerToken -> playerId
    this.dirty = false;
    this.flushAt = 0;
    // نبضة الإبقاء من الجوال (ping) يرد عليها Cloudflare مباشرة دون إيقاظ الغرفة أو احتساب طلب
    try {
      if (typeof WebSocketRequestResponsePair !== 'undefined' && ctx && typeof ctx.setWebSocketAutoResponse === 'function') {
        ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
      }
    } catch (e) {}
  }

  async getEngine() {
    if (this.engine) return this.engine;
    const [saved, ht, tk] = await Promise.all([
      this.ctx.storage.get('engine'),
      this.ctx.storage.get('host_token'),
      this.ctx.storage.get('tokens')
    ]);
    this.hostToken = ht || null;
    this.tokens = new Map(Array.isArray(tk) ? tk : []);
    if (!saved) return null;
    this.engine = ArenaEngine.deserialize(saved);
    // استعادة أحدث حالة لكل لاعب من مرفق مقبسه (قد تكون أحدث من آخر حفظ قبل السبات)
    let restored = false;
    try {
      for (const ws of this.ctx.getWebSockets()) {
        const att = ws.deserializeAttachment ? ws.deserializeAttachment() : null;
        if (att && att.role === 'student' && att.snap && this.engine.restorePlayer(att.playerId, att.snap)) restored = true;
        if (att && att.playerId && this.engine.players.has(att.playerId)) this.engine.players.get(att.playerId).connected = true;
      }
    } catch (e) {}
    if (restored) this.markDirty();
    return this.engine;
  }

  async save() {
    if (!this.engine) return;
    await this.ctx.storage.put({
      engine: this.engine.serialize(),
      host_token: this.hostToken,
      tokens: Array.from((this.tokens || new Map()).entries())
    });
    this.dirty = false;
    this.flushAt = 0;
    await this.schedule();
  }

  markDirty() {
    this.dirty = true;
    if (!this.flushAt) this.flushAt = Date.now() + ROOM_FLUSH_MS;
  }

  // ضبط المنبه على أقرب حدث قادم (حفظ مؤجل / انتهاء الوقت / تنظيف)
  async schedule() {
    const e = this.engine;
    if (!e) return;
    const now = Date.now();
    const times = [];
    if (this.dirty && this.flushAt) times.push(this.flushAt);
    if (e.state === ENGINE_STATES.PLAYING && e.endsAt) times.push(e.endsAt);
    if (e.state === ENGINE_STATES.LOBBY) times.push(e.createdAt + ROOM_IDLE_TTL_MS);
    if (e.state === ENGINE_STATES.ENDED) times.push((e.endedAt || now) + ROOM_ENDED_TTL_MS);
    if (!times.length) return;
    await this.ctx.storage.setAlarm(Math.max(now + 50, Math.min(...times)));
  }

  socketsOf(tag) {
    try { return this.ctx.getWebSockets(tag); } catch (e) { return []; }
  }

  send(ws, obj) {
    try { ws.send(JSON.stringify(obj)); } catch (e) {}
  }

  // نسخ حالة اللاعب في مرفق مقبسه (مجاني ولا يستهلك كتابة تخزين)
  syncAttachment(pid) {
    const snap = this.engine.snapshot(pid);
    for (const ws of this.socketsOf('player:' + pid)) {
      try {
        const att = ws.deserializeAttachment() || {};
        att.snap = snap;
        ws.serializeAttachment(att);
      } catch (e) {}
    }
  }

  sendPlayer(pid, extra) {
    const view = this.engine.playerView(pid, Date.now());
    for (const ws of this.socketsOf('player:' + pid)) this.send(ws, Object.assign({ type: 'sync', state: view }, extra || {}));
  }

  sendHostFull() {
    const view = this.engine.hostView(Date.now());
    for (const ws of this.socketsOf('host')) this.send(ws, { type: 'sync', state: view });
  }

  // تحديث خفيف للمعلم: اللاعبون الذين تغيّروا + الأحداث الجديدة
  sendHostDelta(changedIds, sinceFeedId) {
    const e = this.engine;
    const players = changedIds.map(id => e.players.get(id)).filter(Boolean).map(p => e.pub(p));
    const feed = e.lastEvents(sinceFeedId || 0);
    const msg = { type: 'delta', players, feed, now: Date.now(), playersCount: e.players.size };
    for (const ws of this.socketsOf('host')) this.send(ws, msg);
  }

  broadcastAll() {
    this.sendHostFull();
    for (const p of this.engine.players.values()) this.sendPlayer(p.id);
  }

  async fetch(request) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === '/init' && request.method === 'POST') {
      const existing = await this.getEngine();
      if (existing && existing.state !== ENGINE_STATES.ENDED && Date.now() - existing.createdAt < ROOM_IDLE_TTL_MS) {
        return jres({ error: 'الغرفة مستخدمة' }, 409);
      }
      const cfg = await request.json();
      await this.ctx.storage.deleteAll();
      this.engine = new ArenaEngine(Object.assign({}, cfg, { now: Date.now() }));
      this.hostToken = String(cfg.hostToken || '');
      this.tokens = new Map();
      this._persisted = false;
      await this.save();
      return jres({ ok: true, code: this.engine.code });
    }

    if (path === '/info' && request.method === 'GET') {
      const e = await this.getEngine();
      if (!e) return jres({ error: 'الغرفة غير موجودة أو انتهت' }, 404);
      return jres(Object.assign({ ok: true }, e.meta(Date.now())));
    }

    if (path === '/host-token' && request.method === 'POST') {
      const e = await this.getEngine();
      if (!e) return jres({ error: 'الغرفة غير موجودة' }, 404);
      const b = await request.json().catch(() => ({}));
      if (e.hostUserId == null || Number(b.userId) !== e.hostUserId) return jres({ error: 'هذه الغرفة ليست لك' }, 403);
      return jres({ ok: true, hostToken: this.hostToken });
    }

    if (path === '/register' && request.method === 'POST') {
      const e = await this.getEngine();
      if (!e) return jres({ error: 'لا توجد غرفة بهذا الرقم' }, 404);
      const b = await request.json().catch(() => ({}));
      if (!b.playerId || !b.playerToken) return jres({ error: 'بيانات ناقصة' }, 400);
      const feedBefore = e.feedSeq;
      const r = e.addPlayer(b.playerId, { name: b.name, avatar: b.avatar, classId: b.classId, did: b.did }, Date.now());
      if (!r.ok) return jres({ error: r.error }, 400);
      this.tokens.set(b.playerToken, b.playerId);
      // التسجيل يُحفظ فورًا (حدث نادر) حتى لا يضيع رمز اللاعب
      await this.save();
      this.sendHostDelta([b.playerId], feedBefore);
      if (e.state === ENGINE_STATES.LOBBY) for (const p of e.players.values()) if (p.id !== b.playerId) this.sendPlayer(p.id);
      return jres({ ok: true, name: e.players.get(b.playerId).name });
    }

    if ((request.headers.get('Upgrade') || '').toLowerCase() === 'websocket') {
      const e = await this.getEngine();
      if (!e) return new Response('الغرفة غير موجودة', { status: 404 });
      const token = url.searchParams.get('token') || '';
      let role, playerId;
      if (this.hostToken && token === this.hostToken) { role = 'host'; playerId = e.hostId; }
      else if (this.tokens.has(token)) { role = 'student'; playerId = this.tokens.get(token); }
      else return new Response('رمز الدخول غير صالح', { status: 401 });

      if (role === 'student' && !e.players.has(playerId)) return new Response('تم استبعادك من الغرفة', { status: 403 });

      const pair = new WebSocketPair();
      const client = pair[0], server = pair[1];
      const tags = role === 'host' ? ['host'] : ['student', 'player:' + playerId];
      this.ctx.acceptWebSocket(server, tags);
      server.serializeAttachment({ role, playerId, snap: role === 'student' ? e.snapshot(playerId) : null });

      if (role === 'student') {
        const feedBefore = e.feedSeq;
        e.connect(playerId);
        this.send(server, { type: 'sync', state: e.playerView(playerId, Date.now()) });
        this.sendHostDelta([playerId], feedBefore);
      } else {
        this.send(server, { type: 'sync', state: e.hostView(Date.now()) });
      }
      return new Response(null, { status: 101, webSocket: client });
    }

    return new Response('Not found', { status: 404 });
  }

  async webSocketMessage(ws, message) {
    if (message === 'ping') { try { ws.send('pong'); } catch (err) {} return; }
    const e = await this.getEngine();
    if (!e) return;
    const att = ws.deserializeAttachment() || {};
    let data;
    try { data = JSON.parse(typeof message === 'string' ? message : new TextDecoder().decode(message)); }
    catch (err) { return this.send(ws, { type: 'error', error: 'رسالة غير صالحة' }); }

    const now = Date.now();
    const isHost = att.role === 'host';
    const pid = att.playerId;
    const feedBefore = e.feedSeq;

    // انتهاء الوقت أثناء وصول رسالة (قبل أن يوقظنا المنبه)
    if (e.tick(now).ended) { await this.finish(); return; }

    if (data.action === 'ping') return this.send(ws, { type: 'pong', now });

    if (isHost) {
      if (data.action === 'start') {
        const r = e.start(now);
        if (!r.ok) return this.send(ws, { type: 'error', error: r.error });
        await this.save();
        for (const p of e.players.values()) this.syncAttachment(p.id);
        this.broadcastAll();
        return;
      }
      if (data.action === 'end') { if (e.end(now, 'host').ok) await this.finish(); return; }
      if (data.action === 'lock') { e.setLock(!!data.locked); await this.save(); this.sendHostFull(); return; }
      if (data.action === 'latejoin') { e.lateJoin = !!data.on; await this.save(); this.sendHostFull(); return; }
      if (data.action === 'kick' && data.playerId) {
        const r = e.kick(String(data.playerId));
        if (r.ok) {
          for (const s of this.socketsOf('player:' + data.playerId)) {
            this.send(s, { type: 'kicked' });
            try { s.close(4001, 'kicked'); } catch (err) {}
          }
          await this.save();
          this.broadcastAll();
        }
        return;
      }
      return this.send(ws, { type: 'error', error: 'إجراء غير معروف' });
    }

    // ---- الطالب ----
    if (data.action === 'answer') {
      const r = e.answer(pid, data.q, data.choice, now);
      if (!r.ok) {
        if (r.resync) this.sendPlayer(pid);
        return this.send(ws, { type: 'error', error: r.error, soft: true });
      }
      this.afterChange(r.changed);
      if (r.ended) { await this.finish(); return; }
      this.sendPlayer(pid, { result: { correct: r.correct, correctIndex: r.correctIndex, chest: r.chest } });
      this.sendHostDelta(r.changed, feedBefore);
      await this.schedule();
      return;
    }

    if (data.action === 'chest') {
      const r = e.openChest(pid, data.idx, now);
      if (!r.ok) return this.send(ws, { type: 'error', error: r.error, soft: true });
      this.afterChange(r.changed);
      this.sendPlayer(pid, { chestResult: { outcome: r.outcome, options: r.options, picked: r.picked } });
      for (const id of r.changed) {
        if (id !== pid) this.sendPlayer(id, { hit: { by: e.players.get(pid).name, k: r.outcome.k, amount: r.outcome.amount || 0 } });
      }
      this.sendHostDelta(r.changed, feedBefore);
      await this.schedule();
      return;
    }

    this.send(ws, { type: 'error', error: 'إجراء غير معروف' });
  }

  afterChange(ids) {
    for (const id of ids) this.syncAttachment(id);
    this.markDirty();
  }

  async finish() {
    await this.persistResults();
    await this.save();
    this.broadcastAll();
  }

  async webSocketClose(ws) {
    const att = ws.deserializeAttachment ? ws.deserializeAttachment() : null;
    if (!att || att.role !== 'student') return;
    const e = await this.getEngine();
    if (!e || !e.players.has(att.playerId)) return;
    // قد يبقى للاعب مقبس آخر مفتوح (تبويب ثانٍ أو إعادة اتصال سريعة)
    const still = this.socketsOf('player:' + att.playerId).filter(s => s !== ws && s.readyState === 1);
    if (still.length) return;
    e.leave(att.playerId);
    this.sendHostDelta([att.playerId], e.feedSeq);
  }

  async webSocketError(ws) { return this.webSocketClose(ws); }

  async alarm() {
    const e = await this.getEngine();
    if (!e) return;
    const now = Date.now();
    if (e.state === ENGINE_STATES.LOBBY && now >= e.createdAt + ROOM_IDLE_TTL_MS) return this.wipe();
    if (e.state === ENGINE_STATES.ENDED && now >= (e.endedAt || now) + ROOM_ENDED_TTL_MS) return this.wipe();
    if (e.tick(now).ended) return this.finish();
    if (this.dirty) return this.save();
    return this.schedule();
  }

  async wipe() {
    for (const ws of this.ctx.getWebSockets()) { try { ws.close(1000, 'expired'); } catch (e) {} }
    await this.ctx.storage.deleteAll();
    this.engine = null; this.hostToken = null; this.tokens = new Map(); this.dirty = false;
  }

  // حفظ نتائج اللعبة في D1 مرة واحدة عند انتهائها (صف واحد لكل طالب)
  async persistResults() {
    const e = this.engine;
    if (!e || !this.env || !this.env.DB || e.resultsSaved) return;
    e.resultsSaved = true;
    this.markDirty();
    try {
      const DB = this.env.DB;
      const nowSec = Math.floor(Date.now() / 1000);
      const dayKey = new Date().toISOString().slice(0, 10);
      const usage = await DB.prepare('SELECT session_count FROM arena_daily_usage WHERE day_key = ?').bind(dayKey).first();
      const used = usage ? (usage.session_count || 0) : 0;
      if (used >= 20000) return;
      const students = [...e.players.values()].filter(p => p.answered > 0);
      const stmts = [];
      let n = 0;
      for (const p of students) {
        if (used + n >= 20000) break;
        const sid = 'as_live_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
        const score = Math.min(100000, e.scoreOf(p));
        const reward = Math.min(200, Math.floor(e.mode === 'race' ? p.correct * 5 : p.gold / 20));
        const durSec = Math.max(0, Math.floor(((e.endedAt || Date.now()) - Math.max(p.joinedAt, e.startedAt || p.joinedAt)) / 1000));
        stmts.push(DB.prepare('INSERT INTO arena_sessions (id, user_id, student_name, class_id, course_key, mode, score, gold, total_q, correct_q, duration_sec, answers_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
          .bind(sid, e.hostUserId, p.name, p.classId, e.courseKey || 'arena_live', 'live_' + e.mode, score, reward, p.answered, p.correct, durSec, JSON.stringify(p.answers.slice(0, 200)), nowSec));
        if (p.classId && p.did && reward > 0) {
          const key = p.classId + ':' + p.did;
          stmts.push(DB.prepare("INSERT INTO arena_student_wallet (student_key, class_id, did, balance, total_earned, active_avatar, updated_at) VALUES (?, ?, ?, ?, ?, 'falcon', ?) ON CONFLICT(student_key) DO UPDATE SET balance = balance + ?, total_earned = total_earned + ?, updated_at = ?")
            .bind(key, p.classId, p.did, reward, reward, nowSec, reward, reward, nowSec));
        }
        n++;
      }
      if (n) {
        stmts.push(DB.prepare('INSERT INTO arena_daily_usage (day_key, session_count, updated_at) VALUES (?, ?, ?) ON CONFLICT(day_key) DO UPDATE SET session_count = session_count + ?, updated_at = ?')
          .bind(dayKey, n, nowSec, n, nowSec));
        await DB.batch(stmts);
      }
    } catch (err) {
      // تعثر D1 لا يوقف الغرفة
    }
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ArenaRoom };
}
