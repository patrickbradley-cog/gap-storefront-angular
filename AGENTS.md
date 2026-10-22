# Repo notes for agents

Gap-like Angular 16 storefront + Express API. Internal demo only — not
affiliated with, endorsed by, or a real Gap product. Every page shows the same
disclaimer via the top demo bar; keep it that way.

## Commands

| Where    | Command                                | What                                    |
| -------- | -------------------------------------- | --------------------------------------- |
| root     | `npm start`                            | web :4200 + api :4201 (proxy.conf.json) |
| root     | `npm test`                             | Karma/Jasmine, headless Chrome          |
| root     | `npm run lint` / `npm run build`       | angular-eslint / prod build             |
| `server` | `npm --prefix server test`             | API tests (`node:test` via tsx)         |
| `server` | `npm --prefix server run build`        | `tsc` typecheck                         |
| root     | `cp .env.example .env` (set passwords) | DB passwords for compose, seed and API  |
| root     | `docker compose up -d`                 | boots Oracle XE + an empty Postgres 16  |
| `server` | `npm --prefix server run seed:oracle`  | creates GAPCAT schema + loads catalog   |

## Catalog data sources

The API resolves catalog data through `CatalogRepository`
(`server/src/repository.ts`), selected by `CATALOG_SOURCE`:

- `oracle` → `OracleCatalogRepository` queries the **Oracle XE** catalog DB
  (schema `GAPCAT`, DDL in `server/oracle/schema.sql`). Connection via env:
  `ORACLE_CONNECT_STRING` (default `localhost:1521/XEPDB1`),
  `ORACLE_USER` (`GAPCAT`), `ORACLE_PASSWORD` (required — no default; set it
  in the untracked `.env`, template `.env.example`).
- unset / `json` → `JsonCatalogRepository` reads
  `src/assets/data/catalog.json` — the nightly extract produced from the
  legacy DB. CI, tests and zero-setup runs use this; keep it working.

`GET /api/health` reports `{ ok, products, source }`.

An empty `postgres` service already exists in `docker-compose.yml` as the
migration target (stands in for GCP Cloud SQL / AlloyDB — same engine).

## Conventions

- Intentionally legacy stack — NgModules (no standalone/signals/new control
  flow), RxJS-only state, webpack `browser` builder, Karma, TS 4.9, Node 18.
  Do not "modernize" patterns; README "Upgrade candidates" lists them.
- All dependencies pinned exactly (no `^`/`~`).
- API responses must stay byte-identical regardless of catalog source —
  relational rows are assembled into the same nested product shape.
- `server/src/pricing.ts` is the authoritative pricing copy; the frontend
  `PricingService` mirrors it.
