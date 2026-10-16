import express, { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { CatalogProduct, RequestLine, priceBag } from './pricing';

interface Product extends CatalogProduct {
  name: string;
  department: string;
  category: string;
  [k: string]: unknown;
}

// Resolve the shared catalog whether running via tsx (server/src),
// compiled output (server/dist/src), or an unusual cwd.
const CATALOG_PATH = [
  path.resolve(process.cwd(), 'src/assets/data/catalog.json'),
  path.resolve(__dirname, '../../src/assets/data/catalog.json'),
  path.resolve(__dirname, '../../../src/assets/data/catalog.json'),
].find((p) => fs.existsSync(p)) as string;

function loadCatalog(): Product[] {
  return JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8')) as Product[];
}

const catalog = loadCatalog();
const byId = new Map<string, Product>(catalog.map((p) => [p.id, p]));

export function createApp(): express.Express {
  const app = express();
  app.use(express.json());

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ ok: true, products: catalog.length });
  });

  app.get('/api/catalog', (_req: Request, res: Response) => {
    res.json(catalog);
  });

  app.get('/api/products/:id', (req: Request, res: Response) => {
    const product = byId.get(req.params.id);
    if (!product) {
      res.status(404).json({ error: `Product ${req.params.id} not found` });
      return;
    }
    res.json(product);
  });

  app.post('/api/bag/price', (req: Request, res: Response) => {
    const lines = Array.isArray(req.body?.lines) ? (req.body.lines as RequestLine[]) : [];
    const { quote, errors } = priceBag(lines, byId, req.body?.promoCode);
    if (errors.length) {
      res.status(422).json({ error: errors.join('; '), quote });
      return;
    }
    res.json(quote);
  });

  app.post('/api/checkout', (req: Request, res: Response) => {
    const { shipping, payment, lines, promoCode } = req.body ?? {};
    if (!shipping?.firstName || !shipping?.lastName || !shipping?.email || !shipping?.address) {
      res.status(400).json({ error: 'Missing shipping details' });
      return;
    }
    if (!Array.isArray(lines) || !lines.length) {
      res.status(400).json({ error: 'Bag is empty' });
      return;
    }
    const { quote, errors } = priceBag(lines as RequestLine[], byId, promoCode);
    if (errors.length) {
      res.status(422).json({ error: errors.join('; ') });
      return;
    }
    const orderNumber = 'GAP-' + String(Date.now()).slice(-8);
    res.status(201).json({
      orderNumber,
      email: shipping.email,
      total: quote.total,
      itemCount: quote.itemCount,
      payment: { cardLast4: payment?.cardLast4 || '0000' },
    });
  });

  return app;
}

if (require.main === module) {
  const port = Number(process.env.PORT || 4201);
  createApp().listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`[api] listening on http://localhost:${port} (${catalog.length} products)`);
  });
}
