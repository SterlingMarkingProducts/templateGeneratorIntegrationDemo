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

A small dedicated endpoint avoids all three.

### Correction: where the live implementation actually is

An earlier draft of this document suggested building the new endpoint on
`portals/Web/site/services/ProductService.cfc`. **That recommendation was wrong
and is withdrawn.** A source review showed `ProductService.cfc` is **unwired
dead code**:

- `portals/Web/site/Application.cfc:180-186` instantiates the service layer at
  application start — `functions`, `Compat`, `DataService`, `MenuService`,
  `UserService`, `FormSecurity`, `PunchoutService`. `ProductService` and
  `PricingService` are **not in that list**.
- No `.cfm` page references either of them. `ProductService` is named only by
  itself, `services/README.md`, `CODEBASE_ANALYSIS.md`, and `PricingService.cfc`
  — which is itself unreachable.
- Exactly one commit ever touched it (`599e17d`, 2025-12-10), and it was never
  wired in.

**The canonical live product lookup is `functions.cfc::getStampInfo()`**
(`oldDesigner/functions.cfc:98`, reached as `application.functs.getStampInfo()`
from `getStampInfo.cfm:6`, `gettemplateJson.cfm:148`, `getFormJson.cfm:427`,
`getDesignJson.cfm:143`, `getDesignJsonOpt.cfm:166` and `getProof.cfm:53`).

Note also that `oldDesigner` is **ahead of** the `portals` mirror for these
files: `functions.cfc` is 2149 lines there against 1899 in `portals`, and
`oldDesigner`'s most recent commit is far newer. `getStampInfo.cfm` itself is
byte-identical between the two.

So a future normalized Product API should take **one of two deliberate routes**:

- **A — extract from the canonical implementation.** Reuse or lift the
  read-only query logic already in `functions.cfc::getStampInfo()`, which is the
  code actually serving requests today.
- **B — introduce a properly wired service layer on purpose.** If Sterling wants
  the service-layer structure, wire it in `Application.cfc` as a considered
  decision, with the product queries moved across intentionally.

**What we should not do is extend `ProductService.cfc` merely because it exists
in the repository.** Its presence is not evidence that it works; nothing has
ever executed it.

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

That recording is genuine but is an **older snapshot**. Current
`functions.cfc::getStampInfo()` returns seven keys it does not contain:
`BANDSTRING`, `DESCRIPTIONFR`, `PRODUCTOPTIONS`, `SAMPLEIMAGEEN`,
`SAMPLEIMAGEFR`, `PRODUCTIMAGEEN`, `PRODUCTIMAGEFR`. **None of them affects the
fields this contract consumes** — every product fact above is unchanged in
current source — and six of the seven are exactly the kind of data the *must
NOT include* list below already excludes. This is verified offline by
`scripts/test-product-provider.mjs` (checks L1–L4), which replays the recording
with those keys added and asserts the normalized record is identical.

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
  `getStampInfo.cfm` shape, which discards all pricing and variation data. It is
  an explicit allow-list, not a passthrough: it reads named fields and builds a
  fixed record, so keys added to the response in future are ignored rather than
  forwarded.

Both are tested offline against the recorded response for product 8901,
including a replay with the seven newly-observed response keys added — using
synthetic values — which asserts the normalized record comes out identical.
Nothing calls Sterling.

---

## Established from source — no confirmation needed

These were open questions in the previous draft. A read-only review of
`portals` and `oldDesigner` settled them, so please treat them as findings
rather than asks.

### `designerVariationCode`

`products.designerVariationCode` is an `int(11) DEFAULT '-1'` — a **foreign key**
into `designervariationcodes`, whose own `designerVariationCode varchar(45)`
column holds the human-readable string. Proven by the join in
`templateDesigner.cfm:138-141`:

```sql
select t1.*, t2.*, t3.designerVariationCode as designerVariationCodeString
from products t1, sitefamilyproductmap t2, designerVariationCodes t3
...
and t3.id = t1.designerVariationCode
```

| Code | Mode | Status |
|---|---|---|
| `1` | `SingleColour` | **UNPROVEN — inferred** |
| `2` | `Grayscale` | **UNPROVEN — inferred** |
| `3` | `FullColour` | **PROVEN** |
| `4` | `EngravedPlastic` | **PROVEN** |

Codes 3 and 4 are proven by Sterling's own code —
`oldDesigner/gettemplateJson.cfm:163-167`, identically
`getFormJson.cfm:444-448`:

```coldfusion
<cfif partinfo.designerVariationCode eq "3">
    <cfset format = "FullColour">
<cfelseif partinfo.designerVariationCode eq "4">
    <cfset format = "EngravedPlastic">
</cfif>
```

