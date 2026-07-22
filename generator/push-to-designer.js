/* Push to Designer — converts the generated HTML design into Sterling's
 * "version 1.2" template JSON (the format served by gettemplateJson.cfm and
 * consumed by SMPdesigner.js / parseTemplate) and hands it to a designer
 * instance.
 *
 * TEST-ENVIRONMENT MODULE. It ships disabled against production: the designer
 * URL below intentionally points at a test harness page, never at
 * www.sterling.ca. Configure SMP_CONFIG when Sterling IT provisions staging.
 *
 * Transfer transports, tried in order:
 *   1. POST to a staging-only endpoint (SMP_CONFIG.transferEndpoint) which
 *      stores the JSON server-side and returns the designer URL to open.
 *   2. localStorage handoff — works when the generator and the designer are
 *      hosted on the same test origin (no server code needed).
 *   3. Download of template.json with instructions — always available.
 */

const SMP_CONFIG = {
  // Set by IT once a staging receiveTransfer.cfm exists, e.g.
  // 'https://staging.sterling.ca/designer/receiveTransfer.cfm'
  transferEndpoint: '',
  // Designer page to open. Defaults to the bundled test harness, which lives
  // on the same origin as this generator in the test deployment.
  designerUrl: '../designer/index.html',
  transferKey: 'smpDesignTransfer',
  transferTtlMs: 30 * 60 * 1000, // stored transfers expire after 30 minutes
};

/* Fonts available in the live designer (fontlist in Designer.cfm). */
const STERLING_FONTS = ['Arial','Arial Narrow','Aptos','Atlanta','Atlantic Inline','Belgium','Bentham','Bermuda Script','BrushScriptStd','Castle Com','Calibri','Clarendon BT','Cooper Md BT','Courier New','FleurishScript','Franklin Gothic ITC Bk BT','Futura Md BT','Futura Hv BT','Futura Bk BT','Germany','Gill Sans MT','Goudy Old Style','Helsinki Narrow','Helvetica','Istanbul','Myriad Pro','Myriad Pro Condensed','Open Sans','Open Sans Light','Open Sans SemiBold','Optima','Palatino Linotype','San Diego','Swis721 BT','Times New Roman','Trade Gothic Next','Trade Gothic Next Condensed','Trade Gothic Next Light','Trebuchet MS','US Roman','Utah','Verdana','Zapf Chancery'];

const FONT_FALLBACKS = {
  'sans-serif': 'Arial', 'system-ui': 'Arial', 'segoe ui': 'Arial', 'roboto': 'Arial',
  'helvetica neue': 'Helvetica', 'inter': 'Open Sans', 'lato': 'Open Sans',
  'serif': 'Times New Roman', 'georgia': 'Goudy Old Style', 'garamond': 'Goudy Old Style',
  'playfair display': 'Goudy Old Style', 'monospace': 'Courier New', 'futura': 'Futura Md BT',
  'gill sans': 'Gill Sans MT', 'optima': 'Optima', 'palatino': 'Palatino Linotype',
  'brush script mt': 'BrushScriptStd', 'trade gothic': 'Trade Gothic Next',
};

const MODE_BY_PRODUCT = {
  'Business Card': 'FullColour', 'Poster': 'FullColour', 'Sign': 'FullColour',
  'Brochure': 'FullColour', 'Stamp': 'SingleColour',
  'Nameplate': 'EngravedPlastic', 'Name Badge': 'EngravedPlastic',
};

function mapFont(cssFontFamily, substitutions) {
  const requested = (cssFontFamily || '').split(',')[0].trim().replace(/^["']|["']$/g, '');
  if (!requested) return 'Arial';
  const exact = STERLING_FONTS.find(f => f.toLowerCase() === requested.toLowerCase());
  if (exact) return exact;
  const partial = STERLING_FONTS.find(f => requested.toLowerCase().startsWith(f.toLowerCase())
                                        || f.toLowerCase().startsWith(requested.toLowerCase()));
  const mapped = partial || FONT_FALLBACKS[requested.toLowerCase()] || 'Arial';
  substitutions.push({ requested, used: mapped });
  return mapped;
}

function cssColorToHex(cssColor, doc) {
  if (!cssColor || cssColor === 'transparent') return null;
  const m = cssColor.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)/);
  if (!m) return cssColor; // already hex or named
  if (m[4] !== undefined && parseFloat(m[4]) === 0) return null;
  const hex = n => Number(n).toString(16).padStart(2, '0');
  return `#${hex(m[1])}${hex(m[2])}${hex(m[3])}`;
}

