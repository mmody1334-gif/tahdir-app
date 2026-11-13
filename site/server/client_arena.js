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

  function avatarIcon(id, fallback) {
    var av = getAvatar(id);
    return (av && av.icon) ? av.icon : (fallback || '🦅');
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
        (state.liveEnabled && state.isTeacher ? '<button type="button" class="btn primary small" id="arLiveBtn" title="غرفة يدخلها الطلاب برقمها">🎮 استضف لعبة مباشرة</button>' : '') +
        (state.liveEnabled ? '<a class="btn ghost small" href="/blooket" id="arJoinLiveBtn">🎯 دخول برقم الغرفة</a>' : '') +
        (state.isTeacher ? '<button type="button" class="btn ghost small" id="arTeacherSetsBtn" title="إدارة حقائب الأسئلة">📚 حقائبي</button>' : '') +
        (state.isTeacher ? '<button type="button" class="btn ghost small" id="arTeacherReportsBtn" title="تقارير الطلاب">📊 التقارير</button>' : '') +
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
    var setsBtn = $('arTeacherSetsBtn');
    if (setsBtn) {
      setsBtn.onclick = function() { openTeacherSetsModal(); };
    }
    var repsBtn = $('arTeacherReportsBtn');
    if (repsBtn) {
      repsBtn.onclick = function() { openTeacherReportsModal(); };
    }
    var liveBtn = $('arLiveBtn');
    if (liveBtn) {
      liveBtn.onclick = function() {
        openLiveSetupModal();
      };
    }
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
    state.gameStartTime = Date.now();
    state.recordedAnswers = [];

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
    state.qStartTime = Date.now();
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
      var timeTaken = Date.now() - (state.qStartTime || Date.now());
      state.recordedAnswers = state.recordedAnswers || [];
      state.recordedAnswers.push({
        qid: String(q.qid || ('q_' + state.currentQIndex)),
        lesson_id: String(q.lesson_id || ''),
        is_correct: isCorrect ? 1 : 0,
        chosen_idx: chosenIdx,
        time_taken_ms: timeTaken
      });
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

    // حفظ نتائج الجولة في الخادم D1
    try {
      var dur = Math.round((Date.now() - (state.gameStartTime || Date.now())) / 1000);
      api('/api/arena/session', {
        course_key: state.selectedCourse,
        mode: state.mode,
        duration_sec: dur,
        answers: state.recordedAnswers || []
      }).then(function(res) {
        if (res && res.gold !== undefined) {
          api('/api/arena/wallet').then(function(w) {
            if (w && typeof w.balance === 'number' && !w.guest) {
              state.wallet = w.balance;
              saveWallet();
              var wv = $('arWalletVal');
              if (wv) wv.textContent = state.wallet;
            }
          }).catch(function() {});
        }
      }).catch(function() {});
    } catch (e) {}

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
        api('/api/arena/avatar', { avatar: id }).then(function(res) {
          if (res && res.ok) {
            state.activeAvatar = id;
            saveWallet();
            playSfx('coin');
            toast('تم تفعيل الشخصية!');
            renderStore();
          }
        }).catch(function() {
          state.activeAvatar = id;
          saveWallet();
          playSfx('coin');
          toast('تم تفعيل الشخصية!');
          renderStore();
        });
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
        api('/api/arena/store/buy', { item_id: id }).then(function(res) {
          if (res && res.ok) {
            state.wallet = res.new_balance;
            if (state.ownedAvatars.indexOf(id) === -1) state.ownedAvatars.push(id);
            state.activeAvatar = id;
            saveWallet();
            playSfx('chest');
            toast('مبروك! تم فتح الشخصية وتفعيلها.');
            renderStore();
          } else {
            toast(res && res.error ? res.error : 'عذرًا، تعذر الشراء.');
          }
        }).catch(function() {
          // fallback للضيوف دون حساب
          state.wallet -= price;
          if (state.ownedAvatars.indexOf(id) === -1) state.ownedAvatars.push(id);
          state.activeAvatar = id;
          saveWallet();
          playSfx('chest');
          toast('مبروك! تم فتح الشخصية وتفعيلها.');
          renderStore();
        });
      };
    });
  }

  // ==========================================
  // واجهة المعلم: حقائب الأسئلة المخصصة وتقارير الطلاب
  // ==========================================
  function openTeacherSetsModal() {
    var old = $('arSetsModal');
    if (old) old.remove();

    var div = document.createElement('div');
    div.id = 'arSetsModal';
    div.className = 'ar-modal-backdrop';
    div.innerHTML = '<div class="ar-modal-box">' +
      '<h2><span>📚 حقائب الأسئلة المخصصة (المعلم)</span><button type="button" class="btn ghost small" id="arCloseSetsModal">✖</button></h2>' +
      '<p class="mute">يمكنك إنشاء حقائب أسئلة مخصصة لطلابك يدويًا أو عبر لصق ملف CSV واستخدامها في ساحة التحدي.</p>' +
      '<div id="arSetsList">جارٍ جلب الحقائب...</div>' +
      '<hr style="margin:20px 0;border:0;border-top:1px solid var(--line)">' +
      '<h3>➕ إضافة حقيبة جديدة (CSV أو يدوي)</h3>' +
      '<div class="ar-form-row"><label>عنوان الحقيبة:</label><input type="text" id="arNewSetTitle" placeholder="مثال: أسئلة مراجعة الوحدة الأولى"></div>' +
      '<div class="ar-form-row"><label>المقرر المرتبط:</label><select id="arNewSetCourse">' +
        state.courses.map(function(c) { return '<option value="' + esc(c.key) + '">' + esc(c.subject + ' — ' + c.grade) + '</option>'; }).join('') +
      '</select></div>' +
      '<div class="ar-form-row"><label>محتوى الأسئلة (CSV):</label>' +
        '<small class="mute" style="display:block;margin-bottom:6px">الصيغة: <code>السؤال,الخيار1,الخيار2,الخيار3,الخيار4,رقم الصحيح(1-4),تلميح</code></small>' +
        '<textarea id="arNewSetCsv" rows="5" placeholder="ما عاصمة سلطنة عمان؟,مسقط,نزوى,صلالة,صحار,1,مدينة ساحلية"></textarea>' +
      '</div>' +
      '<div style="display:flex;gap:10px;justify-content:flex-end">' +
        '<button type="button" class="btn primary" id="arSaveSetBtn">💾 حفظ الحقيبة والتحقق</button>' +
      '</div>' +
    '</div>';

    document.body.appendChild(div);
    $('arCloseSetsModal').onclick = function() { div.remove(); };

    function loadSets() {
      api('/api/arena/sets').then(function(res) {
        var box = $('arSetsList');
        if (!box) return;
        var sets = res.sets || [];
        if (!sets.length) {
          box.innerHTML = '<p class="mute">لا توجد لديك حقائب أسئلة حتى الآن. استخدم النموذج أدناه لإنشاء حقيبتك الأولى.</p>';
          return;
        }
        var h = '<table class="ar-table"><thead><tr><th>عنوان الحقيبة</th><th>المقرر</th><th>عدد الأسئلة</th><th>الإجراء</th></tr></thead><tbody>';
        sets.forEach(function(s) {
          h += '<tr>' +
            '<td><b>' + esc(s.title) + '</b></td>' +
            '<td>' + esc(s.course_key || 'عام') + '</td>' +
            '<td>' + s.count + ' سؤال</td>' +
            '<td>' +
              '<button type="button" class="btn ghost small ar-del-set" data-sid="' + s.id + '" style="color:var(--danger)">🗑️ حذف</button>' +
            '</td>' +
          '</tr>';
        });
        h += '</tbody></table>';
        box.innerHTML = h;

        var delBtns = box.querySelectorAll('.ar-del-set');
        Array.prototype.forEach.call(delBtns, function(b) {
          b.onclick = function() {
            var sid = this.getAttribute('data-sid');
            if (confirm('هل أنت متأكد من حذف هذه الحقيبة؟')) {
              api('/api/arena/sets?id=' + encodeURIComponent(sid), null, 'DELETE').then(function() {
                toast('تم حذف الحقيبة.');
                loadSets();
              }).catch(function() { toast('تعذّر الحذف.'); });
            }
          };
        });
      }).catch(function() {
        var box = $('arSetsList');
        if (box) box.innerHTML = '<p class="err">تعذّر جلب الحقائب.</p>';
      });
    }

    loadSets();

    $('arSaveSetBtn').onclick = function() {
      var title = ($('arNewSetTitle').value || '').trim();
      var course = $('arNewSetCourse').value;
      var csvText = ($('arNewSetCsv').value || '').trim();
      if (!title) { toast('اكتب عنوان الحقيبة.'); return; }
      if (!csvText) { toast('الصق محتوى الأسئلة بصيغة CSV.'); return; }

      api('/api/arena/sets', { title: title, course_key: course, csv_text: csvText }).then(function(res) {
        if (res && res.ok) {
          toast('تم حفظ الحقيبة بنجاح (' + res.count + ' سؤال)!');
          $('arNewSetTitle').value = '';
          $('arNewSetCsv').value = '';
          loadSets();
        } else {
          toast(res && res.error ? res.error : 'تعذّر حفظ الحقيبة.');
        }
      }).catch(function(err) {
        toast('خطأ: ' + (err.message || 'تعذّر الحفظ.'));
      });
    };
  }

  function openTeacherReportsModal() {
    var old = $('arReportsModal');
    if (old) old.remove();

    var div = document.createElement('div');
    div.id = 'arReportsModal';
    div.className = 'ar-modal-backdrop';
    div.innerHTML = '<div class="ar-modal-box">' +
      '<h2><span>📊 تقارير الطلاب وسجل ساحة التحدي</span><button type="button" class="btn ghost small" id="arCloseReportsModal">✖</button></h2>' +
      '<div style="display:flex;gap:12px;align-items:center;margin-bottom:14px;flex-wrap:wrap">' +
        '<label><b>المقرر:</b></label>' +
        '<select id="arReportCourseSel" style="padding:6px 10px;border-radius:8px;border:1px solid var(--line)">' +
          '<option value="">كل المقررات المتاحة</option>' +
          state.courses.map(function(c) { return '<option value="' + esc(c.key) + '">' + esc(c.subject + ' — ' + c.grade) + '</option>'; }).join('') +
        '</select>' +
        '<a id="arCsvExportLink" class="btn primary small" href="/api/arena/reports?format=csv" target="_blank" download="arena_report.csv">📥 تصدير CSV (Excel)</a>' +
      '</div>' +
      '<div id="arReportsBody">جارٍ جلب التقارير...</div>' +
    '</div>';

    document.body.appendChild(div);
    $('arCloseReportsModal').onclick = function() { div.remove(); };

    var courseSel = $('arReportCourseSel');
    courseSel.onchange = function() {
      var cKey = this.value;
      $('arCsvExportLink').href = '/api/arena/reports?format=csv' + (cKey ? '&course=' + encodeURIComponent(cKey) : '');
      loadReport(cKey);
    };

    function loadReport(course) {
      var box = $('arReportsBody');
      box.innerHTML = '<p class="mute">جارٍ تحميل الإحصائيات...</p>';
      api('/api/arena/reports' + (course ? '?course=' + encodeURIComponent(course) : '')).then(function(rep) {
        var sm = rep.summary || {};
        var h = '<div class="ar-kpi-grid">' +
          '<div class="ar-kpi-card"><b>' + (sm.total_sessions || 0) + '</b><span>إجمالي الجولات</span></div>' +
          '<div class="ar-kpi-card"><b>' + (sm.total_students || 0) + '</b><span>الطلاب المتفاعلون</span></div>' +
          '<div class="ar-kpi-card"><b>' + (sm.avg_score || 0) + '</b><span>متوسط النقاط</span></div>' +
          '<div class="ar-kpi-card"><b>' + (sm.accuracy_rate || 0) + '%</b><span>نسبة الدقة العامة</span></div>' +
        '</div>';

        h += '<h3>📉 الأسئلة الأكثر تعثراً (تحتاج معالجة صفية):</h3>';
        var topF = rep.top_failed || [];
        if (!topF.length) {
          h += '<p class="mute">لا توجد أسئلة مسجلة بنسب خطأ مرتفعة حتى الآن.</p>';
        } else {
          h += '<table class="ar-table"><thead><tr><th>السؤال/الدرس</th><th>المحاولات</th><th>مرات الخطأ</th><th>نسبة التعثر</th></tr></thead><tbody>';
          topF.forEach(function(f) {
            var failPct = f.attempts > 0 ? Math.round((f.fail_count * 100) / f.attempts) : 0;
            h += '<tr><td><b>' + esc(f.qid) + '</b>' + (f.lesson_id ? ' <small class="mute">(درس ' + esc(f.lesson_id) + ')</small>' : '') + '</td><td>' + f.attempts + '</td><td style="color:var(--danger)">' + f.fail_count + '</td><td><b>' + failPct + '%</b></td></tr>';
          });
          h += '</tbody></table>';
        }

        h += '<h3>🕒 آخر جولات الطلاب المكتملة:</h3>';
        var rec = rep.recent || [];
        if (!rec.length) {
          h += '<p class="mute">لا توجد جولات مسجلة بعد.</p>';
        } else {
          h += '<table class="ar-table"><thead><tr><th>اسم الطالب</th><th>المقرر</th><th>النمط</th><th>النقاط</th><th>الذهب</th><th>الوقت</th></tr></thead><tbody>';
          rec.slice(0, 15).forEach(function(s) {
            h += '<tr>' +
              '<td><b>' + esc(s.student_name || 'طالب') + '</b></td>' +
              '<td>' + esc(s.course_key) + '</td>' +
              '<td>' + (s.mode === 'gold' ? 'سباق الذهب' : (s.mode === 'cafe' ? 'المقهى' : (s.mode === 'tower' ? 'الدفاع' : 'مراجعة'))) + '</td>' +
              '<td>' + s.score + '</td>' +
              '<td>🪙 ' + s.gold + '</td>' +
              '<td>' + s.duration_sec + ' ث</td>' +
            '</tr>';
          });
          h += '</tbody></table>';
        }

        box.innerHTML = h;
      }).catch(function(e) {
        box.innerHTML = '<p class="err">تعذّر تحميل التقارير: ' + esc(e.message || '') + '</p>';
      });
    }

    loadReport('');
  }

  // ==========================================
  // اللعب المباشر: غرف برقم من 6 أرقام (elkabsula.site/blooket/147147)
  // المعلم يستضيف، والطلاب يدخلون اللوبي ويظهرون عنده فورًا، ثم يلعب كل طالب بسرعته
  // ولوحة المعلم تتحدث لحظة بلحظة.
  // ==========================================

  var LIVE_AVATARS = ['🦅', '🦉', '🦁', '🐯', '🦊', '🐼', '🐨', '🐸', '🐙', '🦄', '🐲', '🐧', '🦈', '🐝', '🚀', '⚡'];
  var SHAPES = ['▲', '◆', '●', '■'];
  var live = {
    role: null, code: null, token: null, ws: null, state: null, offset: 0,
    timerId: null, retry: 0, closedByUs: false, pingId: null,
    phase: 'question', // للطالب: question | feedback | chest | chestResult
    lastResult: null, chestResult: null, pendingView: null, hostRenderAt: 0, hostRenderQueued: false
  };
  try { window.__arenaLive = live; } catch (e) {}

  var audioUnlocked = false;
  function unlockAudio() {
    if (audioUnlocked) return;
    audioUnlocked = true;
    try { var c = getAudioCtx(); if (c && c.state === 'suspended') c.resume(); } catch (e) {}
  }
  document.addEventListener('pointerdown', unlockAudio, { passive: true });
  document.addEventListener('keydown', unlockAudio, { passive: true });

  function lsGet(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } }
  function lsSet(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function fmtCode(c) { c = String(c || ''); return c.length === 6 ? c.slice(0, 3) + ' ' + c.slice(3) : c; }
  function fmtNum(n) { n = Math.round(+n || 0); return n.toLocaleString('en-US'); }
  function roomUrl(code) { return location.origin + '/blooket/' + code; }
  function serverNow() { return Date.now() + live.offset; }
  function remainingSec() {
    var s = live.state;
    if (!s || !s.endsAt) return null;
    return Math.max(0, Math.ceil((s.endsAt - serverNow()) / 1000));
  }
  function fmtClock(sec) {
    if (sec == null) return '';
    var m = Math.floor(sec / 60), s = sec % 60;
    return m + ':' + (s < 10 ? '0' : '') + s;
  }
  function scoreLabel(p) {
    if (!live.state) return '';
    return live.state.mode === 'race' ? (p.correct + ' / ' + live.state.goal) : fmtNum(p.gold);
  }
  function modeName(m) { return m === 'race' ? 'سباق الإجابات' : 'سباق الذهب'; }

  function setPlayMode(on) {
    document.body.classList.toggle('ar-play', !!on);
  }

  // ---------- الاتصال ----------
  function connectLive(code, token, role) {
    live.code = code; live.token = token; live.role = role; live.closedByUs = false;
    if (live.ws) { try { live.closedByUs = true; live.ws.close(); } catch (e) {} live.closedByUs = false; }
    var proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    var ws = new WebSocket(proto + '//' + location.host + '/api/arena/live/ws?code=' + encodeURIComponent(code) + '&token=' + encodeURIComponent(token));
    live.ws = ws;
    ws.onopen = function() {
      live.retry = 0;
      if (live.pingId) clearInterval(live.pingId);
      live.pingId = setInterval(function() { try { if (ws.readyState === 1) ws.send('ping'); } catch (e) {} }, 30000);
    };
    ws.onmessage = function(ev) {
      if (ev.data === 'pong') return;
      var msg;
      try { msg = JSON.parse(ev.data); } catch (e) { return; }
      onLiveMessage(msg);
    };
    ws.onclose = function(ev) {
      if (live.pingId) { clearInterval(live.pingId); live.pingId = null; }
      if (live.ws !== ws || live.closedByUs) return;
      if (ev.code === 4001) return kickedOut();
      if (live.state && live.state.state === 'ENDED') return;
      // رمز غير صالح أو غرفة محذوفة: لا نعيد المحاولة إلى ما لا نهاية
      live.retry++;
      if (live.retry > 8) return liveFatal('انقطع الاتصال بالغرفة. تأكد من الإنترنت ثم أعد تحميل الصفحة.');
      showConnBanner(true);
      setTimeout(function() { if (live.ws === ws) connectLive(live.code, live.token, live.role); }, Math.min(8000, 600 * live.retry));
    };
  }

  function sendLive(obj) {
    if (live.ws && live.ws.readyState === 1) { live.ws.send(JSON.stringify(obj)); return true; }
    toast('جارٍ إعادة الاتصال…');
    return false;
  }

  window.addEventListener('visibilitychange', function() {
    if (!document.hidden && live.token && (!live.ws || live.ws.readyState > 1) && !(live.state && live.state.state === 'ENDED')) {
      live.retry = 0;
      connectLive(live.code, live.token, live.role);
    }
  });

  function showConnBanner(on) {
    var b = $('arConnBanner');
    if (on && !b) {
      b = document.createElement('div');
      b.id = 'arConnBanner';
      b.className = 'ar-conn-banner';
      b.textContent = 'جارٍ إعادة الاتصال…';
      document.body.appendChild(b);
    } else if (!on && b) b.remove();
  }

  function onLiveMessage(msg) {
    showConnBanner(false);
    if (msg.type === 'sync') {
      if (msg.state && msg.state.now) live.offset = msg.state.now - Date.now();
      if (live.role === 'host') { live.state = msg.state; return renderHost(); }
      return onStudentSync(msg);
    }
    if (msg.type === 'delta' && live.role === 'host') return applyHostDelta(msg);
    if (msg.type === 'kicked') return kickedOut();
    if (msg.type === 'error') {
      if (!msg.soft) toast(msg.error || 'خطأ');
      else if (live.role === 'student' && live.phase === 'waiting') { live.phase = 'question'; renderStudent(); }
    }
  }

  function kickedOut() {
    lsSet('arena_p_' + live.code, null);
    live.closedByUs = true;
    try { live.ws && live.ws.close(); } catch (e) {}
    liveFatal('أخرجك المعلم من هذه الغرفة.');
  }

  function liveFatal(text) {
    stopTimer();
    var main = $('arenaMain');
    if (!main) return;
    main.innerHTML = '<div class="ar-live-shell"><div class="ar-join-card">' +
      '<div class="ar-join-ic">⚠️</div><h2>' + esc(text) + '</h2>' +
      '<a class="btn primary" href="/blooket">الدخول بلعبة أخرى</a></div></div>';
  }

  function stopTimer() { if (live.timerId) { clearInterval(live.timerId); live.timerId = null; } }
  function startTimer(fn) {
    stopTimer();
    live.timerId = setInterval(fn, 500);
  }

  // ==========================================
  // شاشة إدخال رقم الغرفة (/blooket)
  // ==========================================
  function renderEnterCode(err) {
    setPlayMode(true);
    var main = $('arenaMain');
    main.innerHTML = '<div class="ar-live-shell">' + brandBar() +
      '<div class="ar-join-card">' +
        '<div class="ar-join-ic">🎮</div>' +
        '<h1>ادخل إلى اللعبة</h1>' +
        '<p class="muted">اكتب رقم الغرفة الذي يظهر على شاشة معلمك</p>' +
        '<form id="arCodeForm" autocomplete="off">' +
          '<input id="arCodeIn" class="ar-code-input" inputmode="numeric" pattern="[0-9 ]*" maxlength="7" placeholder="رقم الغرفة" aria-label="رقم الغرفة">' +
          (err ? '<p class="err" id="arCodeErr">' + esc(err) + '</p>' : '<p class="err" id="arCodeErr"></p>') +
          '<button type="submit" class="btn primary ar-big-btn">دخول ←</button>' +
        '</form>' +
      '</div>' +
      '<p class="ar-host-hint">معلم؟ <a href="/arena">استضف لعبة مباشرة من ساحة التحدي</a></p>' +
    '</div>';
    var inp = $('arCodeIn');
    inp.focus();
    inp.oninput = function() { this.value = this.value.replace(/[^0-9]/g, '').slice(0, 6); };
    $('arCodeForm').onsubmit = function(ev) {
      ev.preventDefault();
      var c = inp.value.replace(/\D/g, '');
      if (c.length !== 6) { $('arCodeErr').textContent = 'رقم الغرفة يتكون من 6 أرقام.'; return; }
      location.href = '/blooket/' + c;
    };
  }

  function brandBar() {
    return '<div class="ar-brand-bar"><a href="/blooket" class="ar-brand">⚔️ ساحة التحدي</a>' +
      '<button type="button" class="ar-snd" id="arSndBtn" aria-label="الصوت">' + (state.soundMuted ? '🔇' : '🔊') + '</button></div>';
  }
  function bindBrandBar() {
    var b = $('arSndBtn');
    if (b) b.onclick = function() { state.soundMuted = !state.soundMuted; saveWallet(); this.textContent = state.soundMuted ? '🔇' : '🔊'; };
  }

  // ==========================================
  // فتح رابط غرفة (/blooket/147147): معلم أم طالب؟
  // ==========================================
  function openRoom(code) {
    setPlayMode(true);
    var main = $('arenaMain');
    main.innerHTML = '<div class="ar-live-shell">' + brandBar() + '<div class="ar-join-card"><div class="ar-spin"></div><p>جارٍ فتح الغرفة ' + esc(fmtCode(code)) + '…</p></div></div>';
    var ht = lsGet('arena_h_' + code);
    if (ht && ht.token) return connectLive(code, ht.token, 'host');
    var pl = lsGet('arena_p_' + code);
    if (pl && pl.token) return connectLive(code, pl.token, 'student');

    fetch('/api/arena/live/room?code=' + code, { credentials: 'same-origin' }).then(function(r) {
      return r.json().then(function(j) { return { ok: r.ok, j: j }; });
    }).then(function(res) {
      if (!res.ok) return renderEnterCode(res.j.error || 'لا توجد لعبة بهذا الرقم.');
      var info = res.j;
      // صاحب الغرفة يفتح الرابط من جهاز أو متصفح آخر: نسترجع رمز المضيف من الخادم
      tryHostToken(code).then(function(tok) {
        if (tok) { lsSet('arena_h_' + code, { token: tok }); return connectLive(code, tok, 'host'); }
        if (info.state === 'ENDED') return renderEnterCode('انتهت هذه اللعبة.');
        renderJoinForm(code, info);
      });
    }).catch(function() { renderEnterCode('تعذّر الاتصال، حاول مرة أخرى.'); });
  }

  function tryHostToken(code) {
    var h = {};
    try { var s = sidGet(), d = didGet(); if (s) h['X-Tahdir-Sid'] = s; if (d) h['X-Tahdir-Did'] = d; } catch (e) {}
    h['Content-Type'] = 'application/json';
    return fetch('/api/arena/live/host-token', { method: 'POST', credentials: 'same-origin', headers: h, body: JSON.stringify({ code: code }) })
      .then(function(r) { return r.ok ? r.json() : null; })
      .then(function(j) { return j && j.hostToken ? j.hostToken : null; })
      .catch(function() { return null; });
  }

  // ==========================================
  // الطالب: الاسم والشخصية
  // ==========================================
  function renderJoinForm(code, info) {
    var myAv = lsGet('arena_live_av') || LIVE_AVATARS[Math.floor(Math.random() * 6)];
    var myName = lsGet('arena_live_name') || '';
    var main = $('arenaMain');
    main.innerHTML = '<div class="ar-live-shell">' + brandBar() +
      '<div class="ar-join-card">' +
        '<div class="ar-room-pill">الغرفة <b>' + esc(fmtCode(code)) + '</b></div>' +
        (info.title ? '<p class="muted">' + esc(info.title) + ' · ' + esc(modeName(info.mode)) + '</p>' : '<p class="muted">' + esc(modeName(info.mode)) + '</p>') +
        '<form id="arJoinForm" autocomplete="off">' +
          '<label class="ar-lbl" for="arNameIn">اسمك</label>' +
          '<input id="arNameIn" class="ar-name-input" maxlength="30" placeholder="اكتب اسمك" value="' + esc(myName) + '">' +
          '<div class="ar-lbl">اختر شخصيتك</div>' +
          '<div class="ar-av-pick" id="arAvPick">' + LIVE_AVATARS.map(function(a) {
            return '<button type="button" class="ar-av-opt' + (a === myAv ? ' on' : '') + '" data-av="' + a + '" aria-label="شخصية ' + a + '">' + a + '</button>';
          }).join('') + '</div>' +
          '<details class="ar-class-opt"><summary>عندي كود فصل (اختياري لحفظ ذهبي)</summary>' +
            '<input id="arClassIn" class="ar-name-input" maxlength="12" placeholder="كود الفصل" value="' + esc(lsGet('arena_live_class') || '') + '"></details>' +
          '<p class="err" id="arJoinErr"></p>' +
          '<button type="submit" class="btn primary ar-big-btn" id="arJoinBtn">ادخل اللعبة 🚀</button>' +
        '</form>' +
      '</div></div>';
    bindBrandBar();
    var av = myAv;
    Array.prototype.forEach.call(document.querySelectorAll('.ar-av-opt'), function(b) {
      b.onclick = function() {
        av = this.getAttribute('data-av');
        Array.prototype.forEach.call(document.querySelectorAll('.ar-av-opt'), function(x) { x.classList.toggle('on', x === b); });
      };
    });
    $('arNameIn').focus();
    $('arJoinForm').onsubmit = function(ev) {
      ev.preventDefault();
      var name = $('arNameIn').value.trim();
      if (!name) { $('arJoinErr').textContent = 'اكتب اسمك أولًا.'; return; }
      var cls = ($('arClassIn') && $('arClassIn').value.trim()) || '';
      var btn = $('arJoinBtn');
      btn.disabled = true; btn.textContent = 'جارٍ الدخول…';
      api('/api/arena/live/join', { code: code, name: name, avatar: av, class_id: cls }).then(function(res) {
        lsSet('arena_live_name', name); lsSet('arena_live_av', av); lsSet('arena_live_class', cls || null);
        lsSet('arena_p_' + code, { token: res.playerToken, playerId: res.playerId });
        playSfx('coin');
        connectLive(code, res.playerToken, 'student');
      }).catch(function(err) {
        btn.disabled = false; btn.textContent = 'ادخل اللعبة 🚀';
        $('arJoinErr').textContent = err.message || 'تعذّر الدخول.';
      });
    };
  }

  // ==========================================
  // الطالب: اللوبي واللعب والنتيجة
  // ==========================================
  function onStudentSync(msg) {
    var prev = live.state;
    live.state = msg.state;
    if (!live.state.me) { lsSet('arena_p_' + live.code, null); return liveFatal('لم تعد ضمن هذه الغرفة.'); }
    if (msg.hit) showHit(msg.hit);
    if (msg.result) {
      live.lastResult = msg.result;
      live.phase = 'feedback';
      playSfx(msg.result.correct ? 'correct' : 'wrong');
      renderStudent();
      setTimeout(function() {
        if (live.phase !== 'feedback') return;
        live.phase = live.state.me && live.state.me.chest ? 'chest' : 'question';
        renderStudent();
      }, msg.result.correct ? 700 : 1500);
      return;
    }
    if (msg.chestResult) {
      live.chestResult = msg.chestResult;
      live.phase = 'chestResult';
      playSfx(msg.chestResult.outcome.delta >= 0 ? 'chest' : 'hit');
      return renderStudent();
    }
    if (live.state.state === 'PLAYING' && prev && prev.state === 'LOBBY') { live.phase = live.state.me.chest ? 'chest' : 'question'; playSfx('chest'); }
    // إعادة الاتصال أثناء صندوق مفتوح
    if (live.state.state === 'PLAYING' && live.state.me.chest && live.phase === 'question') live.phase = 'chest';
    if (live.phase === 'feedback' || live.phase === 'chestResult') return updateStudentHud();
    renderStudent();
  }

  function showHit(h) {
    var txt = h.k === 'steal' ? (h.by + ' سرق منك ' + fmtNum(h.amount) + ' 🪙') : (h.by + ' بدّل ذهبه معك! 🔄');
    var d = document.createElement('div');
    d.className = 'ar-hit-banner';
    d.textContent = txt;
    document.body.appendChild(d);
    playSfx('hit');
    setTimeout(function() { d.remove(); }, 2600);
  }

  function studentHud() {
    var s = live.state, me = s.me;
    var timer = s.mode === 'gold' && s.state === 'PLAYING' ? '<span class="ar-hud-timer" id="arHudTimer">⏱ ' + fmtClock(remainingSec()) + '</span>' : '';
    var score = s.mode === 'race'
      ? '<span class="ar-hud-score" id="arHudScore">✅ ' + me.correct + ' / ' + s.goal + '</span>'
      : '<span class="ar-hud-score" id="arHudScore">🪙 ' + fmtNum(me.gold) + '</span>';
    return '<div class="ar-hud"><span class="ar-hud-me">' + esc(me.avatar) + ' ' + esc(me.name) + '</span>' + score +
      '<span class="ar-hud-rank" id="arHudRank">#' + (me.rank || '-') + '</span>' + timer + '</div>';
  }

  function updateStudentHud() {
    var s = live.state; if (!s || !s.me) return;
    var sc = $('arHudScore'), rk = $('arHudRank');
    if (sc) sc.textContent = s.mode === 'race' ? ('✅ ' + s.me.correct + ' / ' + s.goal) : ('🪙 ' + fmtNum(s.me.gold));
    if (rk) rk.textContent = '#' + (s.me.rank || '-');
  }

  function renderStudent() {
    var s = live.state, main = $('arenaMain');
    if (!s || !main) return;
    if (s.state === 'LOBBY') return renderStudentLobby();
    if (s.state === 'ENDED') return renderStudentEnded();
    var h = '<div class="ar-live-shell ar-st">' + studentHud();
    if (live.phase === 'feedback' && live.lastResult) {
      var r = live.lastResult;
      h += '<div class="ar-fb ' + (r.correct ? 'ok' : 'bad') + '"><div class="ar-fb-ic">' + (r.correct ? '✔' : '✖') + '</div>' +
        '<div class="ar-fb-t">' + (r.correct ? 'إجابة صحيحة!' : 'إجابة خاطئة') + '</div>' +
        (!r.correct && live.lastQ ? '<div class="ar-fb-ans">الصحيح: ' + esc(live.lastQ.choices[r.correctIndex] || '') + '</div>' : '') + '</div>';
    } else if (live.phase === 'chest' && s.me.chest) {
      h += '<div class="ar-chest-stage"><h2>اختر صندوقًا!</h2><div class="ar-chests">' +
        [0, 1, 2].map(function(i) { return '<button type="button" class="ar-chest" data-i="' + i + '" aria-label="الصندوق ' + (i + 1) + '"><span>🎁</span></button>'; }).join('') +
        '</div></div>';
    } else if (live.phase === 'chestResult' && live.chestResult) {
      h += renderChestResult(live.chestResult);
    } else if (live.phase === 'waiting') {
      h += '<div class="ar-fb"><div class="ar-spin"></div></div>';
    } else if (s.question) {
      var q = s.question;
      live.lastQ = q;
      h += '<div class="ar-q-card"><div class="ar-q-num">سؤال ' + q.n + '</div><div class="ar-q-stem" dir="auto">' + esc(q.stem) + '</div></div>' +
        '<div class="ar-ans-grid">' + q.choices.map(function(c, i) {
          return '<button type="button" class="ar-ans opt-' + i + '" data-c="' + i + '"><span class="ar-shape">' + SHAPES[i] + '</span><span dir="auto">' + esc(c) + '</span></button>';
        }).join('') + '</div>';
    } else {
      h += '<div class="ar-fb"><div class="ar-spin"></div></div>';
    }
    h += '</div>';
    main.innerHTML = h;
    if (window.scrollY > 0) window.scrollTo(0, 0);

    Array.prototype.forEach.call(main.querySelectorAll('.ar-ans'), function(b) {
      b.onclick = function() {
        if (live.phase !== 'question') return;
        var c = +this.getAttribute('data-c');
        if (sendLive({ action: 'answer', q: s.question.i, choice: c })) {
          live.phase = 'waiting';
          this.classList.add('picked');
          Array.prototype.forEach.call(main.querySelectorAll('.ar-ans'), function(x) { x.disabled = true; });
        }
      };
    });
    Array.prototype.forEach.call(main.querySelectorAll('.ar-chest'), function(b) {
      b.onclick = function() {
        if (live.phase !== 'chest') return;
        live.phase = 'waiting';
        this.classList.add('opening');
        sendLive({ action: 'chest', idx: +this.getAttribute('data-i') });
      };
    });
    var nx = $('arChestNext');
    if (nx) nx.onclick = function() { live.phase = 'question'; live.chestResult = null; renderStudent(); };
    if (s.mode === 'gold') startTimer(function() { var t = $('arHudTimer'); if (t) t.textContent = '⏱ ' + fmtClock(remainingSec()); });
    else stopTimer();
  }

  function outcomeText(o) {
    if (o.k === 'gain') return { ic: '🪙', t: '+' + o.n + ' ذهبة' };
    if (o.k === 'mult') return { ic: '✨', t: 'ذهبك ×' + o.n };
    if (o.k === 'lose') return { ic: '💸', t: 'خسرت ' + o.n + '%' };
    if (o.k === 'steal') return { ic: '🦹', t: o.target ? ('سرقت ' + fmtNum(o.amount) + ' من ' + o.target) : ('سرقة ' + o.n + '%') };
    if (o.k === 'swap') return { ic: '🔄', t: o.target ? ('بدّلت ذهبك مع ' + o.target) : 'تبديل الذهب' };
    return { ic: '🫙', t: o.note || 'صندوق فارغ' };
  }

  function renderChestResult(cr) {
    var main = outcomeText(cr.outcome);
    var others = cr.options.map(function(o, i) {
      if (i === cr.picked) return '';
      var t = outcomeText(o);
      return '<span class="ar-other">' + t.ic + ' ' + esc(t.t) + '</span>';
    }).join('');
    return '<div class="ar-chest-stage"><div class="ar-chest-res ' + (cr.outcome.delta < 0 ? 'bad' : 'good') + '">' +
      '<div class="ar-cr-ic">' + main.ic + '</div><div class="ar-cr-t">' + esc(main.t) + '</div></div>' +
      '<div class="ar-others">كان في الصناديق الأخرى: ' + others + '</div>' +
      '<button type="button" class="btn primary ar-big-btn" id="arChestNext">السؤال التالي ←</button></div>';
  }

  function renderStudentLobby() {
    stopTimer();
    var s = live.state, me = s.me, main = $('arenaMain');
    var others = (s.lobby || []).filter(function(p) { return p.name !== me.name; });
    main.innerHTML = '<div class="ar-live-shell ar-st">' + brandBar() +
      '<div class="ar-lobby-me"><div class="ar-big-av">' + esc(me.avatar) + '</div>' +
        '<h1>' + esc(me.name) + '</h1>' +
        '<p class="ar-wait">أنت داخل! انتظر حتى يبدأ المعلم اللعبة<span class="ar-dots"><i>.</i><i>.</i><i>.</i></span></p>' +
        '<div class="ar-room-pill">الغرفة <b>' + esc(fmtCode(s.code)) + '</b> · ' + esc(modeName(s.mode)) + '</div>' +
      '</div>' +
      '<div class="ar-lobby-others"><div class="ar-lbl">في اللوبي معك (' + others.length + ')</div><div class="ar-mini-roster">' +
        others.map(function(p) { return '<span class="ar-mini">' + esc(p.avatar) + ' ' + esc(p.name) + '</span>'; }).join('') +
      '</div></div>' +
      '<p class="ar-host-hint"><button type="button" class="btn ghost small" id="arLeaveBtn">مغادرة الغرفة</button></p>' +
    '</div>';
    bindBrandBar();
    $('arLeaveBtn').onclick = function() {
      if (!confirm('مغادرة الغرفة؟')) return;
      lsSet('arena_p_' + live.code, null);
      live.closedByUs = true;
      try { live.ws.close(1000); } catch (e) {}
      location.href = '/blooket';
    };
  }

  function renderStudentEnded() {
    stopTimer();
    lsSet('arena_p_' + live.code, null);
    var s = live.state, me = s.me, main = $('arenaMain');
    var medal = me.rank === 1 ? '🥇' : me.rank === 2 ? '🥈' : me.rank === 3 ? '🥉' : '🏁';
    if (me.rank && me.rank <= 3) playSfx('chest');
    main.innerHTML = '<div class="ar-live-shell ar-st">' + brandBar() +
      '<div class="ar-end-me"><div class="ar-end-medal">' + medal + '</div>' +
        '<h1>المركز ' + (me.rank || '-') + ' من ' + s.playersCount + '</h1>' +
        '<div class="ar-end-stats"><span>' + (s.mode === 'race' ? '✅ ' + me.correct : '🪙 ' + fmtNum(me.gold)) + '</span>' +
        '<span>إجابات صحيحة ' + me.correct + ' من ' + me.answered + '</span></div></div>' +
      '<div class="ar-end-top"><div class="ar-lbl">الأوائل</div>' + (s.top || []).map(function(p, i) {
        return '<div class="ar-top-row' + (p.id === me.id ? ' me' : '') + '"><b>' + (i + 1) + '</b><span>' + esc(p.avatar) + ' ' + esc(p.name) + '</span><em>' + scoreLabel(p) + '</em></div>';
      }).join('') + '</div>' +
      '<p class="ar-host-hint"><a class="btn primary" href="/blooket">لعبة أخرى</a></p></div>';
    bindBrandBar();
  }

  // ==========================================
  // المعلم: إنشاء الغرفة من ساحة التحدي
  // ==========================================
  function openLiveSetupModal() {
    var ids = Object.keys(state.selectedLessons).filter(function(k) { return state.selectedLessons[k]; });
    if (!ids.length) { toast('حدّد الدروس أولًا من القائمة، ثم استضف اللعبة.'); return; }
    var old = $('arLiveSetupModal'); if (old) old.remove();
    var m = document.createElement('div');
    m.id = 'arLiveSetupModal';
    m.className = 'ar-modal-backdrop';
    m.innerHTML = '<div class="ar-modal-box ar-host-setup" style="max-width:560px">' +
      '<h2><span>🎮 استضافة لعبة مباشرة</span><button type="button" class="btn ghost small" id="arCloseLive" aria-label="إغلاق">✕</button></h2>' +
      '<p class="muted">الأسئلة من ' + ids.length + ' ' + (ids.length === 1 ? 'درس محدد' : 'دروس محددة') + '. يدخل الطلاب برقم الغرفة، ويلعب كل طالب بسرعته.</p>' +
      '<div class="ar-lbl">نوع اللعبة</div>' +
      '<div class="ar-mode-2">' +
        '<label class="ar-mode-card on"><input type="radio" name="arLm" value="gold" checked><span class="ar-mc-ic">🏆</span><b>سباق الذهب</b><small>أجب صح لتفتح صناديق: ذهب، مضاعفة، سرقة وتبديل. الأغنى عند انتهاء الوقت يفوز.</small></label>' +
        '<label class="ar-mode-card"><input type="radio" name="arLm" value="race"><span class="ar-mc-ic">🏁</span><b>سباق الإجابات</b><small>أول طالب يصل لعدد الإجابات الصحيحة المطلوب يفوز.</small></label>' +
      '</div>' +
      '<div class="ar-form-row" id="arDurRow"><div class="ar-lbl">مدة اللعبة</div><div class="ar-seg" data-name="dur">' +
        [3, 5, 7, 10, 15].map(function(n) { return '<button type="button" class="ar-seg-b' + (n === 7 ? ' on' : '') + '" data-v="' + n + '">' + n + ' د</button>'; }).join('') + '</div></div>' +
      '<div class="ar-form-row" id="arGoalRow" hidden><div class="ar-lbl">عدد الإجابات الصحيحة للفوز</div><div class="ar-seg" data-name="goal">' +
        [10, 15, 20, 30].map(function(n) { return '<button type="button" class="ar-seg-b' + (n === 15 ? ' on' : '') + '" data-v="' + n + '">' + n + '</button>'; }).join('') + '</div></div>' +
      '<label class="ar-check"><input type="checkbox" id="arLateJoin" checked> السماح بالانضمام بعد بدء اللعبة</label>' +
      '<p class="err" id="arLiveErr"></p>' +
      '<button type="button" class="btn primary ar-big-btn" id="arCreateRoom">إنشاء الغرفة ←</button>' +
    '</div>';
    document.body.appendChild(m);
    function close() { m.remove(); }
    $('arCloseLive').onclick = close;
    m.onclick = function(ev) { if (ev.target === m) close(); };
    Array.prototype.forEach.call(m.querySelectorAll('input[name=arLm]'), function(r) {
      r.onchange = function() {
        Array.prototype.forEach.call(m.querySelectorAll('.ar-mode-card'), function(c) { c.classList.toggle('on', c.contains(r) ? r.checked : !r.checked); });
        $('arDurRow').hidden = r.value === 'race' && r.checked;
        $('arGoalRow').hidden = !(r.value === 'race' && r.checked);
      };
    });
    Array.prototype.forEach.call(m.querySelectorAll('.ar-seg-b'), function(b) {
      b.onclick = function() {
        Array.prototype.forEach.call(b.parentNode.children, function(x) { x.classList.toggle('on', x === b); });
      };
    });
    $('arCreateRoom').onclick = function() {
      var btn = this;
      var mode = m.querySelector('input[name=arLm]:checked').value;
      var dur = +m.querySelector('[data-name=dur] .on').getAttribute('data-v');
      var goal = +m.querySelector('[data-name=goal] .on').getAttribute('data-v');
      btn.disabled = true; btn.textContent = 'جارٍ إنشاء الغرفة…';
      api('/api/arena/live/create', {
        lesson_ids: ids, course_key: state.selectedCourse, mode: mode, duration_min: dur, goal: goal,
        late_join: $('arLateJoin').checked
      }).then(function(res) {
        lsSet('arena_h_' + res.code, { token: res.hostToken });
        location.href = '/blooket/' + res.code;
      }).catch(function(err) {
        btn.disabled = false; btn.textContent = 'إنشاء الغرفة ←';
        $('arLiveErr').textContent = err.message || 'تعذّر إنشاء الغرفة.';
      });
    };
  }

  // ==========================================
  // المعلم: اللوبي واللوحة الحية والنتائج
  // ==========================================
  function renderHost() {
    var s = live.state;
    if (!s) return;
    if (s.state === 'LOBBY') return renderHostLobby();
    if (s.state === 'PLAYING') return renderHostLive();
    return renderHostEnded();
  }

  function applyHostDelta(msg) {
    var s = live.state;
    if (!s) return;
    if (msg.now) live.offset = msg.now - Date.now();
    var byId = {};
    s.players.forEach(function(p, i) { byId[p.id] = i; });
    (msg.players || []).forEach(function(np) {
      if (byId[np.id] != null) s.players[byId[np.id]] = np; else s.players.push(np);
    });
    var lastId = s.feed.length ? s.feed[s.feed.length - 1].id : 0;
    (msg.feed || []).forEach(function(ev) { if (ev.id > lastId) { s.feed.push(ev); if (ev.t === 'join' && s.state === 'LOBBY') playSfx('coin'); } });
    if (s.feed.length > 14) s.feed.splice(0, s.feed.length - 14);
    s.playersCount = msg.playersCount != null ? msg.playersCount : s.players.length;
    s.players.sort(function(a, b) {
      var sa = s.mode === 'race' ? a.correct : a.gold, sb = s.mode === 'race' ? b.correct : b.gold;
      return (sb - sa) || (b.correct - a.correct);
    });
    // إعادة رسم مجمّعة لتفادي الوميض مع كثرة الإجابات
    var now = Date.now();
    if (now - live.hostRenderAt > 250) { live.hostRenderAt = now; renderHost(); }
    else if (!live.hostRenderQueued) {
      live.hostRenderQueued = true;
      setTimeout(function() { live.hostRenderQueued = false; live.hostRenderAt = Date.now(); renderHost(); }, 260);
    }
  }

  function hostTopBar(extra) {
    var s = live.state;
    return '<div class="ar-host-bar">' +
      '<div class="ar-hb-code">رقم الغرفة <b>' + esc(fmtCode(s.code)) + '</b></div>' +
      '<div class="ar-hb-mid">' + esc(modeName(s.mode)) + (s.title ? ' · ' + esc(s.title) : '') + '</div>' +
      '<div class="ar-hb-act">' + (extra || '') + '</div></div>';
  }

  function renderHostLobby() {
    stopTimer();
    var s = live.state, main = $('arenaMain');
    var n = s.players.length;
    var link = location.host + '/blooket';
    main.innerHTML = '<div class="ar-live-shell ar-host">' +
      hostTopBar('<button type="button" class="ar-hb-btn" id="arLockBtn">' + (s.locked ? '🔓 فتح الغرفة' : '🔒 قفل الغرفة') + '</button>' +
        '<button type="button" class="ar-hb-btn" id="arCancelRoom">✕ إلغاء</button>') +
      '<div class="ar-lobby-hero">' +
        '<div class="ar-lh-step">ادخلوا على <b dir="ltr">' + esc(link) + '</b></div>' +
        '<div class="ar-lh-code" dir="ltr">' + esc(fmtCode(s.code)) + '</div>' +
        '<div class="ar-lh-actions"><button type="button" class="ar-hb-btn" id="arCopyLink">📋 نسخ رابط الغرفة</button></div>' +
      '</div>' +
      '<div class="ar-lobby-bar"><div class="ar-lb-count"><b id="arLobbyCount">' + n + '</b> ' + (n === 1 ? 'طالب' : 'طلاب') + ' في اللوبي</div>' +
        '<button type="button" class="btn primary ar-start-live" id="arStartLive"' + (n ? '' : ' disabled') + '>' +
          (n ? 'ابدأ اللعبة ▶' : 'بانتظار الطلاب…') + '</button></div>' +
      '<div class="ar-lobby-grid" id="arLobbyGrid">' +
        (n ? s.players.map(function(p) {
          return '<button type="button" class="ar-lobby-p' + (p.connected ? '' : ' off') + '" data-kick="' + esc(p.id) + '" title="اضغط لإخراج ' + esc(p.name) + '">' +
            '<span class="ar-lp-av">' + esc(p.avatar) + '</span><span class="ar-lp-n">' + esc(p.name) + '</span><span class="ar-lp-x">✕</span></button>';
        }).join('') : '<div class="ar-lobby-empty">لم ينضم أحد بعد. اعرض الرقم على السبورة ليدخل الطلاب من جوالاتهم.</div>') +
      '</div></div>';

    $('arStartLive').onclick = function() {
      if (!live.state.players.length) return;
      this.disabled = true;
      sendLive({ action: 'start' });
    };
    $('arLockBtn').onclick = function() { sendLive({ action: 'lock', locked: !live.state.locked }); };
    $('arCancelRoom').onclick = function() {
      if (!confirm('إلغاء الغرفة وإنهاء اللعبة؟')) return;
      sendLive({ action: 'end' });
    };
    $('arCopyLink').onclick = function() {
      var u = roomUrl(s.code);
      try { navigator.clipboard.writeText(u).then(function() { toast('تم نسخ الرابط'); }, function() { toast(u); }); } catch (e) { toast(u); }
    };
    Array.prototype.forEach.call(main.querySelectorAll('[data-kick]'), function(b) {
      b.onclick = function() {
        var id = this.getAttribute('data-kick');
        var name = this.querySelector('.ar-lp-n').textContent;
        if (confirm('إخراج ' + name + ' من الغرفة؟')) sendLive({ action: 'kick', playerId: id });
      };
    });
  }

  function feedLine(ev) {
    if (ev.t === 'join') return esc(ev.avatar) + ' انضم ' + esc(ev.name);
    if (ev.t === 'steal') return '🦹 ' + esc(ev.name) + ' سرق ' + fmtNum(ev.amount) + ' من ' + esc(ev.target);
    if (ev.t === 'swap') return '🔄 ' + esc(ev.name) + ' بدّل ذهبه مع ' + esc(ev.target);
    if (ev.t === 'jackpot') return '💰 ' + esc(ev.name) + ' ربح ' + ev.amount + ' دفعة واحدة';
    if (ev.t === 'triple') return '✨ ' + esc(ev.name) + ' ضاعف ذهبه ×3';
    if (ev.t === 'goal') return '🏁 ' + esc(ev.name) + ' وصل للهدف!';
    if (ev.t === 'start') return '▶ بدأت اللعبة';
    return '';
  }

  function renderHostLive() {
    var s = live.state, main = $('arenaMain');
    var lead = s.players.length ? Math.max(1, s.mode === 'race' ? s.goal : s.players[0].gold) : 1;
    var totalAns = 0, totalOk = 0;
    s.players.forEach(function(p) { totalAns += p.answered; totalOk += p.correct; });
    var acc = totalAns ? Math.round(totalOk * 100 / totalAns) : 0;
    var timer = s.mode === 'gold' ? '<div class="ar-big-timer" id="arHostTimer">' + fmtClock(remainingSec()) + '</div>' : '<div class="ar-big-timer">🏁 ' + s.goal + '</div>';
    main.innerHTML = '<div class="ar-live-shell ar-host">' +
      hostTopBar('<button type="button" class="ar-hb-btn" id="arLockBtn">' + (s.locked ? '🔓 فتح' : '🔒 قفل') + '</button>' +
        '<button type="button" class="ar-hb-btn danger" id="arEndBtn">⏹ إنهاء اللعبة</button>') +
      '<div class="ar-live-stats">' + timer +
        '<div class="ar-ls"><b>' + s.players.length + '</b><span>لاعب</span></div>' +
        '<div class="ar-ls"><b>' + fmtNum(totalAns) + '</b><span>إجابة</span></div>' +
        '<div class="ar-ls"><b>' + acc + '%</b><span>دقة الفصل</span></div>' +
        '<div class="ar-ls join"><span>للانضمام</span><b dir="ltr">' + esc(fmtCode(s.code)) + '</b></div>' +
      '</div>' +
      '<div class="ar-live-body"><div class="ar-board">' +
        s.players.map(function(p, i) {
          var val = s.mode === 'race' ? p.correct : p.gold;
          var pct = Math.max(2, Math.min(100, Math.round(val * 100 / lead)));
          var accP = p.answered ? Math.round(p.correct * 100 / p.answered) : 0;
          return '<div class="ar-row' + (i < 3 ? ' top' + (i + 1) : '') + (p.connected ? '' : ' off') + '">' +
            '<span class="ar-rk">' + (i + 1) + '</span><span class="ar-rav">' + esc(p.avatar) + '</span>' +
            '<div class="ar-rmain"><div class="ar-rname">' + esc(p.name) + '<small>' + p.correct + '/' + p.answered + ' · ' + accP + '%</small></div>' +
            '<div class="ar-rbar"><i style="width:' + pct + '%"></i></div></div>' +
            '<span class="ar-rval">' + scoreLabel(p) + '</span></div>';
        }).join('') + '</div>' +
        '<div class="ar-feed"><div class="ar-lbl">ما يحدث الآن</div>' +
          s.feed.slice().reverse().map(function(ev) { var t = feedLine(ev); return t ? '<div class="ar-fe">' + t + '</div>' : ''; }).join('') +
        '</div></div></div>';
    $('arEndBtn').onclick = function() { if (confirm('إنهاء اللعبة الآن وإعلان النتائج؟')) sendLive({ action: 'end' }); };
    $('arLockBtn').onclick = function() { sendLive({ action: 'lock', locked: !live.state.locked }); };
    if (s.mode === 'gold') startTimer(function() {
      var t = $('arHostTimer'), r = remainingSec();
      if (t) { t.textContent = fmtClock(r); t.classList.toggle('urgent', r != null && r <= 30); }
    });
  }

  function renderHostEnded() {
    stopTimer();
    var s = live.state, main = $('arenaMain'), p = s.players;
    var pod = [1, 0, 2].map(function(i) {
      var x = p[i];
      if (!x) return '<div class="ar-pod empty"></div>';
      return '<div class="ar-pod p' + (i + 1) + '"><div class="ar-pod-av">' + esc(x.avatar) + '</div><div class="ar-pod-n">' + esc(x.name) + '</div>' +
        '<div class="ar-pod-col"><b>' + (i + 1) + '</b><span>' + scoreLabel(x) + '</span></div></div>';
    }).join('');
    main.innerHTML = '<div class="ar-live-shell ar-host">' +
      hostTopBar('<a class="ar-hb-btn" href="/arena">🎮 لعبة جديدة</a><button type="button" class="ar-hb-btn" id="arCsvBtn">⬇ تحميل النتائج</button>') +
      '<h1 class="ar-end-h">🏆 النتائج النهائية</h1>' +
      '<div class="ar-podium">' + pod + '</div>' +
      '<table class="ar-res-tbl"><thead><tr><th>#</th><th>الطالب</th><th>' + (s.mode === 'race' ? 'الإجابات الصحيحة' : 'الذهب') + '</th><th>صح / أجاب</th><th>الدقة</th></tr></thead><tbody>' +
        p.map(function(x, i) {
          return '<tr><td>' + (i + 1) + '</td><td>' + esc(x.avatar) + ' ' + esc(x.name) + '</td><td>' + scoreLabel(x) + '</td><td>' + x.correct + ' / ' + x.answered + '</td><td>' + (x.answered ? Math.round(x.correct * 100 / x.answered) : 0) + '%</td></tr>';
        }).join('') + '</tbody></table>' +
      '<p class="muted ar-saved-note">حُفظت النتائج في تقارير ساحة التحدي.</p></div>';
    playSfx('chest');
    $('arCsvBtn').onclick = function() {
      var rows = [['الترتيب', 'الطالب', s.mode === 'race' ? 'الإجابات الصحيحة' : 'الذهب', 'صحيح', 'عدد الإجابات', 'الدقة %']];
      p.forEach(function(x, i) { rows.push([i + 1, x.name, s.mode === 'race' ? x.correct : x.gold, x.correct, x.answered, x.answered ? Math.round(x.correct * 100 / x.answered) : 0]); });
      var csv = '﻿' + rows.map(function(r) {
        return r.map(function(v) { v = String(v); if (/^[=+\-@\t\r]/.test(v)) v = "'" + v; return '"' + v.replace(/"/g, '""') + '"'; }).join(',');
      }).join('\r\n');
      var a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
      a.download = 'نتائج-الغرفة-' + s.code + '.csv';
      document.body.appendChild(a); a.click(); a.remove();
    };
  }

  // ==========================================
  // الانطلاق والتحميل الأولي
  // ==========================================
  function init() {
    // 0. صفحات الغرف المباشرة: /blooket (إدخال الرقم) و /blooket/147147 (الغرفة)
    var path = location.pathname.replace(/\/+$/, '');
    var mRoom = path.match(/^\/(?:blooket|arena)\/(\d{6})$/);
    if (mRoom) { openRoom(mRoom[1]); return; }
    if (path === '/blooket') {
      var qc = new URLSearchParams(location.search).get('code');
      if (qc && /^\d{6}$/.test(qc)) { location.replace('/blooket/' + qc); return; }
      renderEnterCode();
      return;
    }

    // 1. مزامنة بيانات المستخدم لتفعيل أدوات المعلم (بدون تحويل قسري عند عدم تسجيل الدخول)
    try {
      var h = {};
      var s = typeof sidGet === 'function' ? sidGet() : '', d = typeof didGet === 'function' ? didGet() : '';
      if (s) h['X-Tahdir-Sid'] = s;
      if (d) h['X-Tahdir-Did'] = d;
      fetch('/api/me', { credentials: 'same-origin', headers: h }).then(function(r) {
        return r.ok ? r.json() : null;
      }).then(function(user) {
        if (user && (user.role === 'teacher' || user.role === 'admin')) {
          state.isTeacher = true;
          state.user = user;
          if (state.view === 'setup') renderSetup();
        }
      }).catch(function() {});
    } catch (e) {}

    // 2. مزامنة المحفظة من الخادم كمرجع أساسي
    try {
      api('/api/arena/wallet').then(function(w) {
        if (w && typeof w.balance === 'number' && !w.guest) {
          state.wallet = w.balance;
          if (w.active_avatar) state.activeAvatar = w.active_avatar;
          if (Array.isArray(w.items)) {
            w.items.forEach(function(it) {
              if (state.ownedAvatars.indexOf(it) === -1) state.ownedAvatars.push(it);
            });
          }
          saveWallet();
          var wv = $('arWalletVal');
          if (wv) wv.textContent = state.wallet;
        }
      }).catch(function() {});
    } catch (e) {}

    api('/api/arena/courses').then(function(res) {
      state.courses = res.courses || [];
      state.liveEnabled = !!res.live_enabled;
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
