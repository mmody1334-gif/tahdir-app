/* مصحّح الاختبار القصير — يقرأ ملف Word/PDF أو نصًّا، ويطلب الفحص من الخادم.
   استخراج النصّ يتم **في المتصفح**: Word بلا أي مكتبة (ZIP + DecompressionStream)،
   وPDF عبر pdf.js المخزّن محليًّا. فلا يخرج من جهاز المعلّم إلا النصّ. */
(function () {
  'use strict';
  var $ = function (s) { return document.querySelector(s); };
  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  function pageNonce() {
    var s = document.querySelector('script[nonce]');
    return s ? (s.nonce || s.getAttribute('nonce') || '') : '';
  }

  // ---------- فكّ ضغط ZIP (DOCX) ----------
  async function inflateRaw(u8) {
    if (typeof DecompressionStream === 'undefined') throw new Error('متصفحك لا يدعم فكّ الضغط — استخدم الصق النصّ');
    var ds = new DecompressionStream('deflate-raw');
    var stream = new Blob([u8]).stream().pipeThrough(ds);
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }
  async function readDocxEntries(buf) {
    var u8 = new Uint8Array(buf), dv = new DataView(buf);
    var eocd = -1;
    for (var i = u8.length - 22; i >= Math.max(0, u8.length - 66000); i--) {
      if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) throw new Error('الملف ليس Word صالحًا (.docx)');
    var total = dv.getUint16(eocd + 10, true), ptr = dv.getUint32(eocd + 16, true);
    var out = null;
    for (var k = 0; k < total; k++) {
      if (ptr + 46 > u8.length || dv.getUint32(ptr, true) !== 0x02014b50) break;
      var method = dv.getUint16(ptr + 10, true);
      var csize = dv.getUint32(ptr + 20, true);
      var nameLen = dv.getUint16(ptr + 28, true), extraLen = dv.getUint16(ptr + 30, true), comLen = dv.getUint16(ptr + 32, true);
      var lho = dv.getUint32(ptr + 42, true);
      var name = new TextDecoder().decode(u8.subarray(ptr + 46, ptr + 46 + nameLen));
      ptr += 46 + nameLen + extraLen + comLen;
      if (name !== 'word/document.xml') continue;
      var lnameLen = dv.getUint16(lho + 26, true), lextraLen = dv.getUint16(lho + 28, true);
      var dstart = lho + 30 + lnameLen + lextraLen;
      if (!csize) { // حجم غير مسجّل: نأخذ حتى الترويسة التالية أو نهاية الملف
        var nxt = u8.length;
        for (var q = dstart + 4; q < u8.length - 4; q++) {
          if (dv.getUint32(q, true) === 0x08074b50 || dv.getUint32(q, true) === 0x02014b50) { nxt = q; break; }
        }
        csize = nxt - dstart;
      }
      var data = u8.subarray(dstart, dstart + csize);
      out = new TextDecoder().decode(method === 0 ? data : await inflateRaw(data));
      break;
    }
    if (!out) throw new Error('لم أجد محتوى الورقة داخل ملف Word');
    return out;
  }
  function xmlToText(xml) {
    var s = String(xml)
      .replace(/<w:tab[^>]*\/>/g, ' ')
      .replace(/<w:br[^>]*\/>/g, '\n')
      .replace(/<\/w:p>/g, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'").replace(/&#(\d+);/g, function (_, d) { return String.fromCharCode(+d); })
      .replace(/&amp;/g, '&');
    return s.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  }

  // ---------- PDF ----------
  function loadPdfJs() {
    return new Promise(function (res, rej) {
      if (window.pdfjsLib) return res(window.pdfjsLib);
      var s = document.createElement('script');
      s.src = '/pdf/pdf.min.js';
      var n = pageNonce(); if (n) s.setAttribute('nonce', n);
      s.async = true;
      s.onload = function () {
        try { window.pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf/pdf.worker.min.js'; } catch (e) { }
        res(window.pdfjsLib);
      };
      s.onerror = function () { rej(new Error('تعذّر تحميل قارئ PDF — جرّب ملف Word أو الصق النصّ')); };
      document.head.appendChild(s);
    });
  }
  async function readPdf(buf) {
    var lib = await loadPdfJs();
    var doc = await lib.getDocument({ data: new Uint8Array(buf) }).promise;
    var pages = [];
    for (var p = 1; p <= doc.numPages; p++) {
      var pg = await doc.getPage(p);
      var tc = await pg.getTextContent();
      var rows = [];
      tc.items.forEach(function (it) {
        var y = it.transform ? it.transform[5] : 0, x = it.transform ? it.transform[4] : 0;
        rows.push({ s: it.str || '', x: x, y: y });
      });
      rows.sort(function (a, b) { return (Math.abs(a.y - b.y) > 3) ? (b.y - a.y) : (a.x - b.x); });
      var lines = [], cur = '', lastY = null;
      rows.forEach(function (r) {
        if (lastY !== null && Math.abs(r.y - lastY) > 3) { lines.push(cur); cur = ''; }
        cur += r.s; lastY = r.y;
      });
      if (cur) lines.push(cur);
      pages.push(lines.join('\n'));
    }
    return pages.join('\n');
  }

  // ---------- العرض ----------
  var ICON = { pass: '✓', warn: '!', fail: '✕', skip: '–' };
  function render(rep) {
    var out = $('#chkOut'); if (!out) return;
    if (!rep || !rep.checks) { out.innerHTML = '<p class="chk-err">تعذّر الفحص.</p>'; return; }
    var s = rep.summary || {};
    var cls = rep.ok ? 'ok' : 'bad';
    var h = '<div class="chk-res ' + cls + '">';
    h += '<div class="chk-sum"><span class="chk-num">' + (s.items || 0) + '</span> مفردة</div>';
    h += '<div class="chk-sum"><span class="chk-num">' + (s.marks || 0) + '</span> / ' + (s.expectedMarks || '—') + ' درجة</div>';
    h += '<div class="chk-sum"><b>' + (s.fails || 0) + '</b> خطأ · <b>' + (s.warns || 0) + '</b> ملاحظة</div>';
    h += '</div><ul class="chk-list">';
    rep.checks.forEach(function (c) {
      h += '<li class="chk-it chk-' + c.status + '"><span class="chk-ic">' + (ICON[c.status] || '·') + '</span>'
        + '<span class="chk-tx"><b>' + esc(c.title) + '</b>' + (c.detail ? '<span class="chk-dt">' + esc(c.detail) + '</span>' : '') + '</span></li>';
    });
    h += '</ul>';
    if (rep.items && rep.items.length) {
      h += '<details class="chk-tbl"><summary>تفصيل المفردات (' + rep.items.length + ')</summary><table>';
      h += '<tr><th>#</th><th>الدرجة</th><th>خيارات</th><th>بداية السؤال</th></tr>';
      rep.items.forEach(function (it) {
        h += '<tr><td>' + it.n + '</td><td>' + (it.marks == null ? '—' : it.marks) + '</td>'
          + '<td>' + (it.mcq ? (it.opts || 0) : '—') + '</td><td class="chk-q">' + esc(it.start || '') + '</td></tr>';
      });
      h += '</table></details>';
    }
    out.innerHTML = h;
  }

  async function run() {
    var out = $('#chkOut'), stat = $('#chkStat'), btn = $('#chkRun');
    var grade = ($('#chkGrade') && $('#chkGrade').value) || '';
    var withAns = ($('#chkAns') ? !!$('#chkAns').checked : true);
    var txt = ($('#chkText') && $('#chkText').value || '').trim();
    var f = $('#chkFile') && $('#chkFile').files && $('#chkFile').files[0];
    if (!txt && !f) {
      if (out) out.innerHTML = '<p class="chk-err">اختر ملفًا أو الصق نصّ الورقة أولًا.</p>';
      return;
    }
    if (btn) btn.disabled = true;
    if (stat) stat.textContent = 'جارٍ التحليل…';
    var source = 'text';
    try {
      if (!txt && f) {
        var buf = await f.arrayBuffer();
        var nm = (f.name || '').toLowerCase();
        if (/\.docx$/.test(nm) || /wordprocessingml/.test(f.type || '')) { txt = xmlToText(await readDocxEntries(buf)); source = 'docx'; }
        else if (/\.pdf$/.test(nm) || f.type === 'application/pdf') { txt = await readPdf(buf); source = 'pdf'; }
        else if (/\.txt$/.test(nm) || /^text\//.test(f.type || '')) { txt = new TextDecoder().decode(buf); source = 'txt'; }
        else { txt = new TextDecoder().decode(buf); source = 'txt'; }
      }
      if (!txt || txt.replace(/\s/g, '').length < 20) throw new Error('لم أستخرج نصًّا كافيًا — ربما الملف صور ممسوحة (يحتاج OCR). الصق النصّ بدلًا من ذلك.');
      if (stat) stat.textContent = 'جارٍ الفحص…';
      var r = await fetch('/api/checkquiz', {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: txt, grade: grade, source: source, withAnswer: withAns }),
      });
      var rep = await r.json();
      if (!r.ok) throw new Error(rep && rep.error || 'تعذّر الفحص');
      // PDF: غالبًا يخرج النصّ معكوسًا فيصعب الحكم على الصياغة — نوسمه
      if (source === 'pdf') rep.checks.forEach(function (c) { if (c.id === 'qstart') { c.status = 'skip'; c.detail = 'لم يُفحص: نصّ PDF قد يخرج معكوسًا — ارفع Word أو الصق النصّ'; } });
      render(rep);
      if (stat) stat.textContent = txt.length.toLocaleString('ar') + ' حرفًا · ' + ({ docx: 'Word', pdf: 'PDF', text: 'نصّ', txt: 'نصّ' }[source] || '');
    } catch (e) {
      if (out) out.innerHTML = '<p class="chk-err">' + esc(e.message || 'خطأ') + '</p>';
      if (stat) stat.textContent = '';
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  function init() {
    var drop = $('#chkDrop'), inp = $('#chkFile'), pick = $('#chkRun');
    if (!drop || !inp) return;
    drop.addEventListener('click', function () { inp.click(); });
    drop.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); inp.click(); } });
    inp.addEventListener('change', function () {
      var f = inp.files && inp.files[0];
      var st = $('#chkStat');
      if (st) st.textContent = f ? ('اخترت: ' + f.name + ' · ' + Math.round(f.size / 1024) + ' KB') : '';
    });
    ['dragenter', 'dragover'].forEach(function (ev) {
      drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('over'); });
    });
    ['dragleave', 'drop'].forEach(function (ev) {
      drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove('over'); });
    });
    drop.addEventListener('drop', function (e) {
      var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (!f) return;
      try { var dt = new DataTransfer(); dt.items.add(f); inp.files = dt.files; } catch (err) { }
      var st = $('#chkStat'); if (st) st.textContent = 'اخترت: ' + f.name;
      run();
    });
    if (pick) pick.addEventListener('click', run);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