Codes 1 and 2 remain **unproven and are not claimed**. Those same files never
map them: when the code is neither 3 nor 4 the mode falls back to
`SingleColour`, or `Grayscale` when `isProStamp` is true — so the id is not
consulted at all on that path. `templateDesigner.cfm` takes the other route and
branches on the joined string directly, so the two paths can disagree for 1 and
2. No `INSERT INTO designervariationcodes` exists in any Sterling repository, so
the table's four actual rows cannot be read from source. The contract marks
1 and 2 with `legacy.designerModeProven: false`; a request for the four rows is
in *Open questions*.

The four mode strings themselves **are** certain: `templateDesigner.cfm`
branches on exactly `SingleColour`, `Grayscale`, `FullColour` and
`EngravedPlastic`, the column is `UNIQUE`, and the table is
`AUTO_INCREMENT=5` — four strings, four rows.

### `siteFamilyId`

Derived, not configured. `Application.cfc:158-174` looks it up from the site's
own name at application start:

```sql
select * from sitefamilies where LOWER(siteFamilyName) = :name order by id desc limit 1
```

with `:name` = `lcase(url.sitename)`, which the URL rewrite supplies; the app
aborts if it is missing. `application.siteFamilyId` is then that row's `id`.

### `application.Live`

Determined purely by hostname. `Application.cfc:6-12` sets
`this.liveSite = findnocase("dev", cgi.SERVER_NAME) > 0 ? false : true`, and
`INCLUDES/appSelector.cfm` copies it: `<cfset application.live = application.liveSite>`.
`onRequestStart` then hard-redirects to `portals.sterling.ca` or
`portals-dev.sterling.ca`, so in practice non-dev host → `live = true`, dev host
→ `live = false`.

Both values are interpolated **directly into SQL** as `#application.Live#` and
`#application.SiteFamilyId#` (e.g. `functions.cfc:112-113`) rather than bound as
parameters. They are internally-set integers, so this is not injectable — but it
is why making them per-request arguments is not a one-line change, and it is
part of why we are asking for a *new* endpoint rather than a parameterisation of
the existing one.

### `products.id` and dev/live visibility

`products.id` is the `designCentral` primary key (`int(11) AUTO_INCREMENT`), and
it is what `getStampInfo` returns as `PRODUCTIDINT` (`functions.cfc:360`,
`local.returnStruct.productIdInt = local.searchCproduct.productid`).

**Dev/live is a mapping-row flag, not a separate id space.** Every product query
in both the dev and live code paths hardcodes `setDatasource("designCentral")`,
and `INCLUDES/AppLive.cfm` and `INCLUDES/AppDev.cfm` are identical except for
the punchout endpoint. Visibility is filtered per row:

```sql
... and t2.live = #application.Live# and t2.siteFamilyId = #application.SiteFamilyId#
```

on `sitefamilyproductmap` / `sitefamilyvariationmap`. **The same product row
serves both environments; only its mapping rows differ.** Within one
`designCentral` instance, a product id is therefore stable across dev and live
by construction.

### Canvas derivation

`functions.cfc:528-535` confirms the 96-DPI convention, including for metric
products:

```coldfusion
local.returnStruct.canvasWidth = int(local.searchCproduct.widthIn * 96);
local.returnStruct.canvasWidth = int(local.searchCproduct.widthMM * 3.779527559);
```

`3.779527559 = 96 / 25.4`, so both branches are the same DPI. This is why the
contract asks for **inches** and derives pixels rather than having the endpoint
bake the convention in.

---

## Product identifier strategy

**Primary identifier: `products.id`.** It is the `designCentral` primary key,
it is what `getStampInfo` already returns as `PRODUCTIDINT`, and it is stable
across dev and live within one database (above). A stored design references a
product by this id.

Retained alongside it, and not as substitutes:

| Field | Why it is kept |
|---|---|
| `partNumber` | Human-facing, and what Marketing and operators actually say out loud. Not unique enough to be a key: resolution spans `products.product`, two `sitefamilyproductmap` columns and `products.alternatelookupcodes` — see *Ambiguity* |
| `provenance.siteFamilyId` | The same part number resolves to different products per site family. A record without it cannot be re-resolved later |
| `provenance.live` | Which visibility set the record was read from |
| `provenance.source` / `fetchedAt` / `authoritative` | Whether the record came from Sterling or from the Generator's own non-authoritative defaults, and when |

**We are deliberately not adding an environment qualifier to `products.id`
itself.** Source says one is not needed, the id stays a plain integer, and the
environment context lives in `provenance` where it can be checked without
changing the key's type. If the infrastructure question below comes back the
wrong way, adding a qualifier is a contract-version bump we can make then —
whereas removing one we did not need would be a breaking change.

