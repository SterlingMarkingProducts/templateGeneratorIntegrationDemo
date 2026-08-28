/* ── DOM refs ──────────────────────────────────────── */
const generateBtn     = document.getElementById('generateBtn');
const resetBtn        = document.getElementById('resetBtn');
const regenBtn        = document.getElementById('regenBtn');
const downloadHtmlBtn = document.getElementById('downloadHtmlBtn');
const jsonBtn         = document.getElementById('jsonBtn');
const jsonBtnLabel    = document.getElementById('jsonBtnLabel');
const jsonBtnIcon     = document.getElementById('jsonBtnIcon');

const templateType    = document.getElementById('templateType');
const dimWidth        = document.getElementById('dimWidth');
const dimHeight       = document.getElementById('dimHeight');
const unitToggle      = document.getElementById('unitToggle');
const industry        = document.getElementById('industry');
const businessName    = document.getElementById('businessName');
const styleDirection  = document.getElementById('styleDirection');
const creativityLevel = document.getElementById('creativityLevel');
const imageUrl        = document.getElementById('imageUrl');
const designPhotoFile = document.getElementById('designPhotoFile');
const designPhotoPreview = document.getElementById('designPhotoPreview');
const designPhotoPreviewImg = document.getElementById('designPhotoPreviewImg');
const designPhotoClear = document.getElementById('designPhotoClear');
const referenceFile   = document.getElementById('referenceFile');
const referenceImageUrl = document.getElementById('referenceImageUrl');
const referenceMode   = document.getElementById('referenceMode');
const referencePreview = document.getElementById('referencePreview');
const referencePreviewImg = document.getElementById('referencePreviewImg');
const referenceClear  = document.getElementById('referenceClear');
const svgPaste        = document.getElementById('svgPaste');
const svgFile         = document.getElementById('svgFile');
const specialInstr    = document.getElementById('specialInstructions');
const productNote     = document.getElementById('productNote');
const sidePreviews    = document.getElementById('sidePreviews');
const thumbFront      = document.getElementById('thumbFront');
const thumbBack       = document.getElementById('thumbBack');
const thumbFrontFrame = document.getElementById('thumbFrontFrame');
const thumbBackFrame  = document.getElementById('thumbBackFrame');

const emptyState      = document.getElementById('emptyState');
const blankState      = document.getElementById('blankState');
const orientationToggle = document.getElementById('orientationToggle');
const orientationNote   = document.getElementById('orientationNote');
const loadingState    = document.getElementById('loadingState');
const resultState     = document.getElementById('resultState');

const summaryBody      = null;
const summaryAccordion = null;
const previewFrame    = document.getElementById('previewFrame');
const iframeScaler    = document.getElementById('iframeScaler');
const iframeOuter     = document.getElementById('iframeOuter');
const iframeScrollArea = document.getElementById('iframeScrollArea');
const toolbarLabel    = document.getElementById('toolbarLabel');
const bleedOverlay    = document.getElementById('bleedOverlay');
const guidePills      = document.getElementById('guidePills');
const guideSafe       = document.getElementById('guideSafe');
const guideBleed      = document.getElementById('guideBleed');
const dimWidthLabel   = document.getElementById('dimWidthLabel');
const dimHeightLabel  = document.getElementById('dimHeightLabel');
const dimWidthIndicator  = document.getElementById('dimWidthIndicator');
const dimHeightIndicator = document.getElementById('dimHeightIndicator');
const zoomLabel       = document.getElementById('zoomLabel');
const zoomInBtn       = document.getElementById('zoomIn');
const zoomOutBtn      = document.getElementById('zoomOut');
const zoomFitBtn      = document.getElementById('zoomFit');

const loadingSubline  = document.getElementById('loadingSubline');
const loadingProgressBar = document.getElementById('loadingProgressBar');
const errorToast      = document.getElementById('errorToast');
const errorMessage    = document.getElementById('errorMessage');
const toastClose      = document.getElementById('toastClose');

/* ── State ─────────────────────────────────────────── */
let selectedUnit      = 'in';
let lastPayload       = null;
let generatedHtml     = null;
let generatedJson     = null;
let toastTimeout      = null;
let jsonState         = 'generate'; // 'generate' | 'loading' | 'download'
let lastScale         = 1;
let fitScale          = 1;
let userZoomPercent   = 100;
let showSafeGuide     = true;
let showBleedGuide    = true;
let referenceImageData = null; // { mediaType, data } base64, no prefix

/* Uploaded "Photo for design": kept as a data: URI and embedded directly in the
 * generated design (no backend storage needed). Large-format products keep full
 * resolution; small products are downscaled/compressed to keep the pushed
 * transfer small. The AI is given a sentinel URL to place, which is swapped for
 * the real data URI after generation (the model can't emit a huge base64). */
let designPhotoOriginal = null; // original data: URI as uploaded
let designPhotoData = null;     // data: URI actually embedded (maybe compressed)
const UPLOADED_PHOTO_URL = 'https://smp-generated.local/uploaded-photo.jpg';
const PHOTO_COMPRESS_FORMATS = ['Business Card', 'Stamp', 'Nameplate', 'Name Badge'];
const PHOTO_MAX_BYTES = 25 * 1024 * 1024;

const SUBLINES = [
  'Reading the brief…',
  'Identifying the aesthetic…',
  'Researching design references…',
  'Defining the visual language…',
  'Selecting typography…',
  'Establishing the palette…',
  'Preparing creative direction…',
];
let sublineInterval  = null;
let progressInterval = null;

