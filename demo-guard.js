/* Demo safety guard — loaded FIRST on every page of this demonstration site.
 *
 * 1. Blocks any attempted network request to Sterling production domains
 *    (fetch, XMLHttpRequest, sendBeacon) and logs a clear console warning.
 * 2. Injects the standing demonstration banner if the page has not already
 *    rendered one (element id "demo-banner").
 */
(function () {
  'use strict';

  window.DEMO_BUILD = 'tier1-06';

  var BLOCKED_HOST = /(^|\.)sterling\.ca$/i;
  var WARNING = '[DEMO GUARD] Blocked a network request to a Sterling production domain: ';

  function isBlocked(url) {
    try {
      var u = new URL(url, window.location.href);
      return BLOCKED_HOST.test(u.hostname);
    } catch (e) { return false; }
  }

  var realFetch = window.fetch;
  window.fetch = function (input, init) {
    var url = (input && input.url) || String(input);
    if (isBlocked(url)) {
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
