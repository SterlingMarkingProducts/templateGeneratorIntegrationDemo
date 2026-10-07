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
   * the corresponding inline <svg>. The token's own <i> element is KEPT as the
   * wrapper, attributes and all, so every sizing rule the model wrote still
   * applies: style="width:18px", a class, and CSS aimed at the tag itself
   * (".contact i { width:18px }"). Turning it into a <span> silently dropped
   * that last kind, and the icon then grew to fill its whole panel.
   * The svg fills its wrapper through a zero-specificity rule (ICON_BASE_CSS),
   * never an inline style, so a model rule such as "li svg { width:18px }"
   * still wins, and a wrapper the model never sized is one text line tall
   * instead of as wide as its container.
   * Unknown names collapse to an empty element (never break the layout). */
  const ICON_BASE_CSS = '<style id="icon-bank-base">'
    + ':where([data-icon-name]){display:inline-block;width:1.25em;height:1.25em;vertical-align:-0.25em;flex:none;font-style:normal;line-height:0}'
    + ':where([data-icon-name])>svg{width:100%;height:100%;display:block}'
    + '</style>';

  function withBaseCss(html) {
    if (html.indexOf('id="icon-bank-base"') !== -1) return html;
    if (/<\/head>/i.test(html)) return html.replace(/<\/head>/i, ICON_BASE_CSS + '</head>');
    if (/<body\b[^>]*>/i.test(html)) return html.replace(/<body\b[^>]*>/i, (m) => m + ICON_BASE_CSS);
    return ICON_BASE_CSS + html;
  }
  const TOKEN_RE = /<i\b([^>]*?)\bdata-icon\s*=\s*"([^"]+)"([^>]*?)>\s*<\/i>/gi;

  async function inline(html) {
    if (!html || html.indexOf('data-icon') === -1) return html;
    const jobs = [];
    html.replace(TOKEN_RE, (_m, pre, name) => { jobs.push(name); return _m; });
    const svgs = {};
    await Promise.all([...new Set(jobs)].map(async (n) => { svgs[n] = await getSvg(n); }));
    const out = html.replace(TOKEN_RE, (m, pre, name, post) => {
      const svg = svgs[name];
      const attrs = (pre + ' ' + post).replace(/\s+/g, ' ').trim();
      if (!svg) {
        console.warn('[IconBank] unknown icon:', name);
        return '<i ' + attrs + '></i>';
      }
      return '<i ' + attrs + ' data-icon-name="' + name + '">' + svg + '</i>';
    });
    return out === html ? html : withBaseCss(out);
  }

  window.IconBank = { inline, getSvg, search, resolve, loadManifest };
})();
