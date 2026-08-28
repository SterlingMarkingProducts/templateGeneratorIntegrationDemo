/* Icon Bank — extracted vector icon library for the template generator.
 *
 * 825 individual SVG icons extracted from licensed vendor icon sheets
 * (see icons/README.md). All icons use currentColor, so they inherit the
 * CSS `color` of their container.
 *
 * Usage in generated HTML: the generator asks the model to emit
 *   <i data-icon="phone"></i>            (searches both collections)
 *   <i data-icon="minimal/phone"></i>    (explicit collection)
 * and IconBank.inline() replaces each token with the real inline <svg>,
 * so the final HTML is fully self-contained (survives push-to-designer,
 * download, iframes with srcdoc, etc.).
 *
 * Plain-script global: window.IconBank. Requires http(s) serving (fetch).
 */
(() => {
  /* icon-bank.js lives inside icons/, so sibling files resolve from its own URL */
  const BASE = document.currentScript
    ? new URL('./', document.currentScript.src).href
    : new URL('icons/', location.href).href;
  /* Priority when a bare name exists in several collections */
  const COLLECTION_ORDER = ['minimal', 'business-medical'];

  let manifestPromise = null;
  const svgCache = new Map();

  function loadManifest() {
    if (!manifestPromise) {
      manifestPromise = fetch(BASE + 'manifest.json')
        .then((r) => { if (!r.ok) throw new Error('manifest ' + r.status); return r.json(); })
        .catch((err) => { console.warn('[IconBank] manifest unavailable:', err.message); return { icons: [] }; });
    }
    return manifestPromise;
  }

  async function resolve(name) {
    const man = await loadManifest();
    const clean = String(name || '').trim().toLowerCase();
    if (!clean) return null;
    if (clean.includes('/')) {
      const [col, n] = clean.split('/');
      return man.icons.find((e) => e.collection === col && e.name === n) || null;
    }
    for (const col of COLLECTION_ORDER) {
      const hit = man.icons.find((e) => e.collection === col && e.name === clean);
      if (hit) return hit;
    }
    return null;
  }

  async function getSvg(name) {
    const entry = await resolve(name);
    if (!entry) return null;
    if (!svgCache.has(entry.file)) {
      svgCache.set(entry.file, fetch(BASE + entry.file)
        .then((r) => { if (!r.ok) throw new Error(entry.file + ' ' + r.status); return r.text(); })
        .catch((err) => { console.warn('[IconBank]', err.message); return null; }));
    }
    return svgCache.get(entry.file);
  }

  async function search(term) {
    const man = await loadManifest();
    const t = String(term || '').toLowerCase();
    return man.icons.filter((e) => e.name.includes(t));
  }

  /* Replace every <i data-icon="name" ...></i> token in an HTML string with
   * the corresponding inline <svg>. Attributes (style/class) carry over to a
   * wrapping <span> so sizing/positioning written by the model is kept.
   * Unknown names collapse to an empty span (never break the layout). */
  const TOKEN_RE = /<i\b([^>]*?)\bdata-icon\s*=\s*"([^"]+)"([^>]*?)>\s*<\/i>/gi;

  async function inline(html) {
    if (!html || html.indexOf('data-icon') === -1) return html;
    const jobs = [];
    html.replace(TOKEN_RE, (_m, pre, name) => { jobs.push(name); return _m; });
    const svgs = {};
    await Promise.all([...new Set(jobs)].map(async (n) => { svgs[n] = await getSvg(n); }));
    return html.replace(TOKEN_RE, (m, pre, name, post) => {
      const svg = svgs[name];
      const attrs = (pre + ' ' + post).replace(/\s+/g, ' ').trim();
      if (!svg) {
        console.warn('[IconBank] unknown icon:', name);
        return '<span ' + attrs + '></span>';
      }
      /* size via CSS: make the svg fill its wrapper */
      const sized = svg.replace('<svg ', '<svg style="width:100%;height:100%;display:block" ');
      return '<span ' + attrs + ' data-icon-name="' + name + '">' + sized + '</span>';
    });
  }

  window.IconBank = { inline, getSvg, search, resolve, loadManifest };
})();
