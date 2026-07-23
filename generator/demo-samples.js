/* Demo-only module: "Load sample design" buttons.
 *
 * Lets anyone exercise the full Push to Designer workflow with NO API key —
 * it loads a pre-built sample design (fetched from ../data/test-templates.json)
 * into the same state the generator reaches after a real AI generation.
 */
(function () {
  'use strict';

  let samples = [];

  function loadSample(sample) {
    // Same state transition the app performs after generating
    lastPayload = {
      templateType: sample.templateType,
      width: sample.width, height: sample.height, unit: 'in',
      doubleSided: !!sample.doubleSided,
      businessName: sample.businessName || 'Demo Co',
    };
    generatedHtml = sample.html;
    document.getElementById('emptyState').classList.add('hidden');
    document.getElementById('loadingState').classList.add('hidden');
    document.getElementById('resultState').classList.remove('hidden');

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
    frame.srcdoc = showFront;
    if (scaler) applyPreviewScale(widthPx, heightPx);
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
      b.addEventListener('click', () => loadSample(sample));
      list.appendChild(b);
    });
    anchor.parentNode.insertBefore(wrap, anchor.nextSibling);
  }

  fetch('../data/test-templates.json')
    .then(r => r.json())
    .then(data => { samples = data.samples; buildUi(); })
    .catch(err => console.warn('Demo samples unavailable:', err.message));
})();
