/**
 * Loads the catalog (src/assets/data/catalog.json — the nightly extract) into
 * the GAPCAT schema on Oracle XE. Idempotent: drops and recreates all tables.
 *
 *   npm run db:up          # boots Oracle XE in docker
 *   npm run seed:oracle    # this
 */
import fs from 'fs';
import path from 'path';
import oracledb from 'oracledb';

const SCHEMA_PATH = [
  path.resolve(process.cwd(), 'oracle/schema.sql'),
  path.resolve(__dirname, '../oracle/schema.sql'),
].find((p) => fs.existsSync(p)) as string;

const CATALOG_PATH = [
  path.resolve(process.cwd(), '../src/assets/data/catalog.json'),
  path.resolve(process.cwd(), 'src/assets/data/catalog.json'),
  path.resolve(__dirname, '../../src/assets/data/catalog.json'),
].find((p) => fs.existsSync(p)) as string;

const CONFIG = {
  user: process.env.ORACLE_USER || 'GAPCAT',
  password: process.env.ORACLE_PASSWORD || 'GAPDEMO',
  connectString: process.env.ORACLE_CONNECT_STRING || 'localhost:1521/XEPDB1',
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

async function connectWithRetry(tries = 40): Promise<oracledb.Connection> {
  let lastErr: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      return await oracledb.getConnection(CONFIG);
    } catch (e) {
      lastErr = e;
      process.stdout.write(`  waiting for Oracle (${i + 1}/${tries})...\r`);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
  throw lastErr;
}

async function runDdl(conn: oracledb.Connection): Promise<void> {
  const tables = ['PRODUCT_IMAGES', 'PRODUCT_SIZES', 'PRODUCT_FITS', 'PRODUCT_COLORS', 'PRODUCTS'];
  for (const t of tables) {
    try {
      await conn.execute(`DROP TABLE ${t} CASCADE CONSTRAINTS PURGE`);
    } catch {
      // table didn't exist
    }
  }
  const ddl = fs
    .readFileSync(SCHEMA_PATH, 'utf8')
    .split('\n')
    .filter((l) => !l.trim().startsWith('--'))
    .join('\n')
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);

  for (const stmt of ddl) {
    await conn.execute(stmt);
  }
}

async function main(): Promise<void> {
  const catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8')) as JsonProduct[];
  process.stdout.write(`[seed-oracle] connecting to ${CONFIG.connectString} as ${CONFIG.user}\n`);
  const conn = await connectWithRetry();
  try {
    process.stdout.write('\n[seed-oracle] building GAPCAT schema\n');
    await runDdl(conn);

    const productRows = catalog.map((p) => ({
      PRODUCT_ID: p.id,
      NAME: p.name,
      DEPARTMENT: p.department,
      CATEGORY: p.category,
      PRICE: p.price,
      REGULAR_PRICE: p.regularPrice,
      PROMO: p.promo || null,
      BADGE: p.badge || null,
      REVIEW_SCORE: p.reviewScore,
      REVIEW_COUNT: p.reviewCount,
      DESCRIPTION: p.description || null,
    }));
    await conn.executeMany(
      `INSERT INTO PRODUCTS (PRODUCT_ID, NAME, DEPARTMENT, CATEGORY, PRICE, REGULAR_PRICE,
                             PROMO, BADGE, REVIEW_SCORE, REVIEW_COUNT, DESCRIPTION)
       VALUES (:PRODUCT_ID, :NAME, :DEPARTMENT, :CATEGORY, :PRICE, :REGULAR_PRICE,
               :PROMO, :BADGE, :REVIEW_SCORE, :REVIEW_COUNT, :DESCRIPTION)`,
      productRows,
    );

    const colorRows: Array<Record<string, string | number | null>> = [];
    const imageRows: Array<Record<string, string | number | null>> = [];
    const sizeRows: Array<Record<string, string | number | null>> = [];
    const fitRows: Array<Record<string, string | number | null>> = [];
    let colorId = 1;
    for (const p of catalog) {
      p.colors.forEach((c, ord) => {
        const id = colorId++;
        colorRows.push({
          COLOR_ID: id,
          PRODUCT_ID: p.id,
          CC_ID: c.ccId,
          NAME: c.name,
          REGULAR_PRICE: c.regularPrice,
          EFFECTIVE_PRICE: c.effectivePrice,
          FLAG: c.flag || null,
          BADGE: c.badge || null,
          SWATCH: c.swatch,
          ORD: ord,
        });
        c.images.forEach((url, imgOrd) => {
          imageRows.push({ COLOR_ID: id, URL: url, ORD: imgOrd });
        });
      });
      p.sizes.forEach((s, ord) => sizeRows.push({ PRODUCT_ID: p.id, SIZE: s, ORD: ord }));
      p.fits.forEach((f, ord) => fitRows.push({ PRODUCT_ID: p.id, FIT: f, ORD: ord }));
    }

    await conn.executeMany(
      `INSERT INTO PRODUCT_COLORS (COLOR_ID, PRODUCT_ID, CC_ID, NAME, REGULAR_PRICE,
                                   EFFECTIVE_PRICE, FLAG, BADGE, SWATCH, ORD)
       VALUES (:COLOR_ID, :PRODUCT_ID, :CC_ID, :NAME, :REGULAR_PRICE,
               :EFFECTIVE_PRICE, :FLAG, :BADGE, :SWATCH, :ORD)`,
      colorRows,
    );
    await conn.executeMany(
      'INSERT INTO PRODUCT_IMAGES (COLOR_ID, URL, ORD) VALUES (:COLOR_ID, :URL, :ORD)',
      imageRows,
    );
    await conn.executeMany(
      'INSERT INTO PRODUCT_SIZES (PRODUCT_ID, SIZE, ORD) VALUES (:PRODUCT_ID, :SIZE, :ORD)',
      sizeRows,
    );
    await conn.executeMany(
      'INSERT INTO PRODUCT_FITS (PRODUCT_ID, FIT, ORD) VALUES (:PRODUCT_ID, :FIT, :ORD)',
      fitRows,
    );
    await conn.commit();

    process.stdout.write(
      `[seed-oracle] loaded ${productRows.length} products, ${colorRows.length} colours, ` +
        `${imageRows.length} images, ${sizeRows.length} sizes, ${fitRows.length} fits\n`,
    );
  } finally {
    await conn.close();
  }
}

main().catch((e) => {
  console.error('[seed-oracle] failed:', e);
  process.exit(1);
});