/* ── Unit toggle ───────────────────────────────────── */
unitToggle.addEventListener('click', (e) => {
  const btn = e.target.closest('.unit-btn');
  if (!btn) return;
  unitToggle.querySelectorAll('.unit-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  selectedUnit = btn.dataset.unit;
});

/* ── Product presets ───────────────────────────────── */
const DOUBLE_SIDED_PRODUCTS = ['Business Card', 'Brochure'];

/* ── Print bleed (0.125" on every edge → 12px @ 96dpi) ── */
const BLEED_IN = 0.125;
const BLEED_PRODUCTS = ['Business Card', 'Poster', 'Brochure'];
function bleedPxFor(type) {
  /* Bleed is a PRODUCT fact, so it comes from the ProductProvider — the same
   * source the Sterling adapter uses. Routing both through one provider means
   * the on-screen bleed overlay and the transferred design can never disagree,
   * and swapping in CMS-backed product data later changes nothing here.
   * The inline constants below remain the fallback if the integration layer
   * is not loaded (e.g. the Generator opened standalone). */
  if (window.SMPProductProvider) {
    /* A selected Sterling product outranks the template-type guess. */
    const picked = window.SMPProductSelection?.get?.() || null;
    if (picked) return window.SMPProductProvider.bleedPxForPayload({ product: picked });
    return window.SMPProductProvider.bleedPxFor(type);
  }
  return BLEED_PRODUCTS.includes(type) ? Math.round(BLEED_IN * 96) : 0;
}

const PRODUCT_PRESETS = {
  'Sign':          { w: 18,     h: 24,      unit: 'in', note: '' },
  'Business Card': { w: 3.5,    h: 2,       unit: 'in', note: 'Double-sided: Front = contact details, Back = branding.' },
  'Brochure':      { w: 11,     h: 8.5,     unit: 'in', note: 'Tri-fold, letter size. Generates outside and inside spreads (double-sided). Flat/open: 11"×8.5". Each panel: ~3.67"×8.5".' },
  'Poster':        { w: 18,     h: 24,      unit: 'in', note: '' },
  'Banner':        { w: 72,     h: 24,      unit: 'in', note: '' },
  'Stamp':         { w: 2.25,   h: 0.8125,  unit: 'in', note: 'Standard self-inking stamp. Max 6 lines of text.' },
  'Nameplate':     { w: 8,      h: 2,       unit: 'in', note: '' },
  'Name Badge':    { w: 3,      h: 1,       unit: 'in', note: '' },
};

/* ── Template type: auto-fill dimensions ───────────── */
templateType.addEventListener('change', () => {
  const preset = PRODUCT_PRESETS[templateType.value];
  if (preset) {
    dimWidth.value  = preset.w;
    dimHeight.value = preset.h;
    unitToggle.querySelectorAll('.unit-btn').forEach(b => b.classList.remove('active'));
    unitToggle.querySelector(`[data-unit="${preset.unit}"]`).classList.add('active');
    selectedUnit = preset.unit;
    if (preset.note) {
      productNote.textContent = preset.note;
      productNote.classList.remove('hidden');
    } else {
      productNote.textContent = '';
      productNote.classList.add('hidden');
    }
  } else {
    productNote.textContent = '';
    productNote.classList.add('hidden');
  }
  /* Standalone only: choosing a template type establishes that family's
   * default orientation (the preset dimensions are then ordered for it).
   * With a Sterling product selected the product owns orientation, and this
   * change event is its own re-dispatch — leave it alone. */
  if (!window.SMPProductSelection?.get?.()) {
    resetOrientationToDefault();
  }
});

/* ── Sterling product → technical document settings ──
 *
 * When a Sterling product is selected it OWNS the technical settings: size,
 * unit and the creative template family. Those inputs are populated from the
 * product and made read-only, with a small badge saying where the value came
 * from — so the selected product and the canvas geometry cannot silently
 * disagree, and it is obvious which controls are no longer free.
 *
 * Clearing the product restores every input to normal. Nothing creative is
 * touched either way. */
const PRODUCT_DRIVEN_GROUPS = () => [
  templateType?.closest('.field-group'),
  dimWidth?.closest('.field-group'),
].filter(Boolean);

function setProductBadge(group, on) {
  if (!group) return;
  const label = group.querySelector('.field-label');
  if (!label) return;
  let badge = label.querySelector('.product-locked-badge');
  if (on && !badge) {
    badge = document.createElement('span');
    badge.className = 'product-locked-badge';
    badge.textContent = 'Set by product';
    label.appendChild(badge);
  } else if (!on && badge) {
    badge.remove();
  }
}

/* ── Orientation ───────────────────────────────────── */
/* Which way round the design is composed. This is a real document setting, not
 * a view transform: it reorders the SAME physical dimensions and feeds the form,
 * the blank artboard, the generation context and the pushed package. It never
 * changes the product, its id, its physical size, DPI, bleed amounts or
 * production settings. */
let orientation = 'landscape';
/* Set once the user picks an orientation themselves. A manual choice survives
 * unrelated form edits; only a product change or a demo load may re-establish a
 * default. */
let orientationTouched = false;

const O = () => window.SMPOrientation;

/** The subject orientation rules apply to: the selected product, else the
 *  template type the Generator is standing alone with. */
function orientationSubject() {
  const p = window.SMPProductSelection?.get?.() || null;
  if (p) return p;
  const t = templateType?.value || '';
  return t ? { templateType: t, productFamily: t } : null;
}

function orientationCaps() {
  const o = O();
  return o ? o.capabilitiesOf(orientationSubject()) : { landscape: true, portrait: true, locked: false };
}

function renderOrientationControl() {
  if (!orientationToggle) return;
  const caps = orientationCaps();
  orientationToggle.querySelectorAll('.orient-btn').forEach(b => {
    const v = b.dataset.orientation;
    const allowed = v === 'landscape' ? caps.landscape : caps.portrait;
    b.disabled = !allowed;
    b.classList.toggle('active', v === orientation);
    b.setAttribute('aria-checked', String(v === orientation));
  });
  if (!orientationNote) return;
  if (caps.locked) {
    const only = caps.lockedTo === 'portrait' ? 'vertical' : 'horizontal';
    orientationNote.textContent = caps.restrictionSource === 'cms-verified'
      ? `This Sterling product is only available ${only}.`
      : `The test data for this product lists ${only} only.`;
    orientationNote.classList.remove('hidden');
  } else {
    orientationNote.textContent = '';
    orientationNote.classList.add('hidden');
  }
}

/** Write the oriented dimensions into the form. The physical size is unchanged;
 *  only the ordering of width and height can differ. With a product selected
 *  the product's inch dimensions are authoritative; standalone, the user's own
 *  numbers are swapped in place, in whatever unit they typed them. */
function applyOrientationToDimensions() {
  const o = O();
  if (!o) return;
  const p = window.SMPProductSelection?.get?.() || null;
  if (p) {
    const d = o.orientDimensions(p.dimensions, orientation);
    setDimensionsIn(d.widthIn, d.heightIn);
    return;
  }
  const w = parseFloat(dimWidth.value), h = parseFloat(dimHeight.value);
  if (!w || !h) return;
  /* A swap is unit-agnostic: the two numbers trade places, the unit stays. */
  const d = o.orientDimensions({ widthIn: w, heightIn: h }, orientation);
  dimWidth.value = d.widthIn;
  dimHeight.value = d.heightIn;
}

/** Both dimension inputs, in inches, with the unit toggle pinned to inches. */
function setDimensionsIn(widthIn, heightIn) {
  dimWidth.value = widthIn;
  dimHeight.value = heightIn;
  selectedUnit = 'in';
  unitToggle.querySelectorAll('.unit-btn').forEach(b => b.classList.remove('active'));
  unitToggle.querySelector('[data-unit="in"]')?.classList.add('active');
}

/**
 * Set the orientation.
 *   source 'user'    — a deliberate click; remembered across unrelated edits.
 *   source 'default' — a product change, demo load or template-type change may
 *                      establish a default, but must not overwrite a choice the
 *                      user already made unless `force` is set.
 */
function setOrientation(next, source, force) {
  const o = O();
  if (!o) return orientation;
  const caps = orientationCaps();
  let want = o.isOrientation(next) ? next : orientation;
  if (caps.locked) want = caps.lockedTo;
  else if (want === 'landscape' && !caps.landscape) want = 'portrait';
  else if (want === 'portrait' && !caps.portrait) want = 'landscape';

  if (source === 'default' && orientationTouched && !force) {
    /* Keep the user's choice, but it still has to be legal for this product. */
    if (!caps.locked) { renderOrientationControl(); return orientation; }
  }
  orientation = want;
  if (source === 'user') orientationTouched = true;
  if (force) orientationTouched = false;
  renderOrientationControl();
  applyOrientationToDimensions();
  syncBlankArtboard(window.SMPProductSelection?.get?.() || null);
  return orientation;
}

/** Re-establish the default orientation for the current subject. Used when the
 *  product changes, a demo loads, or the product is cleared. */
function resetOrientationToDefault(preferred) {
  const o = O();
  if (!o) return orientation;
  const subject = orientationSubject();
  const next = (o.isOrientation(preferred) ? preferred : null)
    || o.defaultOrientationFor(subject) || orientation;
  return setOrientation(next, 'default', true);
}

orientationToggle?.addEventListener('click', (e) => {
  const btn = e.target.closest('.orient-btn');
  if (!btn || btn.disabled) return;
  setOrientation(btn.dataset.orientation, 'user');
});

function applyProductToForm(product) {
  const groups = PRODUCT_DRIVEN_GROUPS();

  /* Presentation only. Keeps the blank artboard in step with the selected
   * product — including clearing it — but never disturbs a design that has
   * already been generated. */
  syncBlankArtboard(product);

  if (!product) {
    groups.forEach(g => { g.classList.remove('is-product-driven'); setProductBadge(g, false); });
    dimWidth.readOnly = false;
    dimHeight.readOnly = false;
    templateType.disabled = false;
    /* No stale product orientation state: fall back to the template-type
     * default (or keep landscape if there is no subject at all). */
    resetOrientationToDefault();
    return;
  }

  /* A product change establishes ITS default orientation (family rule, or the
   * product's native ordering for unlisted families). This deliberately
   * overrides a manual choice made for the PREVIOUS product. Locked products
   * clamp inside setOrientation. */
  resetOrientationToDefault(pendingDemoOrientation);
  pendingDemoOrientation = null;

  /* Geometry straight from the product record, ordered for the orientation —
   * the same physical size either way. */
  applyOrientationToDimensions();

  /* Template Type comes from the product's own classification — the
   * database's product-group rows, resolved by templateTypeFor(). When the
   * source names no type the Generator can map, the field goes BLANK and
   * stays editable: an unknown product must never silently keep the previous
   * selection (which is how every sign, banner and badge read "Business
   * Card"), and never be defaulted for the user. */
  const tt = window.SMPProductSelection?.templateTypeFor(product) || '';
  const known = !!(tt && templateType.querySelector(`option[value="${tt}"]`));
  if (known) {
    templateType.value = tt;
    /* Re-run the Generator's own hint logic, then re-apply product geometry —
     * the preset must not win over the real product. */
    templateType.dispatchEvent(new Event('change'));
    applyOrientationToDimensions();
  } else {
    templateType.value = '';
    templateType.dispatchEvent(new Event('change'));
    applyOrientationToDimensions();
  }

  dimWidth.readOnly = true;
  dimHeight.readOnly = true;
  /* A mapped type is a product fact and locks; an unknown one leaves the
   * select open so the person can say what this product is. */
  templateType.disabled = known;
  groups.forEach(g => { g.classList.add('is-product-driven'); setProductBadge(g, true); });
}

/* A demo may carry its own preferred orientation; the demo loader parks it here
 * just before selecting the product, and applyProductToForm consumes it. */
let pendingDemoOrientation = null;
function setPendingDemoOrientation(o) { pendingDemoOrientation = o || null; }

/* Refresh the product-driven blank artboard. It is shown only while there is
 * nothing generated to show: once a real design exists the result state owns
 * the preview and the blank state stays hidden. Passing null clears it, so no
 * stale product geometry survives a product change or a Clear. */
function syncBlankArtboard(product) {
  const shown = window.SMPBlankArtboard?.setProduct(product || null, orientation) || null;
  const hasResult = !resultState.classList.contains('hidden');
  const isLoading = !loadingState.classList.contains('hidden');
  if (hasResult || isLoading) return;
  showPanel(shown ? 'blank' : 'empty');
}

document.addEventListener('DOMContentLoaded', () => {
  window.SMPProductSelection?.onChange(applyProductToForm);
});

/* ── Default product type ──────────────────────────── */
function applyDefaultProduct() {
  templateType.value = 'Business Card';
  templateType.dispatchEvent(new Event('change'));
}
applyDefaultProduct();

/* ── Colour pickers ────────────────────────────────── */
document.querySelectorAll('.color-toggle').forEach(toggle => {
  toggle.addEventListener('change', () => {
    const slot  = toggle.dataset.slot;
    const body  = document.getElementById(`colorBody-${slot}`);
    const row   = toggle.closest('.color-row');
    if (toggle.checked) {
      body.classList.remove('disabled');
      row?.classList.add('enabled');
    } else {
      body.classList.add('disabled');
      row?.classList.remove('enabled');
    }
  });
});

document.querySelectorAll('.color-picker').forEach(picker => {
  picker.addEventListener('input', () => {
    const slot = picker.id.replace('color-', '');
    document.getElementById(`colorHex-${slot}`).textContent = picker.value;
  });
});

/* ── Style preset chips ────────────────────────────── */
function clearChipActive() {
  document.querySelectorAll('.style-chip').forEach(c => c.classList.remove('active'));
}

document.querySelectorAll('.style-chip').forEach(chip => {
  chip.addEventListener('click', () => {
    const isSurprise = chip.id === 'surpriseChip';
    // Empty style lets the server pick a full diverse style + bold archetype
    styleDirection.value = isSurprise ? '' : chip.dataset.style;
    clearChipActive();
    chip.classList.add('active');
  });
});

// Deactivate chips if user manually edits the style direction field
styleDirection.addEventListener('input', () => {
  clearChipActive();
  const val = styleDirection.value.trim();
  if (val) {
    document.querySelectorAll('.style-chip:not(.style-chip--surprise)').forEach(chip => {
      if (chip.dataset.style === val) chip.classList.add('active');
    });
  }
});

let contactDomSide    = 'front'; // which .card--* holds contact info (business cards)

function isBusinessCardPreview() {
  return lastPayload?.templateType === 'Business Card';
}

function scoreContactContent(htmlChunk) {
  if (!htmlChunk) return 0;
  let s = 0;
  if (/zone-contact|contact-group|contact-line|icon-row/i.test(htmlChunk)) s += 10;
  if (/mailto:|tel:|@|\(\d{3}\)|\b\d{3}[-.\s]\d{3}[-.\s]\d{4}\b/i.test(htmlChunk)) s += 8;
  if (/person-name|job-title|person-title/i.test(htmlChunk)) s += 4;
  if (/www\.|https?:\/\//i.test(htmlChunk)) s += 3;
  return s;
}

function extractCardHtml(html, side) {
  const re = new RegExp(`<div class="card card--${side}"[\\s\\S]*?(?=</body>|<div class="card card--|$)`, 'i');
  const m = html.match(re);
  return m ? m[0] : '';
}

function detectContactDomSideFromHtml(html) {
  const backChunk = extractCardHtml(html, 'back');
  if (!backChunk) return 'front';
  const frontScore = scoreContactContent(extractCardHtml(html, 'front'));
  const backScore = scoreContactContent(backChunk);
  if (backScore === frontScore) return 'front'; // prefer front per business-card convention
  return backScore > frontScore ? 'back' : 'front';
}

function detectContactDomSideFromDoc(doc) {
  const front = doc.querySelector('.card--front');
  const back = doc.querySelector('.card--back');
  if (!back) return 'front';
  const frontScore = scoreContactContent(front?.innerHTML || '');
  const backScore = scoreContactContent(back.innerHTML);
  if (backScore === frontScore) return contactDomSide || 'front';
  return backScore > frontScore ? 'back' : 'front';
}

function uiSideToDomSide(uiSide) {
  if (!isBusinessCardPreview()) return uiSide;
  const contact = contactDomSide || 'front';
  const brand = contact === 'front' ? 'back' : 'front';
  return uiSide === 'front' ? contact : brand;
}

/* ── Side switching (double-sided products) ─────────── */
function switchSide(uiSide) {
  const doc = previewFrame.contentDocument;
  if (!doc) return;
  const front = doc.querySelector('.card--front');
  const back  = doc.querySelector('.card--back');

  if (isBusinessCardPreview() && doc) {
    contactDomSide = detectContactDomSideFromDoc(doc);
  }

  const domSide = uiSideToDomSide(uiSide);

  if (domSide === 'back' && !back) {
    thumbFront?.classList.add('active');
    thumbBack?.classList.remove('active');
    return;
  }

  if (front && !doc.__cardDisplay) {
    const d = doc.defaultView.getComputedStyle(front).display;
    if (d && d !== 'none') doc.__cardDisplay = d;
  }
  const visibleDisplay = doc.__cardDisplay || 'grid';

  if (front) front.style.setProperty('display', domSide === 'front' ? visibleDisplay : 'none', 'important');
  if (back)  back.style.setProperty('display',  domSide === 'back'  ? visibleDisplay : 'none', 'important');

  thumbFront?.classList.toggle('active', uiSide === 'front');
  thumbBack?.classList.toggle('active', uiSide === 'back');
}

thumbFront?.addEventListener('click', () => switchSide('front'));
thumbBack?.addEventListener('click', () => switchSide('back'));

/* ── Print guide toggles ───────────────────────────── */
function toggleGuidePill(btn, stateKey) {
  if (!btn) return;
  btn.addEventListener('click', () => {
    if (stateKey === 'safe') showSafeGuide = !showSafeGuide;
    else showBleedGuide = !showBleedGuide;
    btn.classList.toggle('active', stateKey === 'safe' ? showSafeGuide : showBleedGuide);
    updateBleedOverlay(lastScale);
  });
}
toggleGuidePill(guideSafe, 'safe');
toggleGuidePill(guideBleed, 'bleed');

/* ── Zoom controls ─────────────────────────────────── */
function setZoom(percent) {
  userZoomPercent = Math.max(25, Math.min(400, percent));
  if (zoomLabel) zoomLabel.textContent = `${Math.round(userZoomPercent)}%`;
  fitIframeToContent();
}

zoomInBtn?.addEventListener('click', () => setZoom(userZoomPercent + 25));
zoomOutBtn?.addEventListener('click', () => setZoom(userZoomPercent - 25));
zoomFitBtn?.addEventListener('click', () => setZoom(100));

/* ── SVG file upload ───────────────────────────────── */
svgFile.addEventListener('change', () => {
  const file = svgFile.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    svgPaste.value = reader.result;
  };
  reader.onerror = () => showError('Could not read the SVG file.');
  reader.readAsText(file);
});

const REFERENCE_MAX_BYTES = 5 * 1024 * 1024;

function setReferencePreview(dataUrl) {
  if (!referencePreview || !referencePreviewImg) return;
  if (dataUrl) {
    referencePreviewImg.src = dataUrl;
    referencePreview.classList.remove('hidden');
  } else {
    referencePreviewImg.src = '';
    referencePreview.classList.add('hidden');
  }
}

function clearReferenceImage() {
  referenceImageData = null;
  if (referenceFile) referenceFile.value = '';
  if (referenceImageUrl) referenceImageUrl.value = '';
  setReferencePreview(null);
}

function loadReferenceFromFile(file) {
  if (!file) return;
  if (file.size > REFERENCE_MAX_BYTES) {
    showError('Reference image must be under 5 MB.');
    referenceFile.value = '';
    return;
  }
  const reader = new FileReader();
  reader.onload = async () => {
    let result = reader.result;
    let match = /^data:([^;]+);base64,(.+)$/.exec(result);
    if (!match) {
      showError('Could not read the reference image.');
      return;
    }
    /* Normalise BIG references before they travel: the vision API refuses
     * oversized images outright (pixel and byte limits), and a refused
     * analysis used to degrade a recreation silently. Anything past the
     * API's own 1568px sweet spot or ~1.5 MB is downscaled/re-encoded here —
     * the analysis sees the same design either way, only reliably. */
    const bytes = Math.round(match[2].length * 0.75);
    const needsNormalize = bytes > 1.5 * 1024 * 1024 || await (async () => {
      const dims = await new Promise((res) => {
        const im = new Image();
        im.onload = () => res({ w: im.naturalWidth, h: im.naturalHeight });
        im.onerror = () => res(null);
        im.src = result;
      });
      return dims && Math.max(dims.w, dims.h) > 1568;
    })();
    if (needsNormalize) {
      const resized = await resizeDataUrl(result, 1568, 0.9);
      const m2 = /^data:([^;]+);base64,(.+)$/.exec(resized);
      if (m2) { result = resized; match = m2; }
    }
    referenceImageData = { mediaType: match[1], data: match[2] };
    if (referenceImageUrl) referenceImageUrl.value = '';
    setReferencePreview(result);
  };
  reader.onerror = () => showError('Could not read the reference image.');
  reader.readAsDataURL(file);
}

if (referenceFile) {
  referenceFile.addEventListener('change', () => {
    const file = referenceFile.files?.[0];
    if (file) loadReferenceFromFile(file);
  });
}

if (referenceImageUrl) {
  referenceImageUrl.addEventListener('input', () => {
    if (referenceImageUrl.value.trim()) {
      referenceImageData = null;
      if (referenceFile) referenceFile.value = '';
      setReferencePreview(null);
    }
  });
}

if (referenceClear) {
  referenceClear.addEventListener('click', clearReferenceImage);
}

/* ── Design photo upload (embedded as a data: URI, no backend) ── */
function photoNeedsCompression() {
  return PHOTO_COMPRESS_FORMATS.includes(templateType.value);
}

/* Downscale/re-encode a data: URI via canvas. Only used for small products. */
function resizeDataUrl(dataUrl, maxDim, quality) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let w = img.naturalWidth, h = img.naturalHeight;
      if (!w || !h) return resolve(dataUrl);
      const scale = Math.min(1, maxDim / Math.max(w, h));
      w = Math.round(w * scale); h = Math.round(h * scale);
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h); // flatten alpha for JPEG
      ctx.drawImage(img, 0, 0, w, h);
      try { resolve(c.toDataURL('image/jpeg', quality)); }
      catch { resolve(dataUrl); }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

