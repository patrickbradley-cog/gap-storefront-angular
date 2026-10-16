import fs from 'fs';
import path from 'path';
import oracledb from 'oracledb';
import pg from 'pg';
import { CatalogProduct } from './pricing';

export interface Product extends CatalogProduct {
  name: string;
  department: string;
  category: string;
  [k: string]: unknown;
}

/** Where the catalog data comes from. */
export interface CatalogRepository {
  readonly source: string;
  listProducts(): Promise<Product[]>;
  getProduct(id: string): Promise<Product | undefined>;
  /** Products keyed by id — what the pricing engine consumes. */
  catalogMap(): Promise<Map<string, CatalogProduct>>;
}

// Resolve the shared catalog file whether running via tsx (server/src),
// compiled output (server/dist/src), or an unusual cwd.
const CATALOG_PATH = [
  path.resolve(process.cwd(), 'src/assets/data/catalog.json'),
  path.resolve(__dirname, '../../src/assets/data/catalog.json'),
  path.resolve(__dirname, '../../../src/assets/data/catalog.json'),
].find((p) => fs.existsSync(p)) as string;

/** Nightly-extract fallback: the JSON snapshot produced from the legacy DB. */
export class JsonCatalogRepository implements CatalogRepository {
  readonly source = 'json';
  private readonly catalog: Product[];
  private readonly byId: Map<string, Product>;

  constructor() {
    this.catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8')) as Product[];
    this.byId = new Map(this.catalog.map((p) => [p.id, p]));
  }

  listProducts(): Promise<Product[]> {
    return Promise.resolve(this.catalog);
  }

  getProduct(id: string): Promise<Product | undefined> {
    return Promise.resolve(this.byId.get(id));
  }

  catalogMap(): Promise<Map<string, CatalogProduct>> {
    return Promise.resolve(this.byId as Map<string, CatalogProduct>);
  }
}

interface ProductRow {
  product_id: string;
  name: string;
  department: string;
  category: string;
  price: number;
  regular_price: number | null;
  promo: string | null;
  badge: string | null;
  review_score: number | null;
  review_count: number | null;
  description: string | null;
}

interface ColorRow {
  color_id: number;
  product_id: string;
  cc_id: string;
  name: string;
  regular_price: string | null;
  effective_price: string | null;
  flag: string | null;
  badge: string | null;
  swatch: string | null;
}

/** Rows from the five GAPCAT tables, keyed by lowercase column name. */
interface CatalogRows {
  products: ProductRow[];
  colors: ColorRow[];
  images: Array<{ color_id: number; url: string }>;
  sizes: Array<{ product_id: string; size: string }>;
  fits: Array<{ product_id: string; fit: string }>;
}

const CATALOG_SQL = {
  products: `SELECT PRODUCT_ID, NAME, DEPARTMENT, CATEGORY, PRICE, REGULAR_PRICE,
                    PROMO, BADGE, REVIEW_SCORE, REVIEW_COUNT, DESCRIPTION
               FROM PRODUCTS ORDER BY PRODUCT_ID`,
  colors: `SELECT COLOR_ID, PRODUCT_ID, CC_ID, NAME, REGULAR_PRICE, EFFECTIVE_PRICE,
                  FLAG, BADGE, SWATCH
             FROM PRODUCT_COLORS ORDER BY PRODUCT_ID, ORD`,
  images: 'SELECT COLOR_ID, URL FROM PRODUCT_IMAGES ORDER BY COLOR_ID, ORD',
  sizes: 'SELECT PRODUCT_ID, SIZE FROM PRODUCT_SIZES ORDER BY PRODUCT_ID, ORD',
  fits: 'SELECT PRODUCT_ID, FIT FROM PRODUCT_FITS ORDER BY PRODUCT_ID, ORD',
};

function lowerKeys<T>(rows: Array<Record<string, unknown>> | undefined): T[] {
  return (rows || []).map(
    (r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k.toLowerCase(), v])) as T,
  );
}

function groupBy<T, K, V>(rows: T[], key: (r: T) => K, value: (r: T) => V): Map<K, V[]> {
  const out = new Map<K, V[]>();
  for (const r of rows) {
    const k = key(r);
    const list = out.get(k) || [];
    list.push(value(r));
    out.set(k, list);
  }
  return out;
}

/** Reassembles relational rows into the nested product shape of catalog.json. */
function assembleProducts(rows: CatalogRows): Product[] {
  const imagesByColor = groupBy(
    rows.images,
    (i) => i.color_id,
    (i) => i.url,
  );
  const colorsByProduct = groupBy(
    rows.colors,
    (c) => c.product_id,
    (c) => ({
      ccId: c.cc_id,
      name: c.name,
      regularPrice: c.regular_price,
      effectivePrice: c.effective_price,
      flag: c.flag,
      badge: c.badge,
      swatch: c.swatch,
      images: imagesByColor.get(c.color_id) || [],
    }),
  );
  const sizesByProduct = groupBy(
    rows.sizes,
    (s) => s.product_id,
    (s) => s.size,
  );
  const fitsByProduct = groupBy(
    rows.fits,
    (f) => f.product_id,
    (f) => f.fit,
  );

  return rows.products.map((r) => {
    const id = String(r.product_id);
    return {
      id,
      name: r.name,
      department: r.department,
      category: r.category,
      price: r.price,
      regularPrice: r.regular_price,
      promo: r.promo,
      badge: r.badge,
      reviewScore: r.review_score,
      reviewCount: r.review_count,
      description: r.description,
      colors: colorsByProduct.get(id) || [],
      sizes: sizesByProduct.get(id) || [],
      fits: fitsByProduct.get(id) || [],
    } as unknown as Product;
  });
}

