# Sterling read-only Product API — requested contract

**For:** Jesse / Sterling IT
**From:** Design Template Generator integration
**Status:** Request for comment. **Nothing here has been built or deployed.** No
production file was created or modified, and no endpoint was called during the
work that produced this document.

---

## Why this is being asked for

The Design Template Generator produces a print-ready design and hands it to
Sterling's Designer. To size that design correctly it needs a small number of
**product facts** — physical dimensions, bleed, page count, shape.

Today the Generator *guesses* those from its own template-type dropdown
("Business Card" → 3.5×2, 0.125″ bleed). Those guesses are clearly labelled as
non-authoritative in the code, but they are still guesses, and a design built on
a guessed size is a design that prints wrong.

The Generator has been refactored so a product source is pluggable. All that is
missing is an authoritative source.

### Why not just call `getStampInfo.cfm`?

We can, and there is already an interim adapter for it. But it is a poor
long-term fit:

1. It is a **legacy-Designer endpoint**. The Generator was deliberately
   decoupled from the legacy Designer so that Sterling can replace the Designer
   without the Generator being rewritten. Binding it back to `getStampInfo`
   undoes that.
2. It returns **commercial data** — `LOWESTPRICE` and per-variation pricing — to
   what is a public browser application. It also returns colours, product
   options and image paths that are not needed.
3. Its `LIMIT 1` part-number resolution **silently hides ambiguity**.

A small dedicated endpoint avoids all three. It can be built on the existing
`ProductService.cfc` in `portals/Web/site/services/`, which already contains
`getStampInfo()`, `getProductsByGroup()` and `setStampDimensions()` as clean
private methods.

---

## Endpoints requested

### 1. Product lookup by id

```
GET /productLookup.cfm?id=8901&siteFamilyId=<int>&live=<true|false>
```

`id` is `designCentral.products.id` — **the canonical key.**

### 2. Product lookup by part number

```
GET /productLookup.cfm?part=HLCBBCE&siteFamilyId=<int>&live=<true|false>
```

Resolution should follow the existing logic (`products.product`,
`sitefamilyproductmap.customerPartNumber`, `sitefamilyproductmap.sterlingPartNumber`,
then `products.alternatelookupcodes`) — **except** that multiple matches must
return an explicit `ambiguous` error rather than `LIMIT 1`. See *Ambiguity*.

### 3. Product search

```
GET /productSearch.cfm?q=business%20card&limit=25&offset=0&siteFamilyId=<int>&live=<true|false>
```

---

## Response shapes

### Lookup — success (HTTP 200)

```json
{
  "id": 8901,
  "partNumber": "HLCBBCE",
  "name": "Hearing Life Co Branded Business Card - English",
  "productFamily": "Business Cards",

  "dimensions": {
    "widthIn": 3.5,
    "heightIn": 2,
    "dpi": 96,
    "displayUnit": "in",
    "widthDisplay": "3.5",
    "heightDisplay": "2"
  },

  "bleed":  { "top": 12, "right": 12, "bottom": 12, "left": 12 },
  "pages":  { "min": 2, "max": 2 },
  "shape":  "rect",
  "orientation": { "landscapeAvailable": true, "portraitAvailable": true },
  "maxLines": 3,
  "status": { "active": true, "retired": false },

  "legacy": {
    "designerVariationCode": 3,
    "margins":  { "top": 6, "right": 6, "bottom": 6, "left": 6 },
    "borders":  { "top": 0, "right": 0, "bottom": 0, "left": 0, "width": 2 },
    "daterBox": { "width": 0, "height": 0 },
    "isProStamp": false,
    "greenInkAvailable": true,
    "bandString": "",
    "clipPaths": [],
    "clipPathOverlays": []
  },

  "context": { "siteFamilyId": 1, "live": true }
}
```

The values above are the **real recorded values** for product 8901, taken from
`newDesignerDB/EXAMPLES/getStampInfo.cfm.json`. Only the *shape* is proposed.

**Two structural requests:**

- **Top level = genuine product facts.** Physical size, bleed, pages, shape,
  orientation, availability. These survive a Designer replacement.
- **`legacy` = current-Designer facts.** `designerVariationCode`, editor margins
  and borders, dater box, stamp-editor flags, Fabric clip paths. Isolating them
  means a future Designer can ignore the block wholesale.

`dimensions.widthIn`/`heightIn` are authoritative; the pixel canvas is derived
(`inches × dpi`), matching `functions.cfc` today. Please return inches and let
consumers derive pixels rather than baking in the 96-DPI convention.

### Lookup — must **NOT** include

`LOWESTPRICE` · per-variation prices · any customer or contract pricing ·
`VARIATIONS[]` · `COLOURS[]` · `PRODUCTOPTIONS[]` · sample/product image paths ·
`leadTimeDays`, `UOM`, `QtyToWrite`, `outputFolder`, SAP fields · translated
description variants beyond what display needs.

### Search — success (HTTP 200)