/* Derive the embedded photo (designPhotoData) from the original per the product:
 * full resolution for large-format, compressed for small products. */
async function applyPhotoPolicy() {
  if (!designPhotoOriginal) { designPhotoData = null; return; }
  designPhotoData = photoNeedsCompression()
    ? await resizeDataUrl(designPhotoOriginal, 1600, 0.85)
    : designPhotoOriginal; // signage etc. — keep full resolution
}

function setDesignPhotoPreview(dataUrl) {
  if (!designPhotoPreview || !designPhotoPreviewImg) return;
  if (dataUrl) { designPhotoPreviewImg.src = dataUrl; designPhotoPreview.classList.remove('hidden'); }
  else { designPhotoPreviewImg.src = ''; designPhotoPreview.classList.add('hidden'); }
}

function clearDesignPhoto() {
  designPhotoOriginal = null; designPhotoData = null;
  if (designPhotoFile) designPhotoFile.value = '';
  setDesignPhotoPreview(null);
}

function loadDesignPhotoFromFile(file) {
  if (!file) return;
  if (file.size > PHOTO_MAX_BYTES) {
    showError('Photo must be under 25 MB.');
    if (designPhotoFile) designPhotoFile.value = '';
    return;
  }
  const reader = new FileReader();
  reader.onload = async () => {
    if (typeof reader.result !== 'string' || !reader.result.startsWith('data:image/')) {
      showError('Could not read that photo.');
      return;
    }
    designPhotoOriginal = reader.result;
    if (imageUrl) imageUrl.value = ''; // upload and URL are mutually exclusive
    await applyPhotoPolicy();
    setDesignPhotoPreview(designPhotoOriginal);
  };
  reader.onerror = () => showError('Could not read that photo.');
  reader.readAsDataURL(file);
}

if (designPhotoFile) {
  designPhotoFile.addEventListener('change', () => {
    const file = designPhotoFile.files && designPhotoFile.files[0];
    if (file) loadDesignPhotoFromFile(file);
  });
}
if (imageUrl) {
  imageUrl.addEventListener('input', () => { if (imageUrl.value.trim()) clearDesignPhoto(); });
}
if (designPhotoClear) {
  designPhotoClear.addEventListener('click', clearDesignPhoto);
}
// Re-apply the compression policy if the product type changes after uploading.
if (templateType) {
  templateType.addEventListener('change', () => { if (designPhotoOriginal) applyPhotoPolicy(); });
}

/* Test hook (read-only) for the design-photo pipeline. */
window.SMPGen = Object.assign(window.SMPGen || {}, {
  photo: {
    get data() { return designPhotoData; },
    get original() { return designPhotoOriginal; },
    needsCompression: () => photoNeedsCompression(),
    applyPolicy: () => applyPhotoPolicy(),
    sentinel: UPLOADED_PHOTO_URL,
  },
  renderPreviewHtml: (h, p) => renderPreviewHtml(h, p),
});

/* ── Collect colours ───────────────────────────────── */
function getColors() {
  const result = {};
  ['primary', 'secondary', 'tertiary', 'quaternary'].forEach(slot => {
    const toggle = document.querySelector(`.color-toggle[data-slot="${slot}"]`);
    if (toggle && toggle.checked) {
      result[slot] = document.getElementById(`color-${slot}`).value;
    }
  });
  return result;
}

/* ── Build payload ─────────────────────────────────── */
function buildPayload() {
  return {
    templateType: templateType.value,
    /* width/height are already ORIENTED — the form fields hold the physical
     * size ordered for the selected orientation, so generation composes for
     * the canvas the user actually chose. `orientation` travels alongside so
     * the engine and the import pipeline can state the intent explicitly. */
    width:        parseFloat(dimWidth.value) || null,
    height:       parseFloat(dimHeight.value) || null,
    unit:         selectedUnit,
    orientation:  orientation,
    industry:     industry.value.trim(),
    businessName: businessName.value.trim(),
    colors:       getColors(),
    styleDirection:      styleDirection.value.trim(),
    /* There is no #creativityLevel control in the UI, so this optional chain
       always resolves to the fallback. It read 'bold', which silently forced
       PORTFOLIO BOLD on to every generation and left the balanced branch of
       getCreativityDirective() unreachable. 'balanced' is the intended
       default; adding a real control is a later phase. */
    creativityLevel:     creativityLevel?.value || 'balanced',
    imageUrl:            designPhotoData ? UPLOADED_PHOTO_URL : imageUrl.value.trim(),
    referenceImage:      referenceImageData,
    referenceImageUrl:   referenceImageUrl?.value.trim() || '',
    referenceMode:       referenceMode?.value || 'recreate',
    svgContent:          svgPaste.value.trim(),
    specialInstructions: specialInstr.value.trim(),
    /* The selected Sterling product, or null when the Generator is used
     * standalone. Downstream, SMPProductProvider.resolve() checks this FIRST,
     * so a real product record can never be overridden by a template-type
     * assumption. */
    product:             window.SMPProductSelection?.get?.() || null,
    /* Page count is a product fact when a product is selected — BCDP-CM is
     * min 2 / max 2, so it produces a front and a back. Only without a
     * product does the Generator fall back to its own double-sided list. */
    doubleSided:         productPageCount() !== null
                           ? productPageCount() > 1
                           : DOUBLE_SIDED_PRODUCTS.includes(templateType.value),
  };
}

/** Pages required by the selected Sterling product, or null if none selected. */
function productPageCount() {
  const p = window.SMPProductSelection?.get?.();
  return p && p.pages ? p.pages.min : null;
}

/* ── Validate ──────────────────────────────────────── */
function validate(payload) {
  if (!payload.templateType) {
    showError('Please select a Template Type.');
    templateType.focus();
    return false;
  }
  if (!payload.width || !payload.height) {
    showError('Please enter both Width and Height dimensions.');
    (payload.width ? dimHeight : dimWidth).focus();
    return false;
  }
  if (payload.referenceImageUrl && !/^https?:\/\/.+/i.test(payload.referenceImageUrl)) {
    showError('Reference image URL must start with http:// or https://.');
    referenceImageUrl.focus();
    return false;
  }
  if (payload.imageUrl && !/^https?:\/\/.+/i.test(payload.imageUrl)) {
    showError('Image must be a valid URL starting with http:// or https://.');
    imageUrl.focus();
    return false;
  }
  if (payload.svgContent) {
    const cleaned = sanitizeSvgInput(payload.svgContent);
    if (cleaned.error) {
      showError('Could not import this SVG: ' + cleaned.error);
      svgPaste.focus();
      return false;
    }
    payload.svgContent = cleaned.svg;
  }
  return true;
}

/* Pasted/uploaded SVG: parse it for real (never regex-guess), fail with a
 * useful message instead of letting bad markup ride into the pipeline, and
 * strip only what must never execute — scripts, event handlers, javascript:
 * and external-resource references. Geometry (paths, shapes, text, groups,
 * transforms, gradients, masks, clipPaths, internal #refs) passes untouched.
 * viewBox and width/height are each sufficient alone: a width/height-only SVG
 * gets an equivalent viewBox so it scales uniformly wherever the design puts
 * it; an SVG with neither is refused with a plain reason. */
function sanitizeSvgInput(src) {
  let doc;
  try { doc = new DOMParser().parseFromString(src, 'image/svg+xml'); }
  catch (e) { return { error: 'the markup could not be parsed (' + e.message + ').' }; }
  const parseErr = doc.querySelector('parsererror');
  if (parseErr) {
    const firstLine = (parseErr.textContent || '').split('\n').find(l => l.trim()) || 'invalid XML';
    return { error: 'the markup is not valid SVG/XML (' + firstLine.trim().slice(0, 160) + ').' };
  }
  const root = doc.documentElement;
  if (!root || root.nodeName.toLowerCase() !== 'svg') {
    return { error: 'the root element is not <svg>.' };
  }
  if (!root.getAttribute('xmlns')) root.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  root.querySelectorAll('script, foreignObject').forEach(n => n.remove());
  [root, ...root.querySelectorAll('*')].forEach(el => {
    for (const attr of [...el.attributes]) {
      const n = attr.name.toLowerCase();
      if (n.startsWith('on')) { el.removeAttribute(attr.name); continue; }
      if ((n === 'href' || n === 'xlink:href')
          && /^\s*(javascript:|https?:|\/\/)/i.test(attr.value)) {
        el.removeAttribute(attr.name);   // no scripts, no external fetches
      }
    }
  });
  const vb = (root.getAttribute('viewBox') || '').trim();
  const w = parseFloat(root.getAttribute('width'));
  const h = parseFloat(root.getAttribute('height'));
  if (!vb && !(w > 0 && h > 0)) {
    return { error: 'it declares no viewBox and no usable width/height, so its size cannot be determined.' };
  }
  if (!vb && w > 0 && h > 0) root.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
  try { return { svg: new XMLSerializer().serializeToString(root) }; }
  catch (e) { return { error: 'the cleaned markup could not be re-serialized (' + e.message + ').' }; }
}

/* ── Show / hide panels ────────────────────────────── */
function showPanel(name) {
  emptyState.classList.toggle('hidden',   name !== 'empty');
  loadingState.classList.toggle('hidden', name !== 'loading');
  resultState.classList.toggle('hidden',  name !== 'result');
  blankState?.classList.toggle('hidden',  name !== 'blank');
  if (name === 'blank') window.SMPBlankArtboard?.relayout?.();
}

/* The pre-generation state. With a Sterling product selected the preview shows
 * that product's blank artboard; with no product it is the standalone empty
 * state exactly as before. Either way this is presentation only — no design
 * data exists yet. */
function showIdlePanel() {
  const p = window.SMPProductSelection?.get?.() || null;
  const shown = window.SMPBlankArtboard?.setProduct(p, orientation) || null;
  showPanel(shown ? 'blank' : 'empty');
}

/* ── Subline cycling ───────────────────────────────── */
function startSublineCycle() {
  let idx = 0;
  loadingSubline.textContent = SUBLINES[0];
  sublineInterval = setInterval(() => {
    idx = (idx + 1) % SUBLINES.length;
    loadingSubline.style.opacity = '0';
    setTimeout(() => {
      loadingSubline.textContent = SUBLINES[idx];
      loadingSubline.style.opacity = '1';
    }, 300);
  }, 3200);
}

function stopSublineCycle() {
  clearInterval(sublineInterval);
  sublineInterval = null;
}

/* ── Progress bar ──────────────────────────────────── */
function setProgress(pct) {
  if (loadingProgressBar) loadingProgressBar.style.width = Math.min(pct, 100) + '%';
}

function resetProgress() {
  clearInterval(progressInterval);
  progressInterval = null;
  if (loadingProgressBar) {
    loadingProgressBar.style.transition = 'none';
    loadingProgressBar.style.width = '0%';
    // re-enable transition on next frame
    requestAnimationFrame(() => {
      loadingProgressBar.style.transition = '';
    });
  }
}

// Slowly creep from `from` to `to` over `durationMs` (ease-out)
function startFakeProgress(from, to, durationMs) {
  clearInterval(progressInterval);
  const steps    = 50;
  const interval = durationMs / steps;
  let step = 0;
  setProgress(from);
  progressInterval = setInterval(() => {
    step++;
    const t     = step / steps;
    const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
    setProgress(from + (to - from) * eased);
    if (step >= steps) clearInterval(progressInterval);
  }, interval);
}

// Map streaming char count to 40–90% range
function updateStreamProgress(charCount) {
  const streamPct = Math.min(charCount / 12000, 1);
  setProgress(40 + streamPct * 50);
}

/* ── Layout safety for generated iframe HTML ─────────── */
/* These preview caps were tuned while creativityLevel was ALWAYS 'bold' — the
 * #creativityLevel control does not exist, so the `?? 'bold'` fallback decided
 * it on every run. Phase 1 changes that fallback to 'balanced' for the PROMPT
 * ambition only. The preview caps stay pinned where they were tuned so the
 * approved preview behaviour does not change as a side effect — and, in
 * particular, so the hairline rules that restrained directions rely on are not
 * stripped out of the preview. Deliberately decoupled from creativityLevel. */
