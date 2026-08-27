# Running the Generator against the web03 dev endpoint

> **Validated.** This flow was completed in a real browser on web03 and created
> draft `templates.id 37509` in `designCentral-dev`. The release-readiness
> closeout — validated SHAs, what ships, what must not, the remaining Sterling
> configuration, deployment order and rollback points — lives in the
> `oldDesigner` repository as `RELEASE-READINESS.md` on branch
> `claude/web03-dev-e2e`. Nothing in *this* repository is production Sterling
> code.


One URL on web03 takes a design from the real Generator, through the real
`templateImport.cfm`, into a new draft in `designCentral-dev`, and opens that
draft in the DEV Template Designer.

```
https://web03.sterling.ca/git/generator-web03-dev-e2e/generator/index.html
```

## Deploy

Add ONE repository entry on `https://web03.sterling.ca/git`, alongside the
existing `web03-dev-e2e` entry, then click **Pull Updates**:

| | |
|---|---|
| repository | `SterlingMarkingProducts/templateGeneratorIntegrationDemo` |
| branch | `claude/generator-web03-dev-e2e` |
| folder | `generator-web03-dev-e2e` |

The folder name matters — it is the switch. `web03-dev-bootstrap.js` activates
only when the page's own path contains `/generator-web03-dev-e2e/`, so the same
build served from anywhere else (GitHub Pages, a laptop, any other clone
folder) is byte-identical and behaves exactly as it always has.

Both clones must be present, because the Generator posts to the other one:

```
/git/generator-web03-dev-e2e/   this repository
/git/web03-dev-e2e/            oldDesigner, branch claude/web03-dev-e2e
```

## The walkthrough

1. Open the URL above — the real Generator, unchanged.
2. Click the **Axiom** demo button. It selects BCDP-CM (product 6505) and
   loads the demo design.
3. Click **Push to Designer**.
4. The browser POSTs the design same-origin to
   `/git/web03-dev-e2e/tests/web03-dev-e2e/templateImport.cfm` — the real
   endpoint, with its internal-IP gate, its security provider and its CSRF
   check all still in force.
5. On HTTP 201 the FULL-UI dev Template Designer opens automatically at
   `templateDesignerFullDev.cfm?template=<the id the server returned>&product=6505`.
   That page runs Sterling's real `templateDesigner.cfm` — its own toolbar,
   menus and controls — rebased for the `/git/` clone and bound to
   `designCentral-dev`. Publishing, mapping, upload and ordering fail closed
   there; see `RELEASE-READINESS.md` and `tests/web03-dev-e2e/README.md` in the
   oldDesigner repository.

The draft is created with `live = 0` and no rows in `productTemplateMap`,
`siteFamilyTemplateMap` or `verticalTemplateMap`, so it is structurally
invisible to every gallery — those all inner-join a mapping table.

## What the browser cannot choose

`importBase`, `designerPage` and the dev CSRF token are constants in
`web03-dev-bootstrap.js`. Nothing is read from the URL, the query string or
any other client input, so a crafted link cannot point the page at production,
at another datasource or at another asset root. Those remain the server's
rules, and the dev clone's `Application.cfc` still enforces them.

The hand-off URL is built from the numeric `templateId` the endpoint returns —
never a hardcoded id, and never `response.openUrl`, which names the production
page.

## When the import fails

The Generator stays where it is. No window opens, and the toast shows the real
outcome — for example `Push to Designer failed (HTTP 403): missing or invalid
CSRF token`. It never falls back to the localStorage hand-off: a failed import
has to read as a failure.

## The demo guard, and the one exception

`demo-guard.js` blocks every network request whose host matches
`*.sterling.ca`. That is what keeps this demonstration from touching anything
of Sterling's, and it stays exactly as it was everywhere else.

web03 serves this clone from `web03.sterling.ca`, so *same-origin* requests
match that rule too. Two things were caught by it:

* the same-origin POST to the verified dev import endpoint — the whole point of
  this clone; and
* the page's own `../data/*.json` files, which is what emptied the product
  picker and removed the demo shortcuts entirely (`demo-samples.js` builds its
  buttons inside that fetch's `.then`, so a blocked fetch produces no section
  at all rather than a broken one).

The guard now makes one narrow exception, and only when every part holds,
re-checked per request:

* the page is itself served from `/generator-web03-dev-e2e/` — read from the
  page's own path;
* the request is same-origin; and
* the path is either **exactly**
  `/git/web03-dev-e2e/tests/web03-dev-e2e/templateImport.cfm` — with
  `web03-dev-bootstrap.js` active and configured with that same endpoint, two
  independent constants that must agree — or a plain `.json` file in this
  clone's own `data/` folder, composed from the page's own directory so it
  cannot climb out of it.

Nothing is read from the query string, a form field or a header. Every other
`sterling.ca` request stays blocked, from this clone included, and the import
exception is fetch-only: XHR and `sendBeacon` keep the unconditional guard.

## The embedded data fallback

`web03-dev-bootstrap.js` also carries a last-resort copy of the catalogue and
demo files, in `generator/web03-dev-data.js`, generated from the committed
data by `scripts/build-web03-dev-data.mjs` (its `--check` mode fails the build
if the two drift). The real fetch is tried first and wins whenever it works —
with the guard exception in place, it does — so the fallback only covers a
server that genuinely will not serve those files. When it engages, the picker's
own status line says which file and why, and
`window.SMPWeb03Dev.dataFallback` records it. Off the dev clone folder the file
is never even downloaded.

## Live AI generation — no API key to set

On this clone the Generator generates for real, and nobody clicks "Set API
key". `browser-api.js` detects the `/generator-web03-dev-e2e/` path and sends
Anthropic requests **same-origin, with no credentials**, to

```
/git/web03-dev-e2e/tests/web03-dev-e2e/aiProxy.cfm
```

which adds the key server-side. The key is read only from the Lucee service's
own configuration — `ANTHROPIC_API_KEY`, the `anthropic.api.key` JVM property,
or a file named by `ANTHROPIC_API_KEY_FILE` — never from this repository, and
it never reaches the browser, localStorage, a URL or a log. Full rules, and
every fail-closed branch, are in `tests/web03-dev-e2e/README.md` in the
oldDesigner repository.

If the server has no key configured the proxy answers `503` with
`"code": "no-api-key"` and names the variable to set. That is configuration
missing, not a broken build — the demo shortcuts and Push to Designer keep
working either way.

Every other deployment is untouched: the public build still offers its own
"Set API key" button and calls Anthropic directly, and localhost still uses
`local-ai-server.mjs`.

