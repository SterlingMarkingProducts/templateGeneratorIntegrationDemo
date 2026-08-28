/* Demo-only module: "Load sample design" buttons.
 *
 * Lets anyone exercise the full Push to Designer workflow with NO API key —
 * it loads a pre-built sample design (fetched from ../data/test-templates.json)
 * into the same state the generator reaches after a real AI generation.
 *
 * Each sample carries its OWN optional product binding in
 * data/test-templates.json:
 *
 *     "shortcut": true,
 *     "product": { "id": 6505, "partNumber": "BCDP-CM", "name": "..." },
 *     "orientation": "landscape"        // optional per-demo preference
 *
 * A demo may name its own preferred orientation; without one, the bound
 * product's family default applies (BCDP-CM -> landscape). Nothing here says
 * "demos are landscape" globally.
 *
 * There is deliberately no global "all demos are BCDP-CM" rule. A demo names
 * the Sterling product it belongs to, or names none and stays standalone; a
 * future poster or stamp demo only has to add its own product block. Samples
 * with "shortcut": false stay in the file for regression fixtures and tests
 * but get no user-facing button.
 */
(function () {
  'use strict';

  let samples = [];      // user-facing shortcut buttons
  let allSamples = [];   // every sample in the file, shortcuts or not

  /* Select the Sterling product this demo is bound to, if it names one, and
   * resolve only once the picker has really applied it — the product must be
   * live application state (geometry, page count, productId carried through
   * Push to Designer), not a cosmetic dropdown change. A demo with no product
   * block, or a part number the catalogue does not carry, loads standalone. */
  function bindProduct(sample) {
    var part = sample.product && sample.product.partNumber;
    if (!part || !window.SMPProductSelection) return Promise.resolve(null);
    /* A demo's own orientation preference, if it declares one, is consumed by
     * the product-selection handler; otherwise the product's family default
     * applies there. */
    if (typeof setPendingDemoOrientation === 'function') {
      setPendingDemoOrientation(sample.orientation || null);
    }
    return window.SMPProductSelection.selectByPartNumber(part)
      .catch(function (e) {
        console.warn('[demo-samples] product ' + part + ' unavailable for '
          + sample.name + ': ' + (e && e.message));
        return null;
      });
  }

  function loadSample(sample) {
    // Same state transition the app performs after generating
    lastPayload = {
      templateType: sample.templateType,
      width: sample.width, height: sample.height, unit: 'in',
      /* The orientation this sample's HTML was authored in. */
      orientation: sample.orientation
        || (sample.height > sample.width ? 'portrait' : 'landscape'),
      doubleSided: !!sample.doubleSided,
      businessName: sample.businessName || 'Demo Co',
    };
    generatedHtml = sample.html;
    /* Use the app's own panel switch so every pre-generation state — including
     * the product blank artboard — is hidden when the design appears. */
    if (typeof showPanel === 'function') {
      showPanel('result');
    } else {
      document.getElementById('emptyState').classList.add('hidden');
      document.getElementById('loadingState').classList.add('hidden');
      document.getElementById('blankState')?.classList.add('hidden');
      document.getElementById('resultState').classList.remove('hidden');
    }

    const widthPx = Math.round(toPx(sample.width, 'in'));
    const heightPx = Math.round(toPx(sample.height, 'in'));
    const frame = document.getElementById('previewFrame');
    const scaler = document.getElementById('iframeScaler');
    frame.style.width = widthPx + 'px';
    frame.style.height = heightPx + 'px';
    // Route through the same preview pipeline the real generator uses, so the
    // design is centered and scaled to cover the bleed canvas (otherwise a
    // trim-sized card sits in the top-left with white on the right/bottom).
    const rendered = (typeof renderPreviewHtml === 'function')
      ? renderPreviewHtml(sample.html, lastPayload) : sample.html;
    // For double-sided samples show the front and populate BOTH side thumbnails,
    // so Push to Designer transfers both pages (Front + Back).
    const showFront = (sample.doubleSided && typeof injectThumbSideCss === 'function')
      ? injectThumbSideCss(rendered, 'front') : rendered;
    // Mirror the real generation path exactly: reset zoom to 100% and let the
    // previewFrame 'load' listener (fitIframeToContent -> applyPreviewScale) fit
    // the preview with the correct bleed-inclusive size. Previously this called
    // applyPreviewScale directly with a NO-bleed size, which fought that listener
    // and made the design viewer appear to zoom out on each shortcut click.
    if (typeof userZoomPercent !== 'undefined') userZoomPercent = 100;
    if (typeof zoomLabel !== 'undefined' && zoomLabel) zoomLabel.textContent = '100%';
    frame.srcdoc = showFront;
    /* Fit + side visibility must not wait for the iframe 'load' event (a slow
     * fonts CDN can hold it back long after the document has painted). */
    if (typeof armPreviewReady === 'function') armPreviewReady();
    if (sample.doubleSided && typeof injectThumbSideCss === 'function') {
      // Populate BOTH per-side thumbnails with explicit sizes so Push to
      // Designer reliably transfers Front + Back (the converter reads these).
      [['thumbFrontFrame', 'front'], ['thumbBackFrame', 'back']].forEach(([id, side]) => {
        const tf = document.getElementById(id);
        if (!tf) return;
        tf.style.width = widthPx + 'px';
        tf.style.height = heightPx + 'px';
        tf.srcdoc = injectThumbSideCss(sample.html, side);
      });
      if (typeof updateSidePreviews === 'function') { try { updateSidePreviews(); } catch (e) {} }
    }
    const label = document.getElementById('toolbarLabel');
    if (label) label.textContent = sample.name + ' — Sample (demo)';
  }

  function buildUi() {
    const anchor = document.getElementById('generateBtn');
    if (!anchor || !anchor.parentNode) return;
    const wrap = document.createElement('div');
    wrap.style.cssText = 'margin-top:10px;padding:10px;border:1px dashed #e8590c;border-radius:8px;';
    const title = document.createElement('div');
    title.textContent = 'Demo shortcuts — no API key needed:';
    title.style.cssText = 'font-size:12px;font-weight:700;color:#e8590c;margin-bottom:6px;';
    wrap.appendChild(title);
    const list = document.createElement('div');
    list.style.cssText = 'max-height:260px;overflow-y:auto;';
    wrap.appendChild(list);
    samples.forEach(sample => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = 'Load sample: ' + sample.name;
      b.style.cssText = 'display:block;width:100%;margin:4px 0;padding:7px 10px;border:1px solid #e8590c;border-radius:6px;background:#fff4ec;color:#c04a08;font-weight:600;cursor:pointer;font-size:12px;text-align:left;';
      b.addEventListener('click', () => bindProduct(sample).then(() => loadSample(sample)));
      list.appendChild(b);
    });
    anchor.parentNode.insertBefore(wrap, anchor.nextSibling);
  }

  function byId(id) {
    return allSamples.filter(function (x) { return x.id === id; })[0] || null;
  }

  /* Test / preview surface. `list` is what a user can click; `all` includes the
   * samples kept only as regression fixtures, so tests that still need those
   * designs can load them without a user-facing button existing. */
  window.SMPDemoSamples = {
    /** The samples offered as user-facing shortcut buttons. */
    list: function () { return samples.slice(); },
    /** Every sample in the file, including non-shortcut regression fixtures. */
    all: function () { return allSamples.slice(); },
    /** Product this demo is bound to, or null when it is standalone. */
    productFor: function (id) {
      var s = byId(id);
      return (s && s.product) ? s.product : null;
    },
    /** Select the demo's bound product (if any) and load it — the button path. */
    load: function (id) {
      var s = byId(id);
      if (!s) return Promise.reject(new Error('No such demo sample: ' + id));
      return bindProduct(s).then(function () { loadSample(s); return s; });
    },
    /** Load a sample WITHOUT touching product selection — fixture path only. */
    loadDesignOnly: function (id) {
      var s = byId(id);
      if (!s) return Promise.reject(new Error('No such demo sample: ' + id));
      loadSample(s);
      return Promise.resolve(s);
    },
  };

  // Cache-bust the sample data by build stamp — otherwise the browser serves a
  // stale test-templates.json (sample edits wouldn't show even on a new build).
  const v = (typeof window !== 'undefined' && window.DEMO_BUILD) ? window.DEMO_BUILD : Date.now();

  fetch('../data/test-templates.json?v=' + encodeURIComponent(v))
    .then(r => r.json())
    .then(data => {
      // Samples without "shortcut": true remain available as regression
      // fixtures but are not offered as user-facing demo buttons.
      allSamples = data.samples || [];
      samples = allSamples.filter(s => s.shortcut === true);
      buildUi();
    })
    .catch(err => console.warn('Demo samples unavailable:', err.message));
})();
