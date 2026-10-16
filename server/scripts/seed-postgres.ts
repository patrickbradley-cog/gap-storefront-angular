/**
 * Loads the catalog (src/assets/data/catalog.json — the nightly extract) into
 * the GAPCAT tables on Postgres 16. Idempotent: drops and recreates all tables.
 *
 *   npm run db:up          # boots Oracle XE + Postgres 16 in docker
 *   npm run seed:postgres  # this
 */
import fs from 'fs';
import path from 'path';
import {
  Row,
  connectWithRetry,
  describeTarget,
  insertMany,
  resetIdentity,
  runDdl,
} from './postgres-util';

const CATALOG_PATH = [
  path.resolve(process.cwd(), '../src/assets/data/catalog.json'),
  path.resolve(process.cwd(), 'src/assets/data/catalog.json'),
  path.resolve(__dirname, '../../src/assets/data/catalog.json'),
].find((p) => fs.existsSync(p)) as string;

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

async function main(): Promise<void> {
  const catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8')) as JsonProduct[];
  process.stdout.write(`[seed-postgres] connecting to ${describeTarget()}\n`);
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
    await resetIdentity(client, 'PRODUCT_COLORS', 'COLOR_ID');
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
