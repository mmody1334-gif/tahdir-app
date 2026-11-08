// GrindMate 27 — data updater. No external deps (Node 20+).
// Sources: FUT.GG SSR pages + inline TSR payload scripts (parsed in a sandboxed vm
// with no network access; the Telegram token is never passed to the sandbox).
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA = path.join(ROOT, 'data');
const CONFIG = JSON.parse(fs.readFileSync(path.join(DATA, 'config.json'), 'utf8'));
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36';

const read = (f, d) => { try { return JSON.parse(fs.readFileSync(path.join(DATA, f), 'utf8')); } catch { return d; } };
const write = (f, v) => fs.writeFileSync(path.join(DATA, f), JSON.stringify(v, '\n' ? null : null, 2) + '\n');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function fetchText(url, tries = 2) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'en' }, signal: AbortSignal.timeout(25000) });
      if (res.ok) return await res.text();
      if (res.status === 404) return null;
    } catch (e) { /* retry */ }
    await sleep(1500 * (i + 1));
  }
  return null;
}

// ---------- TSR payload extraction ----------

// Runs Fut.GG's inline data-preload script inside a vm sandbox that has no
// fetch/network/timers, then walks the resulting $R registry and returns every
// distinct object it produced.
function tsrObjects(html) {
  const out = [];
  const seen = new Set();
  const push = (val, seenLocal = new Set()) => {
    if (!val || typeof val !== 'object') return;
    if (seen.has(val) || seenLocal.has(val)) return;
    seenLocal.add(val);
    seen.add(val);
    out.push(val);
    for (const k of Object.keys(val)) {
      try { push(val[k], seenLocal); } catch { }
    }
  };
  const chunkRe = /<script[^>]*class="\$tsr"[^>]*>/g;
  const starts = [...html.matchAll(chunkRe)].map(m => m.index + m[0].length);
  if (starts.length) {
    const endTok = 'document.currentScript.remove()';
    let first = starts[0];
    let last = -1;
    for (const s of starts) {
      const e = html.indexOf(endTok, s);
      if (e === -1) break;
      last = e + endTok.length;
    }
    if (last > first) {
      // One streamed mega-script: seams "</script><script ...>" sit inline.
      let body = html.slice(first, last).replace(/<\/script>\s*<script[^>]*>/g, '');
      const ctx = { self: {}, $_TSR: {}, document: { currentScript: { remove() { } } }, ReadableStream: class { constructor(o) { this.start = o && o.start; } } };
      ctx.$R = ctx.self.$R = {};
      try {
        vm.runInNewContext(body, ctx, { timeout: 20000 });
      } catch (e) {
        console.error('tsr mega-body eval failed:', e.message);
      }
      const sources = [ctx.self.$R, ctx.$_TSR];
      for (const src of sources) {
        if (!src) continue;
        for (const k of Object.keys(src)) {
          try { push(src[k]); } catch { }
        }
      }
    }
  }
  // Also handle non-streamed pages (single self-contained chunk scripts).
  for (const m of html.matchAll(/<script[^>]*class="\$tsr"[^>]*>([\s\S]{300,}?)<\/script>/g)) {
    const body = m[1];
    const ctx = { self: {}, $_TSR: {}, document: { currentScript: { remove() { } } }, ReadableStream: class { constructor(o) { this.start = o && o.start; } } };
    ctx.$R = ctx.self.$R = {}; // script head does (self.$R=self.$R||{})["tsr"]=[] — keeps this alias
    // No fetch/XMLHttpRequest/WebSocket/setTimeout in this context by default —
    // a vm context only gets what we pass explicitly.
    try {
      vm.runInNewContext(body, ctx, { timeout: 8000 });
    } catch {
      continue; // mega-body already attempted covers these pages
    }
    const sources = [ctx.self && ctx.self.$R, ctx.$_TSR];
    for (const src of sources) {
      if (!src) continue;
      for (const k of Object.keys(src)) {
        // self.$R["tsr"] IS the registry array — the IIFE writes every $R[n] into it
        try { push(src[k]); } catch { }
      }
    }
  }
  if (process.env.GRINDMATE_DEBUG) {
    console.error('tsrObjects collected:', out.length);
    const cand = out.filter(o => o && ('levels' in o) && ('requirements' in o));
    console.error('evo-cands:', cand.length, 'withArrReq:', cand.filter(o => Array.isArray(o.requirements)).length, 'withArrLv:', cand.filter(o => Array.isArray(o.levels)).length, 'withET:', cand.filter(o => 'endTime' in o).length);
  }
  return out;
}