function isVisible(el, style) {
  if (style.display === 'none' || style.visibility === 'hidden' || parseFloat(style.opacity) === 0) return false;
  const r = el.getBoundingClientRect();
  return r.width > 0.5 && r.height > 0.5;
}

function rotationOf(style) {
  const t = style.transform;
  if (!t || t === 'none') return 0;
  const m = t.match(/matrix\(([^)]+)\)/);
  if (!m) return 0;
  const [a, b] = m[1].split(',').map(parseFloat);
  return Math.round(Math.atan2(b, a) * (180 / Math.PI) * 100) / 100;
}

function hasDirectText(el) {
  return Array.from(el.childNodes).some(n => n.nodeType === 3 && n.textContent.trim().length > 0);
}

/* Extract Fabric v4 objects from one rendered document. rootEl is the design
 * surface (the card element); factor rescales its pixels to canvas pixels. */
function extractObjectsFromDoc(doc, rootEl, factor, substitutions) {
  const rootRect = rootEl.getBoundingClientRect();
  const objects = [];
  const textOwners = new Set();

  const walker = doc.createTreeWalker(rootEl, NodeFilter.SHOW_ELEMENT);
  const els = [rootEl];
  while (walker.nextNode()) els.push(walker.currentNode);

  for (const el of els) {
    const style = doc.defaultView.getComputedStyle(el);
    if (!isVisible(el, style)) continue;
    const r = el.getBoundingClientRect();
    const left = (r.left - rootRect.left) * factor;
    const top = (r.top - rootRect.top) * factor;
    const width = r.width * factor;
    const height = r.height * factor;
    const angle = rotationOf(style);

    /* Shape: painted background or visible border, recorded before any text
     * inside it so Fabric stacking (array order) matches the DOM. */
    const bg = cssColorToHex(style.backgroundColor, doc);
    const hasBorder = parseFloat(style.borderTopWidth) > 0 && cssColorToHex(style.borderTopColor, doc);
    if ((bg || hasBorder) && el !== rootEl) {
      objects.push({
        type: 'rect', version: '4.4.0', originX: 'left', originY: 'top',
        left: round2(left), top: round2(top), width: round2(width), height: round2(height),
        fill: bg || 'transparent',
        stroke: hasBorder ? cssColorToHex(style.borderTopColor, doc) : null,
        strokeWidth: hasBorder ? round2(parseFloat(style.borderTopWidth) * factor) : 0,
        rx: round2(parseFloat(style.borderTopLeftRadius) * factor || 0),
        ry: round2(parseFloat(style.borderTopLeftRadius) * factor || 0),
        angle, scaleX: 1, scaleY: 1, opacity: parseFloat(style.opacity),
      });
    }

    /* Images (and inline SVG serialized to a data URL). */
    if (el.tagName === 'IMG' && el.currentSrc) {
      objects.push(makeImageObject(el.currentSrc, el.naturalWidth || r.width, el.naturalHeight || r.height,
                                   left, top, width, height, angle, style));
    } else if (el.tagName === 'svg') {
      const svgData = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(el.outerHTML)));
      objects.push(makeImageObject(svgData, r.width, r.height, left, top, width, height, angle, style));
      // children of an inline svg are captured by the snapshot; skip them
      const inner = el.querySelectorAll('*');
      inner.forEach(c => textOwners.add(c));
      continue;
    }

    /* Text: one Fabric textbox per element that directly owns text. */
    if (hasDirectText(el) && !textOwners.has(el)) {
      textOwners.add(el);
      const fontSize = parseFloat(style.fontSize) * factor;
      const letterPx = parseFloat(style.letterSpacing);
      objects.push({
        type: 'textbox', version: '4.4.0', originX: 'left', originY: 'top',
        left: round2(left), top: round2(top), width: round2(Math.max(width, 10)),
        text: normalizeText(el),
        fontSize: round2(fontSize),
        fontFamily: mapFont(style.fontFamily, substitutions),
        fontWeight: normalizeWeight(style.fontWeight),
        fontStyle: style.fontStyle === 'italic' ? 'italic' : 'normal',
        underline: (style.textDecorationLine || '').includes('underline'),
        textAlign: ['left','center','right','justify'].includes(style.textAlign) ? style.textAlign : 'left',
        fill: cssColorToHex(style.color, doc) || '#000000',
        lineHeight: normalizeLineHeight(style, fontSize / factor),
        charSpacing: Number.isFinite(letterPx) && fontSize > 0 ? Math.round((letterPx * factor) / fontSize * 1000) : 0,
        angle, scaleX: 1, scaleY: 1, opacity: parseFloat(style.opacity),
        splitByGrapheme: false,
      });
    }
  }
  return objects;
}

