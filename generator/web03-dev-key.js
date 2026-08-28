/* ═══════════════════════════════════════════════════════════════════════════
   DEV-ONLY Anthropic key: storage + the one-time setup dialog.
   web03 dev clone only. NO KEY IS EVER STORED IN THIS FILE OR IN GIT.

   Why this exists at all: on web03 the Lucee service has no ANTHROPIC_API_KEY
   configured, and a key committed to the repository gets reported by GitHub's
   secret scanning and revoked by Anthropic within minutes. So the key is asked
   for once, in the page, and kept in this browser.

   WHY TWO STORES. Nothing in the Generator clears localStorage — the only
   removals anywhere are the transfer-prefix prune in transport-local.js and the
   public build's own key button, neither of which touches this value. A key set
   by hand still disappeared, and localStorage has two ways of doing that which
   no application code can see:

     · http://web03… and https://web03… are DIFFERENT origins with separate
       localStorage. Set on one scheme, invisible on the other.
     · the preview is rendered in sandboxed srcdoc iframes. A DevTools console
       left on one of those writes to a different, throwaway store.

   A cookie is scoped to the HOST, not the scheme or the frame, so it survives
   both. localStorage stays the primary store and the cookie mirrors it; a read
   that finds only the cookie restores localStorage from it. Neither is written
   by anything else, and no console is involved any more.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* The cfGitPuller folders that get dev behaviour. The approved integration
   * clone, and the experimental design-quality clone alongside it, so the two
   * can be compared on web03 without either one being redeployed over the
   * other. Longest first, and each is matched with its trailing slash, so
   * '/generator-web03-dev-e2e/' cannot match the '-phase1' folder by accident.
   * These are CONSTANTS: nothing is read from the URL or the query string, so
   * no crafted link can turn dev behaviour on anywhere else. */
  var CLONE_FOLDERS = ['/generator-web03-dev-e2e-phase2c/', '/generator-web03-dev-e2e-phase1/',
    '/generator-web03-dev-e2e/'];
  var here = window.location.pathname || '';
  if (!CLONE_FOLDERS.some(function (f) { return here.indexOf(f) !== -1; })) { return; }

  var STORAGE_KEY = 'SMP_WEB03_DEV_ANTHROPIC_API_KEY';
  var COOKIE_NAME = 'smp_web03_dev_anthropic_key';
  var COOKIE_DAYS = 90;
  var STATUS_URL  = '/git/web03-dev-e2e/tests/web03-dev-e2e/aiKeyStatus.cfm';

  var memory = '';          /* this page's copy, so a wiped store still works */
  var serverHasKey = null;  /* null until aiKeyStatus answers */

  /* ── storage ─────────────────────────────────────────────────────────── */
  function readCookie() {
    var parts = (document.cookie || '').split(';');
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i].trim();
      if (p.indexOf(COOKIE_NAME + '=') === 0) {
        try { return decodeURIComponent(p.slice(COOKIE_NAME.length + 1)); }
        catch (e) { return ''; }
      }
    }
    return '';
  }

  function writeCookie(value) {
    var expires = new Date(Date.now() + COOKIE_DAYS * 864e5).toUTCString();
    /* Host-scoped, path-wide, not Secure — deliberately, so the value survives
     * whichever scheme the dev clone is opened over. SameSite=Lax keeps it off
     * cross-site requests. This is a dev credential on an internal host. */
    document.cookie = COOKIE_NAME + '=' + encodeURIComponent(value)
      + '; path=/; expires=' + expires + '; SameSite=Lax';
  }

  function clearCookie() {
    document.cookie = COOKIE_NAME + '=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax';
  }

  function get() {
    if (memory) { return memory; }
    var v = '';
    try { v = (localStorage.getItem(STORAGE_KEY) || '').trim(); } catch (e) { /* blocked */ }
    if (!v) {
      v = (readCookie() || '').trim();
      /* Found only in the cookie — put it back where it belongs. */
      if (v) { try { localStorage.setItem(STORAGE_KEY, v); } catch (e) { /* blocked */ } }
    }
    memory = v;
    return v;
  }

  function set(value) {
    var v = (value || '').trim();
    memory = v;
    try { localStorage.setItem(STORAGE_KEY, v); } catch (e) { /* blocked */ }
    writeCookie(v);
  }

  function clear() {
    memory = '';
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* blocked */ }
    clearCookie();
  }

  /* ── the dialog ──────────────────────────────────────────────────────── */
  var overlay = null;
  var onEscape = null;

  function close() {
    if (overlay && overlay.parentNode) { overlay.parentNode.removeChild(overlay); }
    if (onEscape) { document.removeEventListener('keydown', onEscape); onEscape = null; }
    overlay = null;
  }

  /* DISMISSIBLE, deliberately. The key is needed for design generation and for
   * nothing else, so a dialog that cannot be closed would also block the parts
   * of this clone that never call Anthropic — loading a sample, or pushing a
   * template to the Designer. Dismiss it and the page is fully usable; the next
   * generation attempt brings it straight back, because the proxy answers a
   * keyless request with a 503 and browser-api.js reopens this. */
  function open(message) {
    if (overlay) { return; }
    overlay = document.createElement('div');
    overlay.id = 'smpDevKeyDialog';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:2147483600;'
      + 'background:rgba(16,16,20,.72);display:flex;align-items:center;'
      + 'justify-content:center;padding:24px;';

    var card = document.createElement('div');
    card.style.cssText = 'background:#fff;color:#1c1c20;max-width:440px;width:100%;'
      + 'border-radius:10px;padding:22px 24px;box-shadow:0 12px 40px rgba(0,0,0,.35);'
      + 'font:14px/1.55 system-ui,-apple-system,Segoe UI,Arial,sans-serif;';

    var h = document.createElement('div');
    h.textContent = 'Dev API Setup';
    h.style.cssText = 'font:700 17px/1.3 inherit;margin-bottom:8px;';

    var p = document.createElement('div');
    p.textContent = 'Paste your Anthropic API key once to enable live design '
      + 'generation on this browser.';
    p.style.cssText = 'margin-bottom:14px;color:#3a3a42;';

    var warn = null;
    if (message) {
      warn = document.createElement('div');
      warn.textContent = message;
      warn.style.cssText = 'margin-bottom:12px;padding:8px 10px;border-radius:6px;'
        + 'background:#fdecea;color:#8c1d13;font-weight:600;';
    }

    var input = document.createElement('input');
    input.type = 'password';
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.placeholder = 'sk-ant-…';
    input.setAttribute('aria-label', 'Anthropic API key');
    input.style.cssText = 'width:100%;box-sizing:border-box;padding:9px 11px;'
      + 'border:1px solid #c9c9d1;border-radius:6px;font:13px/1.4 ui-monospace,'
      + 'SFMono-Regular,Menlo,monospace;';

    var err = document.createElement('div');
    err.style.cssText = 'min-height:18px;margin:6px 0 2px;color:#8c1d13;font-size:12px;';

    var save = document.createElement('button');
    save.type = 'button';
    save.textContent = 'Save & Continue';
    save.style.cssText = 'width:100%;margin-top:8px;padding:10px 14px;border:0;'
      + 'border-radius:6px;background:#1c1c20;color:#fff;font:600 14px inherit;cursor:pointer;';

    var later = document.createElement('button');
    later.type = 'button';
    later.textContent = 'Not now';
    later.style.cssText = 'display:block;margin:10px auto 0;padding:4px 8px;border:0;'
      + 'background:none;color:#5b5b66;font:13px inherit;text-decoration:underline;cursor:pointer;';
    later.addEventListener('click', close);

    var note = document.createElement('div');
    note.textContent = 'Stored only in this browser for development.';
    note.style.cssText = 'margin-top:12px;font-size:12px;color:#71717a;text-align:center;';

    function submit() {
      var v = (input.value || '').trim();
      if (v.length < 20) { err.textContent = 'That does not look like an API key.'; return; }
      set(v);
      close();
    }
    save.addEventListener('click', submit);
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') { submit(); } });

    card.appendChild(h);
    card.appendChild(p);
    if (warn) { card.appendChild(warn); }
    card.appendChild(input);
    card.appendChild(err);
    card.appendChild(save);
    card.appendChild(later);
    card.appendChild(note);
    overlay.appendChild(card);
    /* Clicking the backdrop, or Escape, is the same as "Not now". */
    overlay.addEventListener('click', function (e) { if (e.target === overlay) { close(); } });
    onEscape = function (e) { if (e.key === 'Escape') { close(); } };
    document.addEventListener('keydown', onEscape);
    document.body.appendChild(overlay);
    input.focus();
  }

  /* Anthropic refused the stored key: drop it and ask again, in plain words. */
  function rejected() {
    clear();
    open('Anthropic rejected this API key. Enter a different key.');
  }

  /* ── when to ask ─────────────────────────────────────────────────────── */
  function maybePrompt() {
    if (get()) { return; }                 /* already have one */
    if (serverHasKey === true) { return; } /* the server has its own — never ask */
    open('');
  }

  function start() {
    /* Ask the dev endpoint whether the Lucee service has a key. It costs
     * nothing — no upstream call — and returns a boolean. If it cannot be
     * reached, fall back to asking, which is the case that actually needs it. */
    fetch(STATUS_URL, { credentials: 'same-origin' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) { serverHasKey = !!(d && d.serverKeyConfigured); })
      .catch(function () { serverHasKey = false; })
      .then(maybePrompt);
  }

  window.SMPDevKey = {
    get: get, set: set, clear: clear,
    open: open, rejected: rejected,
    serverHasKey: function () { return serverHasKey; },
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
}());
