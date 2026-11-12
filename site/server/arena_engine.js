// site/server/arena_engine.js
// محرك ساحة التحدي النقي (Pure JavaScript Game Engine)
// خالٍ تماماً من أي اعتماديات على Cloudflare أو Node.js أو المتصفح.

const ENGINE_STATES = {
  LOBBY: 'LOBBY',
  STARTING: 'STARTING',
  QUESTION: 'QUESTION',
  REVEAL: 'REVEAL',
  PODIUM: 'PODIUM',
  PAUSED: 'PAUSED'
};

class ArenaEngine {
  constructor(config = {}) {
    this.code = String(config.code || '').toUpperCase();
    this.hostId = String(config.hostId || 'host');
    this.hostName = String(config.hostName || 'المعلم');
    this.courseKey = String(config.courseKey || '').trim();
    this.mode = config.mode || 'gold_rush'; // gold_rush | cafe | tower
    this.timePerQuestion = Math.max(5, Math.min(120, +(config.timePerQuestion || 20))); // ثوانٍ
    this.revealDuration = Math.max(3, Math.min(30, +(config.revealDuration || 6))); // ثوانٍ
    this.startingDuration = Math.max(3, Math.min(10, +(config.startingDuration || 3))); // ثوانٍ
    this.maxPlayers = Math.max(2, Math.min(100, +(config.maxPlayers || 60)));

    // قائمة الأسئلة: كل سؤال يحتوي على qid, stem, choices, correct, difficulty
    this.questions = Array.isArray(config.questions) ? config.questions : [];
    this.currentQIndex = -1;

    this.state = ENGINE_STATES.LOBBY;
    this.previousState = null; // للحفظ عند الإيقاف المؤقت (PAUSED)
    this.players = new Map(); // id -> PlayerState

    // مؤقتات الحالة الحالية (بالمللي ثانية)
    this.stateStartedAt = Date.now();
    this.deadlineAt = 0;
    this.pausedRemainingMs = 0;

    // إحصائيات الجولة الحالية
    this.roundAnswers = new Map(); // playerId -> { choiceIndex, answeredAt, durationMs, isCorrect, pointsAwarded }
    this.kickedIds = new Set();
    this.locked = false; // قفل الغرفة من دخول لاعبين جدد
  }

  // انضمام لاعب
  join(playerId, profile = {}) {
    playerId = String(playerId || '').trim();
    if (!playerId) return { ok: false, error: 'معرّف اللاعب مطلوب' };
    if (this.kickedIds.has(playerId)) return { ok: false, error: 'تم استبعادك من هذه الغرفة' };

    // إذا كان اللاعب موجوداً مسبقاً (إعادة اتصال)
    if (this.players.has(playerId)) {
      const p = this.players.get(playerId);
      p.connected = true;
      p.lastSeen = Date.now();
      if (profile.name) p.name = String(profile.name).trim().slice(0, 30);
      if (profile.avatar) p.avatar = String(profile.avatar).slice(0, 10);
      return { ok: true, reconnected: true, player: p };
    }

    if (this.state !== ENGINE_STATES.LOBBY) {
      return { ok: false, error: 'اللعبة بدأت بالفعل ولا يمكن الانضمام الآن' };
    }
    if (this.locked) {
      return { ok: false, error: 'الغرفة مغلقة من قبل المضيف' };
    }
    const nonHostCount = [...this.players.values()].filter(p => !p.isHost).length;
    if (nonHostCount >= this.maxPlayers) {
      return { ok: false, error: 'اكتمل العدد الأقصى للاعبين' };
    }

    const isHost = playerId === this.hostId;
    const player = {
      id: playerId,
      name: String(profile.name || (isHost ? this.hostName : `طالب ${nonHostCount + 1}`)).trim().slice(0, 30),
      avatar: String(profile.avatar || (isHost ? '👑' : '🦅')).slice(0, 10),
      classId: profile.classId ? String(profile.classId).trim() : null,
      did: profile.did ? String(profile.did).trim() : null,
      isHost,
      score: 0,
      gold: 0,
      streak: 0,
      maxStreak: 0,
      correctCount: 0,
      wrongCount: 0,
      connected: true,
      joinedAt: Date.now(),
      lastSeen: Date.now(),
      rounds: []
    };

    this.players.set(playerId, player);
    return { ok: true, player };
  }

