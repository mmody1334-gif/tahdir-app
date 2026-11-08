/* GrindMate 27 — UI logic. Data: ./data/*.json (updated by GitHub Action). */
const $ = (s) => document.querySelector(s);
const fmtDate = (d) => new Date(d).toLocaleDateString('ar-EG', { day: 'numeric', month: 'short' });
const NUM = new Intl.NumberFormat('en-US');

function countdown(end) {
  const ms = new Date(end) - Date.now();
  if (!end || ms <= 0) return { txt: 'انتهى', cls: 'ended' };
  const h = Math.floor(ms / 3600000);
  const d = Math.floor(h / 24);
  const m = Math.floor((ms % 3600000) / 60000);
  return { txt: d ? `${d} يوم ${h % 24} سا` : `${h} سا ${m} د`, cls: '' };
}

const MODES_AR = {
  squad_battles: 'سکواد باتل', rivals: 'Rivals', champions: 'Champions',
  rush: 'Rush', live_event: 'Live Events', any: 'أي مود'
};
const arabize = (s) => MODES_AR[s] || s;

/* ---------- state ---------- */
const seenKey = 'gm27-seen';
const seen = new Set(JSON.parse(localStorage.getItem(seenKey) || '[]'));
function markSeen(list) {
  for (const k of list) seen.add(k);
  localStorage.setItem(seenKey, JSON.stringify([...seen]));
}

/* ---------- tabs ---------- */
for (const b of document.querySelectorAll('#tabs button')) {
  b.onclick = () => {
    document.querySelectorAll('#tabs button').forEach(x => x.classList.toggle('on', x === b));
    if (location.hash !== b.dataset.tab) location.hash = b.dataset.tab;
    show(b.dataset.tab);
  };
}
function show(tab) {
  for (const s of document.querySelectorAll('main section')) s.hidden = s.id !== 'tab-' + tab;
  const btn = document.querySelector(`#tabs button[data-tab="${tab}"]`);
  if (btn) document.querySelectorAll('#tabs button').forEach(x => x.classList.toggle('on', x === btn));
}
window.addEventListener('hashchange', () => show(location.hash.slice(1) || 'objectives'));

/* ---------- data loading ---------- */
const j = (f) => fetch('data/' + f).then(r => r.json()).catch(() => null);
Promise.all([j('objectives.json'), j('evolutions.json'), j('prices.json'), j('leaks.json')]).then(([obj, evos, prices, leaks]) => {
  if (obj) renderObjectives(obj);
  if (evos) renderEvos(evos);
  if (prices) renderMarket(prices);
  if (leaks) renderLeaks(leaks);
  const updated = [obj?.updatedAt, evos?.updatedAt, prices?.updatedAt, leaks?.updatedAt].filter(Boolean).map(s => new Date(s).toLocaleString('ar-EG'));
  $('#updated').textContent = updated.length ? 'آخر تحديث للبيانات: ' + updated.join(' · ') : '';
  show(location.hash.slice(1) || 'objectives');
});