Deliberately lightweight; the client calls lookup for the full record.

```json
{
  "results": [
    { "id": 8901, "partNumber": "HLCBBCE",
      "name": "Hearing Life Co Branded Business Card - English",
      "productFamily": "Business Cards",
      "width": 3.5, "height": 2, "unit": "in" }
  ],
  "total": 1,
  "limit": 25,
  "offset": 0
}
```

### Errors — one stable shape, on every failure

```json
{ "error": { "code": "not-found", "message": "No product matches part 'XYZ' for siteFamilyId 1 (live).", "detail": null } }
```

| `code` | HTTP | When |
|---|---|---|
| `bad-request` | 400 | missing/invalid `id`, `part`, `siteFamilyId`, or `live` |
| `not-found` | 404 | no match in that site family / live combination |
| `ambiguous` | 409 | more than one product matches — see below |
| `server-error` | 500 | anything unexpected (no stack traces, no SQL) |

**Never** return HTTP 200 with an empty body or an HTML error page — the client
treats a non-JSON 200 as a transport failure.

---

## Non-functional requirements

### Context must be explicit

`siteFamilyId` and `live` are **required parameters**, not ambient
`application`-scope values. The same part number resolves to different products
per site family, so an implicit default would silently return the wrong product
— and a wrong product means a wrongly sized print job. Echo both back in
`context` so the client can verify what it actually got.

### Ambiguity

The legacy query ends `ORDER BY t1.id ASC LIMIT 1`, which quietly picks the
lowest id when several products match. Please return `409 ambiguous` with the
candidate ids in `detail` instead:

```json
{ "error": { "code": "ambiguous", "message": "3 products match part 'BC-STD'.",
             "detail": { "candidates": [6505, 8901, 9102] } } }
```

### Not found

`404` with `code: "not-found"`. An inactive, retired, or out-of-site-family
product should be **not found**, not returned with `active: false` — the client
must not be able to build a design on a product that cannot be ordered.

### Security

| Requirement | Why |
|---|---|
| **`SELECT` only** — ideally a read-only DB user | The endpoint must not be able to mutate anything |
| **Explicit CORS allowlist** — the Generator's exact origin, **not `*`** | `catalogService.cfm` currently sets `Access-Control-Allow-Origin: *`; please do not copy that here |
| **No credentials in the browser** | The Generator is a public client-side app. It can never hold a DB credential or a private key. If the endpoint needs authentication, it must be a mechanism safe for a public client, or the endpoint must be network-restricted instead |
| Network restriction is acceptable | If simpler, restrict to Sterling's network/VPN and we will run the Generator inside it |
| **Rate limit `productSearch`** | It takes free text; suggest ~10 req/s per IP |
| No stack traces or SQL in error bodies | |

### Caching

Product specs change rarely. `Cache-Control: public, max-age=300` on lookup is
welcome; search should not be cached.

---

## What the client already does

- `integration/product-contract.js` — the normalized Product record and its
  validator. A response that fails validation is **rejected**, not used, so a
  malformed record can never silently produce a wrongly sized design.
- `integration/product-provider.js` — `SterlingProductProvider`, with
  `getById()`, `getByPartNumber()` and `search()`. It requires `baseUrl`,
  `siteFamilyId` and `live` to be injected and **throws if any is missing**. No
  hostname is hardcoded anywhere.
- It also ships an **interim** `normalizeStampInfo()` for the existing
  `getStampInfo.cfm` shape, which discards all pricing and variation data. That
  is a stopgap, not the target.

Both are tested offline against the recorded response for product 8901. Nothing
calls Sterling.

---

## Open questions

1. **Where should these endpoints live**, and which `ProductService.cfc` is
   canonical? `portals/Web/site/services/ProductService.cfc` looks newest and
   best-factored — is it live?
2. **Which `siteFamilyId` and `live` should the Generator use** for Marketing's
   template work?
3. **Is `getStampInfo.cfm` genuinely public?** The file itself has no login or
   IP check, but its enclosing `Application.cfc` may. This affects whether the
   interim path is usable at all.
4. **Please confirm the `designerVariationCode` mapping.** From
   `designervariationcodes` (4 rows) we have only **`3` → `FullColour`**
   confirmed, from the recorded product 8901. `1`/`2`/`4` are currently inferred
   as SingleColour / Grayscale / EngravedPlastic from the strings the legacy JS
   branches on. The contract flags unproven codes via
   `legacy.designerModeProven`.
5. **Is `products.id` stable across staging and production?** If not, a stored
   product reference needs an environment qualifier.
6. **Real product ids for five more categories** — self-inking stamp, round
   stamp, name badge/nameplate, sign, print. Product 8901 is currently the only
   verified real record available to us; we will not invent the others.
7. **Is `newDesignerDB/product-designer` (datasource `productDesigner`) the
   replacement Designer?** If so, its catalogue may become the long-term product
   source and this contract should be aligned with it now.