/**
 * Live Oracle source — queries the GAPCAT schema in the Oracle XE catalog DB.
 * Thin-mode driver: no Oracle client install required.
 */
export class OracleCatalogRepository implements CatalogRepository {
  readonly source = 'oracle';
  private pool: oracledb.Pool | null = null;

  private readonly config = {
    user: process.env.ORACLE_USER || 'GAPCAT',
    password: process.env.ORACLE_PASSWORD || 'GAPDEMO',
    connectString: process.env.ORACLE_CONNECT_STRING || 'localhost:1521/XEPDB1',
  };

  private async conn(): Promise<oracledb.Connection> {
    if (!this.pool) {
      this.pool = await oracledb.createPool({ ...this.config, poolMin: 1, poolMax: 4 });
    }
    return this.pool.getConnection();
  }

  async listProducts(): Promise<Product[]> {
    const conn = await this.conn();
    try {
      const opts: oracledb.ExecuteOptions = {
        outFormat: oracledb.OUT_FORMAT_OBJECT,
        // Fetch the CLOB as a string, not a Lob stream object.
        fetchInfo: { DESCRIPTION: { type: oracledb.STRING } },
      };
      const q = (sql: string) => conn.execute<Record<string, unknown>>(sql, [], opts);
      const [products, colors, images, sizes, fits] = await Promise.all([
        q(CATALOG_SQL.products),
        q(CATALOG_SQL.colors),
        q(CATALOG_SQL.images),
        // SIZE is a reserved word in Oracle, so it is quoted in the Oracle DDL.
        q(CATALOG_SQL.sizes.replace(' SIZE ', ' "SIZE" ')),
        q(CATALOG_SQL.fits),
      ]);
      return assembleProducts({
        products: lowerKeys(products.rows),
        colors: lowerKeys(colors.rows),
        images: lowerKeys(images.rows),
        sizes: lowerKeys(sizes.rows),
        fits: lowerKeys(fits.rows),
      });
    } finally {
      await conn.close();
    }
  }

  async getProduct(id: string): Promise<Product | undefined> {
    return (await this.listProducts()).find((p) => p.id === id);
  }

  async catalogMap(): Promise<Map<string, CatalogProduct>> {
    const products = await this.listProducts();
    return new Map(products.map((p) => [p.id, p]));
  }
}

/** Connection settings: POSTGRES_URL, else discrete PG* vars, defaulting to the compose service. */
export function postgresConfig(): pg.PoolConfig {
  if (process.env.POSTGRES_URL) return { connectionString: process.env.POSTGRES_URL };
  return {
    host: process.env.PGHOST || 'localhost',
    port: Number(process.env.PGPORT || 5432),
    user: process.env.PGUSER || 'gapcat',
    password: process.env.PGPASSWORD || 'gapdemo',
    database: process.env.PGDATABASE || 'gapcat',
  };
}

// pg returns NUMERIC as strings to avoid precision loss; the catalog's
// NUMERIC(10,2)/(3,2) columns fit in a double, and the API must emit numbers
// exactly like the Oracle driver does.
const pgTypes = {
  getTypeParser(oid: number, format: 'text' | 'binary' = 'text') {
    if (format === 'binary') return pg.types.getTypeParser(oid, 'binary');
    return oid === pg.types.builtins.NUMERIC ? parseFloat : pg.types.getTypeParser(oid, 'text');
  },
} as pg.CustomTypesConfig;

/** Live Postgres 16 source — the migration target (stands in for Cloud SQL / AlloyDB). */
export class PostgresCatalogRepository implements CatalogRepository {
  readonly source = 'postgres';
  private pool: pg.Pool | null = null;

  private db(): pg.Pool {
    if (!this.pool) {
      this.pool = new pg.Pool({ ...postgresConfig(), max: 4, types: pgTypes });
    }
    return this.pool;
  }

  async listProducts(): Promise<Product[]> {
    const db = this.db();
    const [products, colors, images, sizes, fits] = await Promise.all([
      db.query<ProductRow>(CATALOG_SQL.products),
      db.query<ColorRow>(CATALOG_SQL.colors),
      db.query<CatalogRows['images'][number]>(CATALOG_SQL.images),
      db.query<CatalogRows['sizes'][number]>(CATALOG_SQL.sizes),
      db.query<CatalogRows['fits'][number]>(CATALOG_SQL.fits),
    ]);
    return assembleProducts({
      products: products.rows,
      colors: colors.rows,
      images: images.rows,
      sizes: sizes.rows,
      fits: fits.rows,
    });
  }

  async getProduct(id: string): Promise<Product | undefined> {
    return (await this.listProducts()).find((p) => p.id === id);
  }

  async catalogMap(): Promise<Map<string, CatalogProduct>> {
    const products = await this.listProducts();
    return new Map(products.map((p) => [p.id, p]));
  }
}

export function createCatalogRepository(): CatalogRepository {
  switch (process.env.CATALOG_SOURCE) {
    case 'oracle':
      return new OracleCatalogRepository();
    case 'postgres':
      return new PostgresCatalogRepository();
    default:
      return new JsonCatalogRepository();
  }
}
