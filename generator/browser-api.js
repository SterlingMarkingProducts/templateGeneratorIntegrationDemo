/* ============================================================================
   browser-api.js — lets the app run with no server (e.g. on GitHub Pages).
   Provides the `anthropic` client used by engine.js (direct browser calls to
   the Anthropic API) and intercepts the app's fetch('/generate') and
   fetch('/generate-json') calls, routing them to engine.js instead of a
   backend. A default API key is built in (encoded) so visitors are never
   prompted; the "API key" button can override it per-browser via localStorage.

   When the page is served from localhost the Express server (server.js) is
   assumed to be running and this file does nothing, so `npm start` keeps
   working exactly as before.
   ========================================================================= */
(() => {
'use strict';

const IS_LOCALHOST = /^(localhost|127\.|\[::1\])/.test(location.hostname);

/* Served from the web03 dev clone folder: the Anthropic call goes through a
   same-origin CFML proxy in the sibling oldDesigner clone, which adds the API
   key server-side. The browser holds no key and is never asked for one.
   Detected from this page's OWN path, so no other deployment can enter it. */
/* Both dev clone folders: the approved integration clone and the experimental
   design-quality clone beside it. Longest first, and each carries its trailing
   slash, so the plain folder cannot match the '-phase1' one by accident. */
const WEB03_DEV_CLONES = ['/generator-web03-dev-e2e-phase1/', '/generator-web03-dev-e2e/'];
const WEB03_PROXY_ENDPOINT = '/git/web03-dev-e2e/tests/web03-dev-e2e/aiProxy.cfm';
/* The dev endpoints' published test token — the same one the import transport
   sends. Not a secret; it exists so the proxy's own check is exercised. */
const WEB03_DEV_TOKEN = 'web03-dev-e2e-token';

const WEB03_PROXY_MODE = location.protocol !== 'file:'
  && WEB03_DEV_CLONES.some((f) => location.pathname.indexOf(f) !== -1);

/* ── the DEV key, kept OUT of git ──────────────────────────────────────────
   A key committed to a file was the wrong answer: GitHub's secret scanning
   reports it to Anthropic, which revokes it automatically. Two keys died that
   way. The key is asked for once, in the page, by web03-dev-key.js, and kept in
   this browser — never written to a file, so nothing to commit and nothing to
   scan. No console, no DevTools.

   A server-side ANTHROPIC_API_KEY on web03 still wins: aiProxy.cfm falls back
   to what the browser sends only when it has none of its own, and the dialog is
   never shown when the server reports one. */
function getWeb03DevKey() {
  if (!WEB03_PROXY_MODE || !window.SMPDevKey) return '';
  return window.SMPDevKey.get();
}

/* Served from anywhere other than localhost or that clone (GitHub Pages,
   file://): the app runs entirely in the browser and the visitor supplies
   their own key. */
const STATIC_MODE = !WEB03_PROXY_MODE
  && (location.protocol === 'file:' || !IS_LOCALHOST);

/* Served from localhost by local-ai-server.mjs: same in-browser engine, but
   the Anthropic call goes through the local proxy, which adds the API key
   server-side from .env. No key is ever handled by the browser here. */
const LOCAL_PROXY_MODE = IS_LOCALHOST && location.protocol !== 'file:';

/* Both proxy modes share one rule: the browser sends NO credentials, and never
   prompts for a key. Only the URL differs. */
const SERVER_PROXY_MODE = LOCAL_PROXY_MODE || WEB03_PROXY_MODE;

/* engine.js runs in the browser in every mode; only the transport differs. */
const ENGINE_MODE = STATIC_MODE || SERVER_PROXY_MODE;

const ANTHROPIC_ENDPOINT = WEB03_PROXY_MODE
  ? WEB03_PROXY_ENDPOINT
  : (LOCAL_PROXY_MODE ? '/local-api/anthropic'
                      : 'https://api.anthropic.com/v1/messages');

const API_KEY_STORAGE = 'anthropic_api_key';

function getStoredApiKey() {
  return (localStorage.getItem(API_KEY_STORAGE) || '').trim();
}

function requestApiKey(message) {
  const entered = window.prompt(
    message ||
      'Paste your Anthropic API key (starts with "sk-ant-").\n\n' +
      'It is stored only in this browser (localStorage) and sent only to api.anthropic.com — never to any other server.'
  );
  if (entered && entered.trim()) {
    localStorage.setItem(API_KEY_STORAGE, entered.trim());
    updateKeyButton();
    return entered.trim();
  }
  return '';
}

// DEMO BUILD: no built-in API key is shipped. Real AI generation requires
// visitors to set their own key via the "API key" button; the demo's
// "Load sample design" buttons work with no key at all.
function getDefaultApiKey() {
  return '';
}

function ensureApiKey() {
  const key = getStoredApiKey() || getDefaultApiKey() || requestApiKey();
  if (!key) {
    throw new Error(
      'An Anthropic API key is required. Click the "API key" button in the corner to set one.'
    );
  }
  return key;
}

function anthropicHeaders() {
  /* Through either proxy the browser normally sends NO credentials at all — the
     server attaches the key it read from its own configuration. The web03 proxy
     also wants the published dev token, which is not a secret and grants
     nothing: it is there so the endpoint's own check runs rather than being
     bypassed. */
  if (WEB03_PROXY_MODE) {
    const headers = { 'content-type': 'application/json', 'X-CSRF-Token': WEB03_DEV_TOKEN };
    /* DEV ONLY, and only on this clone. When web03 has no server-side
       ANTHROPIC_API_KEY configured, this browser supplies one so live
       generation works without touching the Lucee service. The proxy PREFERS
       its own server-side key and falls back to this only when it has none.
       Held by web03-dev-key.js, never in a committed file. */
    const devKey = getWeb03DevKey();
    if (devKey) { headers['X-Dev-Anthropic-Key'] = devKey; }
    return headers;
  }
  if (LOCAL_PROXY_MODE) return { 'content-type': 'application/json' };
  return {
    'content-type': 'application/json',
    'x-api-key': ensureApiKey(),
    'anthropic-version': '2023-06-01',
    'anthropic-dangerous-direct-browser-access': 'true',
  };
}

/* DEV diagnostics for a 401, on the web03 clone only. Logs the SHA-256 of the
   key this page holds — never the key — next to the hash the proxy reports for
   the key it actually used. Matching hashes prove the value crossed intact, so
   a 401 is the credential itself and not the transport. */
async function logDevKeyHash(diagnostic) {
  if (!WEB03_PROXY_MODE || !window.crypto || !crypto.subtle) return;
  const key = getWeb03DevKey();
  if (!key) return;
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key));
  const hash = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0')).join('');
  console.warn('[DEV KEY CHECK] browser key: length ' + key.length + ', sha256 ' + hash);
  if (diagnostic) {
    console.warn('[DEV KEY CHECK] proxy used : source ' + diagnostic.keySource
      + ', length ' + diagnostic.keyLength + ', sha256 ' + diagnostic.keySha256);
    console.warn('[DEV KEY CHECK] hashes ' + (diagnostic.keySha256 === hash
      ? 'MATCH — the key reached Anthropic unaltered, so this 401 is the credential itself.'
      : 'DIFFER — the proxy used a different key than this page holds.'));
  }
}