/* ---------- objectives ---------- */
let objData = null, wordCountText = '';
function renderObjectives(d) {
  objData = d;
  const wrap = $('#obj-groups');
  const now = Date.now();
  const alerts = [];
  const rows = [];
  for (const g of d.groups) {
    const cd = countdown(g.endTime);
    if (cd.cls !== 'ended') rows.push(g);
    if ((g.objectives?.length || 0) > 0 && g.startTime && new Date(g.startTime).getTime() > now - 86400000 * 2 && !seen.has('g:' + g.slug)) alerts.push({ g, kind: 'new' });
    if (cd.cls === '' && new Date(g.endTime).getTime() - now < 86400000) alerts.push({ g, kind: 'soon' });
  }
  $('#obj-alerts').innerHTML = alerts.map(a => {
    const isNew = a.kind === 'new';
    return `<div class="alert">${isNew
      ? '🆕 <b>' + a.g.name + '</b> — أوبجكتيف جديد! ينتهي ' + new Date(a.g.endTime).toLocaleDateString('ar-EG') + ' <span class="badge soon">جديد</span>'
      : '⏰ <b>' + a.g.name + '</b> قريب ينتهي — فاضل ' + countdown(a.g.endTime).txt}</div>`;
  }).join('');
  markSeen(d.groups.filter(g => new Date(g.startTime || 0).getTime() > now - 86400000 * 2).map(g => 'g:' + g.slug));
  wordCountText = '';
  wrap.innerHTML = rows.map(groupHtml).join('');
  $('#obj-search').value = '';
  $('#obj-search').oninput = filterObj;
  const q = $('#obj-search');
  q.value = ''; q.dispatchEvent(new Event('input'));
}
function groupHtml(g) {
  const cd = countdown(g.endTime);
  const isNew = !seen.has('g:' + g.slug);
  const isPermanent = !g.endTime;
  const tasks = g.objectives || [];
  return `<div class="card" data-g="${g.slug}">
    <div class="group-head" onclick="this.parentNode.classList.toggle('open')">
      <h2>${g.name}${isNew ? '<span class="newdot"></span>' : ''}</h2>
      <div class="badge ${isPermanent ? 'ok' : cd.cls === 'ended' ? 'ended' : 'soon'}">${isPermanent ? 'دائم' : endLabel(g)}</div>
    </div>
    ${g.description ? `<div class="desc">${g.description}</div>` : ''}
    ${isPermanent ? '' : `<div class="cd ${cd.cls}">⏳ ${cd.txt} · ينتهي ${new Date(g.endTime).toLocaleDateString('ar-EG')}</div>`}
    <div class="tasks">${tasks.map(taskHtml).join('')}</div>
  </div>`;
}
function endLabel(g) {
  const cd = countdown(g.endTime);
  return cd.txt;
}
function taskHtml(t) {
  const chips = [];
  const modes = (t.modes || []).map(arabize);
  if (modes.length) chips.push(modes.join(' / '));
  if (t.minDifficulty) chips.push('صعوبة: ' + t.minDifficulty);
  if (t.rivalsMinDivision) chips.push('دیڤیژن: ' + t.rivalsMinDivision);
  if (t.liveEventName) chips.push('Live: ' + t.liveEventName);
  if (t.target) chips.push(((t.action || 'عبها') + ' ' + t.target + ' ' + (t.unit === 'matches' ? 'مباراة' : t.unit === 'goals' ? 'هدف' : t.unit || '')));
  for (let i = 0; i < chips.length; i++) chips[i] = `<span class="chip${i === 0 ? ' hot' : ''}">${chips[i]}</span>`;
  const reqs = (t.squadRequirements || []).map(r =>
    `<span class="chip">${r.label || r.kind}${r.count ? ' ×' + r.count : ''}${r.constraint === 'min' ? '+ ' : ''}${r.scope === 'starting_11' ? ' (تشكيلة البداية)' : ''}</span>`);
  return `<div class="task">
    <h4>${t.name}</h4>
    <p>${t.description}</p>
    ${(chips.length || reqs.length) ? `<div class="meta">${reqs.join('')}${chips.join('')}</div>` : ''}
    ${t.reward?.length ? `<div class="reward">🎁 ${t.reward.map(r => r.name).join(' · ')}</div>` : ''}
  </div>`;
}
function filterObj() {
  const q = $('#obj-search').value.trim().toLowerCase();
  for (const el of document.querySelectorAll('#obj-groups .card')) {
    el.hidden = !!q && !(el.textContent.toLowerCase().includes(q));
    if (q) el.classList.add('open');
    else el.classList.remove('open');
  }
}

