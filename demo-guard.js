/* Demo safety guard — loaded FIRST on every page of this demonstration site.
 *
 * 1. Blocks any attempted network request to Sterling production domains
 *    (fetch, XMLHttpRequest, sendBeacon) and logs a clear console warning.
 * 2. Injects the standing demonstration banner if the page has not already
 *    rendered one (element id "demo-banner").
 */
(function () {
  'use strict';

  window.DEMO_BUILD = 'tier1-30';

  var BLOCKED_HOST = /(^|\.)sterling\.ca$/i;
  var WARNING = '[DEMO GUARD] Blocked a network request to a Sterling production domain: ';

  /* ── the one exception ───────────────────────────────────────────────────
   *
   * The web03 dev E2E clone is itself served from web03.sterling.ca, so the
   * same-origin POST to the verified dev import endpoint matches BLOCKED_HOST
   * and is refused before it leaves the page. That request is the whole point
   * of that clone, and it reaches designCentral-dev, never production.
   *
   * It is allowed only when EVERY one of these holds, checked per request:
   *
   *   - this page is itself served from the dev clone folder
   *   - web03-dev-bootstrap.js has activated, and the endpoint IT is
   *     configured with is exactly the endpoint named here — two independent
   *     constants that have to agree
   *   - the request is same-origin
   *   - its path is exactly that endpoint, nothing else under it
   *
   * Both constants are fixed in source. Nothing is read from the query
   * string, a form field or a header, so no link and no page input can widen
   * this. Every other sterling.ca request — from this clone included — stays
   * blocked, and the exception is fetch-only: XHR and sendBeacon keep the
   * unconditional guard. */
  /* The cfGitPuller folders that get dev behaviour. The approved integration
   * clone, and the experimental design-quality clone alongside it, so the two
   * can be compared on web03 without either one being redeployed over the
   * other. Longest first, and each is matched with its trailing slash, so
   * '/generator-web03-dev-e2e/' cannot match the '-phase1' folder by accident.
   * These are CONSTANTS: nothing is read from the URL or the query string, so
   * no crafted link can turn dev behaviour on anywhere else. */
  var DEV_CLONE_FOLDERS = ['/generator-web03-dev-e2e-phase1/', '/generator-web03-dev-e2e/'];
  var DEV_IMPORT_PATH  = '/git/web03-dev-e2e/tests/web03-dev-e2e/templateImport.cfm';
  /* The same-origin AI proxy. It adds the Anthropic key server-side, so the
   * request that reaches it carries no credentials — exactly like the import. */
  var DEV_AI_PROXY_PATH = '/git/web03-dev-e2e/tests/web03-dev-e2e/aiProxy.cfm';
  /* The proxy's read-only companion. It answers one question — does this server
   * hold an Anthropic key of its own — with a boolean, makes no upstream call
   * and returns nothing derived from a key. Without this exception the dev
   * clone cannot ask, so it would prompt for a key even where the server
   * already has one. */
  var DEV_AI_STATUS_PATH = '/git/web03-dev-e2e/tests/web03-dev-e2e/aiKeyStatus.cfm';
  /* The dev product picker's source: designCentral-dev, read-only, SELECT only.
   * The clone reads its own product catalogue from it instead of the
   * spreadsheet files, so without this exception the picker has no source at
   * all when the clone is served from web03.sterling.ca. */
  var DEV_CATALOGUE_PATH = '/git/web03-dev-e2e/tests/web03-dev-e2e/devProductCatalogue.cfm';
  var DEV_DATA_FILE    = /^[A-Za-z0-9._-]+\.json$/;

  /* The clone directory this page is being served from, or null when it is not
   * being served from the dev clone at all. Built from the page's OWN path, so
   * it cannot be pointed anywhere else. */
  function devCloneRoot() {
    var here = window.location.pathname;
    for (var i = 0; i < DEV_CLONE_FOLDERS.length; i++) {
      var at = here.indexOf(DEV_CLONE_FOLDERS[i]);
      if (at !== -1) { return here.slice(0, at + DEV_CLONE_FOLDERS[i].length); }
    }
    return null;
  }

  /* The verified dev import endpoint, and only it. Two independent constants —
   * this one and the bootstrap's — have to name the same URL. */
  function isDevImportEndpoint(u, root) {
    var dev = window.SMPWeb03Dev;
    if (!dev || dev.active !== true) return false;
    if (dev.importBase + '/templateImport.cfm' !== DEV_IMPORT_PATH) return false;
    return u.pathname === DEV_IMPORT_PATH;
  }

  /* The AI proxy, and only it. Same shape as the import exception: the page
   * must be the dev clone, the request must be same-origin, and the path must
   * match this constant exactly. It is checked WITHOUT requiring the bootstrap,
   * because browser-api.js issues its request from the page's own load path and
   * the two constants are independent by design. */
  function isDevAiProxy(u) {
    return u.pathname === DEV_AI_PROXY_PATH;
  }

  /* The key-status probe, and only it. Same shape and same reasoning as the
   * proxy exception above: one exact path, fixed in source. */
  function isDevAiKeyStatus(u) {
    return u.pathname === DEV_AI_STATUS_PATH;
  }

  /* The live product catalogue, and only it. Same shape as the two above: one
   * exact path, fixed in source. */
  function isDevCatalogue(u) {
    return u.pathname === DEV_CATALOGUE_PATH;
  }

  /* The clone's OWN committed catalogue and demo files, read from its own
   * directory. product-select.js and demo-samples.js fetch these; on web03 the
   * clone is served from web03.sterling.ca, so the guard was refusing the page
   * its own static assets — which is what emptied the product picker and
   * removed the demo shortcuts entirely. The path is composed from this page's
   * own directory plus a plain file name, so it can only ever reach a file
   * beside the page itself. */
  function isDevCloneData(u, root) {
    var rest = u.pathname.indexOf(root) === 0 ? u.pathname.slice(root.length) : null;
    if (rest === null || rest.indexOf('data/') !== 0) return false;
    return DEV_DATA_FILE.test(rest.slice('data/'.length));
  }

  function isDevAllowed(u, allowDevImport) {
    var root = devCloneRoot();
    if (!root || u.origin !== window.location.origin) return false;
    return isDevCloneData(u, root)
      || (allowDevImport && (isDevImportEndpoint(u, root) || isDevAiProxy(u)
                             || isDevAiKeyStatus(u) || isDevCatalogue(u)));
  }

  function isBlocked(url, allowDevImport) {
    try {
      var u = new URL(url, window.location.href);
      if (!BLOCKED_HOST.test(u.hostname)) return false;
      return !isDevAllowed(u, allowDevImport);
    } catch (e) { return false; }
  }

  var realFetch = window.fetch;
  window.fetch = function (input, init) {
    var url = (input && input.url) || String(input);
    if (isBlocked(url, true)) {
      console.warn(WARNING + url);
      return Promise.reject(new Error('Blocked by demo guard: production domains are unreachable from this demonstration.'));
    }
    return realFetch.apply(this, arguments);
  };

  var realOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url) {
    if (isBlocked(url)) {
      console.warn(WARNING + url);
      throw new Error('Blocked by demo guard: production domains are unreachable from this demonstration.');
    }
    return realOpen.apply(this, arguments);
  };

  if (navigator.sendBeacon) {
    var realBeacon = navigator.sendBeacon.bind(navigator);
    navigator.sendBeacon = function (url, data) {
      if (isBlocked(url)) { console.warn(WARNING + url); return false; }
      return realBeacon(url, data);
    };
  }

  function injectBanner() {
    if (document.getElementById('demo-banner')) return;
    var b = document.createElement('div');
    b.id = 'demo-banner';
    var devBanner = null;

    /* On the web03 dev clones the hazard-striped sticky banner was the wrong
     * instrument: everyone using those URLs already knows it is a dev
     * environment, and a sticky bar sat over the Generator's own controls.
     * A quiet line in normal document flow says the same thing and takes
     * nothing away — NOT sticky, NOT fixed, NOT absolute, no z-index, so it
     * can never overlap the page. Every other deployment keeps the loud
     * banner unchanged: there it is a real warning to a real visitor. */
    if (devCloneRoot()) {
      b.textContent = 'DEV TEST ENVIRONMENT \u00b7 designCentral-dev \u00b7 Not Production'
        + (window.DEMO_BUILD ? ' \u00b7 build ' + window.DEMO_BUILD : '');
      b.style.cssText = 'position:static;background:#f2f2f4;color:#5b5b66;'
        + 'font:500 11px/1.4 system-ui,-apple-system,Segoe UI,Arial,sans-serif;'
        + 'text-align:center;padding:4px 10px;letter-spacing:.06em;'
        + 'border-bottom:1px solid #e2e2e6;';
      devBanner = b;
    } else {
      b.textContent = "TEST DEMONSTRATION — NOT CONNECTED TO STERLING'S LIVE DESIGNER, DATABASE, CART, OR ORDERING SYSTEM · build " + window.DEMO_BUILD;
      b.style.cssText = 'position:sticky;top:0;left:0;right:0;z-index:99999;background:repeating-linear-gradient(45deg,#e8590c,#e8590c 14px,#b74708 14px,#b74708 28px);color:#fff;font:700 12px/1.5 Arial,sans-serif;text-align:center;padding:7px 10px;letter-spacing:.04em';
    }
    document.body.insertBefore(b, document.body.firstChild);

    /* The Generator's own header is position:fixed, so an in-flow line at the
     * top of <body> would sit UNDER it and be unreadable. The banner stays in
     * flow — it pushes the page down by its own height — and the fixed header
     * is moved down by exactly that much, so the two sit one above the other
     * with nothing overlapping and no gap. Presentation only, dev clones only. */
    if (devBanner) {
      var drop = Math.round(devBanner.getBoundingClientRect().height);
      var header = document.querySelector('header');
      if (drop > 0 && header && getComputedStyle(header).position === 'fixed') {
        header.style.top = drop + 'px';
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectBanner);
  } else {
    injectBanner();
  }
})();
