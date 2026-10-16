# Gap-like Storefront — Angular 16 (internal demo)

> **Not actually a Gap site — internal demo only, not affiliated with, endorsed by, or a real Gap product.**
> Every page carries the same disclaimer in a thin top bar.

A faithful visual replica of [gap.com](https://www.gap.com) built as an intentionally
**legacy-stack** Angular app. This repo is the "before" picture for a later framework
upgrade exercise — everything here is deliberately the old way (see
[Upgrade candidates](#upgrade-candidates)).

Real catalog data (product names, prices, colourways, images) was captured from the live
gap.com catalog API — including the reference PDP,
[Relaxed Polo Sweater #907280](https://www.gap.com/browse/product.do?pid=907280012&vid=1)
($79.95, "40% off at checkout", 6 colourways, fits Regular/Tall, sizes XS–XXXL). Product
imagery is hotlinked from `www.gap.com/webcontent` / `content.gapinc.com` (verified HTTP 200) with Unsplash `onerror` fallbacks.

## Quick start

```bash
nvm use            # Node 18 (.nvmrc)
npm ci             # frontend deps (exact pins)
npm --prefix server ci   # API deps
npm start          # runs API (:4201) + Angular dev server (:4200) concurrently
```

Open <http://localhost:4200>. The dev server proxies `/api/*` to the Express API on
:4201 (`proxy.conf.json`). If the API isn't running, the UI falls back to the bundled
`src/assets/data/catalog.json`.

```bash
npm run build      # production build -> dist/gap-storefront
```

## Tests & lint

```bash
npm test           # Karma + Jasmine, headless Chrome (52 specs)
npm run test:server  # Express API tests (node:test, 5 suites)
npm run lint       # angular-eslint + prettier via lint-staged/husky
```

Pre-commit hook (husky + lint-staged) runs ESLint `--fix` and Prettier on staged files.

## What's inside

| Route                           | Page                                                                              |
| ------------------------------- | --------------------------------------------------------------------------------- |
| `/`                             | Home — hero, men's category tile rail, F&F promo rail                             |
| `/browse/:department`           | Department PLP (shop-all)                                                         |
| `/browse/:department/:category` | Category PLP — filters (size, colour, price) + sort                               |
| `/browse?q=…`                   | Search results                                                                    |
| `/browse/product/:id`           | PDP — gallery, 6 colourway swatches, fit, size grid + validation, qty, Add to Bag |
| `/bag`                          | Bag — qty edit, remove, promo code, order summary                                 |
| `/checkout`                     | 3-step reactive form: shipping → payment (Luhn) → review                          |
| `/checkout/confirmation`        | Order number from `POST /api/checkout`                                            |

Plus: bag drawer (slide-out) with the "Friends & Family 40% off (at checkout)" savings
line, mock sign-in modal, persistent bag (localStorage via an RxJS `BehaviorSubject`
store), and Gap's standard footer link columns.

## Architecture

```mermaid
flowchart LR
  subgraph Browser["Angular 16 app (NgModules)"]
    UI["Feature modules (lazy)<br/>home / catalog / product / bag / checkout"]
    Store["BagStore<br/>BehaviorSubject + localStorage"]
    Cat["CatalogService<br/>HttpClient + shareReplay"]
    UI --> Store
    UI --> Cat
  end

  subgraph Server["Express API (Node 18, TS) — :4201"]
    EP1["GET /api/catalog"]
    EP2["GET /api/products/:id"]
    EP3["POST /api/bag/price"]
    EP4["POST /api/checkout"]
  end

  subgraph Data["Catalog data — one of, via CATALOG_SOURCE"]
    JSON[("src/assets/data/<br/>catalog.json<br/>nightly extract")]
    ORA[("Oracle XE 21c — GAPCAT<br/>docker compose")]
    PG[("PostgreSQL 16 — gapcat<br/>migration target")]
  end
  GapCDN[("gap.com CDN<br/>hotlinked product images")]

  Cat -- "proxy.conf.json" --> EP1 & EP2
  Store -- "POST /api/bag/price" --> EP3
  UI -- "POST /api/checkout" --> EP4
  EP1 & EP2 & EP3 & EP4 --> JSON
  EP1 & EP2 & EP3 & EP4 -. "CATALOG_SOURCE=oracle" .-> ORA
  EP1 & EP2 & EP3 & EP4 -. "CATALOG_SOURCE=postgres" .-> PG
  ORA -.->|"migration"| PG
  UI -.->|"<img> w/ onerror fallback"| GapCDN
```

Pricing rules (40% Friends & Family markdown on promo-eligible lines, promo codes
`EXTRA10` / `GAPMORE`, free shipping ≥ $50, 8.5% tax) are implemented in
`server/src/pricing.ts` (authoritative) and mirrored by the frontend
`PricingService` for instant UI feedback.

### Catalog backend (JSON, Oracle or Postgres)

The API reads its catalog through a `CatalogRepository`
(`server/src/repository.ts`), selected by the `CATALOG_SOURCE` env var:

- **default — `json`**: reads `src/assets/data/catalog.json`, the nightly
  extract. Zero setup; used by CI and tests.
- **`oracle`**: `OracleCatalogRepository` queries a real Oracle XE database
  (schema `GAPCAT`, DDL in `server/oracle/schema.sql`). API responses are
  byte-identical — relational rows are reassembled into the same product shape.
- **`postgres`**: `PostgresCatalogRepository` queries the same five tables on
  Postgres 16 (DDL in `server/postgres/schema.sql`). Connection via
  `POSTGRES_URL` or `PGHOST`/`PGPORT`/`PGUSER`/`PGPASSWORD`/`PGDATABASE`
  (default `postgres://gapcat:gapdemo@localhost:5432/gapcat`). Output is
  byte-identical to the Oracle source.

```bash
docker compose up -d                     # boots Oracle XE + Postgres 16
npm --prefix server run seed:oracle      # creates GAPCAT schema + loads the catalog
npm --prefix server run seed:postgres    # same tables + rows in Postgres
CATALOG_SOURCE=oracle npm start          # API queries live Oracle on :1521
CATALOG_SOURCE=postgres npm start        # API queries live Postgres on :5432
```

`GET /api/health` reports which source is live (`{"ok":true,"products":45,"source":"oracle"}`).
The Postgres service stands in for GCP Cloud SQL for PostgreSQL / AlloyDB — same
engine, same DDL.

## Screenshots & recording

Desktop (1440px):

| Home                                     | PLP                                    | PDP                                    | Bag drawer                                   |
| ---------------------------------------- | -------------------------------------- | -------------------------------------- | -------------------------------------------- |
| ![home](screenshots/01-home-desktop.png) | ![plp](screenshots/02-plp-desktop.png) | ![pdp](screenshots/03-pdp-desktop.png) | ![drawer](screenshots/04-drawer-desktop.png) |

| Bag                                    | Checkout review                                 | Confirmation                                     |
| -------------------------------------- | ----------------------------------------------- | ------------------------------------------------ |
| ![bag](screenshots/05-bag-desktop.png) | ![checkout](screenshots/07-checkout-review.png) | ![confirmation](screenshots/08-confirmation.png) |

Mobile (390px):

| Home                               | Nav                              | PLP                              | Drawer                                 | Bag                              |
| ---------------------------------- | -------------------------------- | -------------------------------- | -------------------------------------- | -------------------------------- |
| ![m home](screenshots/m1-home.png) | ![m nav](screenshots/m2-nav.png) | ![m plp](screenshots/m3-plp.png) | ![m drawer](screenshots/m4-drawer.png) | ![m bag](screenshots/m5-bag.png) |

End-to-end recordings (home → Men → PDP → add to bag → bag → checkout → confirmation):

- [e2e-desktop.webm](screenshots/e2e-desktop.webm)
- [e2e-mobile.webm](screenshots/e2e-mobile.webm)

Verified: full click-through passes with **0 console errors** and **0 broken images**.

## Upgrade candidates

Legacy patterns used **on purpose** — this repo is the "before" for a framework upgrade:

- **NgModule-based architecture** — no standalone components. `AppModule` + `CoreModule`
  - `SharedModule` + lazy-loaded feature modules (`HomeModule`, `CatalogModule`,
    `ProductModule`, `BagModule`, `CheckoutModule`). → standalone components.
- **Lazy loading via `loadChildren` module factories** — `() => import('…').then(m => m.XModule)`. → lazy `loadComponent` / route-level code splitting without NgModules.
- **`*ngIf` / `*ngFor` structural directives** throughout — no `@if` / `@for` control flow.
- **No signals** — all state is RxJS `BehaviorSubject`s + `async` pipe.
- **Classic `@angular-devkit/build-angular:browser` (webpack) builder** — no esbuild/`application` builder, no Vite.
- **`HttpClientModule`** (deprecated) — no `provideHttpClient()`.
- **Karma + Jasmine** unit tests — no Jest/Vitest/Web Test Runner.
- **TypeScript 4.9** — pre-`satisfies`, pre-decorators-v2 era.
- **RxJS-only state management** — hand-rolled store instead of NgRx/component-store.
- **SCSS `@use` module system + manual design tokens** (`src/styles/_tokens.scss`).
- **`RouterTestingModule`/`HttpClientTestingModule`** testing style.
- **Node 18** (`.nvmrc` pins `18`), Angular **16.2.x**, RxJS **7.8.1**, all versions
  **pinned exactly** in `package.json` (no `^`/`~` ranges).

## Repo layout

```
src/app/
  core/           # singleton chrome: demo/brand/promo bars, header, footer, bag drawer, sign-in modal + services
  shared/         # SharedModule: product-card, img-fallback directive, catalog-utils
  features/       # lazy modules: home, catalog (PLP), product (PDP), bag, checkout
src/assets/data/catalog.json   # 45 real Gap SKUs (names/prices/colourways/images)
src/styles/_tokens.scss        # measured design tokens (colours, type, spacing)
server/           # Express + TypeScript mock API (same pricing rules)
  src/repository.ts            # CatalogRepository — json / oracle / postgres sources
  oracle/schema.sql            # GAPCAT schema in Oracle dialect
  postgres/schema.sql          # same schema in Postgres dialect
  scripts/seed-oracle.ts       # loads catalog.json into Oracle XE
  scripts/seed-postgres.ts     # loads catalog.json into Postgres 16
docker-compose.yml             # Oracle XE (1521) + Postgres 16 (5432)
AGENTS.md                      # agent-facing repo conventions + data-source notes
.github/workflows/ci.yml       # lint, Karma tests, prod build, server tests
```
