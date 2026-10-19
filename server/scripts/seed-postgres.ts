/**
 * Loads the catalog (src/assets/data/catalog.json — the nightly extract) into
 * the gapcat database on Postgres 16. Idempotent: drops and recreates all
 * tables. Rows match what seed-oracle.ts loads into Oracle.
 *
 *   npm run db:up            # boots Postgres in docker
 *   npm run seed:postgres    # this
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

// Same defaults as PostgresCatalogRepository (server/src/repository.ts).
const CONFIG: ClientConfig = process.env.POSTGRES_URL
  ? { connectionString: process.env.POSTGRES_URL }
  : {
      host: process.env.PGHOST || 'localhost',
      port: Number(process.env.PGPORT || 5432),
      user: process.env.PGUSER || 'gapcat',
      password: process.env.PGPASSWORD || 'gapdemo',
      database: process.env.PGDATABASE || 'gapcat',
    };

// host:port/db only — never print credentials from the URL or its query string.
function describeTarget(config: ClientConfig): string {
  if (!config.connectionString) {
    return `${config.host}:${config.port}/${config.database}`;
  }
  try {
    const url = new URL(config.connectionString);
    return `${url.hostname || 'localhost'}:${url.port || '5432'}/${decodeURIComponent(
      url.pathname.replace(/^\//, ''),
    )}`;
  } catch {
    return '<POSTGRES_URL>';
  }
}

const TARGET = describeTarget(CONFIG);

// Keeps every INSERT far below Postgres' 65535 bind-parameter limit.
const MAX_PARAMS_PER_INSERT = 10000;

type Value = string | number | null;

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
  await client.query(
    'DROP TABLE IF EXISTS product_images, product_sizes, product_fits, product_colors, products CASCADE',
  );
  // No bind parameters, so pg uses the simple query protocol and runs every statement in the file.
  await client.query(fs.readFileSync(SCHEMA_PATH, 'utf8'));
}

async function insertRows(
  client: Client,
  table: string,
  columns: string[],
  rows: Value[][],
): Promise<void> {
  const batchSize = Math.max(1, Math.floor(MAX_PARAMS_PER_INSERT / columns.length));
  for (let start = 0; start < rows.length; start += batchSize) {
    const batch = rows.slice(start, start + batchSize);
    const params: Value[] = [];
    const tuples = batch.map((row) => {
      const placeholders = row.map((v) => {
        params.push(v);
        return `$${params.length}`;
      });
      return `(${placeholders.join(', ')})`;
    });
    await client.query(
      `INSERT INTO ${table} (${columns.join(', ')}) VALUES ${tuples.join(', ')}`,
      params,
    );
  }
}

async function main(): Promise<void> {
  const catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8')) as JsonProduct[];
  process.stdout.write(`[seed-postgres] connecting to ${TARGET}\n`);
  const client = await connectWithRetry();
  try {
    process.stdout.write('\n[seed-postgres] building gapcat schema\n');
    await client.query('BEGIN');
    await runDdl(client);

    const productRows: Value[][] = catalog.map((p) => [
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

    const colorRows: Value[][] = [];
    const imageRows: Value[][] = [];
    const sizeRows: Value[][] = [];
    const fitRows: Value[][] = [];
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

    await insertRows(
      client,
      'products',
      [
        'product_id',
        'name',
        'department',
        'category',
        'price',
        'regular_price',
        'promo',
        'badge',
        'review_score',
        'review_count',
        'description',
      ],
      productRows,
    );
    await insertRows(
      client,
      'product_colors',
      [
        'color_id',
        'product_id',
        'cc_id',
        'name',
        'regular_price',
        'effective_price',
        'flag',
        'badge',
        'swatch',
        'ord',
      ],
      colorRows,
    );
    await client.query(
      `SELECT setval(pg_get_serial_sequence('product_colors', 'color_id'),
                     (SELECT MAX(color_id) FROM product_colors))`,
    );
    await insertRows(client, 'product_images', ['color_id', 'url', 'ord'], imageRows);
    await insertRows(client, 'product_sizes', ['product_id', 'size', 'ord'], sizeRows);
    await insertRows(client, 'product_fits', ['product_id', 'fit', 'ord'], fitRows);
    await client.query('COMMIT');

    const counts: Record<string, number> = {};
    for (const t of [
      'products',
      'product_colors',
      'product_images',
      'product_sizes',
      'product_fits',
    ]) {
      const res = await client.query<{ n: number }>(`SELECT count(*)::int AS n FROM ${t}`);
      counts[t] = res.rows[0].n;
    }
    process.stdout.write(
      `[seed-postgres] loaded ${counts.products} products, ${counts.product_colors} colours, ` +
        `${counts.product_images} images, ${counts.product_sizes} sizes, ${counts.product_fits} fits\n`,
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
