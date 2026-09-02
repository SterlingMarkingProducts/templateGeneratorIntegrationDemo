/* ============================================================================
   browser-api.js — the Generator's AI transport.
   Provides the `anthropic` client used by engine.js and intercepts the app's
   fetch('/generate') and fetch('/generate-json') calls, routing them to
   engine.js instead of a backend.

   EVERY AI call goes to Sterling's server-side endpoint, same-origin and
   RELATIVE to this page (generator/api/claude.cfm), which accepts the exact
   Anthropic Messages JSON body and owns the Anthropic credentials entirely.
   The browser holds no key, stores no key, sends no key, and never asks for
   one; any key an old build left in localStorage or a cookie is simply
   ignored. api.anthropic.com is never called from the browser.
   ========================================================================= */
(() => {
'use strict';

/* Same-origin, relative to generator/index.html, so no host and no clone
   folder is hardcoded: /git/<clone>/generator/api/claude.cfm wherever the
   page is served from. */
const ANTHROPIC_ENDPOINT = 'api/claude.cfm';

/* engine.js runs in the browser everywhere; the transport is one endpoint. */
const ENGINE_MODE = true;

function anthropicHeaders() {
  /* NO credentials, ever: the server endpoint authenticates to Anthropic with
     its own configuration. The body is the exact Anthropic Messages JSON. */
  return { 'content-type': 'application/json' };
}

async function readAnthropicError(res) {
  let message = `The AI service request failed (${res.status}).`;
  try {
    const data = await res.json();
    message = data?.error?.message || message;
  } catch { /* non-JSON body */ }
  return new Error(message);
}

/* FAIL LOUD, NEVER SPIN FOREVER. A server endpoint may BUFFER the whole
 * upstream response — the browser sees nothing until the generation finishes.
 * If that response is dropped, stalled or never sent, every await above this
 * layer would wait forever and the Generator would sit on its spinner with no
 * way out. Every AI call runs under a deadline and aborts into a visible
 * error instead.
 * Tests may shorten these via window.SMP_AI_TIMEOUTS = {create, stream} (ms). */
function aiTimeouts() {
  const o = window.SMP_AI_TIMEOUTS || {};
  return {
    create: (o.create > 0) ? o.create : 180000,
    stream: (o.stream > 0) ? o.stream : 360000,
  };
}

async function fetchAiWithDeadline(params, ms, what) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), ms);
  try {
    return await fetch(ANTHROPIC_ENDPOINT, {
      method: 'POST',
      headers: anthropicHeaders(),
      body: JSON.stringify(params),
      signal: ctl.signal,
    });
  } catch (err) {
    if (ctl.signal.aborted) {
      throw new Error(what + ' did not respond within ' + Math.round(ms / 1000)
        + 's. The server may be overloaded or the AI proxy stalled — please try again.');
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

const anthropic = {
  messages: {
    async create(params) {
      const res = await fetchAiWithDeadline(params, aiTimeouts().create, 'The AI service');
      if (!res.ok) throw await readAnthropicError(res);
      return res.json();
    },

    // Async generator yielding the same event objects the SDK stream emits
    // (engine.js only consumes content_block_delta / text_delta events).
    stream(params) {
      return (async function* () {
        /* One deadline covers the whole exchange: on the buffered web03 proxy
         * the entire response arrives in one burst near the end, so a
         * per-chunk watchdog would be meaningless — either the burst arrives
         * inside the budget or the request is dead. */
        const budget = aiTimeouts().stream;
        const ctl = new AbortController();
        const timer = setTimeout(() => ctl.abort(), budget);
        try {
        const res = await fetch(ANTHROPIC_ENDPOINT, {
          method: 'POST',
          headers: anthropicHeaders(),
          body: JSON.stringify({ ...params, stream: true }),
          signal: ctl.signal,
        });
        if (!res.ok) throw await readAnthropicError(res);

        /* ADAPT TO THE SERVER'S RESPONSE TRANSPORT. An SSE relay
           (text/event-stream) is parsed event by event exactly as before. A
           server that BUFFERS the upstream call and answers with one complete
           Anthropic message JSON is translated into the same events, so
           engine.js sees no difference either way. */
        const ctype = (res.headers.get('content-type') || '').toLowerCase();
        if (ctype.indexOf('text/event-stream') === -1) {
          const data = await res.json();
          if (data && data.error) {
            throw new Error(data.error.message || 'The AI service returned an error.');
          }
          const blocks = (data && data.content) || [];
          for (const block of blocks) {
            if (block && block.type === 'text' && block.text) {
              yield { type: 'content_block_delta', delta: { type: 'text_delta', text: block.text } };
            }
          }
          return;
        }
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
        } catch (err) {
          if (ctl.signal.aborted) {
            throw new Error('The AI design service did not respond within '
              + Math.round(budget / 1000) + 's. The server may be overloaded or the '
              + 'AI proxy stalled — please try again.');
          }
          throw err;
        } finally {
          clearTimeout(timer);
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

window.anthropic = anthropic;
})();