const isStr = (v) => typeof v === 'string';
const hasKeys = (o, keys) => keys.every(k => k in o);

// ---------- Objectives ----------

function parseObjectivesFromTsr(objs) {
  const groups = [];
  for (const o of objs) {
    if (o && typeof o === 'object' && hasKeys(o, ['name', 'slug', 'startTime', 'endTime'])) {
      const g = {
        slug: o.slug,
        name: o.name,
        categoryEaId: o.categoryEaId,
        url: o.slug && o.slug.includes('-') && o.eaId ? `https://www.fut.gg/objectives/${(o.category && o.category.slug) || 'campaigns'}/${o.slug}/` : null,
        description: o.description || null,
        startTime: o.startTime,
        endTime: o.endTime,
        tasksCount: o.tasksCount ?? null,
        objectives: []
      };
      if (Array.isArray(o.objectives)) {
        g.objectives = o.objectives.map(t => {
          const req = t && t.squadRequirements || {};
          const match = req.match || {};
          const task = t.task || {};
          return {
            eaId: t.eaId ?? null,
            name: t.name || '',
            description: t.description || '',
            modes: Array.isArray(match.modes) ? match.modes : [],
            minDifficulty: match.squadBattlesMinDifficulty || null,
            rivalsMinDivision: match.rivalsMinDivision || null,
            liveEventName: match.liveEventName || null,
            action: task.action || null,
            target: task.target ?? null,
            unit: task.unit || null,
            subject: task.subject || null,
            squadRequirements: Array.isArray(req.requirements)
              ? req.requirements.map(r => ({
                  kind: r.kind || null, label: r.label || null, count: r.count ?? null,
                  constraint: r.constraint || null, scope: r.scope || null, position: r.position || null
                }))
              : [],
            reward: Array.isArray(t.awards) ? t.awards.map(a => ({ name: a.name || null, type: a.type || null })) : []
          };
        });
      }
      groups.push(g);
    }
  }
  // dedupe by slug, keep the richest copy
  const map = new Map();
  for (const g of groups) {
    const prev = map.get(g.slug);
    if (!prev || (g.objectives?.length || 0) >= (prev.objectives?.length || 0)) map.set(g.slug, g);
  }
  return [...map.values()];
}