async function readAnthropicError(res) {
  let message = `Anthropic API request failed (${res.status}).`;
  let diagnostic = null;
  try {
    const data = await res.json();
    message = data?.error?.message || message;
    diagnostic = data?.error?.diagnostic || null;
  } catch { /* non-JSON body */ }
  if (res.status === 401) { logDevKeyHash(diagnostic); }   /* console only */
  if (SERVER_PROXY_MODE) {
    /* No key button is involved on this side, so never send the operator to
       one. On the dev clone a "no key" refusal has one remedy, and it is a
       thing to DO rather than a thing to read: reopen the setup dialog. */
    if (WEB03_PROXY_MODE && res.status === 503 && window.SMPDevKey) {
      window.SMPDevKey.open('');
      return new Error('Enter your Anthropic API key to enable live generation.');
    }
    /* Anthropic refused the key this browser holds. Say so plainly and ask for
       another — no status codes, no hashes, no diagnostics in the UI. */
    if (WEB03_PROXY_MODE && res.status === 401 && window.SMPDevKey
        && window.SMPDevKey.get()) {
      window.SMPDevKey.rejected();
      return new Error('Anthropic rejected this API key. Enter a different key.');
    }
    return new Error(message);
  }
  if (res.status === 401 || res.status === 403) {
    if (getStoredApiKey()) {
      localStorage.removeItem(API_KEY_STORAGE);
      updateKeyButton();
      message += ' The custom API key saved in this browser was rejected and has been cleared — the built-in key will be used on the next attempt.';
    } else {
      message += ' The built-in API key was rejected — it may have been rotated or disabled. Use the "API key" button (bottom-left) to enter a valid key.';
    }
  }
  return new Error(message);
}

