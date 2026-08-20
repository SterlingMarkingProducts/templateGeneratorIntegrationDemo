# `templateImport.cfm` — requested contract

**For:** Jesse / Sterling IT
**From:** Design Template Generator integration
**Status:** Request for comment. **`templateImport.cfm` does not exist.** No
production file was created or modified, no Sterling endpoint was called, and no
database was queried during the work that produced this document.

The **client half is built and tested** against a deterministic mock
(`integration/adapters/mock-template-import.js`). Every id that mock returns is
synthetic and labelled as such.

---

## What the endpoint is for

The Generator produces a print-ready two-sided design. The goal is to land it in
Sterling as an **editable, non-live draft** that opens in the real
`templateDesigner.cfm`, so a human can review it and then use Sterling's existing
*Save Design as Template* workflow to publish and map it.

Phase 3A established the draft shape from Sterling's own source: **1 `templates`
row + N `templatepages` rows, and no mapping rows at all.** A template with no
`producttemplatemap` / `sitefamilytemplatemap` / `verticaltemplatemap` rows cannot
satisfy the inner joins in the customer gallery query
(`portals/Web/site/INCLUDES/templateSelectionAll.cfm:648-670`), so it is
structurally invisible to customers — a stronger guarantee than a `live` flag.

---

## Request

```
POST /templateImport.cfm
Content-Type: multipart/form-data
```

| Part | Type | Contents |
|---|---|---|
| `manifest` | JSON string | the document below |
| `asset_<refId>` | binary | one part per **unique** image, named by its `refId` |

### `manifest`

```json
{
  "contractVersion": 1,
  "productId": 6505,
  "pages": [
    { "pageNumber": 0, "canvasJson": { "version": "4.4.0", "objects": [ … ] } },
    { "pageNumber": 1, "canvasJson": { "version": "4.4.0", "objects": [ … ] } }
  ],
  "assets": [
    { "refId": "asset-1", "sha256": "9f2c…", "mimeType": "image/png", "byteLength": 155498 },
    { "refId": "asset-2", "sha256": "41ab…", "mimeType": "image/png", "byteLength": 149646 }
  ],
  "source": {
    "application": "templateGenerator",
    "version": 1,
    "partNumberSeenByClient": "BCDP-CM",
    "technicalDataStatus": "cms-verified"
  }
}
```

### What the client deliberately does NOT send

**No `width`, `height`, `bleed`, `safeMargin`, `shape`, `designerMode`,
`minPages` or `maxPages`.**

Those are Sterling product facts. The Generator's own catalogue is 444 products
of which **443 are spreadsheet-INFERRED test data** carrying synthetic negative
ids (`data/sterling-test-catalogue.json`). A server that trusted a client-supplied
dimension could produce a wrongly sized print job. The client sends the artwork —
the only thing it actually knows — plus an id to look the rest up by.

Everything under `source` is **non-authoritative**, present for the audit log
only. The server must never read a technical value from it.

---

## Response

### Success — `201`

```json
{ "templateId": 35042,
  "templateKey": 33871,
  "pages": 2,
  "live": false,
  "mapped": false,
  "openUrl": "/templateDesigner.cfm?template=35042&product=6505" }
```

`openUrl` is the form proven at `portals/Web/site/INCLUDES/templateSelectionAll.cfm:852`
— `template` takes `templates.id`, not `templateKey`.

### Errors — one stable shape

```json
{ "error": { "code": "not-found", "message": "…", "detail": null } }
```

| `code` | HTTP | When |
|---|---|---|
| `bad-request` | 400 | malformed manifest, missing `productId`/`pages`, bad page numbering |
| `not-found` | 404 | product not in designCentral for this site family / live combination |
| `page-count-mismatch` | 409 | `pages.length` outside the product's `minPages…maxPages` |
| `payload-too-large` | 413 | body, an asset, or a page's `canvasJson` over the limit |
| `unsupported-mode` | 422 | the product's designer mode is not in the allowed set |
| `invalid-canvas` | 422 | canvas schema rejected, unresolved `importAssetRef`, or a raster data URI survived |
| `server-error` | 500 | anything unexpected — no stack traces, no SQL |