async function updateObjectives() {
  const cfg = CONFIG.objectives;
  const prev = read('objectives.json', { updatedAt: null, groups: [] });
  const prevSlugs = new Map(prev.groups.map(g => [g.slug, g]));
  const state = read('_state.json', { knownObjectiveSlugs: [], notifiedExpiring: [] });

  // 1) sitemap → recent group URLs
  const sitemap = await fetchText(cfg.sitemapUrl);
  const recent = [];
  if (sitemap) {
    const cutoff = Date.now() - cfg.maxNewDays * 86400000;
    for (const m of sitemap.matchAll(/<loc>([^<]+)<\/loc><lastmod>([^<]+)<\/lastmod>/g)) {
      if (/\/objectives\//.test(m[1]) && new Date(m[2]).getTime() >= cutoff) recent.push(m[1]);
    }
  }
  recent.sort((a, b) => cmpUrl(b, a));
  const picks = recent.slice(0, cfg.maxGroupsPerRun);
  const groups = new Map(prev.groups.map(g => [g.slug, g]));

  // 2) group pages → full data
  const newSlugs = [];
  for (const url of picks) {
    const html = await fetchText(url);
    if (!html) continue;
    const parsed = parseObjectivesFromTsr(tsrObjects(html));
    for (const g of parsed) {
      if (!g.slug) continue;
      if (!groups.has(g.slug)) newSlugs.push(g.slug);
      groups.set(g.slug, g);
    }
    await sleep(800);
  }

  // 3) prune groups past endTime + 2 days
  const now = Date.now();
  const out = [...groups.values()].filter(g => !g.endTime || new Date(g.endTime).getTime() > now - 2 * 86400000);
  out.sort((a, b) => new Date(b.startTime) - new Date(a.startTime));

  const data = { updatedAt: new Date().toISOString(), source: 'fut.gg', groups: out };
  write('objectives.json', data);

  // 4) alerts
  const alerts = [];
  for (const slug of newSlugs) {
    const g = out.find(x => x.slug === slug);
    if (g) alerts.push(`🆕 أوبجكتيف جديد: ${g.name}\nمن ${fmt(g.startTime)} إلى ${fmt(g.endTime)}\n⏳ فاضل ${dur(g.endTime)}\n🔗 https://www.fut.gg/objectives/${g.url ? g.url.replace('https://www.fut.gg/objectives/', '') : ''}`);
  }
  for (const g of out) {
    if (!g.endTime) continue;
    const left = new Date(g.endTime).getTime() - now;
    if (left <= cfg.expiringSoonHours * 3600000 && left > 0 && !state.notifiedExpiring.includes(g.slug)) {
      alerts.push(`⏰ قريب ينتهي: ${g.name}\nفاضل ${dur(g.endTime)} — خش خلص اللي ناقصك!`);
    }
  }
  state.notifiedExpiring = out.filter(g => g.endTime && new Date(g.endTime).getTime() - now <= cfg.expiringSoonHours * 3600000 && new Date(g.endTime).getTime() > now).map(g => g.slug);
  state.knownObjectiveSlugs = out.map(g => g.slug);
  write('_state.json', state);
  return { data, alerts };
}

function cmpUrl(a, b) {
  const da = /lastmod|url/.test(a) ? a : a; // URLs already sorted by caller using lastmod order in sitemap; fallback simple
  return a.localeCompare(b);
}
const fmt = (iso) => isStr(iso) ? new Date(iso).toISOString().slice(0, 16).replace('T', ' ') + ' UTC' : '؟';
function dur(iso) {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return 'انتهى';
  const h = Math.floor(ms / 3600000), d = Math.floor(h / 24);
  return d > 0 ? `${d} يوم و ${h % 24} ساعة` : `${h} ساعة و ${Math.floor((ms % 3600000) / 60000)} دقيقة`;
}

// ---------- Evolutions ----------

function parseEvolutionsFromTsr(objs) {
  const evos = [];
  for (const o of objs) {
    if (!o || typeof o !== 'object') continue;
    if (!('slug' in o) || !('name' in o) || !('requirements' in o) || !('levels' in o) || !('endTime' in o)) continue;
    if (!o.requirements || typeof o.requirements !== 'object' || !Array.isArray(o.levels)) continue;
    // requirements is a player-filter spec — keep only informative (non-null) fields
    const req = {};
    for (const k of Object.keys(o.requirements)) {
      const v = o.requirements[k];
      if (v !== null && v !== false && v !== '') req[k] = v;
    }
    evos.push({
      slug: o.slug,
      name: o.name,
      url: o.url ? `https://www.fut.gg${o.url.startsWith('/') ? '' : '/'}${o.url}` : null,
      description: o.description || null,
      startTime: o.createdAt || null,
      endTime: o.endTime || null,
      endSubmissionTime: o.endSubmissionTime || o.endTime || null,
      trainingTime: o.readableTrainingTime || o.totalTrainingTime || null,
      repeatable: o.repeatabilityCount || null,
      coinsCost: o.coinsCost ?? null,
      pointsCost: o.pointsCost ?? null,
      requirements: req,
      levels: (o.levels || []).map(l => ({
        idx: l.idx,
        challenges: l.challenges || [],
        upgrades: (l.upgrades || []).map(u => ({ upgrade: u.upgrade, value: u.value, maxValue: u.maxValue })),
        options: Array.isArray(l.upgradeOptions) ? l.upgradeOptions.map(gr => Array.isArray(gr) ? gr.map(u => ({ upgrade: u.upgrade, value: u.value, maxValue: u.maxValue })) : [{ upgrade: gr?.upgrade, value: gr?.value, maxValue: gr?.maxValue }]) : []
      })),
      eligibleIds: Array.isArray(o.eligiblePlayerItemIds) ? o.eligiblePlayerItemIds.slice(0, 8) : [],
      trending: Array.isArray(o.trendingPlayersIds) ? o.trendingPlayersIds.slice(0, 10) : [],
      isExpired: !!o.isExpired
    });
  }
  const map = new Map(evos.map(e => [e.slug, e]));
  return [...map.values()];
}

async function updateEvolutions() {
  const html = await fetchText(CONFIG.evolutions.hubUrl);
  const prev = read('evolutions.json', { updatedAt: null, evolutions: [] });
  const state = read('_state.json', { knownObjectiveSlugs: [], notifiedExpiring: [] });
  let evos = [];
  if (html) {
    evos = parseEvolutionsFromTsr(tsrObjects(html));
  }
  if (evos.length) {
    const map = new Map(prev.evolutions.map(e => [e.slug, e]));
    for (const e of evos) map.set(e.slug, e);
    const now = Date.now();
    const list = [...map.values()].filter(e => !e.endTime || new Date(e.endTime).getTime() > now - 86400000);
    list.sort((a, b) => new Date(b.startTime || 0) - new Date(a.startTime || 0));
    const data = { updatedAt: new Date().toISOString(), source: 'fut.gg', evolutions: list };
    write('evolutions.json', data);
    const alerts = [];
    for (const e of list) {
      if (!e.endTime) continue;
      const left = new Date(e.endTime).getTime() - now;
      if (left <= CONFIG.evolutions.expiringSoonHours * 3600000 && left > 0 && !(state.notifiedExpiring || []).some(s => 'evo:' + e.slug === s)) {
        alerts.push(`⚡ تطويرة قريبة تنتهي: ${e.name}\nفاضل ${dur(e.endTime)}`);
      }
    }
    state.evoNotified = [...(state.evoNotified || []), ...alerts.length ? list.filter(e => dur(e.endTime) !== 'انتهى').map(e => 'evo:' + e.slug) : []];
    write('_state.json', state);
    return { data, alerts };
  }
  return { data: prev, alerts: [] };
}

// ---------- Market watchlist prices ----------

async function updateMarket() {
  const wl = CONFIG.market.watchlist.filter(w => w.url);
  const prev = read('prices.json', { players: {} });
  const players = prev.players || {};
  const now = new Date().toISOString().slice(0, 10);
  for (const w of wl) {
    const html = await fetchText(w.url);
    if (!html) continue;
    // SSR price block: "> Price : <div ... tabular-nums ...> 45,000 "
    const m = html.match(/Price\s*:\s*<div[^>]*tabular-nums[^>]*>\s*([\d,]{2,})/);
    if (!m) continue;
    const price = Number(m[1].replace(/,/g, ''));
    const hist = players[w.name] || [];
    if (!hist.length || hist[hist.length - 1].date !== now) hist.push({ date: now, price });
    else hist[hist.length - 1] = { date: now, price };
    players[w.name] = hist.slice(-120); // ~4 months of daily snaps
    await sleep(800);
  }
  const data = { updatedAt: new Date().toISOString(), players };
  write('prices.json', data);
  return { data, alerts: [] };
}

// ---------- Leaks (Nitter RSS fallback chain) ----------

async function updateLeaks() {
  const cfg = CONFIG.leaks;
  const prev = read('leaks.json', { updatedAt: null, leaks: [] });
  const known = new Set(prev.leaks.map(l => l.id));
  const fresh = [];
  for (const instance of cfg.nitterInstances) {
    let ok = false;
    for (const acc of cfg.accounts) {
      const xml = await fetchText(`${instance}/${acc}/rss`, 1);
      if (!xml || xml.startsWith('<')) { if (!xml) continue; }
      if (!xml || !xml.includes('<item>')) continue;
      ok = true;
      for (const m of xml.matchAll(/<item>[\s\S]*?<title>([\s\S]*?)<\/title>[\s\S]*?<guid[^>]*>([\s\S]*?)<\/guid>/g)) {
        const title = m[1].replace(/<!\[[\s\S]*?\]\]>/g, '').replace(/&lt;|&gt;|&amp;/g, c => ({ '&lt;': '<', '&gt;': '>', '&amp;': '&' }[c])).trim();
        const link = m[2].trim();
        const id = link.split('/').pop();
        if (known.has(id)) continue;
        known.add(id);
        fresh.push({ id, account: acc, text: title, link, at: new Date().toISOString() });
      }
      await sleep(400);
    }
    if (ok) break;
  }
  const leaks = [...fresh, ...prev.leaks].slice(0, 60);
  const data = { updatedAt: new Date().toISOString(), leaks };
  write('leaks.json', data);
  const alerts = leaks.filter(l => l.at === data.updatedAt).slice(0, 5).map(l => `🕵️ تسريبة من @${l.account}:\n${l.text}\n${l.link}`);
  return { data, alerts };
}