function makeImageObject(src, naturalW, naturalH, left, top, width, height, angle, style) {
  return {
    type: 'image', version: '4.4.0', originX: 'left', originY: 'top',
    left: round2(left), top: round2(top),
    width: round2(naturalW), height: round2(naturalH),
    scaleX: round4(width / naturalW), scaleY: round4(height / naturalH),
    angle, src, crossOrigin: 'anonymous', opacity: parseFloat(style.opacity),
  };
}

function normalizeText(el) {
  // innerText preserves line breaks the way the user sees them
  return (el.innerText || el.textContent || '').replace(/ /g, ' ').trim();
}

function normalizeWeight(w) {
  const n = parseInt(w, 10);
  if (Number.isFinite(n)) return n >= 600 ? 'bold' : 'normal';
  return w === 'bold' ? 'bold' : 'normal';
}

function normalizeLineHeight(style, fontSizePx) {
  const lh = parseFloat(style.lineHeight);
  if (!Number.isFinite(lh) || !fontSizePx) return 1.16;
  return round2(lh / fontSizePx);
}

function round2(n) { return Math.round(n * 100) / 100; }
function round4(n) { return Math.round(n * 10000) / 10000; }

/* Build the version 1.2 envelope around extracted pages. */
function buildSterlingTemplate(pages, payload) {
  const widthPx = Math.round(toPx(payload.width, payload.unit));
  const heightPx = Math.round(toPx(payload.height, payload.unit));
  const bleedPx = bleedPxFor(payload.templateType);
  const mode = MODE_BY_PRODUCT[payload.templateType] || 'FullColour';

  const canvasProperties = {
    width: widthPx, height: heightPx, dpi: 96, shape: 'rect', angle: 0,
    designerVariationCode: mode,
    bleedTop: bleedPx, bleedRight: bleedPx, bleedBottom: bleedPx, bleedLeft: bleedPx, bleedMargin: 0,
    borderTop: 0, borderRight: 0, borderBottom: 0, borderLeft: 0, borderWidth: 2,
    marginTop: 0, marginRight: 0, marginBottom: 0, marginLeft: 0,
    sideBorder: 0, topBorder: 0, sideMargin: 0, topMargin: 0,
    daterBoxHeight: 0, daterBoxWidth: 0, maxLines: 0,
    drawFullBorder: false, greenInkAvailable: false, isProstamp: false,
    materialColour: '', productNumber: '', productNumberVariation: '',
    /* provenance — lets the designer recognise generator designs */
    sourceApplication: 'templateGenerator',
    sourceVersion: 1,
    sourceMeta: {
      templateType: payload.templateType,
      widthIn: payload.unit === 'in' ? payload.width : round2(widthPx / 96),
      heightIn: payload.unit === 'in' ? payload.height : round2(heightPx / 96),
      businessName: payload.businessName || '',
    },
  };

  return {
    templateNumber: 0,
    templateKey: 'TG-' + Date.now().toString(36).toUpperCase(),
    version: 1.2,
    canvasProperties,
    productList: [],
    pages: pages.map((objects, i) => ({
      page: i,
      canvasProperties: { ...canvasProperties },
      canvasData: { version: '4.4.0', objects },
    })),
  };
}

/* Locate the design surface inside a preview document. */
function findDesignRoot(doc) {
  return doc.querySelector('.card, .design, .canvas, [class*="card"], [class*="plate"], [class*="badge"]')
      || doc.body?.firstElementChild;
}

