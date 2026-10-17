// الكبسولة — Cloudflare Worker + D1
// إعداد: أ. محمد مجدي — مدرسة حذيفة بن محصن
const LESSONS = __LESSONS__;
const PAGES = __PAGES__;
const TOOL = __TOOL__;
const ICONS = __ICONS__;
const APK = __APK__;
const PRIVACY = __PRIVACY__;
const QBANK = __QBANK__;
let GPACK = {};
let STUDY = { lessons: {}, units: {} };
let FINALS = {};
const PACKDIR = __PACKDIR__;
let PACKS_OK = null;
async function loadPacks(env, url) {
  if (PACKS_OK) return PACKS_OK;
  PACKS_OK = (async () => {
    const get = async n => { const r = await env.ASSETS.fetch(new Request(new URL(PACKDIR + n + '.json', url.origin))); if (!r.ok) throw new Error('pack ' + n + ' ' + r.status); return r.json(); };
    const [s, g, f] = await Promise.all([get('study'), get('games'), get('finals')]);
    STUDY = s; GPACK = g; FINALS = f; return true;
  })().catch(e => { PACKS_OK = null; throw e; });
  return PACKS_OK;
}
// أسئلة الاختبارات النهائية للعلوم تدخل بنك الاختبار القصير بصورتها الأصلية، بأهداف تقويم الوثيقة
const FG = { 'الخامس': 5, 'السادس': 6, 'السابع': 7, 'الثامن': 8, 'التاسع': 9, 'العاشر': 10, 'الحادي عشر': 11, 'الثاني عشر': 12 };
const AO_LO = { AO1: 'معرفة', AO2: 'تطبيق', AO3: 'استدلال', 'معرفة': 'معرفة', 'تطبيق': 'تطبيق', 'استدلال': 'استدلال' };
const AO_HI = { AO1: 'AO1', AO2: 'AO2', AO3: 'AO2', 'معرفة': 'AO1', 'تطبيق': 'AO2', 'استدلال': 'AO2' };
// تقنية المعلومات: مستويات الوثيقة (تذكر وفهم/تطبيق/استدلال)، والإجابة القصيرة 1–2 والطويلة 3 درجات
function itBank(key, items) {
  if (!/تقنية/.test(key)) return items;
  return items.map(q => {
    let ao = q.ao;
    if (ao === 'معرفة' || ao === 'AO1') ao = 'تذكر وفهم';
    else if (ao === 'AO2') ao = /مرتفع/.test(q.difficulty || '') ? 'استدلال' : 'تطبيق';
    let type = q.type;
    if (type !== 'mcq' && q.marks === 3 && ao !== 'تذكر وفهم') type = 'long';
    else if (type === 'long' && q.marks <= 2) type = 'short';
    return { ...q, ao, type };
  });
}
// «الأنشطة الصفية»: أسئلة أعلى مستوى لكل درس (تطبيق/استدلال، درجات أعلى، صعوبة أعلى، وأسئلة الوزارة بالرسوم)
function hardItems(key, ls) {
  const ids = new Set(ls.map(l => l.id)), out = {};
  const all = itBank(key, QBANK.filter(q => ids.has(q.lesson_id)).concat(finQuizItems(key).filter(q => ids.has(q.lesson_id))));
  const lvl = q => ({ 'استدلال': 3, 'AO2': 3, 'تطبيق': 2, 'AO1': 1, 'معرفة': 1 }[q.ao] || 1);
  const dif = q => ({ 'مرتفعة': 2, 'متوسطة': 1 }[q.difficulty] || 0);
  const score = q => lvl(q) * 10 + dif(q) * 4 + Math.min(q.marks || 1, 5) * 2 + (q.type === 'long' ? 3 : 0) + (q.img ? 4 : 0) - (q.type === 'mcq' ? 6 : 0);
  ls.forEach(l => {
    // أسئلة متوسطة (سؤالان على الأقل) ثم أسئلة تحدٍّ أعلى مستوى
    const mine = all.filter(q => q.lesson_id === l.id && q.stem);
    const isMid = q => q.difficulty === 'متوسطة' || (lvl(q) === 2 && (q.marks || 1) <= 2);
    const mid = mine.filter(q => isMid(q) && q.type !== 'long').sort((x, y) => (y.marks || 1) - (x.marks || 1));
    const hard = mine.filter(q => lvl(q) >= 2).sort((x, y) => score(y) - score(x));
    const pick = [], seen = new Set();
    const add = q => { const k = String(q.stem).slice(0, 60); if (seen.has(k)) return false; seen.add(k); pick.push({ type: q.type, stem: String(q.stem).replace(/\*\*/g, ''), choices: q.choices || [], correct: q.correct, answer: q.answer || '', marks: q.marks || 1, ao: q.ao, img: q.img || '', mid: isMid(q) }); return true; };
    let nm = 0; for (const q of mid) { if (nm >= 2) break; if (add(q)) nm++; }
    for (const q of hard) { if (pick.length >= 7) break; add(q); }
    pick.sort((x, y) => (y.mid ? 1 : 0) - (x.mid ? 1 : 0));
    if (pick.length) out[l.id] = pick;
  });
  return out;
}
// مستوى هدف التقويم لسؤال الوزارة: بعضها مكتوب مركّبًا («معرفة / تطبيق»، «AO1/AO2»، «أ: AO1 ؛ ب: AO2») أو فارغًا
// نأخذ الأعلى مستوى فيها، والفارغ يُستنتج من الدرجة، حتى لا تسقط أسئلة كثيرة من الفيزياء والعلوم والعلوم البيئية
const AO_RANK = { AO1: 1, 'معرفة': 1, 'تذكر': 1, AO2: 2, 'تطبيق': 2, AO3: 3, 'استدلال': 3 };
function normAO(raw, hi, m) {
  const found = String(raw || '').match(/AO[123]|معرفة|تذكر|تطبيق|استدلال/g) || [];
  const top = found.length ? found.reduce((a, b) => (AO_RANK[b] > AO_RANK[a] ? b : a)) : ((+m || 1) >= 2 ? 'تطبيق' : 'معرفة');
  return (hi ? AO_HI : AO_LO)[top];
}
// نص سؤال الوزارة يبدأ برقمه الأصلي («2) ...»). الواجهة ترقّم الاختبار من جديد،
// فنُزيل الرقم هنا حتى لا يظهر مرتين. الصورة تحتفظ بالرقم الأصلي كما في الورقة.
function stripQNo(t) {
  return String(t || '').replace(/^\s*\(?\s*\d{1,2}\s*[\)\u002e\-]\s*/, '').trim();
}
function finQuizItems(key) {
  const G = FINALS[key]; if (!G) return [];
  const [subj, grade] = key.split('|'); if (subj === 'تقنية المعلومات' || subj === 'اللغة الإنجليزية') return [];
  // اللغة العربية والتربية الإسلامية تستخدمان **أسماء أهداف التقويم العربية** في جداول
  // مواصفاتهما (معرفة · تطبيق · استدلال)، بينما العلوم والكيمياء… تستخدم رموز AO1/AO2.
  // فلو حوّلنا مفرداتهما إلى رموز AO للصفوف 11-12 لما طابقت مواصفتهما فلم يُولَّد اختبار.
  const ARAO = (subj === 'اللغة العربية' || subj === 'التربية الإسلامية');
  // الرياضيات — وثيقة تقويم الرياضيات (سبتمبر 2026): مفردة إجابة طويلة واحدة في كل
  // اختبار قصير، بثلاث درجات للصفوف 7-10 وبأربع درجات للصفين 11-12، وبلا إجابة
  // طويلة في الصفين 5-6. فلا بد من تمرير درجاتها هنا وإلا سقطت من البنك.
  const isM = /رياض/.test(subj);
  const g = FG[grade] || 0, hi = g >= 11 && !ARAO, smax = hi ? 3 : 2,
        lr = isM ? (g >= 11 ? [4] : (g >= 7 ? [3] : []))
                 : (hi ? [4, 5] : (g >= 9 ? [3, 4] : []));
  const out = [];
  for (const q of G.q) {
    const m = q.m, ao = normAO(q.ao, hi, m);
    if (!ao || !q.l || typeof m !== 'number' || m !== Math.floor(m)) continue;
    let type;
    if (q.t === 'mcq') { if (m !== 1) continue; type = 'mcq'; }
    else if (m <= smax) type = 'short';
    else if (lr.includes(m) && ao !== 'معرفة' && ao !== 'AO1') type = 'long';
    else continue;
    const pa = G.papers[q.p] || {};
    out.push({ qid: 'f' + q.id, lesson_id: q.l, type, stem: stripQNo(q.x), img: q.im, iw: q.w, ih: q.h, srcno: String(q.n || ''), src: 'امتحان الوزارة ' + (pa.year || '') + (pa.session ? ' - ' + pa.session : ''),
      answer: q.a || '', choices: [], marks: m, ao, difficulty: '', outcome: q.c || '', notes: '' });
  }
  return out;
}
const BUILD = __BUILD__;
LESSONS.forEach(l => { if (!l.subject) l.subject = l.grade === 'الخامس' ? 'العلوم' : 'الأحياء'; if (!l.term) l.term = 1; });
const LESSON_IDS = new Set(LESSONS.map(l => l.id));
const courseKey = l => (l.subject || '') + '|' + (l.grade || '');
const CUSTOM_BASE = 100000;
const MANIFEST = JSON.stringify({ name: 'الكبسولة', short_name: 'الكبسولة', lang: 'ar', dir: 'rtl', start_url: '/', scope: '/', display: 'standalone', background_color: '#f6f4ee', theme_color: '#f6f4ee',
  icons: [{ src: '/icon-192.png', sizes: '192x192', type: 'image/png' }, { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }] });