const anthropic = {
  messages: {
    async create(params) {
      const res = await fetch(ANTHROPIC_ENDPOINT, {
        method: 'POST',
        headers: anthropicHeaders(),
        body: JSON.stringify(params),
      });
      if (!res.ok) throw await readAnthropicError(res);
      return res.json();
    },

    // Async generator yielding the same event objects the SDK stream emits
    // (engine.js only consumes content_block_delta / text_delta events).
    stream(params) {
      return (async function* () {
        const res = await fetch(ANTHROPIC_ENDPOINT, {
          method: 'POST',
          headers: anthropicHeaders(),
          body: JSON.stringify({ ...params, stream: true }),
        });
        if (!res.ok) throw await readAnthropicError(res);

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const chunks = buffer.split('\n\n');
          buffer = chunks.pop();
          for (const chunk of chunks) {
            for (const line of chunk.split('\n')) {
              if (!line.startsWith('data: ')) continue;
              const data = line.slice(6).trim();
              if (!data || data === '[DONE]') continue;
              let event;
              try { event = JSON.parse(data); } catch { continue; }
              if (event.type === 'error') {
                throw new Error(event.error?.message || 'Anthropic streaming error.');
              }
              yield event;
            }
          }
        }
      })();
    },
  },
};

/* ── Route the app's backend calls to engine.js ─────────────────────────── */

function localSseResponse(init) {
  let body;
  try { body = JSON.parse(init?.body || '{}'); } catch { body = {}; }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (payload) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
        } catch { /* consumer cancelled */ }
      };
      try {
        await handleGenerate(body, send);
      } catch (err) {
        console.error('Generation error:', err);
        send({ error: err?.message || 'Generation failed.' });
      }
      try { controller.close(); } catch { /* already closed */ }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: { 'Content-Type': 'text/event-stream' },
  });
}

async function localJsonResponse(init) {
  let body;
  try { body = JSON.parse(init?.body || '{}'); } catch { body = {}; }
  try {
    const result = await handleGenerateJson(body);
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err?.message || 'JSON generation failed.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

if (ENGINE_MODE) {
  const realFetch = window.fetch.bind(window);
  window.fetch = (input, init) => {
    const url = typeof input === 'string' ? input : input?.url || '';
    if (url === '/generate') return Promise.resolve(localSseResponse(init));
    if (url === '/generate-json') return localJsonResponse(init);
    return realFetch(input, init);
  };
}

/* ── Small "API key" button so the key can be changed later ─────────────── */

let keyButton = null;

function updateKeyButton() {
  if (!keyButton) return;
  keyButton.textContent = getStoredApiKey()
    ? 'API key ✓ (custom)'
    : (getDefaultApiKey() ? 'API key ✓' : 'Set API key');
}

if (STATIC_MODE) {
  document.addEventListener('DOMContentLoaded', () => {
    keyButton = document.createElement('button');
    keyButton.type = 'button';
    keyButton.title = 'Set or replace the Anthropic API key stored in this browser';
    keyButton.style.cssText =
      'position:fixed;left:12px;bottom:12px;z-index:9999;padding:6px 12px;' +
      'font:600 11px/1 system-ui,sans-serif;letter-spacing:.04em;cursor:pointer;' +
      'color:#f5f0e8;background:rgba(20,20,24,.85);border:1px solid rgba(245,240,232,.25);' +
      'border-radius:999px;backdrop-filter:blur(4px);opacity:.75;';
    keyButton.addEventListener('mouseenter', () => (keyButton.style.opacity = '1'));
    keyButton.addEventListener('mouseleave', () => (keyButton.style.opacity = '.75'));
    keyButton.addEventListener('click', () => {
      const current = getStoredApiKey();
      requestApiKey(
        current
          ? `An API key ending in "…${current.slice(-4)}" is saved in this browser.\n\nPaste a new key to replace it (or press Cancel to keep it):`
          : undefined
      );
    });
    updateKeyButton();
    document.body.appendChild(keyButton);
  });
}

window.anthropic = anthropic;
})();
