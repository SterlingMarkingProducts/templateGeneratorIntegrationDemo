#!/usr/bin/env node
/* ============================================================================
   local-ai-server.mjs — LOCAL-ONLY dev server for real AI generation.

   Serves this repository over http://127.0.0.1:4000 and exposes ONE extra
   route, /local-api/anthropic, which forwards the Generator's Anthropic
   request and adds the API key server-side, read from a local .env file.

   The key therefore never reaches the browser, never appears in any committed
   file, and is never printed by this server. Nothing here changes how the
   published GitHub Pages build behaves: that build is not served from
   localhost, so the Generator keeps using its existing static-mode path.

   No dependencies. Start it with:   node local-ai-server.mjs
   ========================================================================= */
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync, statSync, readFileSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)));
const HOST = '127.0.0.1';
const PORT = Number(process.env.PORT || 4000);
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';

/* ── .env (local only, never committed) ─────────────────────────────────── */
function loadEnvFile() {
  const envPath = join(ROOT, '.env');
  if (!existsSync(envPath)) return {};
  const out = {};
  for (const rawLine of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 0) continue;
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    out[line.slice(0, eq).trim()] = value;
  }
  return out;
}
const fileEnv = loadEnvFile();
const API_KEY = (process.env.ANTHROPIC_API_KEY || fileEnv.ANTHROPIC_API_KEY || '').trim();

/* ── static file serving ────────────────────────────────────────────────── */
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.ico': 'image/x-icon', '.woff2': 'font/woff2',
  '.woff': 'font/woff', '.ttf': 'font/ttf', '.map': 'application/json',
};

function safePath(urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0]);
  const rel = normalize(decoded).replace(/^(\.\.[/\\])+/, '').replace(/^[/\\]+/, '');
  const full = resolve(ROOT, rel);
  return full.startsWith(ROOT) ? full : null;   // no path traversal out of the repo
}

async function serveStatic(req, res) {
  let full = safePath(req.url);
  if (!full) { res.writeHead(403).end('forbidden'); return; }
  if (req.url === '/' || req.url.startsWith('/?')) full = join(ROOT, 'index.html');
  try {
    if (existsSync(full) && statSync(full).isDirectory()) full = join(full, 'index.html');
    const body = await readFile(full);
    res.writeHead(200, {
      'Content-Type': MIME[extname(full).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    res.end(body);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' }).end('not found');
  }
}

/* ── the proxy route ────────────────────────────────────────────────────── */
async function proxyAnthropic(req, res) {
  if (req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'application/json' })
       .end(JSON.stringify({ error: { message: 'POST only' } }));
    return;
  }
  if (!API_KEY) {
    res.writeHead(500, { 'Content-Type': 'application/json' }).end(JSON.stringify({
      error: { message: 'No ANTHROPIC_API_KEY found. Put it in a .env file next to ' +
        'local-ai-server.mjs as  ANTHROPIC_API_KEY=sk-ant-...  and restart this server.' },
    }));
    return;
  }

  const chunks = [];
  let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > 8 * 1024 * 1024) { res.writeHead(413).end('payload too large'); return; }
    chunks.push(c);
  }
  const raw = Buffer.concat(chunks).toString('utf8');

  let upstream;
  try {
    upstream = await fetch(ANTHROPIC_URL, {          // fixed URL — never client-controlled
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': API_KEY,                        // added here, never in the browser
        'anthropic-version': ANTHROPIC_VERSION,
      },
      body: raw,
    });
  } catch (err) {
    console.error(`  ! upstream request failed: ${err?.message || err}`);
    res.writeHead(502, { 'Content-Type': 'application/json' })
       .end(JSON.stringify({ error: { message: 'Could not reach api.anthropic.com from this machine.' } }));
    return;
  }

  const isStream = (upstream.headers.get('content-type') || '').includes('text/event-stream');
  res.writeHead(upstream.status, {
    'Content-Type': upstream.headers.get('content-type') || 'application/json',
    'Cache-Control': 'no-store',
  });
  console.log(`  -> anthropic ${upstream.status}${isStream ? ' (stream)' : ''}`);

  if (!upstream.body) { res.end(); return; }
  const reader = upstream.body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    res.write(Buffer.from(value));
  }
  res.end();
}

/* ── server ─────────────────────────────────────────────────────────────── */
const server = http.createServer((req, res) => {
  const path = req.url.split('?')[0];
  if (path !== '/local-api/anthropic') console.log(`${req.method} ${path}`);
  if (path === '/local-api/anthropic') {
    console.log(`${req.method} ${path}`);
    proxyAnthropic(req, res).catch((err) => {
      console.error(`  ! proxy error: ${err?.message || err}`);
      if (!res.headersSent) res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: { message: 'Local proxy error.' } }));
    });
    return;
  }
  if (path === '/local-api/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
       .end(JSON.stringify({ ok: true, apiKeyLoaded: Boolean(API_KEY) }));  // boolean only
    return;
  }
  serveStatic(req, res).catch(() => { res.writeHead(500).end('error'); });
});

server.listen(PORT, HOST, () => {
  console.log('');
  console.log('  Sterling Design Template Generator — local AI dev server');
  console.log('  ------------------------------------------------------');
  console.log(`  Generator:  http://${HOST}:${PORT}/generator/index.html`);
  console.log(`  API key:    ${API_KEY ? 'loaded from .env (never logged, never sent to the browser)'
    : 'NOT FOUND — create a .env file with ANTHROPIC_API_KEY=sk-ant-...'}`);
  console.log('  Requests to Anthropic are proxied through /local-api/anthropic');
  console.log('  Press Ctrl+C to stop.');
  console.log('');
});