const PREVIEW_GENEROUS_CAPS = true;

function resolveTextZoneCollisions(root, cardHeight, bottomPad) {
  const card = root.querySelector?.('.card') || root.querySelector?.('[class*="card"]') || (root.classList?.contains('card') ? root : null);
  if (!card) return null;

  const minScale = PREVIEW_GENEROUS_CAPS ? 0.6 : 0.45;
  const hideRules = !PREVIEW_GENEROUS_CAPS;

  const copy = card.querySelector('.zone-copy');
  const contact = card.querySelector('.zone-contact');
  const gap = 8;
  const cardRect = () => card.getBoundingClientRect();
  const report = { cardHeight, copyTop: copy?.offsetTop, contactTopBefore: contact?.offsetTop, actions: [] };

  if (copy) copy.style.transform = '';
  if (contact) {
    contact.style.transform = '';
    contact.style.top = '';
    contact.style.bottom = '';
  }
  card.querySelectorAll('.layout-hidden').forEach((el) => {
    el.classList.remove('layout-hidden');
    el.style.display = '';
  });

  if (copy && contact) {
    const contactH = contact.scrollHeight;
    report.overlapBefore = (copy.offsetTop + copy.scrollHeight) - contact.offsetTop;

    const scaleCopyTo = (maxCopyBottom) => {
      const available = maxCopyBottom - copy.offsetTop;
      if (available > 0 && copy.scrollHeight > available) {
        const scale = Math.max(minScale, available / copy.scrollHeight);
        copy.style.transform = `scale(${scale})`;
        copy.style.transformOrigin = 'top left';
        report.actions.push(`scaled-copy:${scale.toFixed(2)}`);
        return scale;
      }
      return 1;
    };

    if (cardHeight <= 240) {
      const maxCopyBottom = cardHeight - bottomPad - contactH - gap;
      scaleCopyTo(maxCopyBottom);

      let copyVisualBottom = copy.getBoundingClientRect().bottom - cardRect().top;
      let contactTop = Math.round(copyVisualBottom + gap);
      const maxContactTop = cardHeight - bottomPad - contactH;

      if (contactTop > maxContactTop) {
        scaleCopyTo(maxContactTop - gap);
        copyVisualBottom = copy.getBoundingClientRect().bottom - cardRect().top;
        contactTop = Math.min(maxContactTop, Math.round(copyVisualBottom + gap));
        report.actions.push('rescaled-for-contact-fit');
      }

      contact.style.bottom = 'auto';
      contact.style.top = `${contactTop}px`;
      report.actions.push(`anchored-contact:${contactTop}px`);
    } else {
      let maxCopyBottom = contact.offsetTop - gap;
      if (maxCopyBottom <= copy.offsetTop + 20) {
        contact.style.bottom = 'auto';
        contact.style.top = `${Math.max(copy.offsetTop + 40, cardHeight - bottomPad - contactH)}px`;
        maxCopyBottom = parseFloat(contact.style.top) - gap;
        report.actions.push('repositioned-contact-top');
      }
      scaleCopyTo(maxCopyBottom);

      const copyVisualBottom = copy.getBoundingClientRect().bottom - cardRect().top;
      if (copyVisualBottom > contact.offsetTop - gap) {
        contact.style.bottom = 'auto';
        contact.style.top = `${Math.min(cardHeight - bottomPad - contactH, copyVisualBottom + gap)}px`;
        report.actions.push('pushed-contact-below-copy');
      }
    }

    report.copyBottom = copy.getBoundingClientRect().bottom - cardRect().top;
    report.contactTopAfter = contact.offsetTop;
    report.overlapAfter = report.copyBottom - contact.offsetTop;
  } else {
    card.querySelectorAll('.zone-copy, .zone-contact').forEach((zone) => {
      zone.style.transform = '';
      const available = cardHeight - zone.offsetTop - bottomPad;
      if (zone.scrollHeight > available && zone.scrollHeight > 0) {
        const scale = Math.max(minScale, available / zone.scrollHeight);
        zone.style.transform = `scale(${scale})`;
        zone.style.transformOrigin = 'top left';
        report.actions.push(`scaled-${zone.className}:${scale.toFixed(2)}`);
      }
    });
  }

  const copyRect = copy?.getBoundingClientRect();
  const cRect = cardRect();
  if (hideRules) card.querySelectorAll('.rule-line, [class*="rule-line"], [class*="divider-line"]').forEach((line) => {
    const lineRect = line.getBoundingClientRect();
    const lineTop = line.offsetTop;
    const copyBottom = copy ? copy.getBoundingClientRect().bottom - cRect.top : 0;
    const contactTop = contact ? contact.offsetTop : cardHeight;
    const contactBottom = contact ? contactTop + contact.offsetHeight : cardHeight;
    const inTextBand = lineTop >= (copy?.offsetTop ?? 0) - 4 && lineTop <= contactBottom + 4;
    const crossesCopy = copyRect && lineRect.bottom > copyRect.top + 2 && lineRect.top < copyRect.bottom - 2;
    if (inTextBand || crossesCopy || (lineTop >= copyBottom - 4 && lineTop <= contactTop + 4)) {
      line.classList.add('layout-hidden');
      line.style.display = 'none';
      report.actions.push('hid-rule-line');
    }
  });

  return report;
}

function captureLayoutFixStyles(doc) {
  const card = doc.querySelector('.card') || doc.querySelector('[class*="card"]');
  if (!card) return '';
  let css = '';
  const copy = card.querySelector('.zone-copy');
  const contact = card.querySelector('.zone-contact');
  if (copy?.style.transform) {
    css += `.zone-copy{transform:${copy.style.transform}!important;transform-origin:top left!important;}`;
  }
  if (contact?.style.top) {
    css += `.zone-contact{bottom:auto!important;top:${contact.style.top}!important;}`;
  }
  if (card.querySelector('.layout-hidden')) {
    css += `.layout-hidden{display:none!important;}`;
  }
  return css;
}

function injectCapturedLayoutFixes(html, css) {
  if (!css) return html;
  const tag = `<style id="layout-fix-applied">${css}</style>`;
  if (html.includes('id="layout-fix-applied"')) {
    return html.replace(/<style id="layout-fix-applied">[\s\S]*?<\/style>/, tag);
  }
  return html.includes('</head>') ? html.replace('</head>', tag + '</head>') : tag + html;
}

/* Universal preview overflow-fit — the final safety net so nothing is ever
 * clipped in the preview. The zone scripts only know about .zone-copy /
 * .zone-contact; recreate/custom layouts name their blocks freely, so their
 * bottom-most block could spill past the card edge. This measures every direct
 * child of each card and, for any that genuinely overflows the bottom (and is
 * not a full-height background/bar), scales it down from its top-left just
 * enough to fit. Idempotent (resets first, re-measures) and gated on measured
 * overflow, so blocks that already fit — and .zone-* elements — are untouched. */
const UNIVERSAL_FIT_SCRIPT = `<script id="layout-universal-fit">(function(){function fullFit(){var cards=document.querySelectorAll(".card,[class*=card]");var list=cards.length?Array.prototype.slice.call(cards):(document.body&&document.body.firstElementChild?[document.body.firstElementChild]:[]);list.forEach(function(card){var cs=getComputedStyle(card);if(cs.position==="static")card.style.position="relative";var ch=card.clientHeight,cw=card.clientWidth;if(!ch||!cw)return;var cr=card.getBoundingClientRect();var kids=card.children;for(var i=0;i<kids.length;i++){var k=kids[i];var tn=k.tagName;if(tn==="STYLE"||tn==="SCRIPT"||tn==="LINK")continue;if(k.matches&&k.matches(".zone-copy,.zone-contact"))continue;k.style.transform="";var kr=k.getBoundingClientRect();var kh=kr.height;if(kh<8)continue;var topInCard=kr.top-cr.top;if(topInCard<=2&&kh>=ch-2)continue;var avail=ch-topInCard-2;if(avail>16&&kh>avail+2){var s=Math.max(0.55,avail/kh);k.style.transformOrigin="top left";k.style.transform="scale("+s.toFixed(4)+")";}}});}function r(){fullFit();setTimeout(fullFit,60);setTimeout(fullFit,240);setTimeout(fullFit,650);}if(document.fonts&&document.fonts.ready)document.fonts.ready.then(r);else r();window.addEventListener("load",r);})();</script>`;

function appendUniversalFit(out) {
  return out.includes('</body>')
    ? out.replace('</body>', UNIVERSAL_FIT_SCRIPT + '</body>')
    : out + UNIVERSAL_FIT_SCRIPT;
}

/* The designer's full type library. Loading it into the preview makes the
 * preview render in the SAME fonts the designer uses, so what the user approves
 * on screen matches what transfers. Marked so the push extractor's own font
 * loader treats it as already present. */
const DESIGNER_FONTS_LINK = '<link rel="stylesheet" href="https://saturn.sterling.ca/cdn/hteng/fonts/fonts.css" data-tg-fonts="1">';

