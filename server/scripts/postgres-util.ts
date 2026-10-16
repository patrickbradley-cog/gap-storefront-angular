/** Shared Postgres helpers for seed-postgres.ts and migrate-oracle-to-postgres.ts. */
import fs from 'fs';
import path from 'path';
import { Client, ClientConfig } from 'pg';
import { postgresConfig } from '../src/repository';

export const PG_CONFIG: ClientConfig = postgresConfig();

const SCHEMA_PATH = [
  path.resolve(process.cwd(), 'postgres/schema.sql'),
  path.resolve(__dirname, '../postgres/schema.sql'),
].find((p) => fs.existsSync(p)) as string;

/** Child tables first, so DROP order respects the foreign keys. */
export const TABLES = [
  'PRODUCT_IMAGES',
  'PRODUCT_SIZES',
  'PRODUCT_FITS',
  'PRODUCT_COLORS',
  'PRODUCTS',
] as const;

export type Row = Array<string | number | Date | null>;

/** host:port/db for log lines — never the password. */
export function describeTarget(cfg: ClientConfig = PG_CONFIG): string {
  if (cfg.connectionString) {
    const u = new URL(cfg.connectionString);
    return `${u.host}${u.pathname}`;
  }
  return `${cfg.host}:${cfg.port}/${cfg.database}`;
}

export async function connectWithRetry(tries = 40): Promise<Client> {
  let lastErr: unknown;
  for (let i = 0; i < tries; i++) {
    const client = new Client(PG_CONFIG);
    try {
      await client.connect();
      return client;
    } catch (e) {
      lastErr = e;
      await client.end().catch(() => undefined);
      process.stdout.write(`  waiting for Postgres (${i + 1}/${tries})...\r`);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
  throw lastErr;
}

/** Drops and recreates the GAPCAT tables from server/postgres/schema.sql. */
export async function runDdl(client: Client): Promise<void> {
  await client.query(`DROP TABLE IF EXISTS ${TABLES.join(', ')} CASCADE`);
  await client.query(fs.readFileSync(SCHEMA_PATH, 'utf8'));
}

/** Multi-row parameterized INSERT ($1..$n), batched to stay under the bind-param limit. */
export async function insertMany(
  client: Client,
  table: string,
  columns: readonly string[],
  rows: Row[],
  batchSize = 500,
): Promise<void> {
  for (let start = 0; start < rows.length; start += batchSize) {
    const batch = rows.slice(start, start + batchSize);
    const values = batch
      .map((_, r) => `(${columns.map((_c, c) => `$${r * columns.length + c + 1}`).join(', ')})`)
      .join(',\n');
    await client.query(
      `INSERT INTO ${table} (${columns.join(', ')}) VALUES ${values}`,
      batch.flat(),
    );
  }
}

/** Explicit ids bypass identity sequences; move each sequence past the copied max. */
export async function resetIdentity(client: Client, table: string, column: string): Promise<void> {
  await client.query(
    `SELECT setval(pg_get_serial_sequence($1, $2),
                   GREATEST((SELECT MAX(${column}) FROM ${table}), 1))`,
    [table.toLowerCase(), column.toLowerCase()],
  );
}
