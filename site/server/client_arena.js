/**
 * ساحة التحدي — منصة الألعاب والمسابقات التعليمية التفاعلية
 * تابعة لمنظومة الكبسولة (وتعمل بهوية تقني حذيفة وميدان خبير)
 */
(function() {
  'use strict';
  guard();

  // عناصر الحالة العامة
  var state = {
    view: 'setup', // 'setup', 'game', 'result', 'store'
    courses: [],
    selectedCourse: null,
    units: [],
    selectedLessons: {},
    qCount: 10,
    difficulty: 'all',
    mode: 'gold', // 'gold', 'cafe', 'tower', 'review'
    activeQuestions: [],
    currentQIndex: 0,
    score: 0,
    gold: 0,
    wallet: 0,
    combo: 0,
    wrongAnswers: [],
    activeAvatar: 'falcon',
    ownedAvatars: ['falcon'],
    soundMuted: false,
    gameStats: {}
  };

  // تهيئة المحفظة والصوت والشخصيات
  try {
    state.wallet = parseInt(localStorage.getItem('arena_wallet_v1') || '0', 10);
    state.soundMuted = localStorage.getItem('arena_muted_v1') === '1';
    var savedAvatars = JSON.parse(localStorage.getItem('arena_avatars_v1') || '["falcon"]');
    if (Array.isArray(savedAvatars)) state.ownedAvatars = savedAvatars;
    var curAv = localStorage.getItem('arena_cur_avatar_v1') || 'falcon';
    if (state.ownedAvatars.indexOf(curAv) >= 0) state.activeAvatar = curAv;
  } catch (e) {}

  function saveWallet() {
    try {
      localStorage.setItem('arena_wallet_v1', String(state.wallet));
      localStorage.setItem('arena_avatars_v1', JSON.stringify(state.ownedAvatars));
      localStorage.setItem('arena_cur_avatar_v1', state.activeAvatar);
      localStorage.setItem('arena_muted_v1', state.soundMuted ? '1' : '0');
    } catch (e) {}
  }

  // مولّد المؤثرات الصوتية برمجياً عبر WebAudio API
  var audioCtx = null;
  function getAudioCtx() {
    if (!audioCtx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (AC) audioCtx = new AC();
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  }

  function playSfx(type) {
    if (state.soundMuted) return;
    try {
      var ctx = getAudioCtx();
      if (!ctx) return;
      var now = ctx.currentTime;
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === 'correct') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, now); // C5
        osc.frequency.setValueAtTime(659.25, now + 0.08); // E5
        osc.frequency.setValueAtTime(783.99, now + 0.16); // G5
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
        osc.start(now);
        osc.stop(now + 0.35);
      } else if (type === 'wrong') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(196, now); // G3
        osc.frequency.setValueAtTime(146.83, now + 0.12); // D3
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
        osc.start(now);
        osc.stop(now + 0.3);
      } else if (type === 'coin') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(987.77, now); // B5
        osc.frequency.setValueAtTime(1318.51, now + 0.08); // E6
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.28);
        osc.start(now);
        osc.stop(now + 0.28);
      } else if (type === 'chest') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.setValueAtTime(554.37, now + 0.1);
        osc.frequency.setValueAtTime(659.25, now + 0.2);
        osc.frequency.setValueAtTime(880, now + 0.3);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
        osc.start(now);
        osc.stop(now + 0.5);
      } else if (type === 'hit') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(120, now);
        osc.frequency.setValueAtTime(60, now + 0.1);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
        osc.start(now);
        osc.stop(now + 0.25);
      }
    } catch (e) {}
  }

  // الشخصيات التعليمية الأصلية
  var AVATARS = [
    { id: 'falcon', name: 'الصقر المحلّق', icon: '🦅', price: 0, desc: 'شخصية الانطلاق السريع' },
    { id: 'owl', name: 'البومة الحكيمة', icon: '🦉', price: 150, desc: 'رمز التركيز والتأني' },
    { id: 'rocket', name: 'المستكشف الفضائي', icon: '🚀', price: 300, desc: 'عاشق العلوم والتحديات الكبرى' },
    { id: 'lion', name: 'الشجاع الجسور', icon: '🦁', price: 500, desc: 'حامي البرج وروح الإصرار' },
    { id: 'lightning', name: 'البرق المعرفي', icon: '⚡', price: 750, desc: 'سرعة البديهة ودقة الإجابة' },
    { id: 'knight', name: 'الفارس الذهبي', icon: '🛡️', price: 1000, desc: 'بطل ساحة التحدي بلا منازع' }
  ];

  function getAvatar(id) {
    for (var i = 0; i < AVATARS.length; i++) {
      if (AVATARS[i].id === id) return AVATARS[i];
    }
    return AVATARS[0];
  }

  // قوالب العرض والأزرار العلوية
  function renderHeaderBar() {
    var av = getAvatar(state.activeAvatar);
    return '<div class="ar-top-bar">' +
      '<div class="ar-user-info">' +
        '<span class="ar-av-badge" title="' + esc(av.name) + '">' + av.icon + '</span>' +
        '<div class="ar-wallet-pill" title="رصيد الذهب">' +
          '<span class="ar-coin-icon">🪙</span>' +
          '<b id="arWalletVal">' + state.wallet + '</b>' +
        '</div>' +
      '</div>' +
      '<div class="ar-top-actions">' +
        '<button type="button" class="btn ghost small" id="arSoundToggle" title="كتم/تشغيل الصوت" aria-label="كتم أو تشغيل الصوت">' +
          (state.soundMuted ? '🔇 مكتوم' : '🔊 صوت') +
        '</button>' +
        '<button type="button" class="btn ' + (state.view === 'store' ? 'primary' : 'ghost') + ' small" id="arStoreBtn">' +
          '🛍️ سوق الشخصيات' +
        '</button>' +
        (state.view !== 'setup' ? '<button type="button" class="btn ghost small" id="arExitBtn">🚪 خروج</button>' : '') +
      '</div>' +
    '</div>';
  }

  // ==========================================
  // الشاشة 1: اختيار المقرر والدروس والإعدادات
  // ==========================================
  function renderSetup() {
    state.view = 'setup';
    var main = $('arenaMain');
    if (!main) return;

    var h = renderHeaderBar();
    h += '<div class="ar-notice-strip">' +
      '<span>✨ <b>تنبيه تربوي:</b> الذهب والتوكنز للمتعة والتنافس الصفّي الشريف، ولا تُحسب في درجات التقويم الرسمية.</span>' +
    '</div>';

    h += '<div class="ar-setup-grid">';
    
    // العمود الأيمن: اختيار المقرر والصف والدروس
    h += '<div class="card ar-setup-card">' +
      '<h2 class="ar-step-h"><span class="ar-step-num">1</span> حدّد المقرر والدروس</h2>' +
      '<div class="ar-field">' +
        '<label for="arCourseSel"><b>المقرر الدراسي:</b></label>' +
        '<select id="arCourseSel" class="ar-select">' +
          '<option value="">-- اختر المادة والصف --</option>' +
          state.courses.map(function(c) {
            var icon = (c.subject.indexOf('علوم') >= 0 || c.subject.indexOf('أحياء') >= 0 || c.subject.indexOf('كيمياء') >= 0 || c.subject.indexOf('فيزياء') >= 0) ? '🔬' : '📘';
            if (c.subject.indexOf('عربية') >= 0) icon = '📖';
            if (c.subject.indexOf('إسلام') >= 0) icon = '🕌';
            if (c.subject.indexOf('رياض') >= 0) icon = '➗';
            if (c.subject.indexOf('تقنية') >= 0) icon = '💻';
            var dis = c.total_mcq === 0 ? ' disabled' : '';
            var label = icon + ' ' + c.subject + ' (' + c.grade + ')' + (c.total_mcq > 0 ? ' · ' + c.total_mcq + ' سؤال' : ' · قريبًا');
            return '<option value="' + esc(c.key) + '"' + dis + (state.selectedCourse === c.key ? ' selected' : '') + '>' + esc(label) + '</option>';
          }).join('') +
        '</select>' +
      '</div>';

    // قائمة الوحدات والدروس
    h += '<div id="arUnitsBox" class="ar-units-box">';
    if (!state.selectedCourse) {
      h += '<div class="ar-empty-state">اختر مقررًا لعرض وحداته ودروسه التفاعلية.</div>';
    } else if (!state.units || !state.units.length) {
      h += '<div class="ar-empty-state">جارٍ جلب دروس هذا المقرر…</div>';
    } else {
      h += renderUnitsList();
    }
    h += '</div></div>';

    // العمود الأيسر: نمط اللعب والإعدادات
    h += '<div class="card ar-setup-card">' +
      '<h2 class="ar-step-h"><span class="ar-step-num">2</span> اختر نمط التحدي</h2>' +
      '<div class="ar-modes-grid">' +
        '<label class="ar-mode-opt' + (state.mode === 'gold' ? ' active' : '') + '">' +
          '<input type="radio" name="arMode" value="gold"' + (state.mode === 'gold' ? ' checked' : '') + '>' +
          '<div class="ar-mode-ic">🏆</div>' +
          '<b>سباق الذهب</b>' +
          '<small>أجب وافتح صناديق الكنز، وضاعف ثروتك أو تفادَ المقالب!</small>' +
        '</label>' +
        '<label class="ar-mode-opt' + (state.mode === 'cafe' ? ' active' : '') + '">' +
          '<input type="radio" name="arMode" value="cafe"' + (state.mode === 'cafe' ? ' checked' : '') + '>' +
          '<div class="ar-mode-ic">☕</div>' +
          '<b>المقهى المعرفي</b>' +
          '<small>جهّز طلبات الزبائن بسرعة وحافظ على تقييم 5 نجوم لسمعتك!</small>' +
        '</label>' +
        '<label class="ar-mode-opt' + (state.mode === 'tower' ? ' active' : '') + '">' +
          '<input type="radio" name="arMode" value="tower"' + (state.mode === 'tower' ? ' checked' : '') + '>' +
          '<div class="ar-mode-ic">🏰</div>' +
          '<b>الدفاع عن البرج</b>' +
          '<small>أطلق القذائف المعرفية لصد موجات الوحوش وحماية قلعتك!</small>' +
        '</label>' +
        '<label class="ar-mode-opt' + (state.mode === 'review' ? ' active' : '') + '">' +
          '<input type="radio" name="arMode" value="review"' + (state.mode === 'review' ? ' checked' : '') + '>' +
          '<div class="ar-mode-ic">📑</div>' +
          '<b>وضع المراجعة</b>' +
          '<small>بطاقات استذكار ذاتي وإعادة مكررة للأسئلة الخاطئة حتى الإتقان.</small>' +
        '</label>' +
      '</div>' +

      '<h2 class="ar-step-h" style="margin-top:20px"><span class="ar-step-num">3</span> إعدادات الجولة</h2>' +
      '<div class="ar-settings-row">' +
        '<div class="ar-setting-field">' +
          '<label><b>عدد الأسئلة:</b></label>' +
          '<div class="ar-pills" id="arQCountPills">' +
            [10, 20, 30, 'all'].map(function(n) {
              var txt = n === 'all' ? 'الكل' : n;
              return '<button type="button" class="btn small ' + (state.qCount === n ? 'primary' : 'ghost') + '" data-qc="' + n + '">' + txt + '</button>';
            }).join('') +
          '</div>' +
        '</div>' +
        '<div class="ar-setting-field">' +
          '<label><b>مستوى الصعوبة:</b></label>' +
          '<div class="ar-pills" id="arDiffPills">' +
            [['all', 'مختلطة'], ['منخفضة', 'سهل'], ['متوسطة', 'متوسط'], ['مرتفعة', 'تحدٍّ']].map(function(d) {
              return '<button type="button" class="btn small ' + (state.difficulty === d[0] ? 'primary' : 'ghost') + '" data-diff="' + d[0] + '">' + d[1] + '</button>';
            }).join('') +
          '</div>' +
        '</div>' +
      '</div>' +

      '<div class="ar-launch-box">' +
        '<div class="ar-avail-hint" id="arAvailHint">حدّد درسًا واحدًا على الأقل لبدء التحدي.</div>' +
        '<button type="button" class="btn primary wide ar-start-btn" id="arStartBtn" disabled>' +
          '🚀 انطلق في ساحة التحدي' +
        '</button>' +
      '</div>' +
    '</div></div>';

    main.innerHTML = h;
    bindSetupEvents();
  }

  function renderUnitsList() {
    var out = '';
    state.units.forEach(function(u) {
      var allChecked = u.lessons.length > 0 && u.lessons.every(function(l) { return state.selectedLessons[l.id]; });
      out += '<div class="ar-unit-block">' +
        '<div class="ar-unit-head">' +
          '<b>' + esc(u.unit_name || ('الوحدة ' + u.unit)) + '</b>' +
          '<button type="button" class="btn ghost small ar-toggle-unit" data-unit="' + esc(u.unit) + '">' +
            (allChecked ? 'إلغاء الوحدة' : 'تحديد الوحدة') +
          '</button>' +
        '</div>' +
        '<div class="ar-lessons-list">' +
          u.lessons.map(function(l) {
            var chk = state.selectedLessons[l.id] ? ' checked' : '';
            var dis = l.mcq_count === 0 ? ' disabled' : '';
            var countTag = l.mcq_count > 0 ? '<span class="ar-q-tag">' + l.mcq_count + ' أسئلة</span>' : '<span class="ar-q-tag muted">لا بنك</span>';
            return '<label class="ar-lesson-item' + (l.mcq_count === 0 ? ' disabled' : '') + '">' +
              '<input type="checkbox" data-lid="' + l.id + '"' + chk + dis + '> ' +
              '<span class="ar-l-title">' + esc(l.title) + '</span> ' +
              countTag +
            '</label>';
          }).join('') +
        '</div>' +
      '</div>';
    });
    return out;
  }

  function updateAvailQuestions() {
    var count = 0;
    state.units.forEach(function(u) {
      u.lessons.forEach(function(l) {
        if (state.selectedLessons[l.id] && l.items) {
          l.items.forEach(function(it) {
            if (state.difficulty === 'all' || it.difficulty === state.difficulty) {
              count++;
            }
          });
        }
      });
    });

    var hint = $('arAvailHint');
    var btn = $('arStartBtn');
    if (!hint || !btn) return;

    if (count === 0) {
      hint.textContent = 'لا توجد أسئلة متوفرة وفق الفلاتر المختارة، حدّد دروسًا أخرى.';
      btn.disabled = true;
    } else {
      hint.innerHTML = 'متوفر <b>' + count + '</b> سؤالًا صالحًا وفق اختيارك.';
      btn.disabled = false;
    }
  }

  function bindSetupEvents() {
    var cSel = $('arCourseSel');
    if (cSel) {
      cSel.onchange = function() {
        var val = this.value;
        state.selectedCourse = val;
        state.selectedLessons = {};
        if (!val) {
          state.units = [];
          renderSetup();
          return;
        }
        var uBox = $('arUnitsBox');
        if (uBox) uBox.innerHTML = '<div class="ar-empty-state">جارٍ تحميل بنك أسئلة المقرر…</div>';
        api('/api/arena/data?key=' + encodeURIComponent(val)).then(function(res) {
          state.units = res.units || [];
          // تحديد أول درسين تلقائيًا للتسهيل
          var count = 0;
          state.units.forEach(function(u) {
            u.lessons.forEach(function(l) {
              if (count < 2 && l.mcq_count > 0) {
                state.selectedLessons[l.id] = true;
                count++;
              }
            });
          });
          renderSetup();
        }, function(err) {
          toast(err.message || 'تعذّر جلب بيانات المقرر');
        });
      };
    }

    // تحديد أزرار الصعوبة وعدد الأسئلة
    var qcPills = document.querySelectorAll('#arQCountPills button');
    Array.prototype.forEach.call(qcPills, function(btn) {
      btn.onclick = function() {
        var v = this.getAttribute('data-qc');
        state.qCount = v === 'all' ? 'all' : parseInt(v, 10);
        Array.prototype.forEach.call(qcPills, function(b) { b.classList.remove('primary'); b.classList.add('ghost'); });
        this.classList.add('primary'); this.classList.remove('ghost');
        updateAvailQuestions();
      };
    });

    var diffPills = document.querySelectorAll('#arDiffPills button');
    Array.prototype.forEach.call(diffPills, function(btn) {
      btn.onclick = function() {
        state.difficulty = this.getAttribute('data-diff');
        Array.prototype.forEach.call(diffPills, function(b) { b.classList.remove('primary'); b.classList.add('ghost'); });
        this.classList.add('primary'); this.classList.remove('ghost');
        updateAvailQuestions();
      };
    });

    // تبديل النمط
    var modeInputs = document.querySelectorAll('input[name="arMode"]');
    Array.prototype.forEach.call(modeInputs, function(r) {
      r.onchange = function() {
        state.mode = this.value;
        Array.prototype.forEach.call(document.querySelectorAll('.ar-mode-opt'), function(lbl) {
          lbl.classList.remove('active');
        });
        this.closest('.ar-mode-opt').classList.add('active');
      };
    });

    // تفاعل الدروس والوحدات
    var unitToggles = document.querySelectorAll('.ar-toggle-unit');
    Array.prototype.forEach.call(unitToggles, function(btn) {
      btn.onclick = function() {
        var uNum = this.getAttribute('data-unit');
        var u = state.units.find(function(x) { return String(x.unit) === String(uNum); });
        if (!u) return;
        var allChecked = u.lessons.length > 0 && u.lessons.every(function(l) { return state.selectedLessons[l.id]; });
        u.lessons.forEach(function(l) {
          if (l.mcq_count > 0) {
            state.selectedLessons[l.id] = !allChecked;
          }
        });
        var uBox = $('arUnitsBox');
        if (uBox) uBox.innerHTML = renderUnitsList();
        bindUnitListEvents();
        updateAvailQuestions();
      };
    });

    bindUnitListEvents();
    bindCommonHeaderEvents();

    var startBtn = $('arStartBtn');
    if (startBtn) {
      startBtn.onclick = function() {
        startMatch();
      };
    }

    updateAvailQuestions();
  }

  function bindUnitListEvents() {
    var lChecks = document.querySelectorAll('input[data-lid]');
    Array.prototype.forEach.call(lChecks, function(cb) {
      cb.onchange = function() {
        var lid = this.getAttribute('data-lid');
        state.selectedLessons[lid] = this.checked;
        updateAvailQuestions();
      };
    });
  }

  function bindCommonHeaderEvents() {
    var sndBtn = $('arSoundToggle');
    if (sndBtn) {
      sndBtn.onclick = function() {
        state.soundMuted = !state.soundMuted;
        saveWallet();
        this.textContent = state.soundMuted ? '🔇 مكتوم' : '🔊 صوت';
      };
    }
    var stBtn = $('arStoreBtn');
    if (stBtn) {
      stBtn.onclick = function() {
        renderStore();
      };
    }
    var exBtn = $('arExitBtn');
    if (exBtn) {
      exBtn.onclick = function() {
        if (state.view === 'game') {
          if (confirm('هل تريد إنهاء الجولة الحالية والعودة للإعدادات؟')) {
            renderSetup();
          }
        } else {
          renderSetup();
        }
      };
    }
  }

  // ==========================================
  // تجهيز وبدء الجولة التفاعلية
  // ==========================================
  function startMatch() {
    var pool = [];
    state.units.forEach(function(u) {
      u.lessons.forEach(function(l) {
        if (state.selectedLessons[l.id] && l.items) {
          l.items.forEach(function(it) {
            if (state.difficulty === 'all' || it.difficulty === state.difficulty) {
              pool.push(Object.assign({}, it, { lesson_title: l.title }));
            }
          });
        }
      });
    });

    if (!pool.length) {
      toast('لا توجد أسئلة مختارة!');
      return;
    }

    // خلط الأسئلة عشوائياً (Fisher-Yates)
    for (var i = pool.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = pool[i]; pool[i] = pool[j]; pool[j] = tmp;
    }

    var targetCount = state.qCount === 'all' ? pool.length : Math.min(state.qCount, pool.length);
    state.activeQuestions = pool.slice(0, targetCount);
    state.currentQIndex = 0;
    state.score = 0;
    state.gold = 0;
    state.combo = 0;
    state.wrongAnswers = [];

    // إعدادات حسب النمط
    if (state.mode === 'cafe') {
      state.gameStats = { reputation: 100, served: 0, customers: ['طالب مجتهد', 'معلم نشيط', 'موجّه المادة', 'مدير المدرسة'] };
    } else if (state.mode === 'tower') {
      state.gameStats = { towerHp: 100, maxHp: 100, wave: 1, monstersDefeated: 0 };
    } else if (state.mode === 'gold') {
      state.gameStats = { multiplier: 1, shields: 0 };
    }

    renderGame();
  }

  // ==========================================
  // الشاشة 2: واجهة اللعب المباشر
  // ==========================================
  function renderGame() {
    state.view = 'game';
    var main = $('arenaMain');
    if (!main) return;

    if (state.currentQIndex >= state.activeQuestions.length) {
      finishGame();
      return;
    }

    var q = state.activeQuestions[state.currentQIndex];
    var totalQ = state.activeQuestions.length;
    var progressPct = Math.round((state.currentQIndex / totalQ) * 100);

    var h = renderHeaderBar();

    // شريط تقدم اللعبة
    h += '<div class="ar-game-bar">' +
      '<div class="ar-progress-wrap">' +
        '<div class="ar-progress-fill" style="width:' + progressPct + '%"></div>' +
      '</div>' +
      '<div class="ar-game-meta">' +
        '<span>سؤال <b>' + (state.currentQIndex + 1) + '</b> من <b>' + totalQ + '</b></span>' +
        '<span class="ar-lesson-badge">' + esc(q.lesson_title || '') + '</span>' +
        '<span class="ar-score-badge">الذهب: <b>+' + state.gold + '</b></span>' +
      '</div>' +
    '</div>';

    // لوحة النمط المخصص
    if (state.mode === 'gold') {
      h += renderGoldBar();
    } else if (state.mode === 'cafe') {
      h += renderCafeBar();
    } else if (state.mode === 'tower') {
      h += renderTowerBar();
    }

    // بطاقة السؤال
    h += '<div class="card ar-question-card" id="arQCard">' +
      '<div class="ar-stem" id="arStem">' + esc(q.stem) + '</div>' +
      '<div class="ar-choices-grid" id="arChoicesGrid">' +
        q.choices.map(function(c, idx) {
          var keyHint = (idx + 1);
          return '<button type="button" class="ar-choice-btn" data-cidx="' + idx + '">' +
            '<span class="ar-opt-num">' + keyHint + '</span>' +
            '<span class="ar-opt-txt">' + esc(c) + '</span>' +
          '</button>';
        }).join('') +
      '</div>' +
    '</div>';

    // مساحة التفاعل (الصناديق / الطلبات / تأثيرات النمط)
    h += '<div id="arStageOverlay" class="ar-stage-overlay" hidden></div>';

    main.innerHTML = h;
    bindGameEvents(q);
  }

  function renderGoldBar() {
    return '<div class="ar-mode-bar ar-gold-bar">' +
      '<span>🪙 مضاعف الذهب: <b>' + (state.gameStats.multiplier || 1) + 'x</b></span>' +
      '<span>🛡️ الدروع الواقية: <b>' + (state.gameStats.shields || 0) + '</b></span>' +
      '<span>🔥 التتابع (Combo): <b>' + state.combo + '</b></span>' +
    '</div>';
  }

  function renderCafeBar() {
    var rep = state.gameStats.reputation || 100;
    return '<div class="ar-mode-bar ar-cafe-bar">' +
      '<span>☕ زبون المقهى ينتظر طلبه…</span>' +
      '<div class="ar-rep-wrap">' +
        '<span>السمعة: <b>' + rep + '%</b></span>' +
        '<div class="ar-rep-bar"><div class="ar-rep-fill" style="width:' + rep + '%;background:' + (rep > 50 ? '#1f8a70' : '#b23a2b') + '"></div></div>' +
      '</div>' +
    '</div>';
  }

  function renderTowerBar() {
    var hp = state.gameStats.towerHp || 100;
    return '<div class="ar-mode-bar ar-tower-bar">' +
      '<span>🏰 صحة القلعة: <b>' + hp + ' / 100</b></span>' +
      '<div class="ar-tower-hp-bar"><div class="ar-tower-hp-fill" style="width:' + hp + '%;background:' + (hp > 40 ? '#1f8a70' : '#b23a2b') + '"></div></div>' +
      '<span>👾 الوحوش المهزومة: <b>' + (state.gameStats.monstersDefeated || 0) + '</b></span>' +
    '</div>';
  }

  function bindGameEvents(q) {
    bindCommonHeaderEvents();
    var buttons = document.querySelectorAll('.ar-choice-btn');
    var answered = false;

    function handleAnswer(chosenIdx) {
      if (answered) return;
      answered = true;

      // تعطيل الأزرار
      Array.prototype.forEach.call(buttons, function(b) { b.disabled = true; });

      var isCorrect = (chosenIdx === q.correct);
      var chosenBtn = document.querySelector('.ar-choice-btn[data-cidx="' + chosenIdx + '"]');
      var correctBtn = document.querySelector('.ar-choice-btn[data-cidx="' + q.correct + '"]');

      if (isCorrect) {
        if (chosenBtn) chosenBtn.classList.add('correct');
        playSfx('correct');
        state.score += 10;
        state.combo++;
        var earnedGold = (25 + (state.combo * 5)) * (state.gameStats.multiplier || 1);
        state.gold += earnedGold;
        state.wallet += earnedGold;
        saveWallet();

        if (state.mode === 'gold') {
          showChestsModal(earnedGold);
        } else if (state.mode === 'cafe') {
          state.gameStats.served = (state.gameStats.served || 0) + 1;
          state.gameStats.reputation = Math.min(100, (state.gameStats.reputation || 100) + 5);
          showQuickFeedback(true, 'تم تجهيز الطلب بنجاح! + ' + earnedGold + ' ذهب', nextQuestion);
        } else if (state.mode === 'tower') {
          state.gameStats.monstersDefeated = (state.gameStats.monstersDefeated || 0) + 1;
          playSfx('hit');
          showQuickFeedback(true, 'قذيفة مباشرة دمرت الوحش! + ' + earnedGold + ' ذهب', nextQuestion);
        } else {
          showQuickFeedback(true, 'إجابة صحيحة! + ' + earnedGold + ' ذهب', nextQuestion);
        }
      } else {
        if (chosenBtn) chosenBtn.classList.add('wrong');
        if (correctBtn) correctBtn.classList.add('correct');
        playSfx('wrong');
        state.combo = 0;
        state.wrongAnswers.push(q);

        if (state.mode === 'cafe') {
          state.gameStats.reputation = Math.max(0, (state.gameStats.reputation || 100) - 20);
        } else if (state.mode === 'tower') {
          state.gameStats.towerHp = Math.max(0, (state.gameStats.towerHp || 100) - 20);
        }

        var msg = 'إجابة خاطئة! الإجابة الصحيحة هي: ' + q.choices[q.correct];
        showQuickFeedback(false, msg, nextQuestion);
      }
    }

    Array.prototype.forEach.call(buttons, function(btn) {
      btn.onclick = function() {
        var idx = parseInt(this.getAttribute('data-cidx'), 10);
        handleAnswer(idx);
      };
    });

    // التحكم بلوحة المفاتيح (1, 2, 3, 4)
    var onKey = function(e) {
      if (state.view !== 'game') {
        document.removeEventListener('keydown', onKey);
        return;
      }
      var num = parseInt(e.key, 10);
      if (num >= 1 && num <= q.choices.length) {
        handleAnswer(num - 1);
      }
    };
    document.addEventListener('keydown', onKey);
  }

  function nextQuestion() {
    state.currentQIndex++;
    renderGame();
  }

  function showQuickFeedback(isOk, text, cb) {
    var ov = $('arStageOverlay');
    if (!ov) { cb(); return; }
    ov.hidden = false;
    ov.innerHTML = '<div class="ar-feedback-card ' + (isOk ? 'ok' : 'err') + '">' +
      '<div class="ar-fb-ic">' + (isOk ? '✅' : '❌') + '</div>' +
      '<p>' + esc(text) + '</p>' +
      '<button type="button" class="btn primary small" id="arNextBtn">المتابعة ←</button>' +
    '</div>';

    var btn = $('arNextBtn');
    if (btn) {
      btn.focus();
      btn.onclick = function() {
        ov.hidden = true;
        ov.innerHTML = '';
        cb();
      };
    }
  }

  // ميزة الصناديق العشوائية لنمط سباق الذهب
  function showChestsModal(baseGold) {
    var ov = $('arStageOverlay');
    if (!ov) { nextQuestion(); return; }
    ov.hidden = false;
    playSfx('chest');

    var chests = [
      { text: 'مضاعف الذهب 2x!', action: function() { state.gameStats.multiplier = (state.gameStats.multiplier || 1) * 2; state.gold += baseGold; state.wallet += baseGold; } },
      { text: 'مكافأة كنز +150 ذهب!', action: function() { state.gold += 150; state.wallet += 150; } },
      { text: 'درع الحماية من المقالب 🛡️', action: function() { state.gameStats.shields = (state.gameStats.shields || 0) + 1; } }
    ];

    // خلط الصناديق
    chests.sort(function() { return 0.5 - Math.random(); });

    var h = '<div class="ar-chests-modal">' +
      '<h3>🎁 اختر صندوق الكنز!</h3>' +
      '<p>إجابة صحيحة تمنحك فرصة فتح أحد الصناديق السحرية:</p>' +
      '<div class="ar-chests-row">' +
        '<button type="button" class="ar-chest-box" data-c="0">📦<br><b>الصندوق 1</b></button>' +
        '<button type="button" class="ar-chest-box" data-c="1">📦<br><b>الصندوق 2</b></button>' +
        '<button type="button" class="ar-chest-box" data-c="2">📦<br><b>الصندوق 3</b></button>' +
      '</div>' +
      '<div id="arChestResult" class="ar-chest-res" hidden></div>' +
    '</div>';

    ov.innerHTML = h;

    var boxes = document.querySelectorAll('.ar-chest-box');
    Array.prototype.forEach.call(boxes, function(b) {
      b.onclick = function() {
        var idx = parseInt(this.getAttribute('data-c'), 10);
        var prize = chests[idx];
        prize.action();
        saveWallet();
        playSfx('coin');

        Array.prototype.forEach.call(boxes, function(x) { x.disabled = true; });
        this.classList.add('opened');
        this.innerHTML = '✨<br><b>مفتوح!</b>';

        var res = $('arChestResult');
        if (res) {
          res.hidden = false;
          res.innerHTML = '<div class="ar-prize-alert">🎉 ' + esc(prize.text) + '</div>' +
            '<button type="button" class="btn primary small" id="arChestClose">السؤال التالي ←</button>';
          $('arChestClose').onclick = function() {
            ov.hidden = true;
            ov.innerHTML = '';
            nextQuestion();
          };
        }
      };
    });
  }

  // ==========================================
  // الشاشة 3: لوحة النتائج والتقرير النهائي
  // ==========================================
  function finishGame() {
    state.view = 'result';
    var main = $('arenaMain');
    if (!main) return;

    var totalQ = state.activeQuestions.length;
    var correctCount = totalQ - state.wrongAnswers.length;
    var pct = Math.round((correctCount / totalQ) * 100);

    var h = renderHeaderBar();
    h += '<div class="card ar-result-card">' +
      '<div class="ar-res-trophy">' + (pct >= 80 ? '🏆' : (pct >= 50 ? '🥈' : '🥉')) + '</div>' +
      '<h2>اكتملت الجولة في ساحة التحدي!</h2>' +
      '<p class="ar-res-lead">' + (pct >= 80 ? 'أداء استثنائي ومتقن!' : (pct >= 50 ? 'أحسنت، محاولة جيدة وقابلة للتطور.' : 'تحتاج إلى مراجعة المفاهيم وتكرار التحدي.')) + '</p>' +

      '<div class="ar-stats-summary">' +
        '<div class="ar-stat-box"><b>' + correctCount + ' / ' + totalQ + '</b><span>الإجابات الصحيحة</span></div>' +
        '<div class="ar-stat-box"><b>' + pct + '%</b><span>نسبة الدقة</span></div>' +
        '<div class="ar-stat-box"><b class="gold">+' + state.gold + '</b><span>الذهب المكتسب</span></div>' +
      '</div>';

    // قسم مراجعة الأخطاء إن وجدت
    if (state.wrongAnswers.length > 0) {
      h += '<div class="ar-mistakes-section">' +
        '<h3>📝 الأسئلة التي تحتاج مراجعة (' + state.wrongAnswers.length + '):</h3>' +
        '<div class="ar-mistakes-list">' +
          state.wrongAnswers.map(function(q, i) {
            return '<div class="ar-mistake-item">' +
              '<b>' + (i + 1) + '. ' + esc(q.stem) + '</b>' +
              '<div class="ar-ans-correct">الإجابة الصحيحة: ✓ ' + esc(q.choices[q.correct]) + '</div>' +
            '</div>';
          }).join('') +
        '</div>' +
      '</div>';
    }

    h += '<div class="ar-res-actions">' +
      '<button type="button" class="btn primary" id="arPlayAgainBtn">🔄 العب مرة أخرى</button>' +
      (state.wrongAnswers.length > 0 ? '<button type="button" class="btn ghost" id="arReviewMistakesBtn">📑 تدرّب على الأخطاء فقط</button>' : '') +
      '<button type="button" class="btn ghost" id="arStoreNavBtn">🛍️ سوق الشخصيات</button>' +
    '</div></div>';

    main.innerHTML = h;

    bindCommonHeaderEvents();
    var agBtn = $('arPlayAgainBtn');
    if (agBtn) agBtn.onclick = function() { renderSetup(); };

    var stNav = $('arStoreNavBtn');
    if (stNav) stNav.onclick = function() { renderStore(); };

    var revBtn = $('arReviewMistakesBtn');
    if (revBtn) {
      revBtn.onclick = function() {
        state.activeQuestions = state.wrongAnswers.slice();
        state.currentQIndex = 0;
        state.wrongAnswers = [];
        state.mode = 'review';
        renderGame();
      };
    }
  }

  // ==========================================
  // الشاشة 4: سوق الشخصيات (Avatars Store)
  // ==========================================
  function renderStore() {
    state.view = 'store';
    var main = $('arenaMain');
    if (!main) return;

    var h = renderHeaderBar();
    h += '<div class="card ar-store-card">' +
      '<div class="ar-store-head">' +
        '<h2>🛍️ سوق الشخصيات التعليمية</h2>' +
        '<p>استبدل الذهب الذي حصدته من تفوقك بشخصيات حصرية تُمثلك في ساحة التحدي!</p>' +
      '</div>' +

      '<div class="ar-avatars-grid">' +
        AVATARS.map(function(av) {
          var isOwned = state.ownedAvatars.indexOf(av.id) >= 0;
          var isActive = state.activeAvatar === av.id;
          return '<div class="ar-av-card' + (isActive ? ' active-av' : '') + '">' +
            '<div class="ar-av-icon">' + av.icon + '</div>' +
            '<b>' + esc(av.name) + '</b>' +
            '<small>' + esc(av.desc) + '</small>' +
            '<div class="ar-av-action">' +
              (isActive ?
                '<span class="ar-tag active">مُفعّلة حاليًا ✓</span>' :
                (isOwned ?
                  '<button type="button" class="btn small primary ar-select-av" data-avid="' + av.id + '">تفعيل</button>' :
                  '<button type="button" class="btn small ar-buy-av ' + (state.wallet >= av.price ? 'primary' : 'disabled') + '" data-avid="' + av.id + '" data-price="' + av.price + '">' +
                    '🪙 ' + av.price + ' ذهب' +
                  '</button>'
                )
              ) +
            '</div>' +
          '</div>';
        }).join('') +
      '</div>' +

      '<div class="ar-store-foot">' +
        '<button type="button" class="btn ghost" id="arBackToSetup">← العودة لساحة التحدي</button>' +
      '</div>' +
    '</div>';

    main.innerHTML = h;
    bindCommonHeaderEvents();

    var bBtn = $('arBackToSetup');
    if (bBtn) bBtn.onclick = function() { renderSetup(); };

    var selBtns = document.querySelectorAll('.ar-select-av');
    Array.prototype.forEach.call(selBtns, function(b) {
      b.onclick = function() {
        var id = this.getAttribute('data-avid');
        state.activeAvatar = id;
        saveWallet();
        playSfx('coin');
        toast('تم تفعيل الشخصية!');
        renderStore();
      };
    });

    var buyBtns = document.querySelectorAll('.ar-buy-av');
    Array.prototype.forEach.call(buyBtns, function(b) {
      b.onclick = function() {
        var id = this.getAttribute('data-avid');
        var price = parseInt(this.getAttribute('data-price'), 10);
        if (state.wallet < price) {
          toast('عذرًا، رصيدك من الذهب لا يكفي للشراء!');
          playSfx('wrong');
          return;
        }
        state.wallet -= price;
        state.ownedAvatars.push(id);
        state.activeAvatar = id;
        saveWallet();
        playSfx('chest');
        toast('مبروك! تم فتح الشخصية وتفعيلها.');
        renderStore();
      };
    });
  }

  // ==========================================
  // الانطلاق والتحميل الأولي
  // ==========================================
  function init() {
    api('/api/arena/courses').then(function(res) {
      state.courses = res.courses || [];
      // تحديد أول مقرر متاح فيه أسئلة
      var firstOk = state.courses.find(function(c) { return c.has_arena; });
      if (firstOk) {
        state.selectedCourse = firstOk.key;
        api('/api/arena/data?key=' + encodeURIComponent(firstOk.key)).then(function(d) {
          state.units = d.units || [];
          var count = 0;
          state.units.forEach(function(u) {
            u.lessons.forEach(function(l) {
              if (count < 2 && l.mcq_count > 0) {
                state.selectedLessons[l.id] = true;
                count++;
              }
            });
          });
          renderSetup();
        }, function() {
          renderSetup();
        });
      } else {
        renderSetup();
      }
    }, function(err) {
      var main = $('arenaMain');
      if (main) main.innerHTML = '<div class="card"><p class="err">' + esc(err.message || 'حدث خطأ أثناء تحميل المقررات') + '</p></div>';
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