/* ---------- evolutions ---------- */
let evoData = null;
function renderEvos(d) {
  evoData = d;
  const list = (d.evolutions || []).filter(e => !e.isExpired);
  const cd = e => countdown(e.endSubmissionTime || e.endTime);
  const open = list.filter(e => cd(e).cls !== 'ended');
  $('#evo-list').innerHTML = open.map(evoHtml).join('');
  $('#evo-search').oninput = filterEvos;
  $('#evo-filter').onchange = filterEvos;
  $('#p-match').onclick = matchEvos;
}
function evoHtml(e) {
  const cd = countdown(e.endSubmissionTime || e.endTime);
  const ups = [];
  const lvls = e.levels || [];
  const all = lvls.flatMap(l => l.upgrades || []);
  const ovr = all.find(u => u.upgrade === 'overall');
  if (ovr) ups.push(`<span class="ovr">+${ovr.maxValue} OVR</span>`);
  for (const u of all.filter(u => u.upgrade !== 'overall').slice(0, 14)) {
    const nm = u.upgrade.replace('attribute_', '').replace(/_/g, ' ').replace('sprint speed', 'سرعة').replace('def awareness', 'وعي دفاعي').replace('standing tackle', 'تبخيص').replace('sliding tackle', 'انزلاق').replace('short passing', 'تمرير قصير').replace('long passing', 'تمرير طويل').replace('ball control', 'استقبالكرة').replace('fk accuracy', 'منحنيات').replace('heading acc.', 'رأسية');
    ups.push(`<span>${nm} +${u.value}${u.maxValue ? '→' + u.maxValue : ''}</span>`);
  }
  const req = e.requirements || {};
  const reqBits = [];
  if (req.maxOverall) reqBits.push(`OVR ${req.minOverall || 0}–${req.maxOverall}`);
  if (Array.isArray(req.positions) && req.positions.length) reqBits.push(`مراكز: ${req.positions.length}`);
  const calc = e.repeatable && e.repeatable > 1 ? `<b>تكراري ×${e.repeatable}</b> · ` : '';
  const closing = (new Date(e.endSubmissionTime || e.endTime).getTime() - Date.now()) < 86400000 * 3 ? 1 : 0;
  return `<div class="card evo" data-e="${e.slug}" data-closing="${closing}" data-cosmetic="${e.cosmetics || /cosmetic/i.test(e.description || '') ? 1 : 0}">
    <div class="t">
      <h3><a href="${e.url}" target="_blank">${e.name}</a></h3>
      <div class="desc">${calc}${e.description || ''}</div>
      <div class="cd">⏳ ${cd.txt} · تقديم قبل ${fmtDate(e.endSubmissionTime || e.endTime)}</div>
      <div class="up">${ups.join('')}</div>
      <div class="summary-line">${reqBits.join(' · ')}${e.trainingTime ? ' · ' + e.trainingTime : ''}</div>
    </div>
  </div>`;
}
function filterEvos() {
  const q = $('#evo-search').value.trim().toLowerCase();
  const f = $('#evo-filter').value;
  for (const el of document.querySelectorAll('#evo-list .card')) {
    let ok = !q || el.textContent.toLowerCase().includes(q);
    if (f === 'closing') ok = ok && el.dataset.closing === '1';
    if (f === 'cosmetic') ok = ok && el.dataset.cosmetic === '1';
    if (f === 'big') ok = ok && el.querySelector('.up .ovr')?.textContent.includes('+') && Number(el.querySelector('.up .ovr')?.textContent.match(/\+(\d+)/)?.[1] || 0) >= 5;
    el.hidden = !ok;
  }
}
function matchEvos() {
  const overall = Number($('#p-overall').value || 0);
  const posb = $('#p-position').value;
  if (!overall) { $('#evo-match-output').innerHTML = '<div class="hint">لازم تدخل التقييم (Overall) الأول — مركز اللاعب يرشح بدقة.</div>'; return; }
  const results = (evoData?.evolutions || []).filter(e => !e.isExpired).map(e => {
    const rq = e.requirements || {};
    const max = rq.maxOverall ?? 99;
    const min = rq.minOverall ?? 0;
    let ok = overall >= min && overall <= max;
    let why = `OVR ${min}—${max}`;
    if (ok && posb && Array.isArray(rq.positions)) {
      const code = { GK: 0, RB: 13, CB: 14, LB: 15, RM: 17, CM: 20, CDM: 19, RW: 24, CAM: 21, LM: 16, ST: 25, CF: 22, LW: 27, LWB: 29, RWB: 30 }[posb];
      if (rq.positions.length) {
        if (code && rq.positions.includes(code)) why += ` · مركزك مقبول`;
        else if (code && Array.isArray(rq.excludedPositions) && rq.excludedPositions.includes(code)) { ok = false; why += ' · مركزك مستبعد'; }
        else { ok = false; why += ' · بتطلب مركز آخر'; }
      }
    }
    const ovr = (e.levels || []).flatMap(l => l.upgrades || []).find(u => u.upgrade === 'overall');
    const finalOvr = ovr ? ovr.maxValue : null;
    return { e, ok, why, finalOvr };
  }).filter(x => x.ok).sort((a, b) => (b.finalOvr || 0) - (a.finalOvr || 0));
  if (!results.length) { $('#evo-match-output').innerHTML = '<div class="hint">مفيش تطوّرة تناسب اللاعب دا بالأرقام دي حاليًا — جرب تقييم أو مركز تاني.</div>'; return; }
  $('#evo-match-output').innerHTML = results.slice(0, 8).map(r => `<div class="card"><h3><a href="${r.e.url}" target="_blank">${r.e.name}</a></h3>
    <div class="summary-line">لاعبك ${overall}${posb ? ' ' + posb : ''} · ${r.why}${r.finalOvr ? ' · <b style="color:var(--acc)">يطلع ' + r.finalOvr + '</b>' : ''}</div>
    <div class="cd">⏳ تقديم قبل ${fmtDate(r.e.endSubmissionTime || r.e.endTime)} · ${r.e.trainingTime || ''}</div></div>`).join('');
}

