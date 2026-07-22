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

const STATIC_MODE =
  location.protocol === 'file:' ||
  !/^(localhost|127\.|\[::1\])/.test(location.hostname);

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
  return {
    'content-type': 'application/json',
    'x-api-key': ensureApiKey(),
    'anthropic-version': '2023-06-01',
    'anthropic-dangerous-direct-browser-access': 'true',
  };
}

async function readAnthropicError(res) {
  let message = `Anthropic API request failed (${res.status}).`;
  try {
    const data = await res.json();
    message = data?.error?.message || message;
  } catch { /* non-JSON body */ }
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
      const res = await fetch('https://api.anthropic.com/v1/messages', {
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
        const res = await fetch('https://api.anthropic.com/v1/messages', {
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

if (STATIC_MODE) {
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