**Never** return `200` with an empty body or an HTML error page; the client
treats a non-JSON response as a transport failure.

---

## The asset reference scheme

The client must never mint an `imageKey`. Keys are `createUUID()` values that are
the unique primary key of a real table (`templateassets.assetKey`); a
client-chosen one could collide with, or repoint, somebody else's asset.

So the client says *"this is my asset #1"* and the server says *"that is now key X"*:

```
BEFORE  (Generator output)
  { "type":"image", "src":"data:image/png;base64,iVBORw0…", "left":5, "top":6,
    "width":400, "height":300, "scaleX":0.84, "scaleY":0.64, "crossOrigin":"anonymous" }

ON THE WIRE  (manifest + a matching asset_ part)
  { "type":"image", "importAssetRef":"asset-1", "left":5, "top":6,
    "width":400, "height":300, "scaleX":0.84, "scaleY":0.64, "crossOrigin":"anonymous" }

AFTER  (what the server writes to templatepages.canvasJson)
  { "type":"image", "imageKey":"3F2504E0-4F89-11D3-9A0C-0305E82C3301",
    "src":"getImage.cfm?key=3F2504E0-4F89-11D3-9A0C-0305E82C3301&mode=FC&ver=scale",
    "left":5, "top":6, "width":400, "height":300, "scaleX":0.84, "scaleY":0.64,
    "crossOrigin":"anonymous" }
```

**Geometry is never touched** — `left`, `top`, `width`, `height`, `scaleX`,
`scaleY`, `angle`, `opacity`, `originX`, `originY`, `crossOrigin` and
`sterlingType` all pass through byte-identical. Only `src` changes and
`imageKey` is added.

`mode` follows `gettemplateJson.cfm:112-116` — `FC` full colour, `GS` grayscale,
`BW` single colour — derived from the **validated** product, never from the client.

---

## Image rules

### The no-raster-data-URI invariant

`templatepages.canvasJson` is MySQL `TEXT` — **65,535 bytes**. A single Generator
PNG runs to 1.4 MB. Measured on real output, one page went from **1,438,522 bytes
to 6,053** once its rasters moved to the asset store.

**No raster data URI (`png`, `jpeg`, `gif`, `webp`, `bmp`) may ever reach
`canvasJson`.** The client refuses to send one; the server must refuse to store
one (`invalid-canvas`).

### Small SVG stays inline — deliberately

The Generator's SVG logos are **570 bytes to 5 KB for a whole design**, three
orders of magnitude under its rasters. They stay inline, for two reasons:

1. Extracting them would cost a round trip for half a kilobyte.
2. Sterling's upload path validates an incoming image with `<cfimage>`, which
   cannot open an SVG — an SVG upload would fail there today.

They survive the round trip untouched because `gettemplateJson.cfm:117-124` only
rewrites `src` for objects that **have** an `imageKey`; an object without one
keeps whatever `src` it was stored with.

⚠️ **Needs server confirmation:** whether Sterling's Fabric build renders an
inline `image/svg+xml` data URI. If it does not, the alternative is to teach the
asset store to accept SVG (storing it verbatim rather than through `cfimage`).

### Size limits

| Limit | Value | Why |
|---|---|---|
| `canvasJson` per page | **60,000 bytes** | 8% headroom under the 65,535-byte `TEXT` cap |
| Total asset payload | 20 MB | client-side guard; the server should set its own |
| Per asset | server's choice | `templateImageUpload.cfm:52` uses 10 MB today |

The client pre-flights the page limit and **refuses to send** rather than letting
MySQL truncate. Widening `canvasJson` to `MEDIUMTEXT` would be welcome insurance
but is **no longer required** — the largest measured page is 10.1% of the cap.

---

## Responsibilities

### The server owns