  // مغادرة أو فصل اتصال
  leave(playerId) {
    if (!this.players.has(playerId)) return false;
    const p = this.players.get(playerId);
    p.connected = false;
    p.lastSeen = Date.now();
    // إذا كانت الغرفة في اللوبي ولم تبدأ، يُحذف اللاعب تماماً
    if (this.state === ENGINE_STATES.LOBBY && !p.isHost) {
      this.players.delete(playerId);
    }
    return true;
  }

  // طرد لاعب بواسطة المضيف
  kick(playerId, hostId) {
    if (hostId !== this.hostId) return { ok: false, error: 'صلاحية المضيف مطلوبة للطرد' };
    if (!this.players.has(playerId)) return { ok: false, error: 'اللاعب غير موجود' };
    if (playerId === this.hostId) return { ok: false, error: 'لا يمكن للمضيف طرد نفسه' };

    this.players.delete(playerId);
    this.kickedIds.add(playerId);
    return { ok: true };
  }

  // قفل/فتح الانضمام
  setLock(locked, hostId) {
    if (hostId !== this.hostId) return { ok: false, error: 'صلاحية المضيف مطلوبة' };
    this.locked = !!locked;
    return { ok: true, locked: this.locked };
  }

  // بدء اللعبة
  start(hostId, nowMs = Date.now()) {
    if (hostId !== this.hostId) return { ok: false, error: 'صلاحية المضيف مطلوبة لبدء اللعبة' };
    if (this.state !== ENGINE_STATES.LOBBY) return { ok: false, error: 'اللعبة في حالة لا تسمح بالبدء' };
    if (this.questions.length === 0) return { ok: false, error: 'لا توجد أسئلة في الغرفة' };

    const students = [...this.players.values()].filter(p => !p.isHost);
    if (students.length === 0) return { ok: false, error: 'لا يوجد طلاب في الغرفة بعد' };

    this.state = ENGINE_STATES.STARTING;
    this.stateStartedAt = nowMs;
    this.deadlineAt = nowMs + this.startingDuration * 1000;
    this.currentQIndex = -1;
    return { ok: true, nextAlarmAt: this.deadlineAt };
  }

  // الانتقال إلى السؤال التالي
  nextQuestion(nowMs = Date.now()) {
    this.currentQIndex++;
    if (this.currentQIndex >= this.questions.length) {
      // انتهت الأسئلة -> الانتقال للمنصة والتتويج
      this.state = ENGINE_STATES.PODIUM;
      this.stateStartedAt = nowMs;
      this.deadlineAt = 0;
      return { ok: true, state: this.state, finished: true };
    }

    this.state = ENGINE_STATES.QUESTION;
    this.stateStartedAt = nowMs;
    this.deadlineAt = nowMs + this.timePerQuestion * 1000;
    this.roundAnswers.clear();
    return { ok: true, state: this.state, qIndex: this.currentQIndex, nextAlarmAt: this.deadlineAt };
  }

  // إنهاء السؤال الحالي والانتقال للنتيجة (REVEAL)
  revealQuestion(nowMs = Date.now()) {
    if (this.state !== ENGINE_STATES.QUESTION && this.state !== ENGINE_STATES.PAUSED) {
      return { ok: false, error: 'لا يمكن كشف السؤال خارج حالة السؤال' };
    }

    // احتساب من لم يجب كإجابة خاطئة
    const currentQ = this.getCurrentQuestionRaw();
    const correctIdx = currentQ ? currentQ.correct : 0;

    for (const [id, player] of this.players.entries()) {
      if (player.isHost) continue;
      if (!this.roundAnswers.has(id)) {
        player.streak = 0;
        player.wrongCount++;
        const timeoutRecord = {
          qIndex: this.currentQIndex,
          qid: currentQ ? currentQ.qid : '',
          choiceIndex: -1,
          answeredAt: nowMs,
          durationMs: this.timePerQuestion * 1000,
          isCorrect: false,
          pointsAwarded: 0
        };
        this.roundAnswers.set(id, timeoutRecord);
        if (!player.rounds) player.rounds = [];
        player.rounds.push(timeoutRecord);
      }
    }

    this.state = ENGINE_STATES.REVEAL;
    this.stateStartedAt = nowMs;
    this.deadlineAt = nowMs + this.revealDuration * 1000;
    return { ok: true, state: this.state, nextAlarmAt: this.deadlineAt };
  }

