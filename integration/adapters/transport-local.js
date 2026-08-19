/* Transport — how a translated design package gets from the Generator to a
 * designer, independent of WHAT was translated.
 *
 * Today: a same-origin localStorage handoff between two static pages. That is a
 * DEMO TRANSPORT, and it is the weakest link in the current integration — it is
 * isolated here so replacing it (a staging POST endpoint, a Sterling
 * templateImport bridge, a signed URL) touches nothing else.
 *
 * The functions below are carried over verbatim from the working prototype;
 * their behaviour, size-fallback ladder and error text are unchanged.
 */
(function (root) {
  'use strict';

  var CONFIG = {
    /* Set once a staging receive endpoint exists, e.g.
     * 'https://staging.sterling.ca/designer/receiveTransfer.cfm' */
    endpoint: '',
    key: 'smpDesignTransfer',
    ttlMs: 30 * 60 * 1000,
  };

  /* Re-encode a PNG/WebP data URI as opaque JPEG (optionally downscaled). Fills a
   * white backdrop first so any transparent pixels (e.g. rounded card corners in
   * the bleed margin) don't turn black. Returns the original src on any failure. */
  async function recompressDataUriToJpeg(src, quality, maxSide) {
    if (typeof src !== 'string' || !/^data:image\/(png|webp)/i.test(src)) return src;
    try {
      const img = new Image();
      await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = src; });
      let w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
      if (maxSide && Math.max(w, h) > maxSide) {
        const k = maxSide / Math.max(w, h); w = Math.round(w * k); h = Math.round(h * k);
      }
      const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
      const ctx = cv.getContext('2d');
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      return cv.toDataURL('image/jpeg', quality);
    } catch (e) { return src; }
  }

  /* Shrink a template's raster images so a decoration-heavy design still fits the
   * browser-only demo transport (localStorage, ~5 MB). DEMO TRANSPORT ONLY — a
   * hosted deployment posts the ORIGINAL full-quality PNG template to the staging
   * endpoint and Download JSON keeps PNG too, so print-production export quality
   * is unchanged. Compresses the opaque background raster hardest; small overlay
   * images are left alone. */
  async function compressTemplateForDemoTransport(template, opts) {
    const { bgQuality = 0.85, imgQuality = 0.9, maxSide = 0 } = opts || {};
    for (const page of template.pages || []) {
      const objs = (page.canvasData && page.canvasData.objects) || [];
      for (const o of objs) {
        if (o.type !== 'image' || typeof o.src !== 'string' || !o.src.startsWith('data:image/png')) continue;
        const isBg = o.sterlingType === 'backgroundArt' || o.sterlingType === 'fixedImage';
        o.src = await recompressDataUriToJpeg(o.src, isBg ? bgQuality : imgQuality, isBg ? maxSide : 0);
      }
    }
    return template;
  }

  function storeTransferLocally(template) {
    const id = 'tg-' + Math.random().toString(36).slice(2, 10);
    const record = {
      id, format: 'sterling-template-1.2', source: 'templateGenerator',
      created: Date.now(), expires: Date.now() + CONFIG.ttlMs,
      design: template,
    };
    // prune expired transfers so localStorage cannot fill up
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith(CONFIG.key + ':')) {
        try {
          const old = JSON.parse(localStorage.getItem(key));
          if (!old.expires || old.expires < Date.now()) localStorage.removeItem(key);
        } catch { localStorage.removeItem(key); }
      }
    }
    try {
      localStorage.setItem(`${CONFIG.key}:${id}`, JSON.stringify(record));
    } catch (e) {
      /* localStorage quota exceeded. Signal the caller so it can compress the
       * demo-only transport and retry (production posts to the staging endpoint
       * with no such limit). */
      const err = new Error('DEMO_TRANSFER_QUOTA');
      err.code = 'QUOTA';
      throw err;
    }
    return id;
  }

  /* Store for the demo (localStorage), compressing rasters and retrying if the
   * design is too big to fit. Returns the transfer id. */
  async function storeTransferLocallyWithFallback(template) {
    try {
      return storeTransferLocally(template);
    } catch (e) {
      if (!e || e.code !== 'QUOTA') throw e;
    }
    // First retry: JPEG-compress the opaque background raster.
    await compressTemplateForDemoTransport(template, { bgQuality: 0.85, imgQuality: 0.9 });
    try { return storeTransferLocally(template); } catch (e2) { if (e2.code !== 'QUOTA') throw e2; }
    // Second retry: harder compression + downscale the background.
    await compressTemplateForDemoTransport(template, { bgQuality: 0.6, imgQuality: 0.7, maxSide: 1600 });
    try { return storeTransferLocally(template); } catch (e3) {
      if (e3.code !== 'QUOTA') throw e3;
      throw new Error('This design is too large for the browser-only demo transfer '
        + '(a very large embedded image). In the hosted integration it transfers via the '
        + 'staging endpoint with no size limit. For the demo, use a smaller image or the image-URL option.');
    }
  }

  async function postTransfer(template) {
    const res = await fetch(CONFIG.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: 'templateGenerator', design: template }),
    });
    if (!res.ok) throw new Error(`Transfer endpoint returned ${res.status}`);
    const data = await res.json();
    if (!data.designerUrl) throw new Error('Transfer endpoint did not return a designer URL.');
    return data.designerUrl;
  }

  root.SMPTransportLocal = {
    id: 'local-storage',
    CONFIG,
    storeTransferLocally,
    storeTransferLocallyWithFallback,
    compressTemplateForDemoTransport,
    recompressDataUriToJpeg,
    postTransfer,
  };
})(typeof window !== 'undefined' ? window : globalThis);
