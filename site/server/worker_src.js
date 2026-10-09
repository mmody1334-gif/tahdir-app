// التحضير الآلي — Cloudflare Worker + D1
// إعداد: أ. محمد مجدي — مدرسة حذيفة بن محصن
const LESSONS = __LESSONS__;
const PAGES = __PAGES__;
const TOOL = __TOOL__;
const ICONS = __ICONS__;
const APK = __APK__;
const PRIVACY = __PRIVACY__;
const QBANK = __QBANK__;
const BUILD = __BUILD__;
LESSONS.forEach(l => { if (!l.subject) l.subject = l.grade === 'الخامس' ? 'العلوم' : 'الأحياء'; if (!l.term) l.term = 1; });
const LESSON_IDS = new Set(LESSONS.map(l => l.id));
const courseKey = l => (l.subject || '') + '|' + (l.grade || '');
const CUSTOM_BASE = 100000;
const MANIFEST = JSON.stringify({ name: 'التحضير الآلي', short_name: 'التحضير', lang: 'ar', dir: 'rtl', start_url: '/', scope: '/', display: 'standalone', background_color: '#f3f7f5', theme_color: '#07493b',
  icons: [{ src: '/icon-192.png', sizes: '192x192', type: 'image/png' }, { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }] });

const SESSION_DAYS = 30;
const MAX_FAILS = 5;
const LOCK_MIN = 15;
const PBKDF2_ITER = 100000;
const LESSON_FIELDS = ['title','unit_name','hw_type','hw_q1','hw_a1','hw_q2','hw_a2','concepts','pre_learning','outcomes','strategies','activities_teach','resources','formative','enrich','closing','homework','misconceptions'];

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
  if (!c.sid) return null;
  const row = await env.DB.prepare(
    `SELECT s.token, s.device_id, s.expires_at, s.last_seen, u.id, u.name, u.username, u.role, u.active, u.scope
     FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?`).bind(c.sid).first();
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
  let did = /^[a-f0-9]{48}$/.test(c.did || '') ? c.did : null;
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
  if (!dev) {
    if (u.role !== 'admin' && devs.length >= u.max_devices) {
      await logA(false, 'device_limit', u.id);
      return json({ error: `هذا الحساب مسجّل بالفعل على ${u.max_devices} أجهزة. لا يمكن الدخول من جهاز جديد. تواصل مع أ. محمد مجدي لإعادة ضبط الأجهزة.` }, 403, { 'Set-Cookie': setCookie('did', did, 63072000) });
    }
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
  return new Response(JSON.stringify({ ok: true, role: u.role, name: u.name }), { headers });
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
      SUM(type='quiz_make') quizzes, SUM(type='review_make') reviews, SUM(type IN ('quiz_print','quiz_word')) prints,
      COUNT(DISTINCT CASE WHEN type='view' THEN lesson_id END) views,
      MAX(CASE WHEN type='login' THEN at END) last_login, MAX(at) last_active
    FROM events WHERE at > ? GROUP BY user_id`).bind(since).all()).results || [];
  const byGrade = (await DB.prepare(`SELECT grade,
      SUM(type IN ${PREP_T}) preps, SUM(type IN ${HW_T}) hws, SUM(type IN ('quiz_make','review_make')) quizzes
    FROM events WHERE at > ? AND grade IS NOT NULL AND grade<>'' GROUP BY grade`).bind(since).all()).results || [];
  const daily = (await DB.prepare(`SELECT CAST((at + 14400000) / 86400000 AS INTEGER) d, COUNT(DISTINCT user_id) users,
      SUM(type IN ${PREP_T}) preps, SUM(type IN ${HW_T}) hws, SUM(type IN ('quiz_make','review_make')) quizzes
    FROM events WHERE at > ? GROUP BY d ORDER BY d`).bind(Math.max(since, now() - 30 * 86400000)).all()).results || [];
  const A = Object.fromEntries(agg.map(r => [r.user_id, r])), z = { logins: 0, preps: 0, prep_lessons: 0, hws: 0, hw_lessons: 0, quizzes: 0, reviews: 0, prints: 0, views: 0, last_login: null, last_active: null };
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
    '<style>body{margin:0;background:#e9eeec;font-family:"Simplified Arabic","Traditional Arabic",Tahoma,serif;color:#000}.bar{position:sticky;top:0;display:flex;gap:8px;justify-content:center;align-items:center;flex-wrap:wrap;padding:10px;background:#07493b;color:#fff;font-family:Tahoma,sans-serif;font-size:14px}.bar button{font:inherit;font-weight:bold;border:0;border-radius:10px;padding:10px 18px;background:#fff;color:#07493b;cursor:pointer}.pg{background:#fff;max-width:800px;margin:14px auto;padding:24px 28px;box-shadow:0 2px 10px rgba(0,0,0,.15);font-size:15px;line-height:1.7}.pg+.pg{page-break-before:always}.oval{display:inline-block;width:22px;height:13px;border:1.5px solid #555;border-radius:8px;vertical-align:middle}@media print{@page{size:A4;margin:12mm}body{background:#fff}.bar{display:none}.pg{box-shadow:none;margin:0;padding:0;max-width:none;font-size:14pt}}@media (max-width:600px){.pg{padding:14px 10px;margin:8px 4px;font-size:14px}}</style></head><body>' +
    '<div class="bar"><span>اضغط «طباعة» ثم اختر «حفظ بتنسيق PDF» أو الطابعة</span><button type="button" id="pr">🖨 طباعة / PDF</button></div>' + r.body +
    `<script nonce="${nonce}">document.getElementById('pr').onclick=function(){window.print();};setTimeout(function(){try{window.print();}catch(e){}},700);</script></body></html>`;
  return new Response(page, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Content-Disposition': disp(!inApp), 'Cache-Control': 'no-store', 'Content-Security-Policy': `default-src 'none'; style-src 'unsafe-inline'; img-src data:; script-src 'nonce-${nonce}'`, 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' } });
}

// ---------- router ----------
export default {
  async fetch(req, env) {
    try {
      if (!env.DB) return new Response('اربط قاعدة بيانات D1 بالاسم DB من إعدادات الـ Worker.', { status: 500, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
      await ensureSchema(env.DB);
      const url = new URL(req.url), p = url.pathname, m = req.method;
      if (m !== 'GET' && m !== 'HEAD' && !sameOrigin(req)) return json({ error: 'forbidden' }, 403);

      let mm0;
      const adminCount = async () => ((await env.DB.prepare("SELECT COUNT(*) n FROM users WHERE role='admin'").first()) || {}).n || 0;

      if (p === '/tool/tahdir-noor.user.js' || p === '/tool/tahdir-noor.meta.js') return new Response(TOOL, { headers: { 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' } });
      if (p === '/privacy' || p === '/support') return new Response(PRIVACY, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=3600', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'", ...SEC_HEADERS } });
      if (p === '/download/tahdir.apk') return new Response(Uint8Array.from(atob(APK), c => c.charCodeAt(0)), { headers: { 'Content-Type': 'application/vnd.android.package-archive', 'Content-Disposition': 'attachment; filename="tahdir.apk"', 'Cache-Control': 'no-cache' } });
      if (ICONS[p]) return new Response(Uint8Array.from(atob(ICONS[p]), c => c.charCodeAt(0)), { headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=604800' } });
      if (p === '/manifest.webmanifest') return new Response(MANIFEST, { headers: { 'Content-Type': 'application/manifest+json; charset=utf-8', 'Cache-Control': 'public, max-age=86400' } });
      if (p === '/version') return json(BUILD);
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

      const me = await currentUser(req, env);
      if (p === '/api/logout' && m === 'POST') {
        const c = cookies(req); if (c.sid) await env.DB.prepare('DELETE FROM sessions WHERE token = ?').bind(c.sid).run();
        return json({ ok: true }, 200, { 'Set-Cookie': setCookie('sid', '', 0) });
      }
      if (p === '/') {
        if (!(await adminCount())) return redirect('/setup');
        return me ? redirect(me.role === 'admin' ? '/admin' : '/app') : html('login');
      }
      if (!me) return p.startsWith('/api/') ? json({ error: 'سجّل الدخول أولًا.' }, 401) : redirect('/');

      if (p === '/app') return html('app');
      if (p === '/api/me') return json({ name: me.name, username: me.username, role: me.role });
      if (p === '/quiz') return html('quiz');
      if (p === '/api/lessons') return json({ lessons: await lessonsFor(env, me) });
      if (p === '/api/courses') { const sc = scopeOf(me); return json({ courses: (await coursesList(env)).filter(c => !sc || sc.has(c.key)) }); }
      if (p === '/api/quiz/bank') {
        const key = url.searchParams.get('key') || '', sc = scopeOf(me);
        if (sc && !sc.has(key)) return json({ error: 'غير مسموح.' }, 403);
        const ls = (await allLessons(env)).filter(l => courseKey(l) === key);
        const ids = new Set(ls.map(l => l.id));
        return json({ lessons: ls.map(l => ({ id: l.id, unit: l.unit, unit_name: l.unit_name, title: l.title, subject: l.subject, grade: l.grade, term: l.term || 1 })), items: QBANK.filter(q => ids.has(q.lesson_id)) });
      }
      if (p === '/api/export' && m === 'POST') {
        const b = await body(req), id = rand(20), fmt = b.format === 'print' ? 'print' : 'doc';
        const name = String(b.name || 'التحضير الآلي').replace(/[\\/:*?"<>|\r\n]+/g, '-').slice(0, 100);
        await env.DB.batch([
          env.DB.prepare('DELETE FROM exports WHERE created_at < ?').bind(now() - 86400000),
          env.DB.prepare('INSERT INTO exports(id,user_id,name,format,body,created_at) VALUES(?,?,?,?,?,?)').bind(id, me.id, name, fmt, String(b.html || '').slice(0, 1900000), now())
        ]);
        return json({ ok: true, url: '/x/' + id });
      }
      if (p === '/api/quizzes' && m === 'GET') {
        const r = (await env.DB.prepare('SELECT id,title,grade,subject,kind,created_at,updated_at FROM quizzes WHERE user_id = ? ORDER BY updated_at DESC LIMIT 200').bind(me.id).all()).results || [];
        return json({ quizzes: r });
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
        if (n && n.n >= 200) return json({ error: 'وصلت إلى 200 اختبار محفوظ. احذف بعضها أولًا.' }, 400);
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
        const type = ['view', 'copy_all', 'copy_json', 'copy_field', 'copy_hw', 'send_prep', 'send_hw', 'quiz_make', 'review_make', 'quiz_print', 'quiz_word', 'quiz_save'].includes(b.type) ? b.type : null;
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