function injectLayoutSafety(html, widthPx, heightPx, options = {}) {
  const { creativityLevel, templateType } = options;
  // Ensure the preview loads the designer fonts (once).
  if (!html.includes('data-tg-fonts')) {
    html = html.includes('</head>')
      ? html.replace('</head>', DESIGNER_FONTS_LINK + '</head>')
      : DESIGNER_FONTS_LINK + html;
  }
  const isLargeFormat = /poster|sign/i.test(templateType || '') || heightPx > 600;
  const isBold = PREVIEW_GENEROUS_CAPS;   // see PREVIEW_GENEROUS_CAPS above

  /* The preview iframe is sized to the full bleed canvas (trim + bleed), but
   * designs are authored at trim size and would otherwise sit in the top-left
   * corner leaving white on the right/bottom. Center the trim design and
   * scale it to COVER the bleed canvas so the artwork fills the frame and
   * bleeds off every edge — mirroring what Push to Designer does. */
  const bleedPair = bleedPxFor(templateType) * 2;
  const trimW = widthPx - bleedPair, trimH = heightPx - bleedPair;
  const cover = bleedPair > 0 && trimW > 0 && trimH > 0
    ? Math.max(widthPx / trimW, heightPx / trimH) : 1;
  const bodyFill = cover > 1
    ? `html{margin:0;padding:0;overflow:hidden;width:${widthPx}px;height:${heightPx}px;}`
      + `body{margin:0;padding:0;width:${trimW}px;height:${trimH}px;position:absolute;`
      + `left:50%;top:50%;transform:translate(-50%,-50%) scale(${cover.toFixed(4)});`
      + `transform-origin:center center;}`
    : `html,body{margin:0;padding:0;}`;

  // Posters and large formats need monumental type — skip card-style safety caps
  if (isLargeFormat) {
    const minimalRules = `<style id="layout-safety">${bodyFill}.card,.design,.canvas,[class*="card"]{overflow:hidden!important;position:relative!important;}</style>`;
    return html.includes('</head>') ? html.replace('</head>', minimalRules + '</head>') : minimalRules + html;
  }

  // Nameplates / badges: the person NAME is the hero (large) — never apply the
  // business-card person-name/job-title caps. Only scale text DOWN if it overflows.
  if (/nameplate|name badge|name tag/i.test(templateType || '')) {
    // The model names the outer container freely (.card, .plate, .badge…), so
    // match it generically for both the overflow clamp and the fit-down script.
    const rules = `${bodyFill}
.card,.plate,.nameplate,.badge,.design,.canvas,[class*="card"],[class*="plate"],[class*="badge"]{overflow:hidden!important;position:relative!important;}
.zone-copy{display:flex!important;flex-direction:column!important;gap:6px!important;}
.layout-hidden{display:none!important;}`;
    const styleTag = `<style id="layout-safety">${rules}</style>`;
    const fitScript = `<script id="layout-safety-script">(function(){function fit(){var c=document.querySelector(".card,.plate,.nameplate,.badge,[class*=card],[class*=plate],[class*=badge]")||(document.body&&document.body.firstElementChild);if(!c)return;var cw=c.clientWidth,ch=c.clientHeight;var zones=c.querySelectorAll(".zone-copy,.zone-contact");if(!zones.length)return;zones.forEach(function(z){z.style.transform="";z.style.transformOrigin="center center";var aw=cw-24,ah=ch-24,zw=z.scrollWidth,zh=z.scrollHeight;if((zw>aw||zh>ah)&&zw>0&&zh>0){var s=Math.max(0.4,Math.min(aw/zw,ah/zh));z.style.transform="scale("+s+")";}});}function r(){fit();setTimeout(fit,60);setTimeout(fit,220);setTimeout(fit,600);}if(document.fonts&&document.fonts.ready)document.fonts.ready.then(r);else r();window.addEventListener("load",r);})();<\/script>`;
    let out = html.includes('</head>') ? html.replace('</head>', styleTag + '</head>') : styleTag + html;
    out = out.includes('</body>') ? out.replace('</body>', fitScript + '</body>') : out + fitScript;
    return appendUniversalFit(out);
  }

  const isSmall = heightPx <= 240;
  const headlineMax = isBold
    ? (heightPx <= 192 ? 44 : heightPx <= 240 ? 64 : 80)
    : (heightPx <= 192 ? 28 : heightPx <= 240 ? 36 : 52);
  const subMax = isBold ? (heightPx <= 192 ? 13 : 16) : (heightPx <= 192 ? 11 : 14);
  const nameMax = isBold ? (heightPx <= 192 ? 15 : 18) : (heightPx <= 192 ? 13 : 16);
  const minScale = isBold ? 0.6 : 0.45;
  const bottomPad = 10;
  let rules = `
${bodyFill}
.card,.design,.canvas,[class*="card"]{overflow:hidden!important;position:relative!important;}
.zone-copy{display:flex!important;flex-direction:column!important;gap:6px!important;overflow:hidden!important;}
.zone-copy>*{margin-top:0!important;flex-shrink:1!important;}
.zone-contact{display:flex!important;flex-direction:column!important;gap:6px!important;overflow:hidden!important;}
.card:has(.contact-group) .icon-row,.card:has(.zone-contact) .icon-row{display:none!important;}
.zone-copy>:is(.business-name,h1,[class*="business"],[class*="brand"],[class*="headline"],[class*="line-1"],[class*="line-2"],[class*="word-1"],[class*="word-2"]){font-size:min(${headlineMax}px,var(--headline-size,${headlineMax}px))!important;line-height:0.95!important;}
.zone-copy>:is(.tagline,[class*="tagline"],[class*="sub"]){font-size:min(${subMax}px,var(--sub-size,${subMax}px))!important;line-height:1.2!important;}
.zone-copy>:is(.person-name,[class*="person-name"]){font-size:min(${nameMax}px,var(--name-size,${nameMax}px))!important;line-height:1.2!important;}
.zone-copy>:is(.job-title,[class*="job-title"]){font-size:min(9px,var(--title-size,9px))!important;line-height:1.3!important;}
.layout-hidden{display:none!important;}
`;
  if (isSmall) {
    rules += `
.zone-copy .contact-group{display:none!important;}
`;
  }
  const styleTag = `<style id="layout-safety">${rules}</style>`;
  const fitScript = `<script id="layout-safety-script">(function(){var bp=${bottomPad},gap=8,minScale=${minScale};function R(c){var copy=c.querySelector(".zone-copy"),contact=c.querySelector(".zone-contact"),ch=c.clientHeight,cr=c.getBoundingClientRect();if(copy)copy.style.transform="";if(contact){contact.style.transform="";contact.style.top="";contact.style.bottom="";}c.querySelectorAll(".layout-hidden").forEach(function(el){el.classList.remove("layout-hidden");el.style.display="";});if(copy&&contact){var ch2=contact.scrollHeight;function sc(mx){var av=mx-copy.offsetTop;if(av>0&&copy.scrollHeight>av){var s=Math.max(minScale,av/copy.scrollHeight);copy.style.transform="scale("+s+")";copy.style.transformOrigin="top left";}}if(ch<=240){sc(ch-bp-ch2-gap);var cb=copy.getBoundingClientRect().bottom-cr.top,ct=Math.round(cb+gap),mct=ch-bp-ch2;if(ct>mct){sc(mct-gap);cb=copy.getBoundingClientRect().bottom-cr.top;ct=Math.min(mct,Math.round(cb+gap));}contact.style.bottom="auto";contact.style.top=ct+"px";}else{var mh=contact.offsetTop-gap;if(mh>copy.offsetTop+20)sc(mh);var cb2=copy.getBoundingClientRect().bottom-cr.top;if(cb2>contact.offsetTop-gap){contact.style.bottom="auto";contact.style.top=Math.min(ch-bp-ch2,cb2+gap)+"px";}}${isBold ? '' : 'var cpr=copy.getBoundingClientRect(),ct2=contact.offsetTop,cbt=ct2+contact.offsetHeight;c.querySelectorAll(".rule-line,[class*=\'rule-line\'],[class*=\'divider-line\']").forEach(function(l){var lr=l.getBoundingClientRect(),lt=l.offsetTop,cb3=copy.getBoundingClientRect().bottom-cr.top,cross=cpr&&lr.bottom>cpr.top+2&&lr.top<cpr.bottom-2,inBand=lt>=(copy.offsetTop||0)-4&&lt<=cbt+4;if(cross||inBand||(lt>=cb3-4&&lt<=ct2+4)){l.classList.add("layout-hidden");l.style.display="none";}});'}}else{c.querySelectorAll(".zone-copy,.zone-contact").forEach(function(z){z.style.transform="";var a=ch-z.offsetTop-bp;if(z.scrollHeight>a&&a>0){var s=Math.max(minScale,a/z.scrollHeight);z.style.transform="scale("+s+")";z.style.transformOrigin="top left";}});}}function f(){var c=document.querySelector(".card")||document.querySelector('[class*="card"]');if(c)R(c);}function r(){f();setTimeout(f,50);setTimeout(f,200);setTimeout(f,600);}if(document.fonts&&document.fonts.ready)document.fonts.ready.then(r);else r();window.addEventListener("load",r);})();</script>`;
  let out = html.includes('</head>') ? html.replace('</head>', styleTag + '</head>') : styleTag + html;
  out = out.includes('</body>') ? out.replace('</body>', fitScript + '</body>') : out + fitScript;
  return appendUniversalFit(out);
}

/* ── Icon bank: swap <i data-icon="name"> tokens for real inline SVGs ── */
async function upgradePreviewIcons(htmlStr, payload) {
  if (!window.IconBank || htmlStr.indexOf('data-icon') === -1) return;
  try {
    const inlined = await IconBank.inline(htmlStr);
    if (inlined === htmlStr) return;
    generatedHtml = renderPreviewHtml(inlined, payload);
    previewFrame.srcdoc = generatedHtml;
    armPreviewReady();
    updateSidePreviews();
  } catch (err) {
    console.warn('Icon bank inlining failed (tokens left as empty spans):', err);
  }
}

function renderPreviewHtml(htmlStr, payload) {
  // Swap the sentinel URL the AI was told to place for the real uploaded photo
  // data URI (the model can't emit a large base64 string itself).
  if (designPhotoData && htmlStr.includes(UPLOADED_PHOTO_URL)) {
    htmlStr = htmlStr.split(UPLOADED_PHOTO_URL).join(designPhotoData);
  }
  if (payload.templateType === 'Business Card') {
    contactDomSide = detectContactDomSideFromHtml(htmlStr);
  }
  const bleed    = bleedPxFor(payload.templateType) * 2;
  const widthPx  = toPx(payload.width, payload.unit) + bleed;
  const heightPx = toPx(payload.height, payload.unit) + bleed;
  return injectLayoutSafety(htmlStr, widthPx, heightPx, {
    creativityLevel: payload.creativityLevel,
    templateType: payload.templateType,
  });
}

function fitCardTextInPreview(persistFixes) {
  const doc = previewFrame.contentDocument;
  if (!doc) return;
  // Nameplates handle their own fitting via the injected nameplate script — the
  // business-card collision logic would wrongly shrink the hero name.
  if (/nameplate|name badge|name tag/i.test(lastPayload?.templateType || '')) return;
  const card = doc.querySelector('.card') || doc.querySelector('[class*="card"]');
  if (!card) return;
  resolveTextZoneCollisions(doc, card.clientHeight, 10);
  if (persistFixes && generatedHtml) {
    const css = captureLayoutFixStyles(doc);
    generatedHtml = injectCapturedLayoutFixes(generatedHtml, css);
  }
}

function formatDimLabel(value, unit) {
  const n = parseFloat(value);
  if (Number.isNaN(n)) return '—';
  if (unit === 'in') return `${n.toFixed(2)}in`;
  if (unit === 'mm') return `${Math.round(n)}mm`;
  return `${Math.round(n)}px`;
}

function updateDimensionIndicators(scaledW, scaledH) {
  if (!lastPayload) return;
  if (dimWidthLabel) dimWidthLabel.textContent = formatDimLabel(lastPayload.width, lastPayload.unit);
  if (dimHeightLabel) dimHeightLabel.textContent = formatDimLabel(lastPayload.height, lastPayload.unit);
  dimHeightIndicator?.style.setProperty('--dim-h', `${scaledH}px`);
  dimWidthIndicator?.style.setProperty('--dim-w', `${scaledW}px`);
}

function injectThumbSideCss(html, uiSide) {
  let css = '<style id="thumb-side-only">';
  let showDom = uiSide;
  if (isBusinessCardPreview()) {
    const contact = detectContactDomSideFromHtml(html);
    showDom = uiSide === 'front' ? contact : (contact === 'front' ? 'back' : 'front');
  }
  if (showDom === 'front') {
    css += '.card--back{display:none!important;}';
  } else {
    css += '.card--front{display:none!important;}.card--back{display:grid!important;}';
  }
  css += '</style>';
  if (html.includes('</head>')) return html.replace('</head>', css + '</head>');
  return css + html;
}

function fitThumbFrame(frame, html) {
  if (!frame || !lastPayload) return;
  frame.srcdoc = html;
  frame.onload = () => {
    const bleed = bleedPxFor(lastPayload.templateType) * 2;
    const w = toPx(lastPayload.width, lastPayload.unit) + bleed;
    const h = toPx(lastPayload.height, lastPayload.unit) + bleed;
    const wrap = frame.parentElement;
    if (!wrap) return;
    const s = Math.min(wrap.clientWidth / w, wrap.clientHeight / h);
    frame.style.width = `${w}px`;
    frame.style.height = `${h}px`;
    frame.style.transform = `scale(${s})`;
    frame.style.transformOrigin = 'top left';
  };
}

function updateSidePreviews() {
  if (!generatedHtml || !lastPayload?.doubleSided || !/class="card card--back"/i.test(generatedHtml)) {
    sidePreviews?.classList.add('hidden');
    return;
  }
  sidePreviews?.classList.remove('hidden');
  fitThumbFrame(thumbFrontFrame, injectThumbSideCss(generatedHtml, 'front'));
  fitThumbFrame(thumbBackFrame, injectThumbSideCss(generatedHtml, 'back'));
  thumbFront?.classList.add('active');
  thumbBack?.classList.remove('active');
}

function schedulePreviewTextFit() {
  fitCardTextInPreview();
  const doc = previewFrame.contentDocument;
  if (doc?.fonts?.ready) doc.fonts.ready.then(() => fitCardTextInPreview());
  requestAnimationFrame(() => requestAnimationFrame(() => fitCardTextInPreview()));
  setTimeout(() => fitCardTextInPreview(), 100);
  setTimeout(() => fitCardTextInPreview(true), 600);
}

/* ── Size iframe to design dimensions and scale to fit ── */
function fitIframeToContent() {
  if (!lastPayload) return;

  const bleed    = bleedPxFor(lastPayload.templateType) * 2;
  const widthPx  = toPx(lastPayload.width,  lastPayload.unit) + bleed;
  const heightPx = toPx(lastPayload.height, lastPayload.unit) + bleed;

  previewFrame.style.width  = widthPx  + 'px';
  previewFrame.style.height = heightPx + 'px';

  requestAnimationFrame(() => applyPreviewScale(widthPx, heightPx));
}

/* Everything that makes a freshly set preview correct — the bleed-canvas frame
 * size, hiding the non-front spread of a double-sided design, the text-fit
 * passes — used to run ONLY in the iframe's 'load' event. That event waits for
 * every external stylesheet (the injected designer-fonts link, Google Fonts),
 * so a slow or unreachable CDN delays it indefinitely while the document is
 * already parsed and painted. For an uploaded double-sided export (whose back
 * spread is deliberately un-hidden in the saved file) that meant BOTH spreads
 * visible, and the design's own flex body crushing the two cards to fit —
 * the squished round-trip. Poll for the parsed document instead and run the
 * same steps as soon as the design element exists; the load event stays as a
 * backstop and re-runs the steps harmlessly. */
function onPreviewDocReady() {
  fitIframeToContent();
  schedulePreviewTextFit();
  updateSidePreviews();
  if (lastPayload?.doubleSided) switchSide('front'); // front = contact side for business cards
  if (htmlImportDiag) {
    htmlImportDiag = false;
    const doc = previewFrame.contentDocument;
    const card = doc && doc.querySelector('.card, [class*="card"]');
    const r = card && card.getBoundingClientRect();
    console.log('[html-import] intrinsic design size:', r ? Math.round(r.width) + '×' + Math.round(r.height) + 'px' : 'n/a');
    console.log('[html-import] product canvas size:', previewFrame.style.width, '×', previewFrame.style.height);
    console.log('[html-import] preview display scale X:', lastScale.toFixed(4), 'Y:', lastScale.toFixed(4), '(uniform — one factor scales both axes)');
  }
}

let htmlImportDiag = false;
let previewReadyPoll = null;
function armPreviewReady() {
  if (previewReadyPoll) clearInterval(previewReadyPoll);
  const oldDoc = previewFrame.contentDocument;
  const started = Date.now();
  previewReadyPoll = setInterval(() => {
    const doc = previewFrame.contentDocument;
    if (!doc || doc === oldDoc) { /* srcdoc not swapped in yet */ }
    else if (doc.body && (doc.querySelector('.card, [class*="card"]') || doc.body.firstElementChild)) {
      clearInterval(previewReadyPoll); previewReadyPoll = null;
      onPreviewDocReady();
      return;
    }
    if (Date.now() - started > 6000) { clearInterval(previewReadyPoll); previewReadyPoll = null; }
  }, 100);
}

previewFrame.addEventListener('load', () => {
  if (previewReadyPoll) { clearInterval(previewReadyPoll); previewReadyPoll = null; }
  onPreviewDocReady();
});

