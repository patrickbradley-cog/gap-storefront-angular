import fs from 'fs';
import path from 'path';
import oracledb from 'oracledb';
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

interface ColorRow {
  COLOR_ID: number;
  PRODUCT_ID: string;
  CC_ID: string;
  NAME: string;
  REGULAR_PRICE: string | null;
  EFFECTIVE_PRICE: string | null;
  FLAG: string | null;
  BADGE: string | null;
  SWATCH: string | null;
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
      const opts = { outFormat: oracledb.OUT_FORMAT_OBJECT };
      const [products, colors, images, sizes, fits] = await Promise.all([
        conn.execute<Record<string, unknown>>(
          `SELECT PRODUCT_ID, NAME, DEPARTMENT, CATEGORY, PRICE, REGULAR_PRICE,
                  PROMO, BADGE, REVIEW_SCORE, REVIEW_COUNT, DESCRIPTION
             FROM PRODUCTS ORDER BY PRODUCT_ID`,
          [],
          opts,
        ),
        conn.execute<ColorRow>(
          `SELECT COLOR_ID, PRODUCT_ID, CC_ID, NAME, REGULAR_PRICE, EFFECTIVE_PRICE,
                  FLAG, BADGE, SWATCH
             FROM PRODUCT_COLORS ORDER BY PRODUCT_ID, ORD`,
          [],
          opts,
        ),
        conn.execute<{ COLOR_ID: number; URL: string }>(
          'SELECT COLOR_ID, URL FROM PRODUCT_IMAGES ORDER BY COLOR_ID, ORD',
          [],
          opts,
        ),
        conn.execute<{ PRODUCT_ID: string; SIZE: string }>(
          'SELECT PRODUCT_ID, SIZE FROM PRODUCT_SIZES ORDER BY PRODUCT_ID, ORD',
          [],
          opts,
        ),
        conn.execute<{ PRODUCT_ID: string; FIT: string }>(
          'SELECT PRODUCT_ID, FIT FROM PRODUCT_FITS ORDER BY PRODUCT_ID, ORD',
          [],
          opts,
        ),
      ]);

      const imagesByColor = new Map<number, string[]>();
      for (const img of images.rows || []) {
        const list = imagesByColor.get(img.COLOR_ID) || [];
        list.push(img.URL);
        imagesByColor.set(img.COLOR_ID, list);
      }
      const colorsByProduct = new Map<string, unknown[]>();
      for (const c of colors.rows || []) {
        const list = colorsByProduct.get(c.PRODUCT_ID) || [];
        list.push({
          ccId: c.CC_ID,
          name: c.NAME,
          regularPrice: c.REGULAR_PRICE,
          effectivePrice: c.EFFECTIVE_PRICE,
          flag: c.FLAG,
          badge: c.BADGE,
          swatch: c.SWATCH,
          images: imagesByColor.get(c.COLOR_ID) || [],
        });
        colorsByProduct.set(c.PRODUCT_ID, list);
      }
      const sizesByProduct = new Map<string, string[]>();
      for (const s of sizes.rows || []) {
        const list = sizesByProduct.get(s.PRODUCT_ID) || [];
        list.push(s.SIZE);
        sizesByProduct.set(s.PRODUCT_ID, list);
      }
      const fitsByProduct = new Map<string, string[]>();
      for (const f of fits.rows || []) {
        const list = fitsByProduct.get(f.PRODUCT_ID) || [];
        list.push(f.FIT);
        fitsByProduct.set(f.PRODUCT_ID, list);
      }

      return (products.rows || []).map((r) => {
        const id = String(r.PRODUCT_ID);
        return {
          id,
          name: r.NAME,
          department: r.DEPARTMENT,
          category: r.CATEGORY,
          price: r.PRICE,
          regularPrice: r.REGULAR_PRICE,
          promo: r.PROMO,
          badge: r.BADGE,
          reviewScore: r.REVIEW_SCORE,
          reviewCount: r.REVIEW_COUNT,
          description: r.DESCRIPTION,
          colors: colorsByProduct.get(id) || [],
          sizes: sizesByProduct.get(id) || [],
          fits: fitsByProduct.get(id) || [],
        } as unknown as Product;
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

export function createCatalogRepository(): CatalogRepository {
  return process.env.CATALOG_SOURCE === 'oracle'
    ? new OracleCatalogRepository()
    : new JsonCatalogRepository();
}
