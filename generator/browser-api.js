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

/* Anything resembling an Anthropic key is struck from text BEFORE it can
   reach the console or a toast — even if the server accidentally echoes one. */
function redactSecrets(text) {
  return String(text || '').replace(/sk-ant-[A-Za-z0-9_-]{4,}/g, 'sk-ant-[redacted]');
}

/* Does this body carry SSE framing? Content-Type alone is NOT trusted: the
   live claude.cfm was observed returning Anthropic SSE text under a JSON (or
   missing) Content-Type, and JSON.parse('event: message_start…') is exactly
   the "Unexpected token 'e'" failure the Generator showed. */
function looksLikeSse(text) {
  const t = String(text || '').replace(/^\uFEFF/, '').replace(/^\s+/, '');
  if (/^(event|data):/.test(t)) return true;
  return /(^|\n)event: *[A-Za-z_.]+ *\r?\n/.test(t.slice(0, 4096));
}

/* One complete SSE body -> its data payloads, in order. Blank lines, SSE
   comments, unknown event types and non-JSON data lines are ignored; an
   explicit error event is surfaced. Tolerates every standard Anthropic
   framing event (message_start … message_stop). */
function parseSseText(text) {
  const events = [];
  for (const line of String(text || '').split(/\r?\n/)) {
    if (line.indexOf('data:') !== 0) continue;
    const data = line.slice(5).trim();
    if (!data || data === '[DONE]') continue;
    let event;
    try { event = JSON.parse(data); } catch { continue; }
    if (event && event.type === 'error') {
      throw new Error(redactSecrets((event.error && event.error.message) || 'Anthropic streaming error.'));
    }
    events.push(event);
  }
  return events;
}

/* Assemble a complete Messages-shaped response from buffered SSE events, so a
   non-streaming caller receives the same object either way. */
function messageFromSseEvents(events) {
  let text = '';
  let base = null;
  for (const e of events) {
    if (!e) continue;
    if (e.type === 'message_start' && e.message) base = e.message;
    if (e.type === 'content_block_delta' && e.delta && e.delta.type === 'text_delta') {
      text += e.delta.text || '';
    }
  }
  const msg = base ? Object.assign({}, base) : { type: 'message', role: 'assistant' };
  msg.content = [{ type: 'text', text: text }];
  return msg;
}

/* A non-OK answer becomes a visible, SAFE error: the server's own words,
   truncated and redacted — never a bare status with the reason hidden. A
   fuller (still redacted) body goes to the console for diagnosis. */
function httpError(status, bodyText) {
  const raw = redactSecrets(String(bodyText || ''));
  let message = '';
  try {
    const data = JSON.parse(raw);
    message = (data && data.error && data.error.message) || '';
  } catch (e) { /* not JSON — use the text itself */ }
  if (!message) {
    message = raw.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 300);
  }
  try { console.warn('[ai-endpoint] HTTP ' + status + ' body: ' + raw.slice(0, 2000)); } catch (e) { /* logging only */ }
  return new Error('The AI service request failed (' + status + ')'
    + (message ? ': ' + message : '.'));
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

/* POST once under a deadline and read the WHOLE body as text (the body read
   stays inside the deadline: the abort signal cancels a stalled body too).
   The body is read exactly once; detection happens on the text. */
async function fetchAiText(params, ms, what) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), ms);
  try {
    const res = await fetch(ANTHROPIC_ENDPOINT, {
      method: 'POST',
      headers: anthropicHeaders(),
      body: JSON.stringify(params),
      signal: ctl.signal,
    });
    const text = await res.text();
    return { status: res.status, ok: res.ok,
      ctype: (res.headers.get('content-type') || '').toLowerCase(), text: text };
  } catch (err) {
    if (ctl.signal.aborted) {
      throw new Error(what + ' did not respond within ' + Math.round(ms / 1000)
        + 's. The server may be overloaded or the AI endpoint stalled — please try again.');
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/* Text body -> a complete Messages response, whatever the server sent:
   SSE framing (live-relayed or fully buffered) is assembled from its events;
   plain JSON is parsed; anything else fails visibly with a safe snippet. */
function messageFromBody(text) {
  const trimmed = String(text || '').replace(/^\uFEFF/, '').trim();
  if (looksLikeSse(trimmed)) {
    return messageFromSseEvents(parseSseText(trimmed));
  }
  let data;
  try { data = JSON.parse(trimmed); }
  catch (e) {
    throw new Error('The AI service returned an unreadable response: '
      + redactSecrets(trimmed.replace(/\s+/g, ' ').slice(0, 200)));
  }
  if (data && data.error) {
    throw new Error(redactSecrets((data.error && data.error.message) || 'The AI service returned an error.'));
  }
  return data;
}

const anthropic = {
  messages: {
    async create(params) {
      const r = await fetchAiText(params, aiTimeouts().create, 'The AI service');
      if (!r.ok) throw httpError(r.status, r.text);
      return messageFromBody(r.text);
    },

    // Async generator yielding the same event objects the SDK stream emits
    // (engine.js only consumes content_block_delta / text_delta events).
    stream(params) {
      return (async function* () {
        /* One deadline covers the whole exchange: a buffering server delivers
         * the entire response in one burst near the end, so a per-chunk
         * watchdog would be meaningless — either the burst arrives inside the
         * budget or the request is dead. */
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
        if (!res.ok) throw httpError(res.status, await res.text());

        /* ADAPT TO THE SERVER'S ACTUAL RESPONSE. Only a declared
           text/event-stream is read incrementally (a live relay). EVERYTHING
           else is read fully once, then detected by CONTENT: SSE framing
           under a wrong or missing Content-Type (what the live claude.cfm
           was observed doing) parses as SSE; a complete Anthropic message
           JSON becomes synthetic delta events; anything else fails visibly.
           A body beginning "event:" can never reach JSON.parse. */
        const ctype = (res.headers.get('content-type') || '').toLowerCase();
        if (ctype.indexOf('text/event-stream') === -1) {
          const text = await res.text();
          const trimmed = text.replace(/^\uFEFF/, '').trim();
          if (looksLikeSse(trimmed)) {
            for (const event of parseSseText(trimmed)) yield event;
            return;
          }
          let data;
          try { data = JSON.parse(trimmed); }
          catch (e) {
            throw new Error('The AI service returned an unreadable response: '
              + redactSecrets(trimmed.replace(/\s+/g, ' ').slice(0, 200)));
          }
          if (data && data.error) {
            throw new Error(redactSecrets((data.error && data.error.message) || 'The AI service returned an error.'));
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
              if (line.indexOf('data:') !== 0) continue;
              const data = line.slice(5).trim();
              if (!data || data === '[DONE]') continue;
              let event;
              try { event = JSON.parse(data); } catch { continue; }
              if (event.type === 'error') {
                throw new Error(redactSecrets(event.error?.message || 'Anthropic streaming error.'));
              }
              yield event;
            }
          }
        }
        } catch (err) {
          if (ctl.signal.aborted) {
            throw new Error('The AI design service did not respond within '
              + Math.round(budget / 1000) + 's. The server may be overloaded or the '
              + 'AI endpoint stalled — please try again.');
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