  // تسليم إجابة طالب
  submitAnswer(playerId, choiceIndex, nowMs = Date.now()) {
    if (this.state !== ENGINE_STATES.QUESTION) {
      return { ok: false, error: 'الوقت انتهى أو اللعبة ليست في طور استقبال الإجابات' };
    }
    const player = this.players.get(playerId);
    if (!player) return { ok: false, error: 'اللاعب غير مسجل' };
    if (player.isHost) return { ok: false, error: 'المضيف لا يشارك في الإجابة' };
    if (this.roundAnswers.has(playerId)) return { ok: false, error: 'تم تسليم إجابتك بالفعل' };

    choiceIndex = +choiceIndex;
    const currentQ = this.getCurrentQuestionRaw();
    if (!currentQ) return { ok: false, error: 'لا يوجد سؤال حالي' };

    const durationMs = Math.max(100, nowMs - this.stateStartedAt);
    const totalMs = this.timePerQuestion * 1000;
    const remainingMs = Math.max(0, totalMs - durationMs);
    const isCorrect = choiceIndex === currentQ.correct;

    let pointsAwarded = 0;
    if (isCorrect) {
      // معادلة النقاط القياسية: 500 أساس + ما يصل إلى 500 للسرعة + حافز التتالي
      const speedRatio = Math.max(0, Math.min(1, remainingMs / totalMs));
      const speedPoints = Math.round(speedRatio * 500);
      player.streak = (player.streak || 0) + 1;
      if (player.streak > (player.maxStreak || 0)) player.maxStreak = player.streak;
      const streakBonus = Math.min(300, (player.streak - 1) * 50);
      pointsAwarded = 500 + speedPoints + streakBonus;

      player.score += pointsAwarded;
      player.gold += Math.round(pointsAwarded / 10);
      player.correctCount++;
    } else {
      player.streak = 0;
      player.wrongCount++;
    }

    const ansRecord = {
      qIndex: this.currentQIndex,
      qid: currentQ.qid,
      choiceIndex,
      answeredAt: nowMs,
      durationMs,
      isCorrect,
      pointsAwarded
    };
    this.roundAnswers.set(playerId, ansRecord);
    if (!player.rounds) player.rounds = [];
    player.rounds.push(ansRecord);

    // تحقق هل أجاب جميع الطلاب المتصلين؟
    const activeStudents = [...this.players.values()].filter(p => !p.isHost && p.connected);
    const allAnswered = activeStudents.length > 0 && activeStudents.every(p => this.roundAnswers.has(p.id));

    return {
      ok: true,
      isCorrect,
      pointsAwarded,
      allAnswered
    };
  }

  // إيقاف مؤقت / استئناف
  pause(hostId, nowMs = Date.now()) {
    if (hostId !== this.hostId) return { ok: false, error: 'صلاحية المضيف مطلوبة' };
    if (this.state === ENGINE_STATES.PAUSED) return { ok: false, error: 'اللعبة متوقفة بالفعل' };
    if (this.state !== ENGINE_STATES.QUESTION && this.state !== ENGINE_STATES.REVEAL) {
      return { ok: false, error: 'لا يمكن الإيقاف في هذه الحالة' };
    }

    this.previousState = this.state;
    this.pausedRemainingMs = Math.max(0, this.deadlineAt - nowMs);
    this.state = ENGINE_STATES.PAUSED;
    this.deadlineAt = 0;
    return { ok: true, state: this.state };
  }