// ---------- Telegram ----------

async function tgSend(text) {
  if (!TELEGRAM_TOKEN) { console.log('no token, skipping TG'); return false }
  const chat = CONFIG.telegram.chatId || process.env.TELEGRAM_CHAT_ID || '';
  if (!chat) { console.log('no chatId, skipping TG'); return false }
  try {
    const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chat, text, parse_mode: 'HTML', disable_web_page_preview: false })
    });
    return res.ok;
  } catch (e) { console.error('tg error', e.message); return false }
}

// ---------- main ----------

const only = process.argv[2] || 'all';
const results = {};
const alerts = [];

if (only === 'all' || only === 'objectives') {
  results.objectives = await updateObjectives(); alerts.push(...results.objectives.alerts);
}
if (only === 'all' || only === 'evolutions') {
  results.evolutions = await updateEvolutions(); alerts.push(...results.evolutions.alerts);
}
if (only === 'all' || only === 'market') {
  results.market = await updateMarket();
}
if (only === 'all' || only === 'leaks') {
  results.leaks = await updateLeaks(); alerts.push(...results.leaks.alerts);
}
if (only === 'notify') {
  // send whatever alerts files already hold (used by workflow after commit failures)
  const pending = read('_pending_alerts.json', []);
  alerts.push(...pending);
}

if (alerts.length) {
  const ok = await tgSend(`⚽ <b>GrindMate 27</b>\n\n${alerts.join('\n\n')}\n\n📊 الصفحة: https://mmody1334-gif.github.io/grindmate27/`);
  write('_pending_alerts.json', ok ? [] : alerts);
} else {
  write('_pending_alerts.json', []);
}

console.log(JSON.stringify({
  objectives: results.objectives?.data?.groups?.length ?? null,
  evolutions: results.evolutions?.data?.evolutions?.length ?? null,
  marketPlayers: Object.keys(results.market?.data?.players || {}).length,
  leaks: results.leaks?.data?.leaks?.length ?? null,
  alerts: alerts.length
}, null, 2));
