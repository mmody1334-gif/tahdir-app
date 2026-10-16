// Local test harness: runs worker.js against a SQLite-backed imitation of Cloudflare D1.
import http from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { copyFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
// fileURLToPath يعمل على ويندوز (pathname يعطي /C:/... وهو مسار غير صالح)
const dir = fileURLToPath(new URL('.', import.meta.url));
copyFileSync(join(dir, '../dist/worker.js'), join(dir, 'worker_test.mjs'));
const worker = (await import(new URL('worker_test.mjs', import.meta.url).href)).default;

const sq = new DatabaseSync(':memory:');
class Stmt {
  constructor(sql) { this.sql = sql; this.args = []; }
  bind(...a) { const s = new Stmt(this.sql); s.args = a.map(v => v === undefined ? null : v); return s; }
  _st() { return sq.prepare(this.sql); }
  async first() { return this._st().get(...this.args) ?? null; }
  async all() { return { results: this._st().all(...this.args) }; }
  async run() { const r = this._st().run(...this.args); return { meta: { changes: r.changes } }; }
}
const DB = {
  prepare: s => new Stmt(s),
  async batch(list) { const out = []; sq.exec('BEGIN'); try { for (const s of list) out.push(await s.run()); sq.exec('COMMIT'); } catch (e) { sq.exec('ROLLBACK'); throw e; } return out; }
};
const port = +(process.argv[2] || 8787);
import { readFileSync, existsSync } from 'node:fs';
const ASSETS = { fetch: async rq => { const f = join(dir, '../dist/assets', decodeURIComponent(new URL(rq.url).pathname)); return existsSync(f) ? new Response(readFileSync(f), { headers: { 'content-type': 'application/json' } }) : new Response('nf', { status: 404 }); } };
// بيئة العامل: نمرّر أيضًا إعدادات قابلة للضبط من متغيّرات البيئة حتى نستطيع اختبارها محليًا
// (مثل STALE_SECONDS: مدة إهمال الجهاز). في الإنتاج تُضبط من إعدادات الـWorker.
const ENV = { DB, ASSETS };
if (process.env.STALE_SECONDS) ENV.STALE_SECONDS = process.env.STALE_SECONDS;

http.createServer(async (req, res) => {
  // صور أسئلة الوزارة: في الإنتاج تُنشر تحت dist/assets/fin/ وتُخدم على /fin/ (انظر worker_src.js)
  if (req.url.startsWith('/fin/')) { const f = join(dir, '../dist/assets/fin', decodeURIComponent(req.url.slice(5))); if (existsSync(f)) { const ext = f.split('.').pop().toLowerCase(); res.writeHead(200, { 'content-type': ext === 'webp' ? 'image/webp' : ext === 'png' ? 'image/png' : 'application/octet-stream' }); res.end(readFileSync(f)); return; } res.writeHead(404); res.end('nf'); return; }
  const chunks = []; for await (const c of req) chunks.push(c);
  const headers = new Headers(); for (const [k, v] of Object.entries(req.headers)) headers.set(k, Array.isArray(v) ? v.join(', ') : v);
  headers.set('CF-Connecting-IP', req.headers['x-test-ip'] || '127.0.0.1');
  const r = new Request('http://localhost:' + port + req.url, { method: req.method, headers, body: ['GET', 'HEAD'].includes(req.method) ? undefined : Buffer.concat(chunks) });
  const out = await worker.fetch(r, ENV);
  const h = {}; out.headers.forEach((v, k) => { if (k !== 'set-cookie') h[k] = v; });
  const sc = out.headers.getSetCookie ? out.headers.getSetCookie() : [];
  if (sc.length) h['set-cookie'] = sc;
  res.writeHead(out.status, h); res.end(Buffer.from(await out.arrayBuffer()));
}).listen(port, () => console.log('listening', port));