### The one unresolved infrastructure question

**Do `portals.sterling.ca` and `portals-dev.sterling.ca` map the `designCentral`
datasource to the same physical MySQL instance?**

Source proves the datasource *name* is `designCentral` on both paths, but the
name → server mapping lives in Lucee administrator, outside every repository, so
we cannot answer it ourselves. If the two hosts share one instance — which the
`live` flag design strongly implies — a bare `products.id` is safe everywhere.
If they point at separately-seeded databases, ids may collide and the identifier
strategy needs an environment qualifier after all. This is question 3 below.

---

## Open questions

Two questions from the previous draft have been **withdrawn**, because a source
review answered them: *"which `ProductService.cfc` is canonical"* (answered
above — none of them; it is dead code) and *"is `getStampInfo.cfm` genuinely
public"* (answered below, and it turns out to be a security observation rather
than a question). The five that remain all need **data or infrastructure facts
that do not exist in any repository**.

1. **Please run these two read-only `SELECT`s.** They settle the
   `designerVariationCode` mapping for codes 1 and 2. Both are `SELECT`-only and
   touch no customer or pricing data.

   ```sql
   -- the complete code -> name mapping (4 rows)
   SELECT id, designerVariationCode
   FROM   designervariationcodes
   ORDER  BY id;

   -- how many live products use each code
   SELECT p.designerVariationCode AS code,
          d.designerVariationCode AS name,
          COUNT(*)                AS product_count
   FROM   products p
   LEFT   JOIN designervariationcodes d ON d.id = p.designerVariationCode
   WHERE  p.active = 1
   GROUP  BY p.designerVariationCode, d.designerVariationCode
   ORDER  BY product_count DESC;
   ```

2. **Which `siteFamilyName` — and therefore `siteFamilyId` — should the
   Generator use** for Marketing's template work? `siteFamilyId` is looked up
   from the `sitefamilies` table by name (above), and the schema dump carries no
   rows, so we cannot infer it. This is also a business decision, not a code
   fact.

3. **Do `portals.sterling.ca` and `portals-dev.sterling.ca` share one physical
   `designCentral` MySQL instance?** See *Product identifier strategy* above.
   This decides whether a stored `products.id` needs an environment qualifier.

4. **Real product ids / part numbers for five more categories** — self-inking
   stamp, round stamp, name badge or nameplate, sign, print. One each is enough.
   Product 8901 (`HLCBBCE`) is the only genuine recorded product in any
   repository, and we will not invent the others.

5. **Is `newDesigner` / `product-designer` (datasource `productDesigner`)
   coming back?** Its `serverFiles/schema.sql` defines a wholly separate schema
   with a string `designer_type` column rather than designCentral's integer FK,
   and its seeded products (`BC001`, `LH001`, …) appear nowhere in designCentral
   — so it is not a product source we could use today. If it is intended to
   resume, this contract should eventually align to it; if not, the
   Designer-agnostic shape proposed here is the right long-term target.

---

## Security observations

Raised here because they surfaced during the same review, not because they
block this contract.

### `getStampInfo.cfm` appears to be reachable from outside Sterling's network

The file itself has no login check and no IP check — it is six lines that
serialize `application.functs.getStampInfo(url.part)` straight to JSON. Its
enclosing `Application.cfc:288-300` does contain an IP gate:

```coldfusion
if (left(cgi.remote_addr,8) != "192.168." && left(cgi.remote_addr,7) != "172.16."
    && left(cgi.remote_addr,3) != "10." && cgi.remote_addr != "127.0.0.1") {
    if (application.Live == true) { include "includes\liveBlocker.cfm"; }
    else                          { include "includes\devBlocker.cfm"; }
}
```

**but `INCLUDES/LiveBlocker.cfm` and `INCLUDES/DevBlocker.cfm` are entirely
commented out** — the `<cfabort>` inside each is inside a `<!--- --->` block, so
the gate is a no-op. By contrast the equivalent check at the top of
`templateDesigner.cfm:1-3` is live and does abort, which is presumably the
intent for both.

The practical effect, if no IIS or firewall rule compensates, is that
`getStampInfo.cfm` serves `LOWESTPRICE` and per-variation pricing to any caller
who supplies a valid `SiteName`. **We have not tested this** — doing so would
mean calling production — so please verify from your side rather than taking
this as confirmed.

### A shared token is committed to the repository

`Web/site/INCLUDES/AppLive.cfm` and `AppDev.cfm` both hardcode the same
`application.loginToken` literal, identical between live and dev, in version
control. The `sitefamilies` table additionally has `punchoutSharedSecret`,
`punchoutSharedSecretDev`, `DemoLogin` and `DemoPassword` columns. No value is
reproduced in this document. Worth a look independently of this project.