function extractPage(frame, targetWidthPx, substitutions) {
  const doc = frame?.contentDocument;
  if (!doc || !doc.body || !doc.body.firstElementChild) return null;
  const rootEl = findDesignRoot(doc);
  if (!rootEl) return null;
  const rootRect = rootEl.getBoundingClientRect();
  if (rootRect.width < 2) return null;
  const factor = targetWidthPx / rootRect.width;
  return extractObjectsFromDoc(doc, rootEl, factor, substitutions);
}

/* Public: convert the current generated design. Returns {template, substitutions}. */
function convertCurrentDesign() {
  if (!generatedHtml || !lastPayload) {
    throw new Error('Generate a design first, then push it to the designer.');
  }
  const widthPx = Math.round(toPx(lastPayload.width, lastPayload.unit));
  const substitutions = [];
  const pages = [];

  if (lastPayload.doubleSided) {
    const front = extractPage(document.getElementById('thumbFrontFrame'), widthPx, substitutions);
    const back = extractPage(document.getElementById('thumbBackFrame'), widthPx, substitutions);
    if (front) pages.push(front);
    if (back) pages.push(back);
  }
  if (!pages.length) {
    const single = extractPage(document.getElementById('previewFrame'), widthPx, substitutions);
    if (single) pages.push(single);
  }
  if (!pages.length || !pages[0].length) {
    throw new Error('Could not read any design elements from the preview. Try regenerating the design.');
  }
  return { template: buildSterlingTemplate(pages, lastPayload), substitutions };
}

/* ── Transfer transports ─────────────────────────────── */

function storeTransferLocally(template) {
  const id = 'tg-' + Math.random().toString(36).slice(2, 10);
  const record = {
    id, format: 'sterling-template-1.2', source: 'templateGenerator',
    created: Date.now(), expires: Date.now() + SMP_CONFIG.transferTtlMs,
    design: template,
  };
  // prune expired transfers so localStorage cannot fill up
  for (const key of Object.keys(localStorage)) {
    if (key.startsWith(SMP_CONFIG.transferKey + ':')) {
      try {
        const old = JSON.parse(localStorage.getItem(key));
        if (!old.expires || old.expires < Date.now()) localStorage.removeItem(key);
      } catch { localStorage.removeItem(key); }
    }
  }
  localStorage.setItem(`${SMP_CONFIG.transferKey}:${id}`, JSON.stringify(record));
  return id;
}

async function postTransfer(template) {
  const res = await fetch(SMP_CONFIG.transferEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ source: 'templateGenerator', design: template }),
  });
  if (!res.ok) throw new Error(`Transfer endpoint returned ${res.status}`);
  const data = await res.json();
  if (!data.designerUrl) throw new Error('Transfer endpoint did not return a designer URL.');
  return data.designerUrl;
}

function downloadTemplateJson(template) {
  const blob = new Blob([JSON.stringify(template, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'template.json';
  a.click();
  URL.revokeObjectURL(a.href);
}

/* ── Button wiring ───────────────────────────────────── */

let pushInFlight = false;

async function pushToDesigner() {
  const btn = document.getElementById('pushToDesignerBtn');
  if (pushInFlight) return;
  pushInFlight = true;
  const originalLabel = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Transferring…';
  try {
    const { template, substitutions } = convertCurrentDesign();
    let url;
    if (SMP_CONFIG.transferEndpoint) {
      url = await postTransfer(template);
    } else {
      const id = storeTransferLocally(template);
      url = `${SMP_CONFIG.designerUrl}?transfer=${encodeURIComponent(id)}`;
    }
    if (substitutions.length) {
      const list = [...new Set(substitutions.map(s => `${s.requested} → ${s.used}`))].join(', ');
      showError(`Note: some fonts were substituted with Sterling designer fonts: ${list}`);
    }
    window.open(url, 'sterlingDesignerTest');
  } catch (err) {
    showError(`Push to Designer failed: ${err.message}`);
  } finally {
    pushInFlight = false;
    btn.disabled = false;
    btn.textContent = originalLabel;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('pushToDesignerBtn');
  if (btn) btn.addEventListener('click', pushToDesigner);
});

/* Expose for the test harness and unit tests */
window.SMPPush = { convertCurrentDesign, buildSterlingTemplate, extractObjectsFromDoc, mapFont, SMP_CONFIG, downloadTemplateJson };
