/**
 * Loads the catalog (src/assets/data/catalog.json — the nightly extract) into
 * the GAPCAT tables on Postgres 16. Idempotent: drops and recreates all tables.
 *
 *   npm run db:up          # boots Oracle XE + Postgres 16 in docker
 *   npm run seed:postgres  # this
 */
import fs from 'fs';
import path from 'path';
import { Client, ClientConfig } from 'pg';

const SCHEMA_PATH = [
  path.resolve(process.cwd(), 'postgres/schema.sql'),
  path.resolve(__dirname, '../postgres/schema.sql'),
].find((p) => fs.existsSync(p)) as string;

const CATALOG_PATH = [
  path.resolve(process.cwd(), '../src/assets/data/catalog.json'),
  path.resolve(process.cwd(), 'src/assets/data/catalog.json'),
  path.resolve(__dirname, '../../src/assets/data/catalog.json'),
].find((p) => fs.existsSync(p)) as string;

const CONFIG: ClientConfig = process.env.POSTGRES_URL
  ? { connectionString: process.env.POSTGRES_URL }
  : {
      host: process.env.PGHOST || 'localhost',
      port: Number(process.env.PGPORT || 5432),
      user: process.env.PGUSER || 'gapcat',
      password: process.env.PGPASSWORD || 'gapdemo',
      database: process.env.PGDATABASE || 'gapcat',
    };

interface JsonColor {
  ccId: string;
  name: string;
  regularPrice: string | null;
  effectivePrice: string | null;
  flag: string | null;
  badge: string | null;
  swatch: string | null;
  images: string[];
}

interface JsonProduct {
  id: string;
  name: string;
  department: string;
  category: string;
  price: number;
  regularPrice: number | null;
  promo: string | null;
  badge: string | null;
  reviewScore: number | null;
  reviewCount: number | null;
  description: string | null;
  colors: JsonColor[];
  sizes: string[];
  fits: string[];
}

type Row = Array<string | number | null>;

async function connectWithRetry(tries = 40): Promise<Client> {
  let lastErr: unknown;
  for (let i = 0; i < tries; i++) {
    const client = new Client(CONFIG);
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

async function runDdl(client: Client): Promise<void> {
  const tables = ['PRODUCT_IMAGES', 'PRODUCT_SIZES', 'PRODUCT_FITS', 'PRODUCT_COLORS', 'PRODUCTS'];
  await client.query(`DROP TABLE IF EXISTS ${tables.join(', ')} CASCADE`);
  await client.query(fs.readFileSync(SCHEMA_PATH, 'utf8'));
}

/** Multi-row parameterized INSERT ($1..$n), batched to stay under the bind-param limit. */
async function insertMany(
  client: Client,
  table: string,
  columns: string[],
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

async function main(): Promise<void> {
  const catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8')) as JsonProduct[];
  const target = CONFIG.connectionString
    ? new URL(CONFIG.connectionString).host
    : `${CONFIG.host}:${CONFIG.port}/${CONFIG.database}`;
  process.stdout.write(`[seed-postgres] connecting to ${target}\n`);
  const client = await connectWithRetry();
  try {
    await client.query('BEGIN');
    process.stdout.write('\n[seed-postgres] building GAPCAT schema\n');
    await runDdl(client);

    const productRows: Row[] = catalog.map((p) => [
      p.id,
      p.name,
      p.department,
      p.category,
      p.price,
      p.regularPrice,
      p.promo || null,
      p.badge || null,
      p.reviewScore,
      p.reviewCount,
      p.description || null,
    ]);

    const colorRows: Row[] = [];
    const imageRows: Row[] = [];
    const sizeRows: Row[] = [];
    const fitRows: Row[] = [];
    let colorId = 1;
    for (const p of catalog) {
      p.colors.forEach((c, ord) => {
        const id = colorId++;
        colorRows.push([
          id,
          p.id,
          c.ccId,
          c.name,
          c.regularPrice,
          c.effectivePrice,
          c.flag || null,
          c.badge || null,
          c.swatch,
          ord,
        ]);
        c.images.forEach((url, imgOrd) => imageRows.push([id, url, imgOrd]));
      });
      p.sizes.forEach((s, ord) => sizeRows.push([p.id, s, ord]));
      p.fits.forEach((f, ord) => fitRows.push([p.id, f, ord]));
    }

    await insertMany(
      client,
      'PRODUCTS',
      [
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
      ],
      productRows,
    );
    await insertMany(
      client,
      'PRODUCT_COLORS',
      [
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
      colorRows,
    );
    // Explicit COLOR_IDs bypass the identity sequence; move it past them.
    await client.query(
      `SELECT setval(pg_get_serial_sequence('product_colors', 'color_id'),
                     GREATEST((SELECT MAX(COLOR_ID) FROM PRODUCT_COLORS), 1))`,
    );
    await insertMany(client, 'PRODUCT_IMAGES', ['COLOR_ID', 'URL', 'ORD'], imageRows);
    await insertMany(client, 'PRODUCT_SIZES', ['PRODUCT_ID', 'SIZE', 'ORD'], sizeRows);
    await insertMany(client, 'PRODUCT_FITS', ['PRODUCT_ID', 'FIT', 'ORD'], fitRows);
    await client.query('COMMIT');

    process.stdout.write(
      `[seed-postgres] loaded ${productRows.length} products, ${colorRows.length} colours, ` +
        `${imageRows.length} images, ${sizeRows.length} sizes, ${fitRows.length} fits\n`,
    );
  } catch (e) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw e;
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error('[seed-postgres] failed:', e);
  process.exit(1);
});
