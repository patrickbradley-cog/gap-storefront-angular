/**
 * Oracle -> Postgres catalog migration (parallel-run / strangler pattern).
 *
 * 1. Copies every row of the five GAPCAT tables from Oracle XE (still the live
 *    source) into Postgres 16, preserving ids, ORD ordering and LOADED_AT.
 *    The Postgres tables are dropped and recreated, so re-running is safe.
 * 2. Verifies the copy: per-table row counts, then the API payload
 *    (OracleCatalogRepository.catalogMap() vs PostgresCatalogRepository).
 *    Exits non-zero on any mismatch — do not flip CATALOG_SOURCE until it passes.
 *
 * Oracle is only read, never written.
 *
 *   npm run migrate:db                  # copy + verify
 *   npm run migrate:db -- --verify-only # re-check drift during the parallel run
 */
import { createHash } from 'crypto';
import oracledb from 'oracledb';
import { Client } from 'pg';
import { diffCatalogs } from '../src/catalog-diff';
import {
  OracleCatalogRepository,
  PostgresCatalogRepository,
  oracleConfig,
} from '../src/repository';
import {
  Row,
  TABLES,
  connectWithRetry,
  describeTarget,
  insertMany,
  resetIdentity,
  runDdl,
} from './postgres-util';

/** Columns copied per table, in parent-first insert order. */
const COPY_PLAN: Array<{ table: (typeof TABLES)[number]; columns: string[]; orderBy: string }> = [
  {
    table: 'PRODUCTS',
    columns: [
      'PRODUCT_ID',
      'NAME',
      'DEPARTMENT',
      'CATEGORY',
      'PRICE',
      'REGULAR_PRICE',
      'PROMO',
      'BADGE',
      'REVIEW_SCORE',
      'REVIEW_COUNT',
      'DESCRIPTION',
      'LOADED_AT',
    ],
    orderBy: 'PRODUCT_ID',
  },
  {
    table: 'PRODUCT_COLORS',
    columns: [
      'COLOR_ID',
      'PRODUCT_ID',
      'CC_ID',
      'NAME',
      'REGULAR_PRICE',
      'EFFECTIVE_PRICE',
      'FLAG',
      'BADGE',
      'SWATCH',
      'ORD',
    ],
    orderBy: 'COLOR_ID',
  },
  { table: 'PRODUCT_IMAGES', columns: ['IMAGE_ID', 'COLOR_ID', 'URL', 'ORD'], orderBy: 'IMAGE_ID' },
  { table: 'PRODUCT_SIZES', columns: ['PRODUCT_ID', 'SIZE', 'ORD'], orderBy: 'PRODUCT_ID, ORD' },
  { table: 'PRODUCT_FITS', columns: ['PRODUCT_ID', 'FIT', 'ORD'], orderBy: 'PRODUCT_ID, ORD' },
];

const log = (msg: string) => process.stdout.write(`[migrate] ${msg}\n`);

/** SIZE is reserved in Oracle, so the Oracle DDL quotes it. */
const oracleCol = (c: string) => (c === 'SIZE' ? '"SIZE"' : c);

async function oracleConnectWithRetry(tries = 40): Promise<oracledb.Connection> {
  let lastErr: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      return await oracledb.getConnection(oracleConfig());
    } catch (e) {
      lastErr = e;
      process.stdout.write(`  waiting for Oracle (${i + 1}/${tries})...\r`);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
  throw lastErr;
}

async function copyTables(ora: oracledb.Connection, pg: Client): Promise<void> {
  const extracted: Array<{ table: string; columns: string[]; rows: Row[] }> = [];
  for (const { table, columns, orderBy } of COPY_PLAN) {
    const res = await ora.execute<Row>(
      `SELECT ${columns.map(oracleCol).join(', ')} FROM ${table} ORDER BY ${orderBy}`,
      [],
      {
        outFormat: oracledb.OUT_FORMAT_ARRAY,
        fetchInfo: table === 'PRODUCTS' ? { DESCRIPTION: { type: oracledb.STRING } } : {},
      },
    );
    extracted.push({ table, columns, rows: res.rows || [] });
    log(`read ${String(res.rows?.length ?? 0).padStart(5)} rows from Oracle ${table}`);
  }

  await pg.query('BEGIN');
  try {
    await runDdl(pg);
    for (const { table, columns, rows } of extracted) {
      await insertMany(pg, table, columns, rows);
      log(`wrote ${String(rows.length).padStart(5)} rows to Postgres ${table}`);
    }
    await resetIdentity(pg, 'PRODUCT_COLORS', 'COLOR_ID');
    await resetIdentity(pg, 'PRODUCT_IMAGES', 'IMAGE_ID');
    await pg.query('COMMIT');
  } catch (e) {
    await pg.query('ROLLBACK').catch(() => undefined);
    throw e;
  }
}

async function compareCounts(ora: oracledb.Connection, pg: Client): Promise<string[]> {
  const problems: string[] = [];
  for (const { table } of COPY_PLAN) {
    const o = await ora.execute<[number]>(`SELECT COUNT(*) FROM ${table}`);
    const p = await pg.query<{ n: string }>(`SELECT COUNT(*) AS n FROM ${table}`);
    const oracleRows = Number(o.rows?.[0]?.[0]);
    const pgRows = Number(p.rows[0].n);
    const ok = oracleRows === pgRows;
    log(`  ${ok ? 'OK  ' : 'FAIL'} ${table.padEnd(15)} oracle=${oracleRows} postgres=${pgRows}`);
    if (!ok) problems.push(`${table}: oracle has ${oracleRows} rows, postgres has ${pgRows}`);
  }
  return problems;
}

const sha256 = (m: Map<string, unknown>) =>
  createHash('sha256')
    .update(JSON.stringify([...m.values()]))
    .digest('hex');

async function comparePayloads(): Promise<string[]> {
  const oracle = new OracleCatalogRepository();
  const postgres = new PostgresCatalogRepository();
  try {
    const [o, p] = await Promise.all([oracle.catalogMap(), postgres.catalogMap()]);
    log(`  oracle   ${o.size} products sha256=${sha256(o)}`);
    log(`  postgres ${p.size} products sha256=${sha256(p)}`);
    return diffCatalogs(o, p, 'oracle', 'postgres');
  } finally {
    await Promise.all([oracle.close(), postgres.close()]);
  }
}

async function main(): Promise<void> {
  const verifyOnly = process.argv.includes('--verify-only');
  log(`source: Oracle ${oracleConfig().connectString}  target: Postgres ${describeTarget()}`);
  const ora = await oracleConnectWithRetry();
  const pg = await connectWithRetry();
  let problems: string[];
  try {
    if (verifyOnly) log('--verify-only: skipping copy');
    else await copyTables(ora, pg);

    log('verify 1/2: row counts');
    problems = await compareCounts(ora, pg);
  } finally {
    await pg.end();
    await ora.close();
  }

  log('verify 2/2: API payloads (catalogMap)');
  problems.push(...(await comparePayloads()));

  if (problems.length) {
    log(`FAILED — ${problems.length} mismatch(es); keep CATALOG_SOURCE=oracle:`);
    for (const p of problems.slice(0, 50)) log(`  - ${p}`);
    if (problems.length > 50) log(`  ... and ${problems.length - 50} more`);
    process.exit(1);
  }
  log('PASSED — Postgres matches Oracle. Safe to cut over with CATALOG_SOURCE=postgres.');
}

main().catch((e) => {
  console.error('[migrate] failed:', e);
  process.exit(1);
});