const SESSION_DAYS = 30;
const MAX_FAILS = 5;
const LOCK_MIN = 15;
const PBKDF2_ITER = 100000;
// جهاز لم يُستخدم هذه المدة يُعدّ مهجورًا، فيُستبدل تلقائيًا عند اكتمال الحد
// (تغيّر جهاز أو متصفح، أو مُسحت بيانات المتصفح) فلا يبقى المعلم محجوبًا.
// قابلة للضبط من بيئة الـWorker (STALE_SECONDS) لتسهيل الاختبار المحلي.
const STALE_DAYS = 30;
function staleSeconds(env) {
  const v = env && env.STALE_SECONDS ? parseInt(env.STALE_SECONDS, 10) : NaN;
  return Number.isFinite(v) && v >= 0 ? v : STALE_DAYS * 86400;
}
const LESSON_FIELDS = ['title','unit_name','hw_type','weekly','hw_q1','hw_a1','hw_q2','hw_a2','concepts','pre_learning','outcomes','strategies','activities_teach','resources','formative','enrich','closing','homework','misconceptions'];
// أنواع الأحداث المقبولة في /api/event. أي نوع غير مذكور هنا يُرفض، فيضيع الحدث بصمت.
// عند إضافة track() جديد في client_*.js أضف نوعه هنا وأضف تسميته العربية في TYPES داخل client_admin.js.
const EVENT_TYPES = new Set([
  // التحضير والدروس
  'view', 'copy_all', 'copy_json', 'copy_field', 'copy_hw', 'send_prep', 'send_hw',
  // الاختبارات القصيرة ومراجعات الوحدات
  'quiz_make', 'review_make', 'quiz_print', 'quiz_word', 'quiz_save',
  // الخطط العلاجية والملخصات
  'remedial_make', 'remedial_print', 'remedial_word', 'summary_make', 'summary_print', 'summary_word',
  // الألعاب التعليمية
  'game_play', 'game_live',
  // الاختبارات النهائية السابقة
  'finals_open', 'finals_print',
  // تصحيح الواجبات
  'grade_start', 'tasks_fetch'
]);

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, username TEXT NOT NULL UNIQUE, pass_hash TEXT NOT NULL, salt TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'teacher', active INTEGER NOT NULL DEFAULT 1, max_devices INTEGER NOT NULL DEFAULT 2, created_at INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS devices(id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, device_id TEXT NOT NULL, fp TEXT, label TEXT, ip TEXT, first_seen INTEGER NOT NULL, last_seen INTEGER NOT NULL, UNIQUE(user_id, device_id))`,
  `CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY, user_id INTEGER NOT NULL, device_id TEXT NOT NULL, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL, last_seen INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS events(id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, type TEXT NOT NULL, grade TEXT, lesson_id INTEGER, lesson_title TEXT, detail TEXT, device_id TEXT, ip TEXT, at INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS attempts(id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT, user_id INTEGER, ok INTEGER NOT NULL, reason TEXT, device_id TEXT, label TEXT, ip TEXT, at INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS lesson_overrides(lesson_id INTEGER PRIMARY KEY, data TEXT NOT NULL, updated_at INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS custom_lessons(id INTEGER PRIMARY KEY, data TEXT NOT NULL, updated_at INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS courses(key TEXT PRIMARY KEY, subject TEXT NOT NULL, grade TEXT NOT NULL, created_at INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS quizzes(id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, title TEXT NOT NULL, grade TEXT, subject TEXT, kind TEXT, data TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS qz_user ON quizzes(user_id, updated_at)`,
  `CREATE TABLE IF NOT EXISTS rooms(code TEXT PRIMARY KEY, owner INTEGER NOT NULL, title TEXT, grade TEXT, data TEXT NOT NULL, state TEXT NOT NULL, qi INTEGER NOT NULL DEFAULT -1, q_started INTEGER, dur INTEGER NOT NULL DEFAULT 20, created_at INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS players(id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT NOT NULL, name TEXT NOT NULL, token TEXT NOT NULL, score INTEGER NOT NULL DEFAULT 0, ans_qi INTEGER NOT NULL DEFAULT -1, ans_choice INTEGER, ans_ok INTEGER, ans_pts INTEGER, ans_at INTEGER, joined_at INTEGER NOT NULL, UNIQUE(code, name))`,
  `CREATE INDEX IF NOT EXISTS pl_code ON players(code)`,
  `CREATE TABLE IF NOT EXISTS nour_tasks(user_id INTEGER PRIMARY KEY, data TEXT NOT NULL, updated_at INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS exports(id TEXT PRIMARY KEY, user_id INTEGER NOT NULL, name TEXT, format TEXT, body TEXT NOT NULL, created_at INTEGER NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS ev_user ON events(user_id, type)`,
  `CREATE INDEX IF NOT EXISTS ev_at ON events(at)`,
  `CREATE INDEX IF NOT EXISTS at_user ON attempts(username, at)`
];
let schemaReady = false;
async function ensureSchema(db) {
  if (schemaReady) return;
  await db.batch(SCHEMA.map(s => db.prepare(s)));
  try { await db.prepare('ALTER TABLE users ADD COLUMN scope TEXT').run(); } catch (e) { /* already there */ }
  schemaReady = true;
}

// ---------- helpers ----------
const now = () => Date.now();
const enc = new TextEncoder();
function hex(buf) { return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join(''); }
function rand(n = 32) { const a = new Uint8Array(n); crypto.getRandomValues(a); return hex(a); }
async function hashPass(pw, saltHex) {
  const key = await crypto.subtle.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveBits']);
  const salt = new Uint8Array(saltHex.match(/../g).map(h => parseInt(h, 16)));
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: PBKDF2_ITER }, key, 256);
  return hex(bits);
}
function safeEq(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
function cookies(req) {
  const out = {}; (req.headers.get('Cookie') || '').split(';').forEach(p => {
    const i = p.indexOf('='); if (i > 0) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
  });
  return out;
}
function setCookie(name, val, maxAgeSec) {
  return `${name}=${encodeURIComponent(val)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAgeSec}`;
}
function ipOf(req) { return req.headers.get('CF-Connecting-IP') || req.headers.get('X-Forwarded-For') || ''; }
// مدة مختصرة بالعربية لعرضها في رسائل الأجهزة
function ago(t) {
  if (!t) return 'غير معروف';
  const s = (now() - t) / 1000;
  if (s < 120) return 'قبل لحظات';
  if (s < 3600) return 'قبل ' + Math.floor(s / 60) + ' دقيقة';
  if (s < 86400) return 'قبل ' + Math.floor(s / 3600) + ' ساعة';
  const d = Math.floor(s / 86400);
  if (d === 1) return 'أمس';
  if (d < 30) return 'قبل ' + d + ' يومًا';
  return 'قبل ' + Math.floor(d / 30) + ' شهر';
}
function deviceLabel(ua) {
  ua = ua || '';
  const os = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad' : /Android/.test(ua) ? 'Android' : /Windows/.test(ua) ? 'Windows' : /Mac OS X/.test(ua) ? 'Mac' : /Linux/.test(ua) ? 'Linux' : 'جهاز';
  const br = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /SamsungBrowser/.test(ua) ? 'Samsung' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'متصفح';
  return os + ' · ' + br;
}
const SEC_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'X-Frame-Options': 'DENY',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Strict-Transport-Security': 'max-age=31536000'
};
function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...SEC_HEADERS, ...extra } });
}
function html(name, extra = {}) {
  const nonce = rand(16);
  const body = PAGES[name].replace(/%NONCE%/g, nonce).replace('%CSS%', () => PAGES.css);
  const csp = `default-src 'self'; script-src 'nonce-${nonce}'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'`;
  return new Response(body, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Content-Security-Policy': csp, ...SEC_HEADERS, ...extra } });
}
function redirect(to, extra = {}) { return new Response(null, { status: 302, headers: { Location: to, ...SEC_HEADERS, ...extra } }); }
async function body(req) {
  const t = await req.text();
  if (t.length > 2_000_000) throw new Error('too_large');
  try { return JSON.parse(t || '{}'); } catch { return {}; }
}
function sameOrigin(req) {
  const o = req.headers.get('Origin');
  if (!o) return true; // sendBeacon from same page may omit it in some browsers; cookies are SameSite=Strict
  try { return new URL(o).host === new URL(req.url).host; } catch { return false; }
}
function cleanUser(u) { return String(u || '').trim().toLowerCase().slice(0, 60); }

// ---------- auth ----------
async function currentUser(req, env) {
  const c = cookies(req);
  // الجلسة تُقرأ من الكوكي أولًا، ثم من ترويسة X-Tahdir-Sid. بعض المتصفحات
  // (المدمجة في واتساب/إنستقرام، أو مع حجب كوكيز الطرف الأول) ترفض كوكي الجلسة
  // فيعود المعلم لصفحة الدخول بعد كل محاولة ويُسجَّل جهاز جديد كل مرة.
  const sid = c.sid || String(req.headers.get('X-Tahdir-Sid') || '').trim();
  if (!sid) return null;
  const row = await env.DB.prepare(
    `SELECT s.token, s.device_id, s.expires_at, s.last_seen, u.id, u.name, u.username, u.role, u.active, u.scope
     FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?`).bind(sid).first();
  if (!row || row.expires_at < now() || !row.active) return null;
  // device must still be registered (admin may have removed it)
  if (row.role !== 'admin') {
    const d = await env.DB.prepare('SELECT id FROM devices WHERE user_id = ? AND device_id = ?').bind(row.id, row.device_id).first();
    if (!d) { await env.DB.prepare('DELETE FROM sessions WHERE token = ?').bind(c.sid).run(); return null; }
  }
  if (now() - (row.last_seen || 0) > 5 * 60 * 1000) {
    await env.DB.batch([
      env.DB.prepare('UPDATE sessions SET last_seen = ? WHERE token = ?').bind(now(), c.sid),
      env.DB.prepare('UPDATE devices SET last_seen = ? WHERE user_id = ? AND device_id = ?').bind(now(), row.id, row.device_id)
    ]);
  }
  return row;
}

async function login(req, env) {
  const b = await body(req);
  const username = cleanUser(b.username), password = String(b.password || '');
  const fp = String(b.fp || '').slice(0, 64);
  const ua = req.headers.get('User-Agent') || '';
  const label = deviceLabel(ua) + (b.screen ? ' · ' + String(b.screen).slice(0, 15) : '');
  const ip = ipOf(req);
  const c = cookies(req);
  // معرّف الجهاز من الكوكي، وإلا من ترويسة X-Tahdir-Did (متصفح بلا كوكيز).
  const hDid = String(req.headers.get('X-Tahdir-Did') || '').trim();
  let did = /^[a-f0-9]{48}$/.test(c.did || '') ? c.did : (/^[a-f0-9]{48}$/.test(hDid) ? hDid : null);
  const t = now();
  const logA = (ok, reason, uid) => env.DB.prepare('INSERT INTO attempts(username,user_id,ok,reason,device_id,label,ip,at) VALUES(?,?,?,?,?,?,?,?)').bind(username, uid || null, ok ? 1 : 0, reason, did || '', label, ip, t).run();

  if (!username || !password) return json({ error: 'اكتب اسم المستخدم وكلمة المرور.' }, 400);
  const fails = await env.DB.prepare('SELECT COUNT(*) n FROM attempts WHERE username = ? AND ok = 0 AND reason = ? AND at > ?').bind(username, 'wrong_password', t - LOCK_MIN * 60000).first();
  if (fails && fails.n >= MAX_FAILS) { await logA(false, 'locked'); return json({ error: `محاولات كثيرة خاطئة. حاول بعد ${LOCK_MIN} دقيقة.` }, 429); }

  const u = await env.DB.prepare('SELECT * FROM users WHERE username = ?').bind(username).first();
  const ok = u ? safeEq(await hashPass(password, u.salt), u.pass_hash) : (await hashPass(password, '00'.repeat(16)), false);
  if (!u || !ok) { await logA(false, 'wrong_password', u && u.id); return json({ error: 'اسم المستخدم أو كلمة المرور غير صحيحة.' }, 401); }
  if (!u.active) { await logA(false, 'disabled', u.id); return json({ error: 'هذا الحساب موقوف. تواصل مع أ. محمد مجدي.' }, 403); }

  // ---- device check ----
  const devs = (await env.DB.prepare('SELECT * FROM devices WHERE user_id = ?').bind(u.id).all()).results || [];
  let dev = did ? devs.find(d => d.device_id === did) : null;
  if (!dev && fp) { dev = devs.find(d => d.fp === fp); if (dev) did = dev.device_id; }
  if (!did) did = rand(24);
  if (!dev && u.role !== 'admin' && devs.length >= u.max_devices) {
    // الحد مكتمل. لكن الجهاز القديم الذي لم يُستخدم منذ STALE_DAYS يومًا يكون مهجورًا
    // (تغيّر جهاز/متصفح، أو بيانات متصفح مُمحاة)، فلا نُعطّل المعلم بسببه:
    // نُزيل الأقدم المهمل وندخله. أما لو كان الجهازان مستعملين فعلًا فنمنع (حماية من مشاركة الحساب).
    const oldest = devs.slice().sort((a, b) => (a.last_seen || 0) - (b.last_seen || 0))[0];
    const stale = oldest && (t - (oldest.last_seen || 0)) > staleSeconds(env) * 1000;
    if (stale) {
      await env.DB.batch([
        env.DB.prepare('DELETE FROM sessions WHERE user_id = ? AND device_id = ?').bind(u.id, oldest.device_id),
        env.DB.prepare('DELETE FROM devices WHERE id = ?').bind(oldest.id),
        env.DB.prepare('INSERT INTO events(user_id,type,detail,device_id,ip,at) VALUES(?,?,?,?,?,?)').bind(u.id, 'device_stale_removed', String(oldest.label || '').slice(0, 40), did, ip, t)
      ]);
    } else {
      await logA(false, 'device_limit', u.id);
      const list = devs.slice().sort((a, b) => (b.last_seen || 0) - (a.last_seen || 0))
        .map(d => '• ' + (d.label || 'جهاز') + ' — آخر دخول ' + ago(d.last_seen)).join('\n');
      return json({
        error: `هذا الحساب مسجّل بالفعل على ${u.max_devices} أجهزة، وكلها مستعملة حديثًا. لا يمكن الدخول من جهاز جديد.\n\nأجهزتك المسجّلة:\n${list}\n\nإن كنت غيّرت جهازك، اطلب من أ. محمد مجدي «مسح الأجهزة» ثم ادخل مرة أخرى.`
      }, 403, { 'Set-Cookie': setCookie('did', did, 63072000) });
    }
  }
  if (!dev) {
    await env.DB.prepare('INSERT INTO devices(user_id,device_id,fp,label,ip,first_seen,last_seen) VALUES(?,?,?,?,?,?,?)').bind(u.id, did, fp, label, ip, t, t).run();
  } else {
    await env.DB.prepare('UPDATE devices SET last_seen = ?, ip = ?, label = ?, fp = COALESCE(NULLIF(?,\'\'), fp) WHERE id = ?').bind(t, ip, label, fp, dev.id).run();
  }

  const token = rand(32);
  await env.DB.batch([
    env.DB.prepare('INSERT INTO sessions(token,user_id,device_id,created_at,expires_at,last_seen) VALUES(?,?,?,?,?,?)').bind(token, u.id, did, t, t + SESSION_DAYS * 86400000, t),
    env.DB.prepare('INSERT INTO events(user_id,type,device_id,ip,at) VALUES(?,?,?,?,?)').bind(u.id, 'login', did, ip, t),
    env.DB.prepare('INSERT INTO attempts(username,user_id,ok,reason,device_id,label,ip,at) VALUES(?,?,?,?,?,?,?,?)').bind(username, u.id, 1, 'ok', did, label, ip, t),
    env.DB.prepare('DELETE FROM sessions WHERE expires_at < ?').bind(t)
  ]);
  const headers = new Headers({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...SEC_HEADERS });
  headers.append('Set-Cookie', setCookie('sid', token, SESSION_DAYS * 86400));
  headers.append('Set-Cookie', setCookie('did', did, 63072000));
  // نُعيد الرمز في الجسم أيضًا ليعمل المتصفح الذي يرفض الكوكيز (انظر currentUser).
  return new Response(JSON.stringify({ ok: true, role: u.role, name: u.name, sid: token, did }), { headers });
}

// ---------- lessons ----------
function scopeOf(me) {
  if (!me || me.role === 'admin' || !me.scope) return null;
  try { const a = JSON.parse(me.scope); return Array.isArray(a) && a.length ? new Set(a) : null; } catch { return null; }
}
async function customLessons(env) {
  const rows = (await env.DB.prepare('SELECT id, data FROM custom_lessons ORDER BY id').all()).results || [];
  const out = []; rows.forEach(r => { try { out.push({ ...JSON.parse(r.data), id: r.id, custom: true, ai_filled: [] }); } catch {} });
  return out;
}
async function allLessons(env) {
  const rows = (await env.DB.prepare('SELECT lesson_id, data FROM lesson_overrides').all()).results || [];
  const ov = {}; rows.forEach(r => { try { ov[r.lesson_id] = JSON.parse(r.data); } catch {} });
  const base = LESSONS.map(l => ov[l.id] ? { ...l, ...ov[l.id], ai_filled: (l.ai_filled || []).filter(k => !(k in ov[l.id])) } : l);
  return base.concat(await customLessons(env));
}
async function lessonsFor(env, me) {
  const all = await allLessons(env), sc = scopeOf(me);
  return sc ? all.filter(l => sc.has(courseKey(l))) : all;
}
async function coursesList(env) {
  const all = await allLessons(env), m = new Map();
  all.forEach(l => { const k = courseKey(l); const c = m.get(k) || { key: k, subject: l.subject, grade: l.grade, lessons: 0, custom: 0, quiz_items: 0 }; c.lessons++; if (l.custom) c.custom++; m.set(k, c); });
  const extra = (await env.DB.prepare('SELECT key, subject, grade FROM courses').all()).results || [];
  extra.forEach(c => { if (!m.has(c.key)) m.set(c.key, { key: c.key, subject: c.subject, grade: c.grade, lessons: 0, custom: 0, quiz_items: 0, empty: true }); });
  const byLesson = new Map(all.map(l => [l.id, courseKey(l)]));
  QBANK.forEach(q => { const k = byLesson.get(q.lesson_id); if (k && m.get(k)) m.get(k).quiz_items++; });
  return [...m.values()];
}

// ---------- admin ----------
async function adminStats(env) {
  const DB = env.DB;
  const users = (await DB.prepare("SELECT id,name,username,role,active,max_devices,created_at,scope FROM users ORDER BY role='admin' DESC, name").all()).results || [];
  const agg = (await DB.prepare(`SELECT user_id,
      SUM(type='login') logins,
      SUM(type LIKE 'copy%') copies,
      COUNT(DISTINCT CASE WHEN type LIKE 'copy%' THEN lesson_id END) lessons_copied,
      COUNT(DISTINCT CASE WHEN type='view' THEN lesson_id END) lessons_viewed,
      MAX(CASE WHEN type='login' THEN at END) last_login,
      MAX(at) last_active
    FROM events GROUP BY user_id`).all()).results || [];
  const grades = (await DB.prepare("SELECT user_id, grade, COUNT(*) n FROM events WHERE grade IS NOT NULL AND grade<>'' GROUP BY user_id, grade").all()).results || [];
  const devs = (await DB.prepare('SELECT id,user_id,device_id,label,ip,first_seen,last_seen FROM devices ORDER BY last_seen DESC').all()).results || [];
  const blocked = (await DB.prepare("SELECT user_id, COUNT(*) n, MAX(at) last FROM attempts WHERE reason='device_limit' GROUP BY user_id").all()).results || [];
  const top = (await DB.prepare("SELECT user_id, lesson_title, grade, COUNT(*) n FROM events WHERE type LIKE 'copy%' GROUP BY user_id, lesson_id ORDER BY n DESC").all()).results || [];
  const weekAgo = now() - 7 * 86400000;
  const active7 = await DB.prepare("SELECT COUNT(DISTINCT user_id) n FROM events WHERE at > ?").bind(weekAgo).first();
  const totals = await DB.prepare("SELECT SUM(type='login') logins, SUM(type LIKE 'copy%') copies FROM events").first();
  const by = (arr, k = 'user_id') => arr.reduce((m, r) => ((m[r[k]] = m[r[k]] || []).push(r), m), {});
  const A = Object.fromEntries(agg.map(r => [r.user_id, r])), G = by(grades), D = by(devs), B = Object.fromEntries(blocked.map(r => [r.user_id, r])), T = by(top);
  return {
    totals: { teachers: users.filter(u => u.role === 'teacher').length, active7: active7 ? active7.n : 0, logins: (totals && totals.logins) || 0, copies: (totals && totals.copies) || 0 },
    users: users.map(u => ({
      ...u,
      logins: (A[u.id] && A[u.id].logins) || 0,
      copies: (A[u.id] && A[u.id].copies) || 0,
      lessons_copied: (A[u.id] && A[u.id].lessons_copied) || 0,
      lessons_viewed: (A[u.id] && A[u.id].lessons_viewed) || 0,
      last_login: A[u.id] && A[u.id].last_login, last_active: A[u.id] && A[u.id].last_active,
      grades: (G[u.id] || []).map(g => ({ grade: g.grade, n: g.n })),
      devices: (D[u.id] || []).map(d => ({ id: d.id, label: d.label, ip: d.ip, first_seen: d.first_seen, last_seen: d.last_seen })),
      blocked: B[u.id] ? { n: B[u.id].n, last: B[u.id].last } : null,
      top: (T[u.id] || []).slice(0, 5).map(t => ({ title: t.lesson_title, grade: t.grade, n: t.n }))
    }))
  };
}
const PREP_T = "('send_prep','copy_json','copy_all')", HW_T = "('send_hw','copy_hw')";
async function adminReport(env, days) {
  const DB = env.DB, since = days > 0 ? now() - days * 86400000 : 0;
  const users = (await DB.prepare("SELECT id,name,username,role,active,scope FROM users ORDER BY role='admin' DESC, name").all()).results || [];
  const agg = (await DB.prepare(`SELECT user_id,
      SUM(type='login') logins,
      SUM(type IN ${PREP_T}) preps,
      COUNT(DISTINCT CASE WHEN type IN ${PREP_T} THEN lesson_id END) prep_lessons,
      SUM(type IN ${HW_T}) hws,
      COUNT(DISTINCT CASE WHEN type IN ${HW_T} THEN lesson_id END) hw_lessons,
      SUM(type='quiz_make') quizzes, SUM(type='review_make') reviews, SUM(type IN ('quiz_print','quiz_word')) prints, SUM(type IN ('game_play','game_live')) games, SUM(type IN ('remedial_make','summary_make')) study,
      COUNT(DISTINCT CASE WHEN type='view' THEN lesson_id END) views,
      MAX(CASE WHEN type='login' THEN at END) last_login, MAX(at) last_active
    FROM events WHERE at > ? GROUP BY user_id`).bind(since).all()).results || [];
  const byGrade = (await DB.prepare(`SELECT grade,
      SUM(type IN ${PREP_T}) preps, SUM(type IN ${HW_T}) hws, SUM(type IN ('quiz_make','review_make')) quizzes
    FROM events WHERE at > ? AND grade IS NOT NULL AND grade<>'' GROUP BY grade`).bind(since).all()).results || [];
  const daily = (await DB.prepare(`SELECT CAST((at + 14400000) / 86400000 AS INTEGER) d, COUNT(DISTINCT user_id) users,
      SUM(type IN ${PREP_T}) preps, SUM(type IN ${HW_T}) hws, SUM(type IN ('quiz_make','review_make')) quizzes
    FROM events WHERE at > ? GROUP BY d ORDER BY d`).bind(Math.max(since, now() - 30 * 86400000)).all()).results || [];
  const A = Object.fromEntries(agg.map(r => [r.user_id, r])), z = { games: 0, study: 0, logins: 0, preps: 0, prep_lessons: 0, hws: 0, hw_lessons: 0, quizzes: 0, reviews: 0, prints: 0, views: 0, last_login: null, last_active: null };
  const rows = users.map(u => ({ id: u.id, name: u.name, username: u.username, role: u.role, active: u.active, scope: u.scope, ...z, ...(A[u.id] || {}) }));
  const sum = k => rows.reduce((t, r) => t + (+r[k] || 0), 0);
  return { days, rows, by_grade: byGrade, daily,
    totals: { active: rows.filter(r => r.last_active).length, logins: sum('logins'), preps: sum('preps'), hws: sum('hws'), quizzes: sum('quizzes') + sum('reviews') } };
}
async function adminActivity(env) {
  const ev = (await env.DB.prepare(`SELECT e.type,e.grade,e.lesson_title,e.at,e.ip,u.name,d.label FROM events e JOIN users u ON u.id=e.user_id
     LEFT JOIN devices d ON d.user_id=e.user_id AND d.device_id=e.device_id ORDER BY e.at DESC LIMIT 150`).all()).results || [];
  const at = (await env.DB.prepare(`SELECT a.username,a.reason,a.label,a.ip,a.at,u.name FROM attempts a LEFT JOIN users u ON u.id=a.user_id
     WHERE a.ok=0 ORDER BY a.at DESC LIMIT 100`).all()).results || [];
  return { events: ev, failed: at };
}
async function createUser(env, { name, username, password, role = 'teacher', max_devices = 2, scope = null }) {
  name = String(name || '').trim().slice(0, 80); username = cleanUser(username); password = String(password || '');
  if (!name || !/^[a-z0-9._@-]{3,60}$/.test(username)) throw new Error('اسم المستخدم يكون 3 أحرف إنجليزية أو أرقام على الأقل، بدون مسافات.');
  if (password.length < 6) throw new Error('كلمة المرور 6 أحرف على الأقل.');
  const salt = rand(16), h = await hashPass(password, salt);
  await env.DB.prepare('INSERT INTO users(name,username,pass_hash,salt,role,active,max_devices,created_at,scope) VALUES(?,?,?,?,?,1,?,?,?)').bind(name, username, h, salt, role, Math.max(1, Math.min(5, +max_devices || 2)), now(), Array.isArray(scope) && scope.length ? JSON.stringify(scope) : null).run();
}
function genPass() {
  const a = 'abcdefghjkmnpqrstuvwxyz23456789'; const r = new Uint8Array(8); crypto.getRandomValues(r);
  return [...r].map(x => a[x % a.length]).join('');
}

// ---------- exports (Word / print pages) ----------
// رابط غير قابل للتخمين وصالح 6 ساعات: يعمل في التطبيق والمتصفح الخارجي بدون تسجيل دخول
async function exportFile(req, env, id) {
  const r = await env.DB.prepare('SELECT * FROM exports WHERE id = ?').bind(id).first();
  if (!r || r.created_at < now() - 6 * 3600000) return new Response('انتهت صلاحية الرابط. ارجع للموقع واضغط الزر مرة أخرى.', { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  const ua = req.headers.get('User-Agent') || '', fname = encodeURIComponent(r.name + (r.format === 'doc' ? '.doc' : '.html'));
  const disp = (inline) => (inline ? 'inline' : 'attachment') + `; filename="${r.format === 'doc' ? 'tahdir.doc' : 'tahdir.html'}"; filename*=UTF-8''${fname}`;
  if (r.format === 'doc') return new Response('\ufeff' + r.body, { headers: { 'Content-Type': 'application/msword; charset=utf-8', 'Content-Disposition': disp(false), 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
  // صفحة الطباعة: داخل التطبيق نُرجعها كتحميل فيفتحها أندرويد في Chrome حيث تعمل الطباعة وحفظ PDF
  const nonce = rand(16), inApp = /TahdirApp/.test(ua);
  const page = '<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + r.name.replace(/</g, '') + '</title>' +
    '<style>body{margin:0;background:#e9eeec;font-family:"Simplified Arabic","Traditional Arabic",Tahoma,serif;color:#000}.bar{position:sticky;top:0;display:flex;gap:8px;justify-content:center;align-items:center;flex-wrap:wrap;padding:10px;background:#07493b;color:#fff;font-family:Tahoma,sans-serif;font-size:14px}.bar button{font:inherit;font-weight:bold;border:0;border-radius:10px;padding:10px 18px;background:#fff;color:#07493b;cursor:pointer}.pg{background:#fff;max-width:800px;margin:14px auto;padding:24px 28px;box-shadow:0 2px 10px rgba(0,0,0,.15);font-size:15px;line-height:1.7}.pg+.pg{page-break-before:always}.oval{display:inline-block;width:22px;height:13px;border:1.5px solid #555;border-radius:8px;vertical-align:middle}@media print{@page{size:A4;margin:0}body{background:#fff}.bar{display:none}.pg{box-shadow:none;margin:0;padding:0;max-width:none;font-size:14pt}.prw td{padding:0 12mm}.prsp{height:11mm}}.prw{width:100%;border-collapse:collapse}.prw td{padding:0;border:0}.prsp{height:0}.fin-pq{page-break-inside:avoid;margin:0 0 10px}.fin-pq img{max-width:100%}@media (max-width:600px){.pg{padding:14px 10px;margin:8px 4px;font-size:14px}}</style></head><body>' +
    '<div class="bar"><span>اضغط «طباعة» ثم اختر «حفظ بتنسيق PDF» أو الطابعة</span><button type="button" id="pr">🖨 طباعة / PDF</button></div><table class="prw"><thead><tr><td><div class="prsp"></div></td></tr></thead><tfoot><tr><td><div class="prsp"></div></td></tr></tfoot><tbody><tr><td>' + r.body + '</td></tr></tbody></table>' +
    `<script nonce="${nonce}">document.getElementById('pr').onclick=function(){window.print();};setTimeout(function(){try{window.print();}catch(e){}},700);</script></body></html>`;
  return new Response(page, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Content-Disposition': disp(!inApp), 'Cache-Control': 'no-store', 'Content-Security-Policy': `default-src 'none'; style-src 'unsafe-inline'; img-src data: https:; script-src 'nonce-${nonce}'`, 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' } });
}

// ---------- live phone challenge (Kahoot-style) ----------
const ROOM_TTL = 4 * 3600000;
async function roomOf(env, code) {
  const r = await env.DB.prepare('SELECT * FROM rooms WHERE code = ?').bind(String(code || '')).first();
  if (!r || r.created_at < now() - ROOM_TTL) return null;
  r.q = JSON.parse(r.data); return r;
}
function publicQ(q) { return { stem: q.stem, choices: q.choices, table: q.table || null }; }
async function playApi(req, env, p, m, url) {
  const DB = env.DB;
  if (p === '/api/play/join' && m === 'POST') {
    const b = await body(req), code = String(b.code || '').replace(/\D/g, '').slice(0, 6);
    const name = String(b.name || '').replace(/[<>]/g, '').trim().replace(/\s+/g, ' ').slice(0, 24);
    if (!name) return json({ error: 'اكتب اسمك.' }, 400);
    const r = await roomOf(env, code);
    if (!r || r.state === 'end') return json({ error: 'رمز التحدي غير صحيح أو انتهى التحدي.' }, 404);
    const n = await DB.prepare('SELECT COUNT(*) n FROM players WHERE code = ?').bind(code).first();
    if (n && n.n >= 80) return json({ error: 'اكتمل عدد اللاعبين.' }, 400);
    const token = rand(12);
    try { const row = await DB.prepare('INSERT INTO players(code,name,token,joined_at) VALUES(?,?,?,?) RETURNING id').bind(code, name, token, now()).first(); return json({ ok: true, pid: row.id, token, title: r.title }); }
    catch (e) { return json({ error: 'هذا الاسم مستخدم في التحدي. اكتب اسمًا آخر (مثلًا مع رقمك).' }, 400); }
  }
  if (p === '/api/play/state' || (p === '/api/play/answer' && m === 'POST')) {
    const b = m === 'POST' ? await body(req) : Object.fromEntries(url.searchParams);
    const r = await roomOf(env, b.code); if (!r) return json({ state: 'gone' });
    const pl = await DB.prepare('SELECT * FROM players WHERE id = ? AND code = ? AND token = ?').bind(+b.pid, r.code, String(b.t || '')).first();
    if (!pl) return json({ state: 'gone' });
    const t = now(), q = r.q[r.qi], dur = r.dur * 1000;
    if (p === '/api/play/answer') {
      if (r.state !== 'question' || +b.qi !== r.qi || pl.ans_qi === r.qi) return json({ ok: false });
      const el = t - r.q_started; if (el > dur + 1500) return json({ ok: false, late: true });
      const choice = +b.choice, ok = choice === q.correct ? 1 : 0, pts = ok ? Math.round(1000 - 500 * Math.min(1, el / dur)) : 0;
      await DB.prepare('UPDATE players SET ans_qi=?, ans_choice=?, ans_ok=?, ans_pts=?, ans_at=?, score=score+? WHERE id=?').bind(r.qi, choice, ok, pts, t, pts, pl.id).run();
      return json({ ok: true });
    }
    const out = { state: r.state, qi: r.qi, total: r.q.length, title: r.title, you: { name: pl.name, score: pl.score } };
    if (r.state === 'question') { out.q = publicQ(q); out.left = Math.max(0, dur - (t - r.q_started)); out.answered = pl.ans_qi === r.qi; out.choice = pl.ans_qi === r.qi ? pl.ans_choice : null; }
    if (r.state === 'reveal' || r.state === 'end') {
      if (r.state === 'reveal') { out.q = publicQ(q); out.correct = q.correct; out.mine = pl.ans_qi === r.qi ? { choice: pl.ans_choice, ok: !!pl.ans_ok, pts: pl.ans_pts } : null; }
      const rk = await DB.prepare('SELECT COUNT(*) n FROM players WHERE code = ? AND score > ?').bind(r.code, pl.score).first();
      out.rank = (rk ? rk.n : 0) + 1;
    }
    return json(out);
  }
  return null;
}
async function liveApi(req, env, me, p, m, url) {
  const DB = env.DB;
  if (p === '/api/live/create' && m === 'POST') {
    const b = await body(req);
    const items = (Array.isArray(b.items) ? b.items : []).filter(x => x && Array.isArray(x.choices) && x.choices.length >= 2 && x.correct >= 0 && x.correct < x.choices.length).slice(0, 40)
      .map(x => ({ stem: String(x.stem || '').slice(0, 1500), choices: x.choices.slice(0, 4).map(c => String(c).slice(0, 300)), correct: +x.correct, table: x.table || null }));
    if (!items.length) return json({ error: 'لا توجد أسئلة اختيار من متعدد.' }, 400);
    await DB.prepare('DELETE FROM rooms WHERE created_at < ?').bind(now() - ROOM_TTL).run();
    let code = '';
    for (let i = 0; i < 8; i++) { code = String(100000 + Math.floor(Math.random() * 900000)); if (!(await DB.prepare('SELECT code FROM rooms WHERE code = ?').bind(code).first())) break; }
    await DB.batch([DB.prepare('DELETE FROM players WHERE code = ?').bind(code),
      DB.prepare('INSERT OR REPLACE INTO rooms(code,owner,title,grade,data,state,qi,q_started,dur,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)').bind(code, me.id, String(b.title || 'تحدٍّ').slice(0, 120), String(b.grade || ''), JSON.stringify(items), 'lobby', -1, null, Math.max(10, Math.min(120, +b.dur || 20)), now())]);
    return json({ ok: true, code });
  }
  const r = await roomOf(env, (m === 'POST' ? (await req.clone().json().catch(() => ({}))).code : url.searchParams.get('code')));
  if (!r || (r.owner !== me.id && me.role !== 'admin')) return json({ error: 'التحدي غير موجود أو انتهت صلاحيته.' }, 404);
  if (p === '/api/live/state') {
    const pls = (await DB.prepare('SELECT name, score, ans_qi, ans_choice, ans_ok FROM players WHERE code = ? ORDER BY score DESC, joined_at').bind(r.code).all()).results || [];
    const dist = [0, 0, 0, 0]; let answered = 0;
    pls.forEach(x => { if (x.ans_qi === r.qi) { answered++; if (x.ans_choice >= 0 && x.ans_choice < 4) dist[x.ans_choice]++; } });
    const q = r.q[r.qi];
    return json({ state: r.state, qi: r.qi, total: r.q.length, dur: r.dur, left: r.state === 'question' ? Math.max(0, r.dur * 1000 - (now() - r.q_started)) : 0,
      q: q || null, players: pls.map(x => ({ name: x.name, score: x.score, ok: x.ans_qi === r.qi ? !!x.ans_ok : null })), answered, dist });
  }
  if (p === '/api/live/control' && m === 'POST') {
    const b = await body(req), a = b.action;
    if (a === 'next' || a === 'start') {
      const nq = r.qi + 1;
      if (nq >= r.q.length) await DB.prepare("UPDATE rooms SET state='end' WHERE code=?").bind(r.code).run();
      else await DB.prepare("UPDATE rooms SET state='question', qi=?, q_started=? WHERE code=?").bind(nq, now(), r.code).run();
    } else if (a === 'reveal') await DB.prepare("UPDATE rooms SET state='reveal' WHERE code=? AND state='question'").bind(r.code).run();
    else if (a === 'end') await DB.prepare("UPDATE rooms SET state='end' WHERE code=?").bind(r.code).run();
    else return json({ error: 'bad' }, 400);
    return json({ ok: true });
  }
  return json({ error: 'not found' }, 404);
}
async function gamesData(env, me, key) {
  const sc = scopeOf(me); if (sc && !sc.has(key)) return { error: 'غير مسموح.' };
  const ls = (await allLessons(env)).filter(l => courseKey(l) === key);
  const ids = new Set(ls.map(l => l.id));
  // مفردات الألعاب من البنك المثبّت **ومن مفردات امتحانات الوزارة** معًا — وإلا
  // خلت موادّ بلا بنك مثبّت (الرياضيات) من أي لعبة، مع أن نهائياتها مستخرجة
  // ومربوطة بالدروس والأهداف وبنكها يعمل في صفحة التقويم.
  const items = QBANK.filter(q => ids.has(q.lesson_id)).map(q => ({ ...q, src: 'bank' }))
    .concat(finQuizItems(key).filter(q => ids.has(q.lesson_id)).map(q => ({ ...q, src: 'fin' })));
  let k = 0;
  ls.forEach(l => { if (l.hw_type !== 'mcq') return; [1, 2].forEach(n => {
    const c = String(l['hw_a' + n] || '').split('\n').map(x => x.trim()).filter(Boolean); if (!l['hw_q' + n] || c.length < 2) return;
    items.push({ qid: 900000 + (k++), lesson_id: l.id, type: 'mcq', stem: String(l['hw_q' + n]).replace(/^Choose the correct answer:\s*/i, ''), choices: c.slice(0, 4), correct: 0, marks: 1, ao: '', difficulty: 'منخفضة', src: 'hw' }); }); });
  const pack = {}; ls.forEach(l => { if (GPACK[l.id]) pack[l.id] = GPACK[l.id]; });
  return { lessons: ls.map(l => ({ id: l.id, unit: l.unit, unit_name: l.unit_name, title: l.title, concepts: l.concepts || '', subject: l.subject, grade: l.grade })), items, pack };
}

// ---------- router ----------
export default {
  async fetch(req, env) {
    try {
      if (!env.DB) return new Response('اربط قاعدة بيانات D1 بالاسم DB من إعدادات الـ Worker.', { status: 500, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
      await ensureSchema(env.DB);
      const url = new URL(req.url), p = url.pathname, m = req.method;
      if (p.startsWith('/api/') && /^\/api\/(study|games|finals|quiz|live)/.test(p)) await loadPacks(env, url);
      if (m !== 'GET' && m !== 'HEAD' && !sameOrigin(req)) return json({ error: 'forbidden' }, 403);

      let mm0;
      const adminCount = async () => ((await env.DB.prepare("SELECT COUNT(*) n FROM users WHERE role='admin'").first()) || {}).n || 0;

      if (p === '/tool/tahdir-noor.user.js' || p === '/tool/tahdir-noor.meta.js') return new Response(TOOL, { headers: { 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' } });
      if (p === '/privacy' || p === '/support') return new Response(PRIVACY, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=3600', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'", ...SEC_HEADERS } });
      if (p === '/download/tahdir.apk') return new Response(Uint8Array.from(atob(APK), c => c.charCodeAt(0)), { headers: { 'Content-Type': 'application/vnd.android.package-archive', 'Content-Disposition': 'attachment; filename="tahdir.apk"', 'Cache-Control': 'no-cache' } });
      if (ICONS[p]) return new Response(Uint8Array.from(atob(ICONS[p]), c => c.charCodeAt(0)), { headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=604800' } });
      if (p === '/manifest.webmanifest') return new Response(MANIFEST, { headers: { 'Content-Type': 'application/manifest+json; charset=utf-8', 'Cache-Control': 'public, max-age=86400' } });
      if (p === '/version') { let packs = false; try { packs = await loadPacks(env, url); } catch (e) { packs = String(e.message || e); } return json({ ...BUILD, packs }); }
      if ((mm0 = p.match(/^\/x\/([a-f0-9]{40})$/))) return exportFile(req, env, mm0[1]);
      if (p === '/robots.txt') return new Response('User-agent: *\nDisallow: /', { headers: { 'Content-Type': 'text/plain' } });
      if (p === '/setup') return (await adminCount()) ? redirect('/') : html('setup');
      if (p === '/api/setup' && m === 'POST') {
        if (await adminCount()) return json({ error: 'تم إنشاء حساب المدير من قبل.' }, 403);
        const b = await body(req);
        try { await createUser(env, { ...b, role: 'admin' }); } catch (e) { return json({ error: e.message }, 400); }
        return json({ ok: true });
      }
      if (p === '/api/login' && m === 'POST') return login(req, env);
      if (p === '/play') return html('play');
      if (p.startsWith('/api/play/')) { const r = await playApi(req, env, p, m, url); if (r) return r; }

      const me = await currentUser(req, env);
      if (p === '/api/logout' && m === 'POST') {
        const c = cookies(req); if (c.sid) await env.DB.prepare('DELETE FROM sessions WHERE token = ?').bind(c.sid).run();
        const cs = cookies(req), tk = cs.sid || String(req.headers.get('X-Tahdir-Sid') || '').trim();
        if (tk) { try { await env.DB.prepare('DELETE FROM sessions WHERE token = ?').bind(tk).run(); } catch (e) {} }
        return json({ ok: true }, 200, { 'Set-Cookie': setCookie('sid', '', 0) });
      }
      if (p === '/') {
        if (!(await adminCount())) return redirect('/setup');
        return me ? redirect(me.role === 'admin' ? '/admin' : '/app') : html('login');
      }
      if (!me) return p.startsWith('/api/') ? json({ error: 'سجّل الدخول أولًا.' }, 401) : redirect('/');

      if (p === '/app') return html('app');
      if (p === '/api/me') {
        // «first»: أول دخول لهذا الحساب — يُستخدم لإظهار دليل الاستخدام مرة واحدة
        // لمن يدخل أول مرة فقط. معلم له زيارات سابقة (أحداث دخول أكثر من واحد)
        // لا يظهر له الدليل تلقائيًّا، ولو كان قد مسح تخزين المتصفح.
        let lg = 0;
        try {
          const r = await env.DB.prepare("SELECT COUNT(*) n FROM events WHERE user_id = ? AND type = 'login'").bind(me.id).first();
          lg = (r && r.n) || 0;
        } catch (e) { lg = 0; }
        return json({ name: me.name, username: me.username, role: me.role, first: lg <= 1 });
      }
      if (p === '/quiz') return html('quiz');
      if (p === '/games') return html('games');
      if (p === '/grading') return html('grading');
      if (p === '/api/nour/tasks') {
        if (m === 'POST') {
          const b = await body(req), data = JSON.stringify(b.tasks || {});
          if (data.length > 300000) return json({ error: 'كبير جدًا' }, 400);
          await env.DB.prepare('INSERT INTO nour_tasks(user_id,data,updated_at) VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET data=excluded.data, updated_at=excluded.updated_at').bind(me.id, data, now()).run();
          return json({ ok: true });
        }
        const r = await env.DB.prepare('SELECT data, updated_at FROM nour_tasks WHERE user_id = ?').bind(me.id).first();
        return json({ tasks: r ? JSON.parse(r.data) : {}, updated_at: r ? r.updated_at : null });
      }
      if (p === '/remedial') return html('remedial');
      if (p === '/summaries') return html('summaries');
      if (p === '/finals') return html('finals');
      if (p === '/api/finals') {
        const key = url.searchParams.get('key') || '', sc = scopeOf(me);
        if (sc && !sc.has(key)) return json({ error: 'غير مسموح.' }, 403);
        const G = FINALS[key]; if (!G) return json({ error: 'لا توجد اختبارات لهذا الصف.' }, 404);
        const lessons = {}; (await allLessons(env)).filter(l => courseKey(l) === key).forEach(l => { lessons[l.id] = { title: l.title, unit: l.unit }; });
        return json({ ...G, lessons });
      }
      if (p === '/api/study') {
        const key = url.searchParams.get('key') || '', sc = scopeOf(me);
        if (sc && !sc.has(key)) return json({ error: 'غير مسموح.' }, 403);
        const ls = (await allLessons(env)).filter(l => courseKey(l) === key);
        const study = {}, units = {};
        ls.forEach(l => { if (STUDY.lessons[l.id]) study[l.id] = STUDY.lessons[l.id]; const u = STUDY.units[key + '|' + l.unit]; if (u) units[l.unit] = u; });
        return json({ lessons: ls.map(l => ({ id: l.id, unit: l.unit, unit_name: l.unit_name, title: l.title, subject: l.subject, grade: l.grade, outcomes: l.outcomes || '', concepts: l.concepts || '' })), study, units, hard: hardItems(key, ls) });
      }
      if (p === '/api/games/data') { const d = await gamesData(env, me, url.searchParams.get('key') || ''); return d.error ? json(d, 403) : json(d); }
      if (p.startsWith('/api/live/')) return liveApi(req, env, me, p, m, url);
      if (p === '/api/lessons') return json({ lessons: await lessonsFor(env, me) });
      if (p === '/api/courses') { const sc = scopeOf(me); return json({ courses: (await coursesList(env)).filter(c => !sc || sc.has(c.key)) }); }
      if (p === '/api/quiz/bank') {
        const key = url.searchParams.get('key') || '', sc = scopeOf(me);
        if (sc && !sc.has(key)) return json({ error: 'غير مسموح.' }, 403);
        const ls = (await allLessons(env)).filter(l => courseKey(l) === key);
        const ids = new Set(ls.map(l => l.id));
        return json({ lessons: ls.map(l => ({ id: l.id, unit: l.unit, unit_name: l.unit_name, title: l.title, subject: l.subject, grade: l.grade, term: l.term || 1 })), items: itBank(key, QBANK.filter(q => ids.has(q.lesson_id)).concat(finQuizItems(key).filter(q => ids.has(q.lesson_id)))) });
      }
      if (p === '/api/export' && m === 'POST') {
        const b = await body(req), id = rand(20), fmt = b.format === 'print' ? 'print' : 'doc';
        const name = String(b.name || 'الكبسولة').replace(/[\\/:*?"<>|\r\n]+/g, '-').slice(0, 100);
        await env.DB.batch([
          env.DB.prepare('DELETE FROM exports WHERE created_at < ?').bind(now() - 86400000),
          env.DB.prepare('INSERT INTO exports(id,user_id,name,format,body,created_at) VALUES(?,?,?,?,?,?)').bind(id, me.id, name, fmt, String(b.html || '').slice(0, 1900000), now())
        ]);
        return json({ ok: true, url: '/x/' + id });
      }
      if (p === '/api/quizzes' && m === 'GET') {
        const kinds = (url.searchParams.get('kind') || '').split(',').filter(Boolean);
        let r = (await env.DB.prepare('SELECT id,title,grade,subject,kind,created_at,updated_at FROM quizzes WHERE user_id = ? ORDER BY updated_at DESC LIMIT 400').bind(me.id).all()).results || [];
        if (kinds.length) r = r.filter(q => kinds.includes(q.kind || 'quiz'));
        return json({ quizzes: r.slice(0, 200) });
      }
      if (p === '/api/quizzes' && m === 'POST') {
        const b = await body(req), t = now();
        const title = String(b.title || 'اختبار').trim().slice(0, 160), data = JSON.stringify(b.data || {});
        if (data.length > 400000) return json({ error: 'الاختبار كبير جدًا.' }, 400);
        if (b.id) {
          const r = await env.DB.prepare('UPDATE quizzes SET title=?, grade=?, subject=?, kind=?, data=?, updated_at=? WHERE id=? AND user_id=?').bind(title, String(b.grade || ''), String(b.subject || ''), String(b.kind || ''), data, t, +b.id, me.id).run();
          if (r.meta && r.meta.changes) return json({ ok: true, id: +b.id });
        }
        const n = await env.DB.prepare('SELECT COUNT(*) n FROM quizzes WHERE user_id = ?').bind(me.id).first();
        if (n && n.n >= 400) return json({ error: 'وصلت إلى الحد الأقصى للملفات المحفوظة. احذف بعضها أولًا.' }, 400);
        const r = await env.DB.prepare('INSERT INTO quizzes(user_id,title,grade,subject,kind,data,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?) RETURNING id').bind(me.id, title, String(b.grade || ''), String(b.subject || ''), String(b.kind || ''), data, t, t).first();
        return json({ ok: true, id: r && r.id });
      }
      if ((mm0 = p.match(/^\/api\/quizzes\/(\d+)$/))) {
        const id = +mm0[1];
        if (m === 'DELETE') { await env.DB.prepare('DELETE FROM quizzes WHERE id = ? AND user_id = ?').bind(id, me.id).run(); return json({ ok: true }); }
        const r = await env.DB.prepare('SELECT * FROM quizzes WHERE id = ? AND user_id = ?').bind(id, me.id).first();
        if (!r) return json({ error: 'غير موجود' }, 404);
        return json({ quiz: { ...r, data: JSON.parse(r.data) } });
      }
      if (p === '/api/event' && m === 'POST') {
        const b = await body(req);
        const type = EVENT_TYPES.has(b.type) ? b.type : null;
        if (!type) return json({ error: 'bad' }, 400);
        let l = LESSONS.find(x => x.id === +b.lesson_id);
        if (!l && +b.lesson_id >= CUSTOM_BASE) { const r = await env.DB.prepare('SELECT data FROM custom_lessons WHERE id = ?').bind(+b.lesson_id).first(); if (r) { try { l = { ...JSON.parse(r.data), id: +b.lesson_id }; } catch {} } }
        const grade = l ? l.grade : String(b.grade || '').slice(0, 30) || null;
        await env.DB.prepare('INSERT INTO events(user_id,type,grade,lesson_id,lesson_title,detail,device_id,ip,at) VALUES(?,?,?,?,?,?,?,?,?)')
          .bind(me.id, type, grade, l ? l.id : null, l ? l.title : (b.title ? String(b.title).slice(0, 120) : null), String(b.detail || '').slice(0, 40), me.device_id, ipOf(req), now()).run();
        return json({ ok: true });
      }

      // ----- admin only -----
      if (me.role !== 'admin') return p.startsWith('/api/') ? json({ error: 'غير مسموح.' }, 403) : redirect('/app');
      if (p === '/admin') return html('admin');
      if (p === '/api/admin/stats') return json(await adminStats(env));
      if (p === '/api/admin/activity') return json(await adminActivity(env));
      if (p === '/api/admin/report') return json(await adminReport(env, Math.max(0, Math.min(3650, +url.searchParams.get('days') || 0))));
      if (p === '/api/admin/courses' && m === 'GET') return json({ courses: await coursesList(env), build: BUILD });
      if (p === '/api/admin/courses' && m === 'POST') {
        const b = await body(req), subject = String(b.subject || '').trim().slice(0, 40), grade = String(b.grade || '').trim().slice(0, 30);
        if (!subject || !grade) return json({ error: 'اكتب المادة والصف.' }, 400);
        await env.DB.prepare('INSERT OR IGNORE INTO courses(key,subject,grade,created_at) VALUES(?,?,?,?)').bind(subject + '|' + grade, subject, grade, now()).run();
        return json({ ok: true, key: subject + '|' + grade });
      }
      if (p === '/api/admin/courses' && m === 'DELETE') {
        const key = url.searchParams.get('key') || '';
        const used = (await customLessons(env)).some(l => courseKey(l) === key) || LESSONS.some(l => courseKey(l) === key);
        if (used) return json({ error: 'احذف دروس هذا الصف أولًا.' }, 400);
        await env.DB.prepare('DELETE FROM courses WHERE key = ?').bind(key).run();
        return json({ ok: true });
      }
      if (p === '/api/admin/custom_lessons' && m === 'POST') {
        const b = await body(req);
        const subject = String(b.subject || '').trim().slice(0, 40), grade = String(b.grade || '').trim().slice(0, 30), title = String(b.title || '').trim().slice(0, 200);
        if (!subject || !grade || !title) return json({ error: 'المادة والصف وعنوان الدرس مطلوبة.' }, 400);
        const data = { subject, grade, title, unit: String(+b.unit || 1), unit_name: String(b.unit_name || '').slice(0, 200), lesson_no: Math.max(0, +b.lesson_no || 0), term: +b.term === 2 ? 2 : 1, hw_type: b.hw_type === 'mcq' ? 'mcq' : 'essay' };
        for (const k of LESSON_FIELDS) if (!(k in data) && typeof b[k] === 'string') data[k] = b[k].slice(0, 20000);
        let id = +b.id || 0;
        if (id) { if (id < CUSTOM_BASE) return json({ error: 'bad id' }, 400); }
        else { const mx = await env.DB.prepare('SELECT MAX(id) m FROM custom_lessons').first(); id = Math.max(CUSTOM_BASE, ((mx && mx.m) || 0) + 1); }
        await env.DB.batch([
          env.DB.prepare('INSERT INTO custom_lessons(id,data,updated_at) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data, updated_at=excluded.updated_at').bind(id, JSON.stringify(data), now()),
          env.DB.prepare('INSERT OR IGNORE INTO courses(key,subject,grade,created_at) VALUES(?,?,?,?)').bind(subject + '|' + grade, subject, grade, now())
        ]);
        return json({ ok: true, id });
      }
      if ((mm0 = p.match(/^\/api\/admin\/custom_lessons\/(\d+)$/)) && m === 'DELETE') {
        await env.DB.prepare('DELETE FROM custom_lessons WHERE id = ?').bind(+mm0[1]).run();
        return json({ ok: true });
      }
      if (p === '/api/admin/teachers' && m === 'POST') {
        const b = await body(req);
        try { await createUser(env, b); } catch (e) { return json({ error: /UNIQUE/i.test(e.message) ? 'اسم المستخدم مستخدم من قبل.' : e.message }, 400); }
        return json({ ok: true });
      }
      if (p === '/api/admin/import' && m === 'POST') {
        const b = await body(req); const lines = String(b.text || '').split(/\r?\n/).map(s => s.trim()).filter(Boolean);
        const done = [], errors = [];
        for (const ln of lines.slice(0, 300)) {
          const parts = ln.split(/\s*[,،\t]\s*/);
          const [name, username] = parts; const password = parts[2] || genPass();
          try { await createUser(env, { name, username, password, scope: Array.isArray(b.scope) ? b.scope.map(String) : null }); done.push({ name, username: cleanUser(username), password }); }
          catch (e) { errors.push({ line: ln, error: /UNIQUE/i.test(e.message) ? 'اسم المستخدم مستخدم من قبل.' : e.message }); }
        }
        return json({ done, errors });
      }
      let mm;
      if ((mm = p.match(/^\/api\/admin\/teachers\/(\d+)$/))) {
        const id = +mm[1];
        const u = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(id).first();
        if (!u) return json({ error: 'غير موجود' }, 404);
        if (m === 'DELETE') {
          if (u.role === 'admin') return json({ error: 'لا يمكن حذف حساب المدير.' }, 400);
          await env.DB.batch(['users WHERE id', 'devices WHERE user_id', 'sessions WHERE user_id'].map(t => env.DB.prepare(`DELETE FROM ${t} = ?`).bind(id)));
          return json({ ok: true });
        }
        if (m === 'POST') {
          const b = await body(req); const out = { ok: true };
          if (b.action === 'reset_devices') await env.DB.batch([env.DB.prepare('DELETE FROM devices WHERE user_id = ?').bind(id), env.DB.prepare('DELETE FROM sessions WHERE user_id = ? AND user_id <> ?').bind(id, me.id)]);
          else if (b.action === 'clean_stale') {
            // إزالة أجهزة هذا المعلم التي لم تُستخدم منذ مدة الإهمال (لا يخسر جهازه الحالي)
            const cut = now() - staleSeconds(env) * 1000;
            const dead = (await env.DB.prepare('SELECT id, device_id FROM devices WHERE user_id = ? AND last_seen < ?').bind(id, cut).all()).results || [];
            if (!dead.length) return json({ ok: true, removed: 0 });
            await env.DB.batch(dead.flatMap(d => [
              env.DB.prepare('DELETE FROM sessions WHERE user_id = ? AND device_id = ?').bind(id, d.device_id),
              env.DB.prepare('DELETE FROM devices WHERE id = ?').bind(d.id)
            ]));
            return json({ ok: true, removed: dead.length });
          }
          else if (b.action === 'remove_device') await env.DB.batch([env.DB.prepare('DELETE FROM sessions WHERE user_id = ? AND device_id = (SELECT device_id FROM devices WHERE id = ? AND user_id = ?)').bind(id, +b.device, id), env.DB.prepare('DELETE FROM devices WHERE id = ? AND user_id = ?').bind(+b.device, id)]);
          else if (b.action === 'toggle') {
            if (u.role === 'admin') return json({ error: 'لا يمكن إيقاف حساب المدير.' }, 400);
            await env.DB.prepare('UPDATE users SET active = 1 - active WHERE id = ?').bind(id).run();
            await env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(id).run();
          } else if (b.action === 'password') {
            const pw = String(b.password || '') || genPass();
            if (pw.length < 6) return json({ error: 'كلمة المرور 6 أحرف على الأقل.' }, 400);
            const salt = rand(16); await env.DB.prepare('UPDATE users SET pass_hash = ?, salt = ? WHERE id = ?').bind(await hashPass(pw, salt), salt, id).run();
            if (id !== me.id) await env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(id).run();
            out.password = pw;
          } else if (b.action === 'max_devices') {
            await env.DB.prepare('UPDATE users SET max_devices = ? WHERE id = ?').bind(Math.max(1, Math.min(5, +b.value || 2)), id).run();
          } else if (b.action === 'scope') {
            const v = Array.isArray(b.value) ? b.value.map(x => String(x).slice(0, 80)).slice(0, 50) : [];
            await env.DB.prepare('UPDATE users SET scope = ? WHERE id = ?').bind(v.length ? JSON.stringify(v) : null, id).run();
          } else if (b.action === 'rename') {
            const n = String(b.name || '').trim().slice(0, 80); if (!n) return json({ error: 'اكتب الاسم.' }, 400);
            await env.DB.prepare('UPDATE users SET name = ? WHERE id = ?').bind(n, id).run();
          } else return json({ error: 'bad action' }, 400);
          return json(out);
        }
      }
      if ((mm = p.match(/^\/api\/admin\/lessons\/(\d+)$/)) && m === 'POST') {
        const id = +mm[1]; const b = await body(req);
        if (id >= CUSTOM_BASE) {
          const r = await env.DB.prepare('SELECT data FROM custom_lessons WHERE id = ?').bind(id).first();
          if (!r) return json({ error: 'غير موجود' }, 404);
          const d = JSON.parse(r.data); for (const k of LESSON_FIELDS) if (typeof b[k] === 'string') d[k] = b[k].slice(0, 20000);
          await env.DB.prepare('UPDATE custom_lessons SET data = ?, updated_at = ? WHERE id = ?').bind(JSON.stringify(d), now(), id).run();
          return json({ ok: true });
        }
        if (!LESSON_IDS.has(id)) return json({ error: 'غير موجود' }, 404); const cur = await env.DB.prepare('SELECT data FROM lesson_overrides WHERE lesson_id = ?').bind(id).first();
        const data = cur ? JSON.parse(cur.data) : {};
        for (const k of LESSON_FIELDS) if (typeof b[k] === 'string') data[k] = b[k].slice(0, 20000);
        await env.DB.prepare('INSERT INTO lesson_overrides(lesson_id,data,updated_at) VALUES(?,?,?) ON CONFLICT(lesson_id) DO UPDATE SET data=excluded.data, updated_at=excluded.updated_at').bind(id, JSON.stringify(data), now()).run();
        return json({ ok: true });
      }
      return p.startsWith('/api/') ? json({ error: 'not found' }, 404) : redirect('/');
    } catch (e) {
      return json({ error: 'حدث خطأ في السيرفر.', detail: String(e && e.message || e).slice(0, 200) }, 500);
    }
  }
};