/* ---------- market ---------- */
function renderMarket(d) {
  const rows = Object.entries(d.players || {});
  if (!rows.length) { $('#market-list').innerHTML = '<div class="empty">قائمة المراقبة فاضية — حط روابط لاعبا في <code>data/config.json</code></div>'; return; }
  const html = ['<table><tr><th>اللاعب</th><th>آخر سعر</th><th>التغير</th><th>إشارة</th><th>معدل 7 days</th></tr>'];
  for (const [name, hist] of rows) {
    const p = hist[hist.length - 1];
    const prev = hist[hist.length - 2];
    const delta = prev ? (p.price - prev.price) / prev.price * 100 : 0;
    const week = hist.slice(-8);
    const w0 = week[0]?.price, wN = p.price;
    const wDelta = w0 ? (wN - w0) / w0 * 100 : 0;
    let sig = '—', cls = 'hold';
    if (delta <= -8 && wDelta < -10) { sig = '🟢 اشتري — السعر نازل جيدًا'; cls = 'buy'; }
    else if (delta >= 12) { sig = '🔴 بيع — السعر طلع عالي'; cls = 'sell'; }
    else if (wDelta >= 4) { sig = '🟡 تمسك — ممكن يكمل'; cls = 'hold'; }
    else if (wDelta <= -4) { sig = '🟡 استنى — السعر مكمل نزول'; cls = 'hold'; }
    else { sig = '🟢 السعر مناسب'; }
    html.push(`<tr><td>${name}</td><td>${NUM.format(p.price)}</td><td>${delta ? (delta > 0 ? '+' : '') + delta.toFixed(1) + '%' : '—'}</td><td class="sig ${cls}">${sig}</td><td>${wDelta ? (wDelta > 0 ? '+' : '') + wDelta.toFixed(1) + '%' : '—'}</td></tr>`);
  }
  html.push('</table>');
  $('#market-list').innerHTML = html.join('');
}

/* ---------- leaks ---------- */
function renderLeaks(d) {
  const list = d.leaks || [];
  if (!list.length) { $('#leaks-list').innerHTML = '<div class="empty">مفيش تسريبات لسه — الـ Action هيحاول تاني كل 4 ساعات</div>'; return; }
  $('#leaks-list').innerHTML = list.map(l => `<div class="card leak">
    <div class="acc">@${l.account} · ${new Date(l.at).toLocaleString('ar-EG')}</div>
    <div>${l.text.replace(/https?:[^\s]+/g, u => `<a href="${u}" target="_blank">${u}</a>`)}</div>
    <a href="${l.link}" target="_blank" class="at">↗ على X</a>
  </div>`).join('');
}