/* ── PX conversion (for iframe sizing) ────────────── */
function toPx(value, unit) {
  if (unit === 'px') return value;
  if (unit === 'mm') return Math.round(value * (96 / 25.4));
  if (unit === 'in') return Math.round(value * 96);
  return value;
}

/* ── Scale iframe to fit panel ─────────────────────── */
function applyPreviewScale(widthPx, heightPx) {
  const padding = 48;
  const areaW = iframeScrollArea.clientWidth - padding;
  const areaH = iframeScrollArea.clientHeight - padding;

  if (areaW <= 0 || areaH <= 0) {
    requestAnimationFrame(() => applyPreviewScale(widthPx, heightPx));
    return;
  }

  fitScale = Math.min(areaW / widthPx, areaH / heightPx);
  const scale = fitScale * (userZoomPercent / 100);

  previewFrame.style.width  = `${widthPx}px`;
  previewFrame.style.height = `${heightPx}px`;
  previewFrame.width  = widthPx;
  previewFrame.height = heightPx;

  iframeScaler.style.width           = `${widthPx}px`;
  iframeScaler.style.height          = `${heightPx}px`;
  iframeScaler.style.transform       = `scale(${scale})`;
  iframeScaler.style.transformOrigin = 'top left';

  const scaledW = Math.ceil(widthPx * scale);
  const scaledH = Math.ceil(heightPx * scale);
  iframeOuter.style.width  = `${scaledW}px`;
  iframeOuter.style.height = `${scaledH}px`;

  if (zoomLabel) zoomLabel.textContent = `${Math.round(userZoomPercent)}%`;
  updateDimensionIndicators(scaledW, scaledH);

  lastScale = scale;
  updateBleedOverlay(scale);
}

/* ── Bleed / trim / safe-area guides overlay ───────── */
function updateBleedOverlay(scale) {
  if (!bleedOverlay || !lastPayload) return;

  const bleed = bleedPxFor(lastPayload.templateType);
  const hasBleedProduct = bleed > 0;

  guidePills?.classList.remove('hidden');
  guideBleed?.classList.toggle('hidden', !hasBleedProduct);

  const showAny = showSafeGuide || (showBleedGuide && hasBleedProduct);
  if (!showAny) {
    bleedOverlay.classList.add('hidden');
    return;
  }

  bleedOverlay.style.setProperty('--bleed', `${hasBleedProduct ? bleed : 12}px`);
  // Safe-area guide sits at the trim line (one bleed-width in from the edge).
  bleedOverlay.style.setProperty('--safe', `${hasBleedProduct ? bleed : 12}px`);
  bleedOverlay.style.setProperty('--lw', `${1 / (scale || 1)}px`);

  bleedOverlay.querySelector('.bleed-line--bleed')?.classList.toggle('hidden', !showBleedGuide || !hasBleedProduct);
  // The separate dark trim line is redundant — the safe-area guide marks the trim.
  bleedOverlay.querySelector('.bleed-line--trim')?.classList.add('hidden');
  bleedOverlay.querySelector('.bleed-line--safe')?.classList.toggle('hidden', !showSafeGuide);

  bleedOverlay.classList.remove('hidden');
}

/* ── Generate ──────────────────────────────────────── */
async function generate(payload) {
  lastPayload   = payload;
  generatedHtml = null;
  generatedJson = null;
  generateBtn.disabled = true;
  regenBtn.disabled    = true;
  showPanel('loading');
  resetProgress();
  startSublineCycle();

  try {
    const res = await fetch('/generate', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    });

    // Validation errors arrive as plain JSON before SSE headers are set
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Generation failed.');
    }

    const reader  = res.body.getReader();
    const decoder = new TextDecoder();
    let sseBuffer   = '';
    let accum       = '';
    let htmlRendered = false;

    const widthPx  = toPx(payload.width,  payload.unit);
    const heightPx = toPx(payload.height, payload.unit);

    let sawDone = false;
    outer: while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      sseBuffer += decoder.decode(value, { stream: true });

      // SSE events are delimited by \n\n
      const events = sseBuffer.split('\n\n');
      sseBuffer = events.pop(); // retain incomplete trailing chunk

      for (const event of events) {
        const line = event.trim();
        if (!line.startsWith('data: ')) continue;

        let msg;
        try { msg = JSON.parse(line.slice(6)); } catch { continue; }

        if (msg.error) throw new Error(msg.error);

        if (msg.phase === 0) {
          stopSublineCycle();
          loadingSubline.style.opacity = '1';
          loadingSubline.textContent = 'Analyzing style reference…';
          startFakeProgress(0, 18, 12000);
        }

        if (msg.phase === 1) {
          stopSublineCycle();
          loadingSubline.style.opacity = '1';
          loadingSubline.textContent = 'Creative director developing the visual spec…';
          startFakeProgress(0, 38, 30000);
        }

        if (msg.phase === 2) {
          clearInterval(progressInterval);
          loadingSubline.style.opacity = '1';
          loadingSubline.textContent = 'Building the design with Claude…';
          setProgress(42);
        }

        if (msg.t) {
          accum += msg.t;
          updateStreamProgress(accum.length);

          // Render preview the instant the HTML block closes — summary streams in after
          if (!htmlRendered) {
            const htmlMatch = accum.match(/```html\s*([\s\S]*?)```/);
            if (htmlMatch) {
              const htmlStr = htmlMatch[1].trim();
              generatedHtml = renderPreviewHtml(htmlStr, payload);
              upgradePreviewIcons(htmlStr, payload);

              toolbarLabel.textContent = payload.templateType + ' — Preview';
              setJsonState('generate');
              showPanel('result');
              stopSublineCycle();
              userZoomPercent = 100;
              if (zoomLabel) zoomLabel.textContent = '100%';

              requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                  previewFrame.srcdoc = generatedHtml;
                  armPreviewReady(); // fit + side visibility without waiting for 'load'
                });
              });

              regenBtn.disabled        = false;
              downloadHtmlBtn.disabled = false;
              htmlRendered = true;
            }
          }
        }

        if (msg.done) {
          sawDone = true;
          // If HTML wasn't detected mid-stream (edge case), try final buffer
          if (!htmlRendered) {
            const htmlMatch = accum.match(/```html\s*([\s\S]*?)```/);
            if (!htmlMatch) {
              throw new Error('The AI response did not contain a valid HTML block. Please try regenerating.');
            }
            const htmlStr = htmlMatch[1].trim();
            generatedHtml = renderPreviewHtml(htmlStr, payload);
            upgradePreviewIcons(htmlStr, payload);

            toolbarLabel.textContent = payload.templateType + ' — Preview';
            setJsonState('generate');
            showPanel('result');
            stopSublineCycle();
            userZoomPercent = 100;
            if (zoomLabel) zoomLabel.textContent = '100%';

            requestAnimationFrame(() => {
              requestAnimationFrame(() => {
                previewFrame.srcdoc = generatedHtml;
                armPreviewReady(); // fit + side visibility without waiting for 'load'
              });
            });

            regenBtn.disabled        = false;
            downloadHtmlBtn.disabled = false;
          }

          setProgress(100);
          break outer;
        }
      }
    }

    /* The stream ended without a done (and without an error event): the proxy
     * dropped or truncated the buffered response. Falling through silently
     * left the loading panel up FOREVER — the "spins forever" state. */
    if (!sawDone) {
      throw new Error('The design service stopped responding before the design '
        + 'finished. Please try again.');
    }

  } catch (err) {
    showError(err.message || 'Something went wrong. Please try again.');
    showIdlePanel();
  } finally {
    stopSublineCycle();
    clearInterval(progressInterval);
    generateBtn.disabled = false;
  }
}

/* ── Event: Generate button ────────────────────────── */
generateBtn.addEventListener('click', () => {
  const payload = buildPayload();
  if (validate(payload)) generate(payload);
});

/* ── DEV asset indicator (web03 dev clones only) ─────
 *
 * "Is the design asset library actually doing anything?" is not answerable from
 * looking at a card — a well-integrated asset is meant to be invisible as an
 * asset. This reports what the engine chose, beside the preview toolbar, so a
 * generation can be checked against its selection.
 *
 * DEV CLONES ONLY (window.SMPWeb03Dev.active, set by web03-dev-bootstrap.js on
 * the /generator-web03-dev-e2e…/ paths). It lives in the page chrome, never in
 * the generated design or the preview iframe, and it reads a decision that has
 * already been made — it changes nothing. */
