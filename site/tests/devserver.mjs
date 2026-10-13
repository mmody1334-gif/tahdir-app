// Local test harness: runs worker.js against a SQLite-backed imitation of Cloudflare D1.
import http from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { copyFileSync } from 'node:fs';
const dir = new URL('.', import.meta.url).pathname;
copyFileSync(dir + '../dist/worker.js', dir + 'worker_test.mjs');
const worker = (await import(dir + 'worker_test.mjs')).default;

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
const ASSETS = { fetch: async rq => { const f = dir + '../dist/assets' + decodeURIComponent(new URL(rq.url).pathname); return existsSync(f) ? new Response(readFileSync(f), { headers: { 'content-type': 'application/json' } }) : new Response('nf', { status: 404 }); } };
http.createServer(async (req, res) => {
  if (req.url.startsWith('/fin/')) { const f = dir + '../finals/img/' + decodeURIComponent(req.url.slice(5)); if (existsSync(f)) { res.writeHead(200, { 'content-type': 'image/webp' }); res.end(readFileSync(f)); return; } }
  const chunks = []; for await (const c of req) chunks.push(c);
  const headers = new Headers(); for (const [k, v] of Object.entries(req.headers)) headers.set(k, Array.isArray(v) ? v.join(', ') : v);
  headers.set('CF-Connecting-IP', req.headers['x-test-ip'] || '127.0.0.1');
  const r = new Request('http://localhost:' + port + req.url, { method: req.method, headers, body: ['GET', 'HEAD'].includes(req.method) ? undefined : Buffer.concat(chunks) });
  const out = await worker.fetch(r, { DB, ASSETS });
  const h = {}; out.headers.forEach((v, k) => { if (k !== 'set-cookie') h[k] = v; });
  const sc = out.headers.getSetCookie ? out.headers.getSetCookie() : [];
  if (sc.length) h['set-cookie'] = sc;
  res.writeHead(out.status, h); res.end(Buffer.from(await out.arrayBuffer()));
}).listen(port, () => console.log('listening', port));