| Concern | Note |
|---|---|
| **Authentication** | Internal-IP restriction as `templateDesigner.cfm:1-3`, **plus** a logged-in internal session. `templateDesignerSubmit.cfm` has no session check today; please don't inherit that |
| **CSRF** | `portals` already wires `services/FormSecurity.cfc` (`Application.cfc:185`) |
| **Method** | POST only |
| **Product validation** | Re-fetch product `6505` from designCentral via the canonical `functions.cfc::getStampInfo()` (`oldDesigner/functions.cfc:98`). Derive width, height, bleed, margins, shape, pages and mode there |
| **MIME validation** | Sniff the **bytes**. Never trust `manifest.assets[].mimeType` or the part filename |
| **Storage extension** | Derive server-side from the sniffed type |
| **Asset storage + dedup** | Reuse the existing `md5Hash`/`shaHash` check (`templateImageUpload.cfm:88-96`) so an identical bitmap returns its existing `assetKey` |
| **Canvas rewrite** | `importAssetRef` → `imageKey` + `getImage.cfm` src |
| **Invariants** | reject a surviving raster data URI; reject a page over 60,000 bytes |
| **Transaction** | `<cftransaction>` around `templates` + all `templatepages`. There is **no `cftransaction` anywhere in `oldDesigner` today**; without one a partial insert leaves a row `gettemplateJson.cfm:40` reports as "template damaged" |
| **Draft state** | `live = 0`, `languageCode = 'xx'`, and **zero mapping rows** |

### The client owns

| Concern | Where |
|---|---|
| Design generation | `generator/app.js` |
| Normalized model | `integration/normalized-design.js` |
| Fabric/Sterling dialect | `integration/adapters/sterling-legacy.js` |
| Asset extraction + dedup | `integration/adapters/asset-extract.js` |
| Request assembly | `integration/adapters/transport-import.js` |
| Eligibility (a real positive `products.id`) | `transport-import.js` |
| Pre-flight of both invariants | `transport-import.js` |

---

## Why the existing `templateImageUpload.cfm` is not called directly

Phase 3A.1 audited it. Reusing its **logic** server-side is the right move;
exposing the **endpoint** to a browser app is not:

- **It would need CORS on an unauthenticated write endpoint.** The Generator is a
  separate origin.
- **Two round trips cannot be transactional.** Assets would land before any
  template exists, so every failed or abandoned push would orphan them.
- **It hardcodes Sterling's upload protocol into the browser**, which is exactly
  the coupling this integration was built to avoid.
- **It has defects that should not be given a wider audience.** Two were reported
  separately to Jesse; they are live today and worth fixing regardless of this
  project. They are not restated here.

The recommendation is to **extract** the hash-check-and-store block into a shared
CFC function and call it from both `templateImageUpload.cfm` (behaviour
unchanged) and `templateImport.cfm`.

---

## Eligibility: only a real `products.id` may be imported

A real import writes a row keyed on `designCentral.products.id`. The
spreadsheet-derived test catalogue carries **synthetic negative ids** precisely so
they can never be mistaken for real ones.

| Product | id | Importable |
|---|---|---|
| BCDP-CM | `6505` | ✅ CMS-verified |
| B1438 and 442 others | negative | ❌ blocked client-side with an explanatory message |

Inferred products remain fully usable for design generation and the local
designer handoff. The client refuses the import **before building anything**, so
no partial request is ever assembled.

---

## Still to confirm on a server

1. Are `templateAssets` backed up and persistent? If not, `imageKey` references rot.
2. Do dev and live share the asset filesystem path? `templateassets` has no
   `siteFamilyId`, but the path comes from the per-environment `sites` row.
3. Does Sterling's Fabric build render an inline SVG data URI?
4. Is `<cftransaction>` usable on the `designCentral` Lucee datasource?
5. Widen `canvasJson` to `MEDIUMTEXT`? Optional insurance.
6. Draft and asset expiry policy — drafts also consume a `templateKey`.