(function () {
  var el = null;
  function host() {
    if (el) return el;
    /* Directly above the design. .preview-main is the column that holds the
     * canvas, so its first child is a full-width row sitting immediately over
     * the preview — visible without opening anything. The toolbar was the wrong
     * home: .toolbar-left is a flex row and the line was squashed out of sight. */
    var main = document.querySelector('.preview-main')
      || document.querySelector('.preview-workspace');
    if (!main) return null;
    el = document.createElement('div');
    el.id = 'devAssetIndicator';
    el.style.cssText = 'flex:0 0 auto;order:-1;padding:5px 12px;text-align:center;'
      + 'display:flex;align-items:center;justify-content:center;gap:0;'
      + 'background:#f4f4f6;border-bottom:1px solid #e4e4e8;color:#5b5b66;'
      + 'font:500 11px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace;'
      + 'letter-spacing:.02em;white-space:nowrap;overflow:hidden;'
      + 'text-overflow:ellipsis;';
    main.insertBefore(el, main.firstChild);
    return el;
  }

  /* 35_Ornate_Gold_Oval_Frame.png -> "Ornate Gold Oval Frame" */
  function pretty(filename) {
    return String(filename || '')
      .replace(/\.png$/i, '')
      .replace(/^\d+_/, '')
      .replace(/_/g, ' ')
      .trim();
  }

  var line = null, modeSel = null, photoLine = null, photoSel = null;
  var logoLine = null, logoSel = null, refLine = null;

  /* Force/No modes are TESTING controls, not product UI. They render only when
   * the page is opened with ?visualDebug=1; the normal Generator runs Auto and
   * shows nothing. The DEV diagnostic lines above the preview stay regardless
   * (dev clones only). */
  function visualDebug() {
    try { return new URLSearchParams(window.location.search).get('visualDebug') === '1'; }
    catch (e) { return false; }
  }

  /* One builder for both DEV selects, so the stock-photo control is visibly and
   * behaviourally the same kind of thing as the asset control beside it. */
  function makeModeSelect(id, labelText, options, globalName) {
    var wrap = document.createElement('div');
    wrap.id = id + 'Wrap';
    wrap.style.cssText = 'margin-bottom:10px;padding:8px 10px;border:1px solid #e4e4e8;'
      + 'border-radius:6px;background:#f7f7f9;';

    var label = document.createElement('label');
    label.setAttribute('for', id);
    label.textContent = labelText;
    label.style.cssText = 'display:block;margin-bottom:4px;color:#71717a;'
      + 'font:600 10px/1.3 system-ui,-apple-system,Segoe UI,Arial,sans-serif;'
      + 'letter-spacing:.08em;text-transform:uppercase;';

    var sel = document.createElement('select');
    sel.id = id;
    sel.style.cssText = 'width:100%;box-sizing:border-box;padding:5px 7px;'
      + 'border:1px solid #d4d4d8;border-radius:4px;background:#fff;color:#3f3f46;'
      + 'font:500 12px/1.3 system-ui,-apple-system,Segoe UI,Arial,sans-serif;';
    options.forEach(function (o) {
      var opt = document.createElement('option');
      opt.value = o[0]; opt.textContent = o[1];
      sel.appendChild(opt);
    });
    /* Read at selection time by the engine — it changes WHICH file is chosen,
     * never HOW it is chosen, so Force uses the identical local code path. */
    sel.value = window[globalName] || 'auto';
    window[globalName] = sel.value;
    sel.addEventListener('change', function () { window[globalName] = sel.value; });

    wrap.appendChild(label);
    wrap.appendChild(sel);
    return { wrap: wrap, sel: sel };
  }

  /* The REPORT lives above the preview, which only exists once something has
   * been generated. The CONTROL has to be usable before that, so it goes in the
   * left sidebar directly above Generate Design — visible on the blank state,
   * before the first click. */
  function buildModeControl() {
    if (modeSel) return;
    if (!visualDebug()) return;
    var actions = document.querySelector('.form-actions');
    var generate = document.getElementById('generateBtn');
    if (!actions || !generate) return;

    var asset = makeModeSelect('devAssetMode', 'Asset Mode',
      [['auto', 'Auto'], ['force', 'Force Asset'], ['off', 'No Asset']], 'SMPAssetMode');
    modeSel = asset.sel;
    actions.insertBefore(asset.wrap, generate);

    /* Each source is its own selector, so each gets its own control. */
    var photo = makeModeSelect('devStockPhotoMode', 'Stock Photo Mode',
      [['auto', 'Auto'], ['force', 'Force Photo'], ['off', 'No Photo']], 'SMPStockPhotoMode');
    photoSel = photo.sel;
    actions.insertBefore(photo.wrap, generate);

    var logo = makeModeSelect('devLogoMode', 'Logo Mode',
      [['auto', 'Auto'], ['force', 'Force Logo'], ['off', 'No Logo']], 'SMPLogoMode');
    logoSel = logo.sel;
    actions.insertBefore(logo.wrap, generate);
  }

  function reportLine(box) {
    if (line) return;
    /* Two stacked lines: the design asset on top, the stock photo under it.
     * Separate libraries, separate decisions, separate readouts. */
    box.style.flexDirection = 'column';
    line = document.createElement('span');
    photoLine = document.createElement('span');
    photoLine.style.cssText = 'max-width:100%;overflow:hidden;text-overflow:ellipsis;';
    logoLine = document.createElement('span');
    logoLine.style.cssText = 'max-width:100%;overflow:hidden;text-overflow:ellipsis;';
    refLine = document.createElement('span');
    refLine.style.cssText = 'max-width:100%;overflow:hidden;text-overflow:ellipsis;display:none;';
    box.appendChild(line);
    box.appendChild(photoLine);
    box.appendChild(logoLine);
    box.appendChild(refLine);
  }

  /* Reference: active · <what the vision pass actually saw> — shown only when
   * a reference is in play, so the normal three lines stay uncluttered. */
  function renderReference(sel) {
    var box = host();
    if (!box) return;
    reportLine(box);
    if (!sel || !sel.active) { refLine.style.display = 'none'; return; }
    refLine.style.display = '';
    if (sel.error) {
      refLine.textContent = 'Reference: FAILED \u00b7 ' + sel.error;
      refLine.title = sel.error;
      return;
    }
    refLine.textContent = 'Reference: active (' + sel.mode + ', '
      + sel.analysisChars + ' chars) \u00b7 ' + (sel.summary || '(no summary)');
    refLine.title = sel.summary || '';
  }

  /* Logo: None · Reason: <reason>   or   Logo: <name> · Family/Type: <type> */
  function renderLogo(sel) {
    var box = host();
    if (!box) return;
    reportLine(box);
    var timing = (sel && typeof sel.selectMs === 'number') ? '  (' + sel.selectMs + 'ms)' : '';
    if (!sel || !sel.file) {
      var why = (sel && sel.reason) || 'not generated yet';
      logoLine.textContent = 'Logo: None \u00b7 Reason: ' + why + timing;
      logoLine.title = 'No library mark was used. Reason: ' + why;
      return;
    }
    logoLine.textContent = 'Logo: ' + sel.name + ' \u00b7 Family/Type: '
      + (sel.tier === 'B' ? 'industry mark' : 'abstract mark') + ' \u00b7 ' + sel.type + timing;
    logoLine.title = sel.url;
  }

  /* Photo: None · Reason: <reason>   or   Photo: <file> · Industry: <slug> */
  function renderPhoto(sel) {
    var box = host();
    if (!box) return;
    reportLine(box);
    var timing = (sel && typeof sel.selectMs === 'number') ? '  (' + sel.selectMs + 'ms)' : '';
    var fmt = (sel && sel.format) ? '  \u00b7 ' + sel.format : '';
    if (!sel || !sel.file) {
      var why = (sel && sel.reason) || 'not generated yet';
      photoLine.textContent = 'Photo: None \u00b7 Reason: ' + why + fmt + timing;
      photoLine.title = 'No stock photograph was used. Reason: ' + why;
      return;
    }
    photoLine.textContent = 'Photo: ' + sel.file + ' \u00b7 Industry: ' + sel.industry
      + (sel.requiresScrim ? ' \u00b7 scrim required' : '') + fmt + timing;
    photoLine.title = sel.url + '\n' + (sel.subject || '')
      + '\nmatched: ' + ((sel.matchedIndustries || []).join(', ') || sel.industry);
  }

  function render(sel) {
    var box = host();
    if (!box) return;
    reportLine(box);
    var assets = (sel && sel.assets) || [];
    var timing = (sel && typeof sel.selectMs === 'number') ? '  (' + sel.selectMs + 'ms)' : '';
    var fmt = (sel && sel.format) ? '  \u00b7 ' + sel.format : '';
    if (!assets.length) {
      /* A blocked or missing manifest must never look like a design decision. */
      var why = (sel && sel.reason) || 'not generated yet';
      line.textContent = 'Asset: None \u00b7 Reason: ' + why + fmt + timing;
      line.title = 'No library asset was used. Reason: ' + why;
      return;
    }
    line.textContent = assets.map(function (a) {
      return 'Asset: ' + pretty(a.filename) + ' \u00b7 Family: ' + a.family;
    }).join('   |   ') + fmt + timing;
    line.title = assets.map(function (a) { return a.url; }).join('\n');
  }

  function start() {
    /* web03-dev-bootstrap.js publishes SMPWeb03Dev on DOMContentLoaded, so the
     * check has to wait for that — reading it while this file is still parsing
     * would always find it undefined and silently skip the indicator. */
    if (!(window.SMPWeb03Dev && window.SMPWeb03Dev.active)) return;
    /* Built first and independently of any generation, so it is there on the
     * blank state before Generate Design has ever been clicked. */
    buildModeControl();
    window.addEventListener('smp:assets-selected', function (e) { render(e.detail); });
    window.addEventListener('smp:stock-photo-selected', function (e) { renderPhoto(e.detail); });
    window.addEventListener('smp:logo-selected', function (e) { renderLogo(e.detail); });
    window.addEventListener('smp:reference-analyzed', function (e) { renderReference(e.detail); });
    /* A generation may already have run before these listeners existed. */
    render(window.SMPLastAssetSelection || { assets: [] });
    renderPhoto(window.SMPLastStockPhoto || null);
    renderLogo(window.SMPLastLogoSelection || null);
    renderReference(window.SMPLastReference || null);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(start, 0); });
  } else {
    setTimeout(start, 0);
  }
}());

/* ── Event: Regenerate button ──────────────────────── */
regenBtn.addEventListener('click', () => {
  if (lastPayload) generate(lastPayload);
});

/* ── Event: Reset ──────────────────────────────────── */
resetBtn.addEventListener('click', () => {
  applyDefaultProduct();
  industry.value       = '';
  businessName.value   = '';
  styleDirection.value = '';
  imageUrl.value       = '';
  clearDesignPhoto();
  clearReferenceImage();
  if (referenceMode) referenceMode.value = 'recreate';
  svgPaste.value       = '';
  svgFile.value        = '';
  specialInstr.value   = '';
  productNote.textContent = '';
  productNote.classList.add('hidden');
  sidePreviews?.classList.add('hidden');
  if (thumbFrontFrame) thumbFrontFrame.srcdoc = '';
  if (thumbBackFrame) thumbBackFrame.srcdoc = '';
  userZoomPercent = 100;
  if (zoomLabel) zoomLabel.textContent = '100%';
  contactDomSide = 'front';
  clearChipActive();

  unitToggle.querySelectorAll('.unit-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.unit === 'in');
  });
  selectedUnit = 'in';

  document.querySelectorAll('.color-toggle').forEach(t => {
    t.checked = false;
    const slot = t.dataset.slot;
    document.getElementById(`colorBody-${slot}`).classList.add('disabled');
    t.closest('.color-row')?.classList.remove('enabled');
  });

  generatedHtml = null;
  generatedJson = null;
  lastPayload   = null;

  setJsonState('generate');
  resetProgress();
  showIdlePanel();
  hideError();
});

/* ── Download helpers ──────────────────────────────── */

/* The preview decorations MUST come off a file before it is exported or
 * measured. push-to-designer.js owns the canonical stripper; this fallback
 * carries the same ids so a stale-cached (or not-yet-loaded) SMPPush can never
 * silently disable stripping — an unstripped file measures at its cover-scaled,
 * flex-crushed preview box (e.g. 4.22×0.84in for a 3.5×2 business card), and
 * that measurement must never exist. */
const PREVIEW_DECOR_IDS = ['layout-safety', 'layout-fix-applied', 'download-both-sides', 'layout-safety-script', 'layout-universal-fit'];
function stripPreviewDecorationsSafe(html) {
  if (window.SMPPush?.stripPreviewDecorations) return window.SMPPush.stripPreviewDecorations(html);
  let out = html;
  for (const id of PREVIEW_DECOR_IDS) {
    out = out.replace(new RegExp('<style id="' + id + '">[\\s\\S]*?<\\/style>', 'g'), '')
             .replace(new RegExp('<script id="' + id + '">[\\s\\S]*?<\\/script>', 'g'), '');
  }
  return out;
}

