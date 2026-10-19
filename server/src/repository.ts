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

type Row = Record<string, unknown>;

/** Raw result sets of the five catalog SELECTs, keyed by lowercase column name. */
export interface CatalogRows {
  products: Row[];
  colors: Row[];
  images: Row[];
  sizes: Row[];
  fits: Row[];
}

export type CatalogQueries = Record<keyof CatalogRows, string>;

// SIZE is reserved in Oracle (must be quoted) but stored lowercase in Postgres,
// so only the size column expression differs per dialect; it's aliased to SZ.
function catalogSql(sizeColumn: string): CatalogQueries {
  return {
    products: `SELECT PRODUCT_ID, NAME, DEPARTMENT, CATEGORY, PRICE, REGULAR_PRICE,
                      PROMO, BADGE, REVIEW_SCORE, REVIEW_COUNT, DESCRIPTION
                 FROM PRODUCTS ORDER BY PRODUCT_ID`,
    colors: `SELECT COLOR_ID, PRODUCT_ID, CC_ID, NAME, REGULAR_PRICE, EFFECTIVE_PRICE,
                    FLAG, BADGE, SWATCH
               FROM PRODUCT_COLORS ORDER BY PRODUCT_ID, ORD`,
    images: 'SELECT COLOR_ID, URL FROM PRODUCT_IMAGES ORDER BY COLOR_ID, ORD',
    sizes: `SELECT PRODUCT_ID, ${sizeColumn} AS SZ FROM PRODUCT_SIZES ORDER BY PRODUCT_ID, ORD`,
    fits: 'SELECT PRODUCT_ID, FIT FROM PRODUCT_FITS ORDER BY PRODUCT_ID, ORD',
  };
}

/** The catalog SELECTs shared by every relational source. */
export const CATALOG_SQL: Record<'oracle' | 'postgres', CatalogQueries> = {
  oracle: catalogSql('"SIZE"'),
  postgres: catalogSql('size'),
};

const CATALOG_KEYS = Object.keys(CATALOG_SQL.oracle) as Array<keyof CatalogRows>;

function groupBy<K, V>(rows: Row[], key: string, value: (r: Row) => V): Map<K, V[]> {
  const out = new Map<K, V[]>();
  for (const r of rows) {
    const k = r[key] as K;
    const list = out.get(k) || [];
    list.push(value(r));
    out.set(k, list);
  }
  return out;
}

/** Assemble relational catalog rows (lowercase keys) into the nested product shape. */
export function assembleProducts(rows: CatalogRows): Product[] {
  const imagesByColor = groupBy<unknown, unknown>(rows.images, 'color_id', (r) => r.url);
  const colorsByProduct = groupBy<string, unknown>(rows.colors, 'product_id', (c) => ({
    ccId: c.cc_id,
    name: c.name,
    regularPrice: c.regular_price,
    effectivePrice: c.effective_price,
    flag: c.flag,
    badge: c.badge,
    swatch: c.swatch,
    images: imagesByColor.get(c.color_id) || [],
  }));
  const sizesByProduct = groupBy<string, unknown>(rows.sizes, 'product_id', (s) => s.sz);
  const fitsByProduct = groupBy<string, unknown>(rows.fits, 'product_id', (f) => f.fit);

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

function lowercaseKeys(row: Row): Row {
  const out: Row = {};
  for (const [k, v] of Object.entries(row)) out[k.toLowerCase()] = v;
  return out;
}

/** Shared lookups for sources that load the whole catalog per request. */
abstract class RelationalCatalogRepository implements CatalogRepository {
  abstract readonly source: string;
  abstract listProducts(): Promise<Product[]>;

  async getProduct(id: string): Promise<Product | undefined> {
    return (await this.listProducts()).find((p) => p.id === id);
  }

  async catalogMap(): Promise<Map<string, CatalogProduct>> {
    const products = await this.listProducts();
    return new Map(products.map((p) => [p.id, p]));
  }
}

/**
 * Live Oracle source — queries the GAPCAT schema in the Oracle XE catalog DB.
 * Thin-mode driver: no Oracle client install required.
 */
export class OracleCatalogRepository extends RelationalCatalogRepository {
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
        // DESCRIPTION is a CLOB; without this it comes back as a Lob stream.
        fetchInfo: { DESCRIPTION: { type: oracledb.STRING } },
      };
      const results = await Promise.all(
        CATALOG_KEYS.map((k) => conn.execute<Row>(CATALOG_SQL.oracle[k], [], opts)),
      );
      const rows = {} as CatalogRows;
      CATALOG_KEYS.forEach((k, i) => {
        rows[k] = (results[i].rows || []).map(lowercaseKeys);
      });
      return assembleProducts(rows);
    } finally {
      await conn.close();
    }
  }
}

const PG_NUMERIC_OID = 1700;

/** Postgres catalog source (Cloud SQL / AlloyDB stand-in) — same GAPCAT schema. */
export class PostgresCatalogRepository extends RelationalCatalogRepository {
  readonly source = 'postgres';
  private readonly pool: pg.Pool;

  constructor() {
    super();
    const env = process.env;
    const conn: pg.PoolConfig = env.POSTGRES_URL
      ? { connectionString: env.POSTGRES_URL }
      : {
          host: env.PGHOST || 'localhost',
          port: Number(env.PGPORT || 5432),
          user: env.PGUSER || 'gapcat',
          password: env.PGPASSWORD || 'gapdemo',
          database: env.PGDATABASE || 'gapcat',
        };
    this.pool = new pg.Pool({
      ...conn,
      max: 4,
      // NUMERIC arrives as a string by default; Oracle returns numbers.
      types: {
        getTypeParser: ((oid: number, format: 'text' | 'binary' = 'text') =>
          oid === PG_NUMERIC_OID && format === 'text'
            ? parseFloat
            : pg.types.getTypeParser(oid, format as 'text')) as typeof pg.types.getTypeParser,
      },
    });
    this.pool.on('error', (err) => {
      console.error('[catalog] idle Postgres client error:', err.message);
    });
  }

  async listProducts(): Promise<Product[]> {
    const client = await this.pool.connect();
    try {
      const results = await Promise.all(
        CATALOG_KEYS.map((k) => client.query<Row>(CATALOG_SQL.postgres[k])),
      );
      const rows = {} as CatalogRows;
      CATALOG_KEYS.forEach((k, i) => {
        rows[k] = results[i].rows;
      });
      return assembleProducts(rows);
    } finally {
      client.release();
    }
  }

  end(): Promise<void> {
    return this.pool.end();
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
