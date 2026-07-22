/* Transfer loader for the static test copy of the Sterling designer.
 *
 * Loaded AFTER SMPdesigner.js. When the page is opened with ?transfer=<id>
 * (set by the Template Generator's Push to Designer button), this waits for
 * the designer to finish booting its blank template, then feeds the pushed
 * version-1.2 design into the designer's own parseTemplate() — the exact code
 * path a real template load uses — so every object arrives editable.
 */
(function () {
  'use strict';
  var TRANSFER_KEY = 'smpDesignTransfer';

  function getParam(name) {
    var m = new RegExp('[?&]' + name + '=([^&]*)').exec(window.location.search);
    return m ? decodeURIComponent(m[1]) : '';
  }

  var id = getParam('transfer');
  if (!id) return;

  var record = null;
  try { record = JSON.parse(window.localStorage.getItem(TRANSFER_KEY + ':' + id)); } catch (e) {}
  if (!record || !record.design || record.design.version !== 1.2) return;
  if (record.expires && record.expires < Date.now()) return;

  function badge() {
    var b = document.createElement('div');
    b.textContent = 'Design imported from the Design Template Generator';
    b.style.cssText = 'position:fixed;bottom:10px;right:10px;z-index:99999;background:#e8590c;color:#fff;' +
      'padding:6px 12px;border-radius:6px;font:600 12px/1.4 Arial,sans-serif;box-shadow:0 2px 8px rgba(0,0,0,.3)';
    document.body.appendChild(b);
  }

  var tries = 0;
  var timer = setInterval(function () {
    tries++;
    var ready = typeof window.parseTemplate === 'function'
      && typeof window.currentCanvas !== 'undefined' && window.currentCanvas
      && window.canvases && window.canvases.length > 0;
    if (ready) {
      clearInterval(timer);
      // small settle delay so the blank-template boot finishes rendering first
      setTimeout(function () {
        try {
          window.parseTemplate(JSON.parse(JSON.stringify(record.design)));
          badge();
        } catch (e) {
          if (window.toastr) toastr.error('Transferred design could not be loaded: ' + e.message);
        }
      }, 600);
    } else if (tries > 100) { // ~30s
      clearInterval(timer);
    }
  }, 300);
})();