function downloadFile(content, filename, mime) {
  const blob = new Blob([content], { type: mime });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/* The machine-readable identity block every export carries. Values come from
 * the REAL selected product and the live payload — nothing hardcoded. It is
 * inert JSON: browsers ignore it, and only the Upload Design parser reads it. */
function buildSterlingMetadata() {
  if (!lastPayload) return null;
  const p = window.SMPProductSelection?.get?.() || null;
  const trimW = Math.round(toPx(lastPayload.width, lastPayload.unit));
  const trimH = Math.round(toPx(lastPayload.height, lastPayload.unit));
  const bleed = bleedPxFor(lastPayload.templateType);
  return {
    schemaVersion: 1,
    generator: 'sterling-template-generator',
    productId: p ? p.id : null,
    partNumber: p ? p.partNumber : null,
    productName: p ? p.name : null,
    templateType: lastPayload.templateType || '',
    width: lastPayload.width, height: lastPayload.height, unit: lastPayload.unit || 'in',
    widthIn: +(trimW / 96).toFixed(4), heightIn: +(trimH / 96).toFixed(4),
    trimWidthPx: trimW, trimHeightPx: trimH,
    bleedPx: bleed,
    canvasWidthPx: trimW + 2 * bleed, canvasHeightPx: trimH + 2 * bleed,
    pages: lastPayload.doubleSided ? 2 : 1,
    doubleSided: !!lastPayload.doubleSided,
    orientation: lastPayload.orientation
      || (trimH > trimW ? 'vertical' : 'horizontal'),
    businessName: lastPayload.businessName || '',
  };
}

function injectSterlingMetadata(html) {
  const meta = buildSterlingMetadata();
  if (!meta) return html;
  /* one block only — replace any earlier one (re-download after edits) */
  let out = html.replace(/<script[^>]*id="sterling-template-metadata"[^>]*>[\s\S]*?<\/script>\s*/i, '');
  const json = JSON.stringify(meta, null, 1).replace(/<\//g, '<\\/');
  const block = `<script type="application/json" id="sterling-template-metadata">${json}</script>`;
  return out.includes('</head>') ? out.replace('</head>', block + '</head>') : block + out;
}

function prepareDownloadHtml(html, doubleSided, templateType) {
  /* THE DOWNLOAD IS THE INTRINSIC DESIGN, never the preview presentation.
   * generatedHtml carries the preview layers — the trim-sized body box, the
   * translate+cover-scale that centres the trim art on the bleed canvas, and
   * the text-fit scripts. Baked into an export they are exactly the
   * "card 360×216 / body 336×192 / extra transform" conflict: the file's own
   * coordinate system disagreeing with itself, and a re-upload compounding
   * it. Push to Designer already strips them before extraction; the download
   * now starts from the same clean design, and the preview re-applies its
   * display layers fresh on upload. */
  html = stripPreviewDecorationsSafe(html);
  html = injectSterlingMetadata(html);
  if (!doubleSided) return html;
  let out = html;
  // Remove preview-only hiding so both spreads render in the saved file.
  out = out.replace(/(<div class="card card--back"[^>]*)\s*style="display:\s*none;?\s*"/gi, '$1');
  out = out.replace(/(<div class="card card--back"[^>]*)\s*style="[^"]*display:\s*none;?[^"]*"/gi, '$1');
  out = out.replace(/(\.card--back[^{]*\{[^}]*?)display:\s*none\s*;?\s*/gi, '$1');
  const cardDisplay = templateType === 'Brochure' ? 'grid' : 'block';
  if (!out.includes('id="download-both-sides"')) {
    out = out.replace('</head>', `<style id="download-both-sides">
.card--back{display:${cardDisplay}!important;margin-top:24px;}
@media print{
  .card--front{page-break-after:always;}
  .card--back{margin-top:0!important;}
}
</style></head>`);
  }
  return out;
}

downloadHtmlBtn.addEventListener('click', () => {
  if (!generatedHtml) return;
  const name = (lastPayload?.templateType || 'template').replace(/\s+/g, '-').toLowerCase();
  const out = prepareDownloadHtml(generatedHtml, lastPayload?.doubleSided, lastPayload?.templateType);
  downloadFile(out, `${name}-design.html`, 'text/html');
});

/* ── JSON state machine ────────────────────────────── */
const JSON_ICONS = {
  generate: `<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>`,
  loading:  `<path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>`,
  download: `<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>`,
};
const JSON_LABELS = {
  generate: 'Generate JSON',
  loading:  'Generating…',
  download: 'Download JSON',
};

/* The Generate JSON button was retired from the toolbar (Push to Designer is
 * the product path; the JSON download was a development aid). The state
 * machine stays as a guarded no-op so the call sites in the generation flow
 * need no changes, and the export logic itself lives on in Push to Designer's
 * downloadTemplateJson. */
function setJsonState(state) {
  jsonState = state;
  if (!jsonBtn) return;
  jsonBtnIcon.innerHTML  = JSON_ICONS[state];
  jsonBtnLabel.textContent = JSON_LABELS[state];
  jsonBtn.disabled       = state === 'loading';
  jsonBtn.classList.toggle('tool-btn-spinning', state === 'loading');
  jsonBtn.classList.toggle('tool-btn-ready', state === 'download');
}

if (jsonBtn) jsonBtn.addEventListener('click', async () => {
  if (jsonState === 'download') {
    const name = (lastPayload?.templateType || 'template').replace(/\s+/g, '-').toLowerCase();
    downloadFile(generatedJson, `${name}-design.json`, 'application/json');
    return;
  }
  if (jsonState !== 'generate' || !generatedHtml) return;

  setJsonState('loading');
  try {
    /* Build the Sterling v1.2 template JSON deterministically in the browser —
     * the same payload Push to Designer produces — instead of calling a server.
     * Embed the source HTML + form payload so the file can be re-uploaded to
     * reload the exact design (see the Upload Design button). */
    if (!window.SMPPush?.convertCurrentDesign) throw new Error('Converter unavailable.');
    const { template } = await window.SMPPush.convertCurrentDesign();
    template.canvasProperties.sourceMeta = template.canvasProperties.sourceMeta || {};
    template.canvasProperties.sourceMeta.sourceHtml = generatedHtml;
    template.canvasProperties.sourceMeta.payload = {
      templateType: lastPayload.templateType, width: lastPayload.width,
      height: lastPayload.height, unit: lastPayload.unit,
      doubleSided: !!lastPayload.doubleSided, businessName: lastPayload.businessName || '',
    };
    generatedJson = JSON.stringify(template, null, 2);
    setJsonState('download');
  } catch (err) {
    setJsonState('generate');
    showError(err.message || 'Could not build the design JSON. Please try again.');
  }
});

/* ── Upload a pre-created design (HTML, or a JSON exported by this tool) ── */
const uploadDesignBtn   = document.getElementById('uploadDesignBtn');
const uploadDesignInput = document.getElementById('uploadDesignInput');

/* Read the versioned identity block out of an exported HTML file. */
function parseSterlingMetadata(html) {
  const m = /<script[^>]*id="sterling-template-metadata"[^>]*>([\s\S]*?)<\/script>/i.exec(html);
  if (!m) return null;
  try {
    const d = JSON.parse(m[1].replace(/<\\\//g, '<\/'));
    return d && Number(d.schemaVersion) >= 1 && d.width > 0 && d.height > 0 ? d : null;
  } catch (e) { return null; }
}

/* Exactly ONE verified product with these trim dimensions (either
 * orientation) -> that product. Anything else -> null: ambiguity is reported,
 * never guessed away. */
async function findUniqueProductByDims(wIn, hIn) {
  if (!window.SMPProductSelection?.search) return null;
  try {
    const r = await window.SMPProductSelection.search('', { limit: 2000 });
    const fit = (a, b) => Math.abs(a - b) <= Math.max(0.06, b * 0.02);
    const hits = (r.results || []).filter((p) =>
      (fit(wIn, p.widthIn) && fit(hIn, p.heightIn))
      || (fit(wIn, p.heightIn) && fit(hIn, p.widthIn)));
    if (hits.length !== 1) return null;
    /* Template Type resolves through applyProductToForm when the product is
       selected; the caller only needs the part number. */
    return { partNumber: hits[0].partNumber, templateType: '' };
  } catch (e) { return null; }
}

/* Best-effort product match from finished dimensions (inches, either orientation). */
function matchTemplateType(wIn, hIn) {
  const fit = (a, b) => Math.abs(a - b) <= Math.max(0.2, b * 0.06);
  for (const [name, p] of Object.entries(PRODUCT_PRESETS)) {
    if ((fit(wIn, p.w) && fit(hIn, p.h)) || (fit(wIn, p.h) && fit(hIn, p.w))) return name;
  }
  return 'Business Card';
}

/* Render HTML off-screen and measure the design surface, to infer its size. */
function measureHtmlDims(html) {
  /* Measurement only: external stylesheets (the injected designer-fonts link,
   * a slow CDN) delay or hang the iframe's load event without changing the
   * card's fixed pixel geometry, so they are dropped from the measuring copy
   * and the element is POLLED instead of waiting for a full load. */
  const measurable = html.replace(/<link\b[^>]*rel=["']?stylesheet["']?[^>]*>/gi, '');
  return new Promise(resolve => {
    const f = document.createElement('iframe');
    f.setAttribute('sandbox', 'allow-same-origin allow-scripts');
    f.style.cssText = 'position:fixed;left:-10000px;top:0;width:1600px;height:1600px;border:0;';
    let done = false;
    const finish = (v) => { if (done) return; done = true; try { f.remove(); } catch {} resolve(v); };
    document.body.appendChild(f);
    const read = () => {
      try {
        const doc = f.contentDocument;
        if (!doc || !doc.body) return false;
        const el = doc.querySelector('.card, .design, .canvas, [class*="card"], [class*="plate"], [class*="badge"]')
          || doc.body.firstElementChild;
        if (!el) return false;
        const r = el.getBoundingClientRect();
        if (r.width > 2 && r.height > 2) {
          finish({ wpx: Math.round(r.width), hpx: Math.round(r.height) });
          return true;
        }
        return false;
      } catch (e) { return false; }
    };
    const poll = setInterval(() => { if (read()) clearInterval(poll); }, 100);
    f.addEventListener('load', () => { if (read()) clearInterval(poll); }, { once: true });
    f.srcdoc = measurable;
    setTimeout(() => { clearInterval(poll); finish(null); }, 2500);
  });
}

/* Load an arbitrary design into the generator exactly as if it had just been
 * generated — preview, Push to Designer, and Download JSON all then work. */
function loadDesignIntoGenerator(payload, html, label, opts) {
  lastPayload = {
    templateType: payload.templateType || 'Business Card',
    width: payload.width, height: payload.height, unit: payload.unit || 'in',
    doubleSided: !!payload.doubleSided,
    businessName: payload.businessName || 'Demo Co',
    creativityLevel: creativityLevel?.value || 'balanced',   // see the note at the first use
  };
  generatedHtml = html;
  generatedJson = null;
  setJsonState('generate');
  /* Keep the form controls in sync so Regenerate / Push stay consistent —
   * EXCEPT when a selected product's fields are authoritative and this design
   * was NOT restored to that product (a metadata-less upload kept "at its own
   * size"). Writing the file's measured dimensions into product-locked fields
   * poisoned every later generation for that product (a 3.5×2 business card
   * regenerating at 4.22×0.84 after one bad upload). The design still previews,
   * pushes and downloads at its own lastPayload size either way. */
  const syncForm = !(opts && opts.syncForm === false);
  if (syncForm) {
    if ([...templateType.options].some(o => o.value === lastPayload.templateType)) templateType.value = lastPayload.templateType;
    if (dimWidth)  dimWidth.value  = lastPayload.width;
    if (dimHeight) dimHeight.value = lastPayload.height;
  }
  if (businessName && payload.businessName && payload.businessName !== 'Demo Co') businessName.value = payload.businessName;
  showPanel('result');
  const widthPx  = Math.round(toPx(lastPayload.width, lastPayload.unit));
  const heightPx = Math.round(toPx(lastPayload.height, lastPayload.unit));
  previewFrame.style.width  = widthPx + 'px';
  previewFrame.style.height = heightPx + 'px';
  previewFrame.srcdoc = renderPreviewHtml(html, lastPayload);
  armPreviewReady(); // fit + side visibility without waiting for 'load'
  applyPreviewScale(widthPx, heightPx);
  toolbarLabel.textContent = (label || 'Uploaded design') + ' — loaded';
  upgradePreviewIcons(html, lastPayload);
}

async function handleUploadedFile(file) {
  try {
    const text = await file.text();
    const isJson = /\.json$/i.test(file.name) || (!/\.html?$/i.test(file.name) && /^\s*[{[]/.test(text));
    if (isJson) {
      const data = JSON.parse(text);
      // 1) A Sterling template exported by this tool (Download JSON) — has the
      //    source HTML + form payload embedded in canvasProperties.sourceMeta.
      const meta = data?.canvasProperties?.sourceMeta;
      if (data?.pages && meta?.sourceHtml) {
        const p = meta.payload || {};
        loadDesignIntoGenerator(
          { templateType: p.templateType, width: p.width, height: p.height, unit: p.unit,
            doubleSided: p.doubleSided, businessName: p.businessName },
          meta.sourceHtml, file.name.replace(/\.json$/i, ''));
        return;
      }
      // 2) A sample-style design JSON: {samples:[…]} or {html,width,height,…}
      const s = Array.isArray(data?.samples) ? data.samples[0] : (data?.html ? data : null);
      if (s?.html) {
        loadDesignIntoGenerator(
          { templateType: s.templateType, width: s.width, height: s.height,
            unit: s.unit || 'in', doubleSided: s.doubleSided, businessName: s.businessName },
          s.html, s.name || file.name.replace(/\.json$/i, ''));
        return;
      }
      throw new Error('That JSON has no embedded design HTML. Upload an HTML file, or a JSON exported by this tool with the Download JSON button.');
    }
    // An HTML file. Older exports carry baked preview layers (trim-sized body
    // box + cover scale); strip them so the design is intrinsic again and can
    // never arrive pre-squished.
    const clean = stripPreviewDecorationsSafe(text);
    const label = file.name.replace(/\.[^.]+$/, '');

    // 1) The metadata block, read BEFORE anything renders: restore the REAL
    //    Sterling product first, through the same verified provider the picker
    //    uses — arbitrary metadata is never trusted past that resolution.
    const meta = parseSterlingMetadata(clean);
    console.log('[html-import] metadata product:', meta ? (meta.partNumber + ' · ' + meta.width + '×' + meta.height + (meta.unit || 'in')) : 'none (older file)');
    console.log('[html-import] current product BEFORE:', window.SMPProductSelection?.get?.()?.partNumber || 'none');
    if (meta && meta.partNumber && window.SMPProductSelection) {
      try {
        await window.SMPProductSelection.selectByPartNumber(meta.partNumber);
      } catch (e) {
        showError('This design was made for ' + meta.partNumber + ', which this catalogue '
          + 'does not carry — loading it standalone at its own size.');
      }
      console.log('[html-import] current product AFTER await:', window.SMPProductSelection?.get?.()?.partNumber || 'none');
      htmlImportDiag = true;
      loadDesignIntoGenerator(
        { templateType: meta.templateType, width: meta.width, height: meta.height,
          unit: meta.unit || 'in', doubleSided: !!meta.doubleSided,
          businessName: meta.businessName },
        clean, label);
      return;
    }

    // 2) No metadata (an older file): measure its intrinsic surface, then try
    //    a catalogue match — auto-select ONLY when exactly one verified
    //    product has these trim dimensions. Never silently assume a product,
    //    and never rewrite the design into the currently selected one.
    const dims = await measureHtmlDims(clean);
    if (!dims) throw new Error('Could not find a design element (e.g. a .card) in that HTML file.');
    const wIn = +(dims.wpx / 96).toFixed(2), hIn = +(dims.hpx / 96).toFixed(2);
    console.log('[html-import] intrinsic HTML size:', dims.wpx + '×' + dims.hpx + 'px (' + wIn + '×' + hIn + 'in)');
    const unique = await findUniqueProductByDims(wIn, hIn);
    let keptCurrent = false;
    if (unique) {
      try { await window.SMPProductSelection.selectByPartNumber(unique.partNumber); }
      catch (e) { /* keep standalone */ }
    } else if (window.SMPProductSelection?.get?.()) {
      keptCurrent = true;
      showError('This HTML carries no Sterling metadata and its size matches more than one '
        + 'product (or none) — keeping the current product; the design loads at its own '
        + wIn + '×' + hIn + ' in size.');
    }
    console.log('[html-import] current product AFTER await:', window.SMPProductSelection?.get?.()?.partNumber || 'none');
    htmlImportDiag = true;
    loadDesignIntoGenerator(
      { templateType: (unique && unique.templateType) || matchTemplateType(wIn, hIn),
        width: wIn, height: hIn, unit: 'in',
        doubleSided: /card--back/i.test(clean) },
      clean, label,
      /* never rewrite a locked product's dimension fields with a stray file's
       * measured size — the preview alone uses the file's own size */
      { syncForm: !keptCurrent });
  } catch (err) {
    showError(err.message || 'Could not load that file.');
  }
}

uploadDesignBtn?.addEventListener('click', () => uploadDesignInput?.click());
uploadDesignInput?.addEventListener('change', (e) => {
  const file = e.target.files && e.target.files[0];
  if (file) handleUploadedFile(file);
  e.target.value = ''; // let the same file be picked again
});

/* ── Error toast ───────────────────────────────────── */
function showError(msg) {
  clearTimeout(toastTimeout);
  errorMessage.textContent = msg;
  errorToast.classList.remove('is-success');
  errorToast.classList.remove('hidden');
  toastTimeout = setTimeout(hideError, 8000);
}

/* Same toast, success dress — "Draft created, opening the designer" is good
 * news and was being announced in the red error style. */
function showSuccess(msg) {
  clearTimeout(toastTimeout);
  errorMessage.textContent = msg;
  errorToast.classList.add('is-success');
  errorToast.classList.remove('hidden');
  toastTimeout = setTimeout(hideError, 8000);
}

function hideError() {
  errorToast.classList.add('hidden');
}

toastClose.addEventListener('click', hideError);

/* ── Resize: re-scale on window resize ─────────────── */
let resizeDebounce = null;
window.addEventListener('resize', () => {
  clearTimeout(resizeDebounce);
  resizeDebounce = setTimeout(() => {
    if (!resultState.classList.contains('hidden') && lastPayload) {
      fitIframeToContent();
    }
  }, 120);
});