  resume(hostId, nowMs = Date.now()) {
    if (hostId !== this.hostId) return { ok: false, error: 'صلاحية المضيف مطلوبة' };
    if (this.state !== ENGINE_STATES.PAUSED) return { ok: false, error: 'اللعبة ليست متوقفة' };

    this.state = this.previousState || ENGINE_STATES.QUESTION;
    this.previousState = null;
    this.deadlineAt = nowMs + Math.max(1000, this.pausedRemainingMs);
    this.stateStartedAt = nowMs;
    return { ok: true, state: this.state, nextAlarmAt: this.deadlineAt };
  }

  // تخطي السؤال فورياً
  skip(hostId, nowMs = Date.now()) {
    if (hostId !== this.hostId) return { ok: false, error: 'صلاحية المضيف مطلوبة' };
    if (this.state !== ENGINE_STATES.QUESTION && this.state !== ENGINE_STATES.PAUSED) {
      return { ok: false, error: 'لا يوجد سؤال نشط لتخطيه' };
    }
    return this.revealQuestion(nowMs);
  }

  // مؤقت التنبيه (Alarms)
  tick(nowMs = Date.now()) {
    if (this.state === ENGINE_STATES.PAUSED || this.state === ENGINE_STATES.LOBBY || this.state === ENGINE_STATES.PODIUM) {
      return { transitioned: false };
    }
    if (this.deadlineAt && nowMs >= this.deadlineAt) {
      if (this.state === ENGINE_STATES.STARTING) {
        const res = this.nextQuestion(nowMs);
        return { transitioned: true, state: this.state, ...res };
      }
      if (this.state === ENGINE_STATES.QUESTION) {
        const res = this.revealQuestion(nowMs);
        return { transitioned: true, state: this.state, ...res };
      }
      if (this.state === ENGINE_STATES.REVEAL) {
        const res = this.nextQuestion(nowMs);
        return { transitioned: true, state: this.state, ...res };
      }
    }
    return { transitioned: false, nextAlarmAt: this.deadlineAt };
  }

  // السؤال الحالي الخام (مع الإجابة الصحيحة - داخلي فقط)
  getCurrentQuestionRaw() {
    if (this.currentQIndex < 0 || this.currentQIndex >= this.questions.length) return null;
    return this.questions[this.currentQIndex];
  }

  // السؤال المنقح للعميل (يمنع تماماً إرسال الإجابة الصحيحة أثناء طور السؤال)
  getSanitizedQuestion(isHost = false) {
    const raw = this.getCurrentQuestionRaw();
    if (!raw) return null;

    const base = {
      index: this.currentQIndex,
      total: this.questions.length,
      qid: raw.qid,
      stem: raw.stem,
      choices: raw.choices,
      difficulty: raw.difficulty || 'متوسطة'
    };

    // الإجابة الصحيحة لا تُرسل أبداً أثناء طور السؤال إلا إذا كنا في طور REVEAL أو PODIUM
    if (this.state === ENGINE_STATES.REVEAL || this.state === ENGINE_STATES.PODIUM) {
      base.correct = raw.correct;
      base.answer = raw.choices[raw.correct] || '';
    } else if (isHost) {
      // المعلم يرى الإجابة الصحيحة في شاشته للإرشاد فقط
      base.hostHintCorrect = raw.correct;
    }
    return base;
  }

  // لوحة الصدارة والمتصدرين
  getLeaderboard() {
    const list = [...this.players.values()]
      .filter(p => !p.isHost)
      .map(p => ({
        id: p.id,
        name: p.name,
        avatar: p.avatar,
        score: p.score,
        streak: p.streak,
        maxStreak: p.maxStreak || 0,
        correctCount: p.correctCount,
        wrongCount: p.wrongCount,
        connected: p.connected
      }))
      .sort((a, b) => b.score - a.score);

    list.forEach((p, idx) => {
      p.rank = idx + 1;
    });
    return list;
  }

