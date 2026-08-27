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
  var DEV_CLONE_FOLDER = '/generator-web03-dev-e2e/';
  var DEV_IMPORT_PATH  = '/git/web03-dev-e2e/tests/web03-dev-e2e/templateImport.cfm';
  var DEV_DATA_FILE    = /^[A-Za-z0-9._-]+\.json$/;

  /* The clone directory this page is being served from, or null when it is not
   * being served from the dev clone at all. Built from the page's OWN path, so
   * it cannot be pointed anywhere else. */
  function devCloneRoot() {
    var here = window.location.pathname;
    var at = here.indexOf(DEV_CLONE_FOLDER);
    return at === -1 ? null : here.slice(0, at + DEV_CLONE_FOLDER.length);
  }

  /* The verified dev import endpoint, and only it. Two independent constants —
   * this one and the bootstrap's — have to name the same URL. */
  function isDevImportEndpoint(u, root) {
    var dev = window.SMPWeb03Dev;
    if (!dev || dev.active !== true) return false;
    if (dev.importBase + '/templateImport.cfm' !== DEV_IMPORT_PATH) return false;
    return u.pathname === DEV_IMPORT_PATH;
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
    return isDevCloneData(u, root) || (allowDevImport && isDevImportEndpoint(u, root));
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
    b.textContent = "TEST DEMONSTRATION — NOT CONNECTED TO STERLING'S LIVE DESIGNER, DATABASE, CART, OR ORDERING SYSTEM · build " + window.DEMO_BUILD;
    b.style.cssText = 'position:sticky;top:0;left:0;right:0;z-index:99999;background:repeating-linear-gradient(45deg,#e8590c,#e8590c 14px,#b74708 14px,#b74708 28px);color:#fff;font:700 12px/1.5 Arial,sans-serif;text-align:center;padding:7px 10px;letter-spacing:.04em';
    document.body.insertBefore(b, document.body.firstChild);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectBanner);
  } else {
    injectBanner();
  }
})();
