// site/server/arena_engine.js
// محرك غرف «ساحة التحدي» المباشرة — لعب ذاتي الإيقاع بأسلوب الغرف الصفية:
// المعلم ينشئ غرفة برقم من 6 أرقام، الطلاب يدخلون اللوبي ويظهرون عنده فورًا،
// وبعد البدء يجيب كل طالب بسرعته على أسئلة مخلوطة له وحده، ولوحة المعلم تتحدث لحظيًا.
// كود JS نقي بلا أي اعتماد على Cloudflare أو المتصفح، ليُختبر مباشرة في Node.

const ENGINE_STATES = { LOBBY: 'LOBBY', PLAYING: 'PLAYING', ENDED: 'ENDED' };
const MAX_PLAYERS = 80;
const MIN_ANSWER_GAP_MS = 500; // أقل زمن بين إجابتين لنفس الطالب (حماية من النقر الآلي)
const MAX_ANSWERS_LOG = 300;
const FEED_MAX = 30;

function clampInt(v, lo, hi, def) {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return def;
  return Math.max(lo, Math.min(hi, n));
}

function cleanText(s, max) {
  return String(s == null ? '' : s).replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function shuffled(n, rnd) {
  const a = [];
  for (let i = 0; i < n; i++) a.push(i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    const t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}

// جدول صناديق الذهب: أوزان الاحتمالات (المجموع غير مهم، تُطبَّع تلقائيًا)
const CHEST_TABLE = [
  { k: 'gain', n: 10, w: 10 },
  { k: 'gain', n: 20, w: 12 },
  { k: 'gain', n: 30, w: 11 },
  { k: 'gain', n: 40, w: 9 },
  { k: 'gain', n: 50, w: 7 },
  { k: 'gain', n: 75, w: 4 },
  { k: 'gain', n: 100, w: 3 },
  { k: 'mult', n: 2, w: 6 },
  { k: 'mult', n: 3, w: 2 },
  { k: 'lose', n: 25, w: 6 },
  { k: 'lose', n: 50, w: 3 },
  { k: 'steal', n: 10, w: 5 },
  { k: 'steal', n: 25, w: 3 },
  { k: 'swap', n: 0, w: 3 },
  { k: 'none', n: 0, w: 5 }
];
const CHEST_TOTAL_W = CHEST_TABLE.reduce((s, c) => s + c.w, 0);

class ArenaEngine {
  constructor(cfg = {}) {
    const now = cfg.now || Date.now();
    this.code = String(cfg.code || '');
    this.hostId = String(cfg.hostId || 'host');
    this.hostUserId = cfg.hostUserId != null ? Number(cfg.hostUserId) : null;
    this.hostName = cleanText(cfg.hostName || 'المعلم', 40);
    this.title = cleanText(cfg.title || '', 80);
    this.courseKey = String(cfg.courseKey || '');
    this.mode = cfg.mode === 'race' ? 'race' : 'gold';
    this.durationSec = clampInt(cfg.durationSec, 60, 1800, 420);
    this.goal = clampInt(cfg.goal, 5, 100, 20);
    this.lateJoin = cfg.lateJoin !== false;
    this.questions = ArenaEngine.cleanQuestions(cfg.questions || []);
    this.state = ENGINE_STATES.LOBBY;
    this.locked = false;
    this.createdAt = now;
    this.startedAt = null;
    this.endsAt = null;
    this.endedAt = null;
    this.winnerId = null;
    this.resultsSaved = false;
    this.players = new Map();
    this.kicked = new Set();
    this.feed = [];
    this.feedSeq = 0;
    this.rnd = typeof cfg.random === 'function' ? cfg.random : Math.random;
  }

  static cleanQuestions(list) {
    const out = [];
    for (const q of list || []) {
      if (!q) continue;
      const choices = (Array.isArray(q.choices) ? q.choices : []).map(c => cleanText(c, 300)).filter(Boolean).slice(0, 4);
      const correct = Number(q.correct);
      const stem = cleanText(q.stem, 1000);
      if (!stem || choices.length < 2 || !Number.isInteger(correct) || correct < 0 || correct >= choices.length) continue;
      out.push({ qid: String(q.qid != null ? q.qid : out.length), stem, choices, correct });
      if (out.length >= 300) break;
    }
    return out;
  }

  // ---------- اللاعبون ----------
  nameTaken(name) {
    const n = cleanText(name, 30).toLowerCase();
    for (const p of this.players.values()) if (p.name.toLowerCase() === n) return true;
    return false;
  }

  // يتحقق قبل إصدار رمز اللاعب: هل يمكن لهذا الاسم أن يدخل الآن؟
  canJoin(name) {
    const clean = cleanText(name, 30);
    if (!clean) return { ok: false, error: 'اكتب اسمك للدخول.' };
    if (this.state === ENGINE_STATES.ENDED) return { ok: false, error: 'انتهت هذه اللعبة.' };
    if (this.locked) return { ok: false, error: 'المعلم أغلق الغرفة أمام لاعبين جدد.' };
    if (this.state === ENGINE_STATES.PLAYING && !this.lateJoin) return { ok: false, error: 'بدأت اللعبة ولا يُسمح بالانضمام المتأخر.' };
    if (this.players.size >= MAX_PLAYERS) return { ok: false, error: 'الغرفة ممتلئة.' };
    if (this.nameTaken(clean)) return { ok: false, error: 'هذا الاسم مستخدم في الغرفة، اختر اسمًا آخر.' };
    return { ok: true, name: clean };
  }

  addPlayer(pid, info = {}, now = Date.now()) {
    if (this.kicked.has(pid)) return { ok: false, error: 'تم استبعادك من هذه الغرفة.' };
    if (this.players.has(pid)) {
      this.players.get(pid).connected = true;
      return { ok: true, reconnected: true };
    }
    const chk = this.canJoin(info.name);
    if (!chk.ok) return chk;
    const p = {
      id: pid,
      name: chk.name,
      avatar: cleanText(info.avatar || '🦅', 8) || '🦅',
      classId: info.classId ? String(info.classId).slice(0, 20) : null,
      did: info.did ? String(info.did).slice(0, 64) : null,
      gold: 0,
      correct: 0,
      answered: 0,
      streak: 0,
      order: [],
      pos: 0,
      cur: null,
      chest: null,
      lastAnsAt: 0,
      answers: [],
      joinedAt: now,
      connected: false,
      v: 0
    };
    this.players.set(pid, p);
    if (this.state === ENGINE_STATES.PLAYING) this._nextQ(p);
    this._event('join', { name: p.name, avatar: p.avatar }, now);
    return { ok: true, player: p };
  }

  connect(pid) {
    const p = this.players.get(pid);
    if (!p) return { ok: false, error: 'اللاعب غير مسجل في الغرفة.' };
    p.connected = true;
    return { ok: true };
  }

  leave(pid) {
    const p = this.players.get(pid);
    if (p) p.connected = false;
  }

  kick(pid) {
    const p = this.players.get(pid);
    if (!p) return { ok: false };
    this.players.delete(pid);
    this.kicked.add(pid);
    return { ok: true, name: p.name };
  }

  setLock(locked) { this.locked = !!locked; }

  // ---------- دورة اللعبة ----------
  start(now = Date.now()) {
    if (this.state !== ENGINE_STATES.LOBBY) return { ok: false, error: 'اللعبة بدأت بالفعل.' };
    if (this.players.size < 1) return { ok: false, error: 'انتظر انضمام طالب واحد على الأقل قبل البدء.' };
    if (!this.questions.length) return { ok: false, error: 'لا توجد أسئلة في هذه الغرفة.' };
    this.state = ENGINE_STATES.PLAYING;
    this.startedAt = now;
    // سباق الذهب ينتهي بالوقت؛ سباق الإجابات ينتهي بالهدف أو بسقف 30 دقيقة
    this.endsAt = now + (this.mode === 'gold' ? this.durationSec : 1800) * 1000;
    for (const p of this.players.values()) this._nextQ(p);
    this._event('start', {}, now);
    return { ok: true };
  }

  end(now = Date.now(), reason = 'host') {
    if (this.state === ENGINE_STATES.ENDED) return { ok: false };
    this.state = ENGINE_STATES.ENDED;
    this.endedAt = now;
    for (const p of this.players.values()) { p.chest = null; p.cur = null; }
    const top = this.leaderboard()[0];
    if (!this.winnerId && top) this.winnerId = top.id;
    this._event('end', { reason }, now);
    return { ok: true };
  }

  tick(now = Date.now()) {
    if (this.state === ENGINE_STATES.PLAYING && this.endsAt && now >= this.endsAt) {
      this.end(now, 'time');
      return { ended: true };
    }
    return { ended: false };
  }

  _nextQ(p) {
    const n = this.questions.length;
    if (!n) { p.cur = null; return; }
    if (!p.order.length || p.pos >= p.order.length) {
      const prev = p.cur;
      p.order = shuffled(n, this.rnd);
      // لا يتكرر نفس السؤال مرتين متتاليتين عند إعادة الخلط
      if (n > 1 && p.order[0] === prev) { p.order.push(p.order.shift()); }
      p.pos = 0;
    }
    p.cur = p.order[p.pos++];
  }

  questionFor(pid) {
    const p = this.players.get(pid);
    if (!p || this.state !== ENGINE_STATES.PLAYING || p.chest || p.cur == null) return null;
    const q = this.questions[p.cur];
    if (!q) return null;
    return { i: p.cur, n: p.answered + 1, stem: q.stem, choices: q.choices.slice() };
  }

  answer(pid, qIndex, choice, now = Date.now()) {
    if (this.state !== ENGINE_STATES.PLAYING) return { ok: false, error: 'اللعبة ليست قيد التشغيل.' };
    const p = this.players.get(pid);
    if (!p) return { ok: false, error: 'اللاعب غير موجود.' };
    if (p.chest) return { ok: false, error: 'افتح صندوقًا أولًا.' };
    if (p.cur == null || Number(qIndex) !== p.cur) return { ok: false, error: 'هذا ليس سؤالك الحالي.', resync: true };
    if (now - p.lastAnsAt < MIN_ANSWER_GAP_MS) return { ok: false, error: 'تمهّل قليلًا.' };
    const q = this.questions[p.cur];
    const c = Number(choice);
    if (!Number.isInteger(c) || c < 0 || c >= q.choices.length) return { ok: false, error: 'اختيار غير صالح.' };

    const isCorrect = c === q.correct;
    p.answered++;
    p.lastAnsAt = now;
    if (p.answers.length < MAX_ANSWERS_LOG) p.answers.push({ qid: q.qid, chosen: c, ok: isCorrect ? 1 : 0 });
    if (isCorrect) { p.correct++; p.streak++; } else { p.streak = 0; }
    p.v++;

    const res = { ok: true, correct: isCorrect, correctIndex: q.correct, changed: [p.id], chest: false, ended: false };

    if (this.mode === 'gold') {
      if (isCorrect) { p.chest = this._rollChest(); res.chest = true; }
      else this._nextQ(p);
    } else {
      // سباق الإجابات: النقاط = عدد الإجابات الصحيحة، والفائز أول من يبلغ الهدف
      p.gold = p.correct;
      if (isCorrect && p.correct >= this.goal) {
        this.winnerId = p.id;
        this._event('goal', { name: p.name, avatar: p.avatar }, now);
        this.end(now, 'goal');
        res.ended = true;
      } else {
        this._nextQ(p);
      }
    }
    return res;
  }

  _pick() {
    let r = this.rnd() * CHEST_TOTAL_W;
    for (const c of CHEST_TABLE) { if ((r -= c.w) < 0) return { k: c.k, n: c.n }; }
    return { k: 'gain', n: 10 };
  }

  _rollChest() { return [this._pick(), this._pick(), this._pick()]; }

  // فتح أحد الصناديق الثلاثة بعد الإجابة الصحيحة (سباق الذهب)
  openChest(pid, idx, now = Date.now()) {
    if (this.state !== ENGINE_STATES.PLAYING) return { ok: false, error: 'اللعبة ليست قيد التشغيل.' };
    const p = this.players.get(pid);
    if (!p || !p.chest) return { ok: false, error: 'لا يوجد صندوق لفتحه.' };
    const i = Number(idx);
    if (!Number.isInteger(i) || i < 0 || i > 2) return { ok: false, error: 'صندوق غير صالح.' };

    const options = p.chest;
    const pick = options[i];
    const before = p.gold;
    const changed = [p.id];
    const outcome = { k: pick.k, n: pick.n, delta: 0 };

    if (pick.k === 'gain') {
      p.gold += pick.n;
    } else if (pick.k === 'mult') {
      p.gold = p.gold * pick.n;
    } else if (pick.k === 'lose') {
      p.gold -= Math.floor(p.gold * pick.n / 100);
    } else if (pick.k === 'steal') {
      const victims = [...this.players.values()].filter(x => x.id !== p.id && x.gold > 0);
      if (victims.length) {
        const t = victims[Math.floor(this.rnd() * victims.length)];
        const amt = Math.max(1, Math.floor(t.gold * pick.n / 100));
        t.gold -= amt; p.gold += amt; t.v++;
        outcome.target = t.name; outcome.targetId = t.id; outcome.amount = amt;
        changed.push(t.id);
        this._event('steal', { name: p.name, avatar: p.avatar, target: t.name, amount: amt }, now);
      } else {
        outcome.k = 'none'; outcome.note = 'لا يوجد من تسرق منه بعد';
      }
    } else if (pick.k === 'swap') {
      const richer = [...this.players.values()].filter(x => x.id !== p.id && x.gold > p.gold).sort((a, b) => b.gold - a.gold)[0];
      if (richer) {
        const g = richer.gold; richer.gold = p.gold; p.gold = g; richer.v++;
        outcome.target = richer.name; outcome.targetId = richer.id; outcome.amount = g;
        changed.push(richer.id);
        this._event('swap', { name: p.name, avatar: p.avatar, target: richer.name }, now);
      } else {
        outcome.k = 'none'; outcome.note = 'أنت في الصدارة، لا أحد تبدّل معه';
      }
    }
    if (p.gold < 0) p.gold = 0;
    outcome.delta = p.gold - before;
    if (pick.k === 'gain' && pick.n >= 75) this._event('jackpot', { name: p.name, avatar: p.avatar, amount: pick.n }, now);
    if (pick.k === 'mult' && pick.n === 3 && outcome.delta > 0) this._event('triple', { name: p.name, avatar: p.avatar }, now);

    p.chest = null;
    p.v++;
    this._nextQ(p);
    return { ok: true, outcome, options, picked: i, changed };
  }

  // ---------- العرض ----------
  scoreOf(p) { return this.mode === 'race' ? p.correct : p.gold; }

  leaderboard() {
    return [...this.players.values()].sort((a, b) =>
      (this.scoreOf(b) - this.scoreOf(a)) || (b.correct - a.correct) || (a.answered - b.answered) || (a.joinedAt - b.joinedAt));
  }

  rankOf(pid) {
    const lb = this.leaderboard();
    const i = lb.findIndex(p => p.id === pid);
    return i < 0 ? null : i + 1;
  }

  pub(p) {
    return { id: p.id, name: p.name, avatar: p.avatar, gold: p.gold, correct: p.correct, answered: p.answered, connected: !!p.connected };
  }

  meta(now) {
    return {
      state: this.state, code: this.code, mode: this.mode, goal: this.goal, durationSec: this.durationSec,
      title: this.title, hostName: this.hostName, locked: this.locked, lateJoin: this.lateJoin,
      startedAt: this.startedAt, endsAt: this.endsAt, endedAt: this.endedAt, now: now || Date.now(),
      qCount: this.questions.length, playersCount: this.players.size, winnerId: this.winnerId
    };
  }

  hostView(now = Date.now()) {
    return Object.assign(this.meta(now), {
      role: 'host',
      players: this.leaderboard().map(p => this.pub(p)),
      feed: this.feed.slice(-12)
    });
  }

  playerView(pid, now = Date.now()) {
    const p = this.players.get(pid);
    const v = Object.assign(this.meta(now), { role: 'student' });
    if (!p) return Object.assign(v, { me: null });
    v.me = Object.assign(this.pub(p), { rank: this.rankOf(pid), chest: !!p.chest, streak: p.streak });
    v.question = this.questionFor(pid);
    if (this.state === ENGINE_STATES.LOBBY) {
      v.lobby = [...this.players.values()].map(x => ({ name: x.name, avatar: x.avatar }));
    }
    if (this.state === ENGINE_STATES.ENDED) {
      v.top = this.leaderboard().slice(0, 5).map(x => this.pub(x));
    }
    return v;
  }

  _event(type, data, now) {
    this.feedSeq++;
    this.feed.push(Object.assign({ id: this.feedSeq, t: type, at: now || Date.now() }, data));
    if (this.feed.length > FEED_MAX) this.feed.splice(0, this.feed.length - FEED_MAX);
  }

  lastEvents(sinceId) { return this.feed.filter(e => e.id > sinceId); }

  // ---------- الحفظ والاستعادة ----------
  snapshot(pid) {
    const p = this.players.get(pid);
    if (!p) return null;
    return {
      v: p.v, gold: p.gold, correct: p.correct, answered: p.answered, streak: p.streak,
      order: p.order, pos: p.pos, cur: p.cur, chest: p.chest, lastAnsAt: p.lastAnsAt, answers: p.answers
    };
  }

  // دمج حالة لاعب محفوظة في مرفق مقبسه إن كانت أحدث من المخزّن (حماية من فقد الذاكرة عند السبات)
  restorePlayer(pid, snap) {
    const p = this.players.get(pid);
    if (!p || !snap || !(snap.v > p.v)) return false;
    Object.assign(p, {
      v: snap.v, gold: snap.gold, correct: snap.correct, answered: snap.answered, streak: snap.streak,
      order: snap.order || p.order, pos: snap.pos, cur: snap.cur, chest: snap.chest || null,
      lastAnsAt: snap.lastAnsAt || 0, answers: snap.answers || p.answers
    });
    return true;
  }

  serialize() {
    return {
      code: this.code, hostId: this.hostId, hostUserId: this.hostUserId, hostName: this.hostName, title: this.title,
      courseKey: this.courseKey, mode: this.mode, durationSec: this.durationSec, goal: this.goal, lateJoin: this.lateJoin,
      questions: this.questions, state: this.state, locked: this.locked, createdAt: this.createdAt,
      startedAt: this.startedAt, endsAt: this.endsAt, endedAt: this.endedAt, winnerId: this.winnerId, resultsSaved: this.resultsSaved,
      players: [...this.players.values()], kicked: [...this.kicked], feed: this.feed, feedSeq: this.feedSeq
    };
  }

  static deserialize(s) {
    if (!s) return null;
    const e = new ArenaEngine({
      code: s.code, hostId: s.hostId, hostUserId: s.hostUserId, hostName: s.hostName, title: s.title,
      courseKey: s.courseKey, mode: s.mode, durationSec: s.durationSec, goal: s.goal, lateJoin: s.lateJoin, now: s.createdAt
    });
    e.questions = s.questions || [];
    e.state = s.state || ENGINE_STATES.LOBBY;
    e.locked = !!s.locked;
    e.startedAt = s.startedAt || null;
    e.endsAt = s.endsAt || null;
    e.endedAt = s.endedAt || null;
    e.winnerId = s.winnerId || null;
    e.resultsSaved = !!s.resultsSaved;
    e.players = new Map((s.players || []).map(p => [p.id, p]));
    e.kicked = new Set(s.kicked || []);
    e.feed = s.feed || [];
    e.feedSeq = s.feedSeq || 0;
    return e;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ArenaEngine, ENGINE_STATES, MIN_ANSWER_GAP_MS, MAX_PLAYERS };
}