  // حالة الغرفة الكاملة للعميل وفق هويته (طالب / معلم)
  getStateFor(playerId, nowMs = Date.now()) {
    const isHost = playerId === this.hostId;
    const player = this.players.get(playerId) || null;
    const remainingMs = this.state === ENGINE_STATES.PAUSED ? this.pausedRemainingMs : Math.max(0, this.deadlineAt - nowMs);

    const out = {
      code: this.code,
      state: this.state,
      mode: this.mode,
      isHost,
      locked: this.locked,
      totalQuestions: this.questions.length,
      currentQIndex: this.currentQIndex,
      remainingSeconds: Math.ceil(remainingMs / 1000),
      remainingMs,
      question: this.getSanitizedQuestion(isHost),
      leaderboard: this.getLeaderboard(),
      playersCount: [...this.players.values()].filter(p => !p.isHost).length,
      activeCount: [...this.players.values()].filter(p => !p.isHost && p.connected).length
    };

    // إحصائيات الإجابات للمعلم في طور REVEAL
    if (this.state === ENGINE_STATES.REVEAL || this.state === ENGINE_STATES.PODIUM) {
      const counts = [0, 0, 0, 0];
      for (const ans of this.roundAnswers.values()) {
        if (ans.choiceIndex >= 0 && ans.choiceIndex < counts.length) {
          counts[ans.choiceIndex]++;
        }
      }
      out.choiceCounts = counts;
    }

    // معلومات خاصة باللاعب الطالب
    if (player && !isHost) {
      out.me = {
        id: player.id,
        name: player.name,
        avatar: player.avatar,
        score: player.score,
        gold: player.gold,
        streak: player.streak,
        hasAnswered: this.roundAnswers.has(playerId)
      };
      if (this.roundAnswers.has(playerId) && (this.state === ENGINE_STATES.REVEAL || this.state === ENGINE_STATES.PODIUM)) {
        const myAns = this.roundAnswers.get(playerId);
        out.myRoundResult = {
          choiceIndex: myAns.choiceIndex,
          isCorrect: myAns.isCorrect,
          pointsAwarded: myAns.pointsAwarded,
          durationMs: myAns.durationMs
        };
      }
    }
    return out;
  }

  // تسلسل وحفظ الحالة في SQLite / DO Storage
  serialize() {
    return {
      code: this.code,
      hostId: this.hostId,
      hostName: this.hostName,
      courseKey: this.courseKey,
      mode: this.mode,
      timePerQuestion: this.timePerQuestion,
      revealDuration: this.revealDuration,
      startingDuration: this.startingDuration,
      maxPlayers: this.maxPlayers,
      questions: this.questions,
      currentQIndex: this.currentQIndex,
      state: this.state,
      previousState: this.previousState,
      stateStartedAt: this.stateStartedAt,
      deadlineAt: this.deadlineAt,
      pausedRemainingMs: this.pausedRemainingMs,
      locked: this.locked,
      kickedIds: [...this.kickedIds],
      players: [...this.players.entries()],
      roundAnswers: [...this.roundAnswers.entries()]
    };
  }

  // استعادة الحالة من التخزين
  static deserialize(data) {
    if (!data) return null;
    const engine = new ArenaEngine({
      code: data.code,
      hostId: data.hostId,
      hostName: data.hostName,
      courseKey: data.courseKey,
      mode: data.mode,
      timePerQuestion: data.timePerQuestion,
      revealDuration: data.revealDuration,
      startingDuration: data.startingDuration,
      maxPlayers: data.maxPlayers,
      questions: data.questions
    });

    engine.currentQIndex = data.currentQIndex;
    engine.state = data.state;
    engine.previousState = data.previousState;
    engine.stateStartedAt = data.stateStartedAt;
    engine.deadlineAt = data.deadlineAt;
    engine.pausedRemainingMs = data.pausedRemainingMs;
    engine.locked = !!data.locked;
    engine.kickedIds = new Set(data.kickedIds || []);
    engine.players = new Map(data.players || []);
    engine.roundAnswers = new Map(data.roundAnswers || []);
    return engine;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ArenaEngine, ENGINE_STATES };
}
