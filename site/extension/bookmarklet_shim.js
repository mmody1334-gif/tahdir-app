(function () {
  if (location.hostname !== 'lms.moe.gov.om') { alert('افتح منصة نور أولًا، ثم اضغط زر «أداة نور» من شريط الإشارات.'); return; }
  var P = 'tahdir_bm_';
  var get = function (k, d) { try { var v = localStorage.getItem(P + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } };
  var set = function (k, v) { try { localStorage.setItem(P + k, JSON.stringify(v)); } catch (e) { } };
  var del = function (k) { try { localStorage.removeItem(P + k); } catch (e) { } };
  var toast = function (msg, ms) { var t = document.createElement('div'); t.textContent = msg; t.style.cssText = 'position:fixed;top:16px;left:50%;transform:translateX(-50%);z-index:2147483647;background:#0e7c66;color:#fff;padding:12px 18px;border-radius:12px;font:14px Tahoma,sans-serif;direction:rtl;box-shadow:0 6px 20px rgba(0,0,0,.25);max-width:90vw;line-height:1.7'; document.body.appendChild(t); setTimeout(function () { t.remove(); }, ms || 5000); };
  var m = location.hash.match(/tahdir=([^&]+)/);
  if (m) {
    try {
      var o = JSON.parse(decodeURIComponent(escape(atob(m[1].replace(/-/g, '+').replace(/_/g, '/')))));
      set(o.kind === 'hw' ? 'tahdir_pending_hw' : 'tahdir_pending_prep', { data: o.data, ts: Date.now(), routed: false });
    } catch (e) { toast('تعذّرت قراءة التحضير المُرسل. أعد الإرسال من الموقع.'); }
    history.replaceState(null, '', location.pathname + location.search);
  }
  var path = location.pathname;
  var onPrep = /\/courses\/add_preparation\//.test(path), onTask = /\/homeworks\/(create|edit|add)\//.test(path), onBulk = /\/questions\/add_bulk_questions\//.test(path);
  var prep = get('tahdir_pending_prep', null), hw = get('tahdir_pending_hw', null);
  if (onPrep && prep) toast('📋 أداة نور: جارٍ ملء التحضير… راجعه ثم احفظ بنفسك.', 4000);
  else if ((onTask || onBulk) && hw) toast('📝 أداة نور: جارٍ ملء الواجب… راجعه ثم احفظ بنفسك.', 4000);
  else if ((prep && !prep.routed) || (hw && !hw.routed)) toast('⏳ أداة نور: أفتح صفحة الإضافة لهذا الصف… عندما تفتح اضغط زر «أداة نور» مرة ثانية.', 9000);
  else if (!prep && !hw && !onPrep && !onBulk) toast('لا يوجد شيء مُرسل. اضغط «إرسال التحضير إلى نور» في موقع التحضير الآلي أولًا.', 6000);
  (__RUN__)(get, set, del, function (u) { location.href = u; }, function () { }, window);
})();
