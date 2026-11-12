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
        (state.liveEnabled ? '<button type="button" class="btn primary small" id="arLiveBtn" title="بدء مسابقة حية متعددة اللاعبين">⚔️ لعبة مباشرة</button>' : '') +
        '<button type="button" class="btn ghost small" id="arJoinLiveBtn" title="انضمام كطالب لغرفة مباشرة بكود الغرفة">🎯 انضمام لغرفة</button>' +
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
    var joinBtn = $('arJoinLiveBtn');
    if (joinBtn) {
      joinBtn.onclick = function() {
        renderStudentJoinForm();
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
  // المرحلة 4: شاشات اللعب المباشر التفاعلي (Live Multiplayer)
  // ==========================================

  var live = {
    role: null,         // 'host' أو 'student'
    code: null,         // رمز الغرفة
    token: null,        // hostToken أو playerToken
    ws: null,
    state: null,        // كائن sync من الخادم
    timerId: null,
    answered: false,
    selectedChoice: null,
    myResult: null,
    showHostHint: false // إخفاء الإجابة الصحيحة افتراضياً عن شاشة المعلم
  };
  try { window.__arenaLive = live; } catch (e) {}

  // 1. AudioContext unlocker على أول لمسة / نقرة
  var audioUnlocked = false;
  function unlockAudio() {
    if (audioUnlocked) return;
    audioUnlocked = true;
    try {
      var ctx = getAudioCtx();
      if (ctx && ctx.state === 'suspended') ctx.resume();
    } catch (e) {}
    document.removeEventListener('pointerdown', unlockAudio);
    document.removeEventListener('touchstart', unlockAudio);
    document.removeEventListener('keydown', unlockAudio);
  }
  document.addEventListener('pointerdown', unlockAudio, { passive: true });
  document.addEventListener('touchstart', unlockAudio, { passive: true });
  document.addEventListener('keydown', unlockAudio, { passive: true });

  // 2. إعادة الاتصال التلقائي عند visibilitychange و pageshow
  function checkResumeLive() {
    try {
      var tok = sessionStorage.getItem('arena_live_token');
      var cod = sessionStorage.getItem('arena_live_code');
      var rol = sessionStorage.getItem('arena_live_role');
      if (tok && cod && rol && (!live.ws || live.ws.readyState > 1)) {
        connectLiveWs(cod, tok, rol);
      }
    } catch (e) {}
  }
  window.addEventListener('visibilitychange', function() {
    if (!document.hidden) checkResumeLive();
  });
  window.addEventListener('pageshow', checkResumeLive);

  // 3. فتح الاتصال بمقبس WebSocket الحقيقي
  function connectLiveWs(code, token, role) {
    if (live.ws) {
      try { live.ws.close(); } catch (e) {}
      live.ws = null;
    }
    live.role = role;
    live.code = code;
    live.token = token;
    try {
      sessionStorage.setItem('arena_live_token', token);
      sessionStorage.setItem('arena_live_code', code);
      sessionStorage.setItem('arena_live_role', role);
    } catch (e) {}

    var proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    var wsUrl = proto + '//' + location.host + '/api/arena/live/ws?code=' + encodeURIComponent(code) + '&token=' + encodeURIComponent(token);
    var ws = new WebSocket(wsUrl);
    live.ws = ws;

    ws.onmessage = function(ev) {
      try {
        var msg = JSON.parse(ev.data);
        if (msg.type === 'sync') {
          handleLiveSync(msg.state);
        } else if (msg.type === 'answer_ack') {
          live.answered = true;
          if (live.role === 'student') {
            live.myResult = msg;
            renderStudentQuestion();
          }
        } else if (msg.type === 'kicked') {
          leaveLiveSession('تم استبعادك من الجلسة المباشرة بواسطة المعلم.');
        } else if (msg.type === 'error') {
          toast(msg.error || 'خطأ في الغرفة المباشرة');
        }
      } catch (e) {}
    };

    ws.onclose = function(ev) {
      if (live.role && state.view.indexOf('live_') === 0 && ev.code !== 1000 && ev.code !== 4001) {
        setTimeout(function() {
          if (live.token && live.code) connectLiveWs(live.code, live.token, live.role);
        }, 1200);
      }
    };
  }

  function leaveLiveSession(msg) {
    if (msg) toast(msg);
    if (live.timerId) { clearInterval(live.timerId); live.timerId = null; }
    if (live.ws) {
      try { live.ws.close(1000, 'leave'); } catch (e) {}
      live.ws = null;
    }
    try {
      sessionStorage.removeItem('arena_live_token');
      sessionStorage.removeItem('arena_live_code');
      sessionStorage.removeItem('arena_live_role');
    } catch (e) {}
    live.role = null;
    live.code = null;
    live.token = null;
    live.state = null;
    live.answered = false;
    live.selectedChoice = null;
    live.myResult = null;
    renderSetup();
  }

  function handleLiveSync(newState) {
    if (!newState) return;
    var prevState = live.state ? live.state.state : null;
    var prevQ = live.state ? live.state.currentQIndex : null;
    live.state = newState;

    if (newState.state === 'QUESTION') {
      if (prevQ !== newState.currentQIndex || prevState !== 'QUESTION') {
        live.answered = false;
        live.selectedChoice = null;
        live.myResult = null;
        live.showHostHint = false;
      }
    }

    if (live.role === 'host') {
      if (newState.state === 'LOBBY') renderHostLobby();
      else if (newState.state === 'QUESTION' || newState.state === 'REVEAL' || newState.state === 'PAUSED' || newState.state === 'STARTING') renderHostGame();
      else if (newState.state === 'PODIUM') renderHostPodium();
    } else if (live.role === 'student') {
      if (newState.state === 'LOBBY') renderStudentLobby();
      else if (newState.state === 'QUESTION' || newState.state === 'PAUSED' || newState.state === 'STARTING') renderStudentQuestion();
      else if (newState.state === 'REVEAL') renderStudentReveal();
      else if (newState.state === 'PODIUM') renderStudentPodium();
    }
  }

  // 4. واجهة المعلم: إعداد الغرفة المباشرة (Live Setup Modal)
  function openLiveSetupModal() {
    var old = $('arLiveSetupModal');
    if (old) old.remove();

    var curCourse = state.courses.find(function(c) { return c.key === state.selectedCourse; });
    var courseLabel = curCourse ? (curCourse.subject + ' (' + curCourse.grade + ')') : 'مقرر عام';

    var m = document.createElement('div');
    m.id = 'arLiveSetupModal';
    m.className = 'ar-modal-backdrop';
    m.innerHTML = '<div class="ar-modal-box" style="max-width:540px">' +
      '<h2><span>⚔️ إعداد اللعبة المباشرة</span><button type="button" class="btn ghost small" id="arCloseLiveModalBtn">✕</button></h2>' +
      '<div class="ar-form-row">' +
        '<label>المقرر الدراسي:</label>' +
        '<div style="font-size:1.05rem;font-weight:700;color:var(--main-d);margin-bottom:6px">' + esc(courseLabel) + '</div>' +
      '</div>' +
      '<div class="ar-form-row">' +
        '<label for="arLiveTimeSel">الوقت المخصص لكل سؤال:</label>' +
        '<select id="arLiveTimeSel" class="ar-select">' +
          '<option value="5">5 ثوانٍ (سريع للتجربة)</option>' +
          '<option value="10">10 ثوانٍ (سريع جداً)</option>' +
          '<option value="15" selected>15 ثانية (مثالي)</option>' +
          '<option value="20">20 ثانية (مريح)</option>' +
          '<option value="30">30 ثانية (تفكيري)</option>' +
        '</select>' +
      '</div>' +
      '<div class="ar-form-row">' +
        '<label for="arLiveCountSel">عدد الأسئلة:</label>' +
        '<select id="arLiveCountSel" class="ar-select">' +
          '<option value="1">سؤال واحد (سريع)</option>' +
          '<option value="2">سؤالان</option>' +
          '<option value="5">5 أسئلة</option>' +
          '<option value="10" selected>10 أسئلة</option>' +
          '<option value="15">15 سؤالاً</option>' +
          '<option value="20">20 سؤالاً</option>' +
        '</select>' +
      '</div>' +
      '<div class="ar-form-row">' +
        '<label for="arLiveModeSel">نمط المسابقة:</label>' +
        '<select id="arLiveModeSel" class="ar-select">' +
          '<option value="gold_rush" selected>🏆 سباق الذهب والتتويج</option>' +
          '<option value="speed">⚡ التحدي السريع (نقاط السرعة)</option>' +
          '<option value="classic">🎯 كلاسيكي متوازن</option>' +
        '</select>' +
      '</div>' +
      '<div class="ar-host-actions" style="margin-top:20px">' +
        '<button type="button" class="btn primary" id="arSubmitLiveCreateBtn" style="min-height:46px;font-size:1.05rem">🚀 إنشاء الغرفة وبدء البهو</button>' +
        '<button type="button" class="btn ghost" id="arCancelLiveModalBtn">إلغاء</button>' +
      '</div>' +
    '</div>';

    document.body.appendChild(m);

    function closeModal() { if (m) m.remove(); }
    $('arCloseLiveModalBtn').onclick = closeModal;
    $('arCancelLiveModalBtn').onclick = closeModal;

    $('arSubmitLiveCreateBtn').onclick = function() {
      var btn = this;
      btn.disabled = true;
      btn.textContent = 'جارٍ إنشاء الغرفة…';
      var timeLimit = +$('arLiveTimeSel').value || 15;
      var qCount = +$('arLiveCountSel').value || 10;
      var mode = $('arLiveModeSel').value || 'gold_rush';

      api('/api/arena/live/create', {
        course_key: state.selectedCourse,
        time_limit: timeLimit,
        question_count: qCount,
        mode: mode
      }).then(function(res) {
        closeModal();
        if (res && res.code && res.hostToken) {
          toast('تم إنشاء الغرفة المباشرة بنجاح!');
          connectLiveWs(res.code, res.hostToken, 'host');
        } else {
          toast(res.error || 'تعذّر إنشاء الغرفة');
        }
      }).catch(function(err) {
        btn.disabled = false;
        btn.textContent = '🚀 إنشاء الغرفة وبدء البهو';
        toast(err.message || 'تعذّر إنشاء الغرفة المباشرة');
      });
    };
  }

  // 5. واجهة المعلم: شاشة البهو وانتظار الطلاب (Host Lobby)
  function renderHostLobby() {
    state.view = 'live_host_lobby';
    var main = $('arenaMain');
    if (!main || !live.state) return;

    var players = (live.state.leaderboard || []).filter(function(p) { return !p.isHost; });

    var h = '<div class="ar-top-bar">' +
      '<div class="ar-user-info">' +
        '<span class="ar-av-badge">👑</span>' +
        '<b>لوحة تحكم المعلم (المضيف)</b>' +
      '</div>' +
      '<div class="ar-top-actions">' +
        '<button type="button" class="btn ghost small" id="arHostExitBtn">🚪 خروج من الغرفة</button>' +
      '</div>' +
    '</div>';

    h += '<div class="ar-live-code-card">' +
      '<span style="font-size:1.1rem;color:var(--mute)">رمز الغرفة المباشرة للطلاب:</span>' +
      '<div><span class="ar-room-code-badge" id="arRoomCodeVal">' + esc(live.state.code) + '</span></div>' +
      '<p style="margin:8px 0;font-size:1rem;color:var(--ink)">رابط الدخول المباشر: <b>' + esc(location.origin + '/arena?code=' + live.state.code) + '</b></p>' +
      '<button type="button" class="btn ghost small" id="arCopyCodeLink">📋 نسخ الرابط</button>' +
    '</div>';

    h += '<div class="card ar-players-panel">' +
      '<div class="ar-players-title">' +
        '<span>👥 الطلاب المنضمون في البهو:</span>' +
        '<b id="arPlayerCount" style="color:var(--main);font-size:1.25rem">' + players.length + '</b>' +
      '</div>' +
      '<div class="ar-students-roster" id="arRosterBox">';

    if (!players.length) {
      h += '<div style="grid-column:1/-1;text-align:center;padding:20px;color:var(--mute)">في انتظار انضمام الطلاب عبر الرمز أعلاه…</div>';
    } else {
      players.forEach(function(p) {
        h += '<span class="ar-student-chip">' +
          '<span>' + avatarIcon(p.avatar, '🦅') + '</span>' +
          '<b>' + esc(p.name) + '</b>' +
          '<button type="button" class="ar-kick-btn" data-kid="' + esc(p.id) + '" title="طرد الطالب">✕</button>' +
        '</span>';
      });
    }

    h += '</div>' +
      '<div class="ar-host-actions">' +
        '<button type="button" class="btn primary ar-start-btn" id="arHostStartBtn"' + (players.length === 0 ? ' disabled' : '') + '>🚀 بدء المنافسة الآن</button>' +
        '<button type="button" class="btn secondary" id="arHostLockBtn">' + (live.state.locked ? '🔓 فتح الغرفة' : '🔒 قفل الغرفة') + '</button>' +
      '</div>' +
    '</div>';

    main.innerHTML = h;

    $('arHostExitBtn').onclick = function() {
      if (confirm('هل تريد إغلاق الغرفة وإنهاء الجلسة للجميع؟')) leaveLiveSession();
    };

    $('arCopyCodeLink').onclick = function() {
      var lnk = location.origin + '/arena?code=' + live.state.code;
      navigator.clipboard ? navigator.clipboard.writeText(lnk).then(function() { toast('تم نسخ الرابط!'); }) : toast(lnk);
    };

    var sBtn = $('arHostStartBtn');
    if (sBtn) {
      sBtn.onclick = function() {
        this.disabled = true;
        this.textContent = 'جارٍ الانطلاق…';
        if (live.ws && live.ws.readyState === 1) {
          live.ws.send(JSON.stringify({ action: 'start' }));
        }
      };
    }

    var lBtn = $('arHostLockBtn');
    if (lBtn) {
      lBtn.onclick = function() {
        if (live.ws && live.ws.readyState === 1) {
          live.ws.send(JSON.stringify({ action: 'lock', locked: !live.state.locked }));
        }
      };
    }

    var kBtns = document.querySelectorAll('.ar-kick-btn');
    Array.prototype.forEach.call(kBtns, function(b) {
      b.onclick = function() {
        var kid = this.getAttribute('data-kid');
        if (kid && confirm('هل أنت متأكد من استبعاد هذا الطالب؟')) {
          if (live.ws && live.ws.readyState === 1) {
            live.ws.send(JSON.stringify({ action: 'kick', targetPlayerId: kid }));
          }
        }
      };
    });
  }

  // 6. واجهة المعلم: شاشة إدارة السؤال وكشف الإجابات (Host Game & Reveal)
  function renderHostGame() {
    state.view = 'live_host_game';
    var main = $('arenaMain');
    if (!main || !live.state) return;

    var q = live.state.question || { index: 0, total: 1, stem: 'السؤال', choices: [] };
    var isReveal = live.state.state === 'REVEAL';
    var isPaused = live.state.state === 'PAUSED';
    var activePlayers = (live.state.leaderboard || []).filter(function(p) { return !p.isHost; });

    var h = '<div class="ar-top-bar">' +
      '<div class="ar-user-info">' +
        '<b>السؤال ' + (q.index + 1) + ' من ' + q.total + '</b>' +
        '<span class="ar-tag active" style="margin-inline-start:8px">' + (isReveal ? 'كشف الإجابات' : (isPaused ? 'متوقف مؤقتاً' : 'نشط')) + '</span>' +
      '</div>' +
      '<div class="ar-top-actions">' +
        (!isReveal ? '<button type="button" class="btn ar-ctrl-btn ar-hint-toggle" id="arHostToggleHintBtn">' + (live.showHostHint ? '🙈 إخفاء الإجابة' : '👁️ إظهار الإجابة لي') + '</button>' : '') +
        '<button type="button" class="btn ar-ctrl-btn" id="arHostPauseBtn">' + (isPaused ? '▶️ استئناف' : '⏸️ إيقاف') + '</button>' +
        '<button type="button" class="btn ar-ctrl-btn" id="arHostSkipBtn">⏭️ تخطي</button>' +
        '<button type="button" class="btn ar-ctrl-btn" id="arHostEndBtn">🚪 إنهاء</button>' +
      '</div>' +
    '</div>';

    h += '<div class="card ar-live-q-box">' +
      '<div class="ar-live-q-top">' +
        '<span style="font-size:1rem;color:var(--mute)">كود الغرفة: <b>' + esc(live.state.code) + '</b></span>' +
        '<div class="ar-live-timer' + (live.state.remainingSeconds <= 3 && !isReveal ? ' urgent' : '') + '">⏱️ ' + live.state.remainingSeconds + 'ث</div>' +
      '</div>' +
      '<div class="ar-live-q-stem">' + esc(q.stem) + '</div>';

    if (isReveal) {
      // إحصائيات توزيع إجابات الطلاب للمعلم
      var dist = live.state.choiceCounts || (q && q.choiceCounts) || [0, 0, 0, 0];
      var totalAnswers = dist.reduce(function(a, b) { return a + b; }, 0) || 1;
      h += '<div class="ar-bars-dist">' +
        '<h4>📊 إحصائيات إجابات الطلاب:</h4>';
      q.choices.forEach(function(ch, idx) {
        var isCorr = idx === q.correct;
        var cnt = dist[idx] || 0;
        var pct = Math.round((cnt / totalAnswers) * 100);
        h += '<div class="ar-bar-row">' +
          '<span class="ar-bar-label">' + (idx + 1) + '</span>' +
          '<div class="ar-bar-track">' +
            '<div class="ar-bar-fill opt-' + idx + '" style="width:' + pct + '%"></div>' +
          '</div>' +
          '<span class="ar-bar-cnt" data-cidx="' + idx + '">' + cnt + ' (' + pct + '%)' + (isCorr ? ' ✓' : '') + '</span>' +
          '<span style="flex:2;margin-inline-start:8px;font-size:.9rem' + (isCorr ? ';color:#10b981;font-weight:700' : '') + '">' + esc(ch) + '</span>' +
        '</div>';
      });
      h += '</div>';
    } else {
      // عرض الخيارات مع إخفاء الإجابة الصحيحة افتراضياً (المعلم يعرض شاشته للفصل)
      h += '<div class="ar-live-grid">';
      q.choices.forEach(function(ch, idx) {
        var isHint = live.showHostHint && (idx === q.hostHintCorrect);
        h += '<div class="ar-live-btn opt-' + idx + '" style="cursor:default' + (isHint ? ';border:3px solid #fff;box-shadow:0 0 0 4px #10b981' : '') + '">' +
          '<span class="ar-shape">' + (idx + 1) + '</span>' +
          '<span>' + esc(ch) + (isHint ? ' <small class="ar-host-hint-label" style="background:rgba(0,0,0,.2);padding:2px 6px;border-radius:6px">✓ الصحيحة</small>' : '') + '</span>' +
        '</div>';
      });
      h += '</div>';
    }

    h += '</div>';

    // لوحة المتصدرين المصغرة
    h += '<div class="card" style="padding:16px">' +
      '<h4 style="margin:0 0 10px;font-size:1.05rem">🏆 لوحة المتصدرين الحالية:</h4>' +
      '<div style="display:flex;gap:10px;flex-wrap:wrap">';
    (live.state.leaderboard || []).slice(0, 5).forEach(function(p, idx) {
      h += '<div class="ar-student-chip">' +
        '<span>' + (idx === 0 ? '🥇' : (idx === 1 ? '🥈' : (idx === 2 ? '🥉' : '🎖️'))) + ' ' + avatarIcon(p.avatar, '') + '</span>' +
        '<b>' + esc(p.name) + '</b>' +
        '<span style="color:var(--accent);font-weight:700">' + p.score + ' نقطة</span>' +
      '</div>';
    });
    h += '</div></div>';

    main.innerHTML = h;

    if ($('arHostToggleHintBtn')) {
      $('arHostToggleHintBtn').onclick = function() {
        live.showHostHint = !live.showHostHint;
        renderHostGame();
      };
    }

    $('arHostPauseBtn').onclick = function() {
      if (live.ws && live.ws.readyState === 1) {
        live.ws.send(JSON.stringify({ action: isPaused ? 'resume' : 'pause' }));
      }
    };
    $('arHostSkipBtn').onclick = function() {
      if (live.ws && live.ws.readyState === 1 && confirm('هل تريد تخطي هذا السؤال؟')) {
        live.ws.send(JSON.stringify({ action: 'skip' }));
      }
    };
    $('arHostEndBtn').onclick = function() {
      if (confirm('هل تريد إنهاء المسابقة المباشرة الآن؟')) leaveLiveSession();
    };
  }

  // 7. واجهة المعلم: شاشة التتويج والمنصة (Host Podium)
  function renderHostPodium() {
    state.view = 'live_host_podium';
    var main = $('arenaMain');
    if (!main || !live.state) return;

    var list = (live.state.leaderboard || []).filter(function(p) { return !p.isHost; });
    var p1 = list[0] || null;
    var p2 = list[1] || null;
    var p3 = list[2] || null;

    var h = '<div class="card ar-result-card">' +
      '<div class="ar-res-trophy">🏆</div>' +
      '<h2>منصة تتويج أبطال الساحة</h2>' +
      '<p class="ar-res-lead">تهانينا لجميع الطلاب المتنافسين! تم حفظ النتائج بنجاح.</p>' +
      '<div class="ar-podium-wrap">';

    // المركز الثاني (فضة)
    if (p2) {
      h += '<div class="ar-podium-col rank-2">' +
        '<span style="font-size:1.8rem">' + avatarIcon(p2.avatar, '🥈') + '</span>' +
        '<b style="font-size:.9rem;margin:4px 0">' + esc(p2.name) + '</b>' +
        '<span style="font-size:.85rem;color:var(--accent);font-weight:700">' + p2.score + ' نقطة</span>' +
        '<div class="ar-podium-pedestal">2</div>' +
      '</div>';
    }

    // المركز الأول (ذهب)
    if (p1) {
      h += '<div class="ar-podium-col rank-1">' +
        '<span style="font-size:2.4rem">👑</span>' +
        '<span style="font-size:2rem">' + avatarIcon(p1.avatar, '🦅') + '</span>' +
        '<b style="font-size:1.05rem;margin:4px 0">' + esc(p1.name) + '</b>' +
        '<span style="font-size:.95rem;color:var(--accent);font-weight:700">' + p1.score + ' نقطة</span>' +
        '<div class="ar-podium-pedestal">1</div>' +
      '</div>';
    }

    // المركز الثالث (برونز)
    if (p3) {
      h += '<div class="ar-podium-col rank-3">' +
        '<span style="font-size:1.8rem">' + avatarIcon(p3.avatar, '🥉') + '</span>' +
        '<b style="font-size:.9rem;margin:4px 0">' + esc(p3.name) + '</b>' +
        '<span style="font-size:.85rem;color:var(--accent);font-weight:700">' + p3.score + ' نقطة</span>' +
        '<div class="ar-podium-pedestal">3</div>' +
      '</div>';
    }

    h += '</div>';

    // جدول الترتيب الكامل
    h += '<table class="ar-leaderboard-tbl">' +
      '<thead><tr><th>المركز</th><th>اسم الطالب</th><th>النقاط</th><th>الإجابات الصحيحة</th></tr></thead><tbody>';
    list.forEach(function(p, idx) {
      h += '<tr>' +
        '<td><b>' + (idx + 1) + '</b></td>' +
        '<td>' + esc(p.name) + '</td>' +
        '<td style="color:var(--accent);font-weight:700">' + p.score + ' نقطة</td>' +
        '<td>' + (p.correctCount || 0) + '</td>' +
      '</tr>';
    });
    h += '</tbody></table>';

    h += '<div class="ar-res-actions">' +
      '<button type="button" class="btn primary" id="arHostDoneBtn">العودة للرئيسية 🏠</button>' +
      '<button type="button" class="btn secondary" id="arHostRepBtn">عرض تقارير الطلاب 📊</button>' +
    '</div></div>';

    main.innerHTML = h;

    $('arHostDoneBtn').onclick = function() { leaveLiveSession(); };
    $('arHostRepBtn').onclick = function() {
      leaveLiveSession();
      renderTeacherReports();
    };
  }

  // 8. واجهة الطالب: نموذج الانضمام (Student Join Screen)
  function renderStudentJoinForm(initialCode) {
    state.view = 'live_join';
    var main = $('arenaMain');
    if (!main) return;

    var h = '<div class="ar-top-bar">' +
      '<div class="ar-user-info">' +
        '<span class="ar-av-badge">🎯</span>' +
        '<b>انضمام لمسابقة مباشرة</b>' +
      '</div>' +
      '<div class="ar-top-actions">' +
        '<button type="button" class="btn ghost small" id="arCancelJoinBtn">رجوع للساحة</button>' +
      '</div>' +
    '</div>';

    h += '<div class="card ar-setup-card" style="max-width:520px;margin:24px auto;padding:24px;text-align:center">' +
      '<h2 style="margin:0 0 16px;font-size:1.3rem;color:var(--main-d)">ادخل بياناتك للانضمام</h2>' +
      '<div class="ar-form-row" style="text-align:right">' +
        '<label for="arLiveCodeInput">رمز الغرفة (6 أحرف):</label>' +
        '<input type="text" id="arLiveCodeInput" maxlength="6" value="' + esc(initialCode || '') + '" placeholder="ABCDEF" style="text-transform:uppercase;font-family:monospace;font-size:1.6rem;letter-spacing:4px;text-align:center" required>' +
      '</div>' +
      '<div class="ar-form-row" style="text-align:right">' +
        '<label for="arLiveNameInput">اسمك (للظهور في المسابقة):</label>' +
        '<input type="text" id="arLiveNameInput" maxlength="30" placeholder="مثال: أحمد العماني" required>' +
      '</div>' +
      '<div class="ar-form-row" style="text-align:right">' +
        '<label for="arLiveClassInput">كود الفصل (اختياري لحفظ رصيد الجوائز):</label>' +
        '<input type="text" id="arLiveClassInput" placeholder="مثال: 6K52W2">' +
      '</div>' +
      '<div class="ar-host-actions" style="margin-top:20px">' +
        '<button type="button" class="btn primary ar-start-btn" id="arSubmitJoinBtn" style="width:100%;min-height:48px;font-size:1.1rem">دخول الساحة المباشرة ←</button>' +
      '</div>' +
    '</div>';

    main.innerHTML = h;

    $('arCancelJoinBtn').onclick = function() { renderSetup(); };

    $('arSubmitJoinBtn').onclick = function() {
      var btn = this;
      var code = ($('arLiveCodeInput').value || '').trim().toUpperCase();
      var name = ($('arLiveNameInput').value || '').trim();
      var classId = ($('arLiveClassInput').value || '').trim();

      if (!code || code.length !== 6) { toast('أدخل رمز الغرفة المكون من 6 أحرف!'); return; }
      if (!name) { toast('اكتب اسمك للمشاركة!'); return; }

      btn.disabled = true;
      btn.textContent = 'جارٍ الانضمام…';

      api('/api/arena/live/join', {
        code: code,
        name: name,
        class_id: classId,
        avatar: state.activeAvatar
      }).then(function(res) {
        if (res && res.playerToken) {
          toast('أهلاً بك يا ' + res.name + '!');
          connectLiveWs(res.code, res.playerToken, 'student');
        } else {
          btn.disabled = false;
          btn.textContent = 'دخول الساحة المباشرة ←';
          toast(res.error || 'تعذّر الانضمام');
        }
      }).catch(function(err) {
        btn.disabled = false;
        btn.textContent = 'دخول الساحة المباشرة ←';
        toast(err.message || 'تعذّر الانضمام للغرفة المباشرة');
      });
    };
  }

  // 9. واجهة الطالب: شاشة الانتظار في البهو (Student Lobby)
  function renderStudentLobby() {
    state.view = 'live_student_lobby';
    var main = $('arenaMain');
    if (!main || !live.state) return;

    var h = '<div class="ar-top-bar">' +
      '<div class="ar-user-info">' +
        '<span class="ar-av-badge">' + avatarIcon(state.activeAvatar, '🦅') + '</span>' +
        '<b>الساحة المباشرة</b>' +
      '</div>' +
      '<div class="ar-top-actions">' +
        '<button type="button" class="btn ghost small" id="arStudentLeaveLobby">🚪 مغادرة</button>' +
      '</div>' +
    '</div>';

    h += '<div class="card ar-setup-card" style="max-width:520px;margin:30px auto;padding:32px 20px;text-align:center">' +
      '<div style="font-size:3.5rem;margin-bottom:12px">⏳</div>' +
      '<h2 style="font-size:1.4rem;color:var(--main-d);margin-bottom:8px">أنت الآن في البهو!</h2>' +
      '<p style="font-size:1.1rem;color:var(--ink);margin-bottom:16px">رمز الغرفة: <b style="font-family:monospace;letter-spacing:2px">' + esc(live.state.code) + '</b></p>' +
      '<div class="ar-notice-strip" style="justify-content:center">' +
        '<span>المعلم يجهز المنافسة، سيبدأ السؤال الأول على هاتفك تلقائياً فور الانطلاق… استعد!</span>' +
      '</div>' +
    '</div>';

    main.innerHTML = h;

    $('arStudentLeaveLobby').onclick = function() {
      if (confirm('هل تريد مغادرة الغرفة؟')) leaveLiveSession();
    };
  }

  // 10. واجهة الطالب: شاشة الإجابة بأزرار كبيرة ولمسية (Student Question Screen)
  function renderStudentQuestion() {
    state.view = 'live_student_question';
    var main = $('arenaMain');
    if (!main || !live.state) return;

    var q = live.state.question || { index: 0, total: 1, stem: '', choices: [] };
    var answered = live.answered;

    var h = '<div class="ar-top-bar">' +
      '<div class="ar-user-info">' +
        '<b>السؤال ' + (q.index + 1) + ' من ' + q.total + '</b>' +
      '</div>' +
      '<div class="ar-top-actions">' +
        '<div class="ar-live-timer' + (live.state.remainingSeconds <= 3 ? ' urgent' : '') + '">⏱️ ' + live.state.remainingSeconds + 'ث</div>' +
      '</div>' +
    '</div>';

    h += '<div class="card ar-live-q-box">' +
      '<div class="ar-live-q-stem">' + esc(q.stem) + '</div>';

    if (answered) {
      h += '<div class="ar-notice-strip" style="justify-content:center;margin:16px 0;background:#e1f3ec;color:#0b3b33">' +
        '<span>✓ تم تسجيل إجابتك بنجاح! في انتظار انتهاء وقت السؤال لكشف النتيجة…</span>' +
      '</div>';
    }

    var shapes = ['▲', '◆', '●', '◼'];
    h += '<div class="ar-live-grid">';
    q.choices.forEach(function(ch, idx) {
      var isSel = live.selectedChoice === idx;
      h += '<button type="button" class="ar-live-btn opt-' + idx + (isSel ? ' selected' : '') + '" data-cidx="' + idx + '"' + (answered ? ' disabled' : '') + '>' +
        '<span class="ar-shape">' + shapes[idx] + '</span>' +
        '<span>' + esc(ch) + '</span>' +
      '</button>';
    });
    h += '</div></div>';

    main.innerHTML = h;

    if (!answered) {
      var btns = document.querySelectorAll('.ar-live-btn');
      Array.prototype.forEach.call(btns, function(b) {
        b.onclick = function() {
          var cidx = +this.getAttribute('data-cidx');
          live.selectedChoice = cidx;
          live.answered = true;
          playSfx('coin');
          if (live.ws && live.ws.readyState === 1) {
            live.ws.send(JSON.stringify({ action: 'answer', choiceIndex: cidx }));
          }
          renderStudentQuestion();
        };
      });
    }
  }

  // 11. واجهة الطالب: كشف النتيجة والنقاط (Student Reveal Screen)
  function renderStudentReveal() {
    state.view = 'live_student_reveal';
    var main = $('arenaMain');
    if (!main || !live.state) return;

    var q = live.state.question || { choices: [], correct: 0 };
    var res = live.myResult;
    var isCorrect = res && res.isCorrect;

    var h = '<div class="ar-top-bar">' +
      '<div class="ar-user-info">' +
        '<b>كشف الإجابات 🎯</b>' +
      '</div>' +
      '<div class="ar-top-actions">' +
        '<span>السؤال القادم قريباً…</span>' +
      '</div>' +
    '</div>';

    h += '<div class="card ar-reveal-card">';
    if (isCorrect) {
      h += '<div class="ar-reveal-status ok">🎉 إجابة صحيحة وممتازة!</div>' +
        '<div class="ar-reveal-pts">+' + (res.pointsAwarded || 500) + ' نقطة</div>';
      playSfx('correct');
    } else if (live.answered) {
      h += '<div class="ar-reveal-status fail">❌ إجابة خاطئة! حظاً أوفر</div>' +
        '<div style="color:var(--mute);margin-bottom:12px">لم تكتسب نقاطاً في هذا السؤال</div>';
      playSfx('wrong');
    } else {
      h += '<div class="ar-reveal-status fail">⏳ انتهى الوقت دون إجابة!</div>';
    }

    h += '<div class="ar-notice-strip" style="justify-content:center;margin:16px 0">' +
      '<span>الإجابة الصحيحة هي: <b>' + esc(q.answer || q.choices[q.correct] || '') + '</b></span>' +
    '</div>';

    // الترتيب الحالي للطالب
    var me = (live.state.leaderboard || []).find(function(p) { return p.id === (live.state.playerId || (live.myResult && live.myResult.playerId)); });
    if (me) {
      h += '<div style="margin-top:16px;font-size:1.1rem;color:var(--ink)">' +
        'مركزك الحالي: <b style="color:var(--main);font-size:1.3rem">#' + me.rank + '</b> (مجموعك: <b>' + me.score + '</b> نقطة)' +
      '</div>';
    }

    h += '</div>';

    main.innerHTML = h;
  }

  // 12. واجهة الطالب: منصة التتويج النهائية (Student Podium Screen)
  function renderStudentPodium() {
    state.view = 'live_student_podium';
    var main = $('arenaMain');
    if (!main || !live.state) return;

    var list = (live.state.leaderboard || []).filter(function(p) { return !p.isHost; });
    var p1 = list[0] || null;
    var p2 = list[1] || null;
    var p3 = list[2] || null;

    var me = list.find(function(p) { return p.id === live.state.playerId; }) || list[0];

    var h = '<div class="card ar-result-card">' +
      '<div class="ar-res-trophy">🏆</div>' +
      '<h2>انتهت المسابقة المباشرة!</h2>' +
      '<p class="ar-res-lead">أحسنت المشاركة والمنافسة اليوم!</p>';

    if (me) {
      h += '<div style="background:var(--main-l);border:2px solid var(--main);border-radius:14px;padding:14px;margin:16px 0">' +
        '<span style="font-size:1.15rem;color:var(--main-d)">نتيجتك النهائية: </span>' +
        '<b style="font-size:1.4rem;color:var(--main-d)">المركز #' + (me.rank || 1) + ' بمجموع ' + (me.score || 0) + ' نقطة</b>' +
      '</div>';
    }

    h += '<div class="ar-podium-wrap">';
    if (p2) {
      h += '<div class="ar-podium-col rank-2">' +
        '<span style="font-size:1.8rem">' + avatarIcon(p2.avatar, '🥈') + '</span>' +
        '<b style="font-size:.9rem;margin:4px 0">' + esc(p2.name) + '</b>' +
        '<span style="font-size:.85rem;color:var(--accent);font-weight:700">' + p2.score + ' نقطة</span>' +
        '<div class="ar-podium-pedestal">2</div>' +
      '</div>';
    }
    if (p1) {
      h += '<div class="ar-podium-col rank-1">' +
        '<span style="font-size:2.2rem">👑</span>' +
        '<span style="font-size:2rem">' + avatarIcon(p1.avatar, '🦅') + '</span>' +
        '<b style="font-size:1.05rem;margin:4px 0">' + esc(p1.name) + '</b>' +
        '<span style="font-size:.95rem;color:var(--accent);font-weight:700">' + p1.score + ' نقطة</span>' +
        '<div class="ar-podium-pedestal">1</div>' +
      '</div>';
    }
    if (p3) {
      h += '<div class="ar-podium-col rank-3">' +
        '<span style="font-size:1.8rem">' + avatarIcon(p3.avatar, '🥉') + '</span>' +
        '<b style="font-size:.9rem;margin:4px 0">' + esc(p3.name) + '</b>' +
        '<span style="font-size:.85rem;color:var(--accent);font-weight:700">' + p3.score + ' نقطة</span>' +
        '<div class="ar-podium-pedestal">3</div>' +
      '</div>';
    }
    h += '</div>';

    h += '<div class="ar-res-actions">' +
      '<button type="button" class="btn primary" id="arStudentDoneBtn">العودة للساحة الرئيسية 🏠</button>' +
    '</div></div>';

    main.innerHTML = h;

    $('arStudentDoneBtn').onclick = function() {
      leaveLiveSession();
    };
  }

  // ==========================================
  // الانطلاق والتحميل الأولي
  // ==========================================
  function init() {
    // 0. فحص رابط الانضمام المباشر أو استئناف الجلسة الحية
    try {
      var urlParams = new URLSearchParams(window.location.search);
      var codeParam = urlParams.get('code');
      var joinParam = urlParams.get('join');
      if (codeParam || joinParam) {
        renderStudentJoinForm(codeParam || '');
        return;
      }
      var savedTok = sessionStorage.getItem('arena_live_token');
      var savedCod = sessionStorage.getItem('arena_live_code');
      var savedRol = sessionStorage.getItem('arena_live_role');
      if (savedTok && savedCod && savedRol) {
        connectLiveWs(savedCod, savedTok, savedRol);
        return;
      }
    } catch (e) {}

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
