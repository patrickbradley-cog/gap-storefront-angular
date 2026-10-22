import express, { Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { RequestLine, priceBag } from './pricing';
import { createCatalogRepository } from './repository';

const repo = createCatalogRepository();

/** Wrap async handlers so rejected promises become 500s, not hangs. */
const h =
  (fn: (req: Request, res: Response) => Promise<void>) =>
  (req: Request, res: Response): void => {
    fn(req, res).catch((e: unknown) => {
      res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
    });
  };

export function createApp(): express.Express {
  const app = express();
  const perMinute = Number(process.env.API_RATE_LIMIT_PER_MIN ?? 600);
  if (perMinute > 0) {
    app.use(
      '/api',
      rateLimit({
        windowMs: 60_000,
        limit: perMinute,
        standardHeaders: 'draft-7',
        legacyHeaders: false,
        message: { error: 'Too many requests, slow down.' },
      }),
    );
  }
  app.use(express.json());

  app.get(
    '/api/health',
    h(async (_req, res) => {
      try {
        const products = await repo.listProducts();
        res.json({ ok: true, products: products.length, source: repo.source });
      } catch (e) {
        res.status(503).json({
          ok: false,
          source: repo.source,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }),
  );

  app.get(
    '/api/catalog',
    h(async (_req, res) => {
      res.json(await repo.listProducts());
    }),
  );

  app.get(
    '/api/products/:id',
    h(async (req, res) => {
      const product = await repo.getProduct(req.params.id);
      if (!product) {
        res.status(404).json({ error: `Product ${req.params.id} not found` });
        return;
      }
      res.json(product);
    }),
  );

  app.post(
    '/api/bag/price',
    h(async (req, res) => {
      const lines = Array.isArray(req.body?.lines) ? (req.body.lines as RequestLine[]) : [];
      const { quote, errors } = priceBag(lines, await repo.catalogMap(), req.body?.promoCode);
      if (errors.length) {
        res.status(422).json({ error: errors.join('; '), quote });
        return;
      }
      res.json(quote);
    }),
  );

  app.post(
    '/api/checkout',
    h(async (req, res) => {
      const { shipping, payment, lines, promoCode } = req.body ?? {};
      if (!shipping?.firstName || !shipping?.lastName || !shipping?.email || !shipping?.address) {
        res.status(400).json({ error: 'Missing shipping details' });
        return;
      }
      if (!Array.isArray(lines) || !lines.length) {
        res.status(400).json({ error: 'Bag is empty' });
        return;
      }
      const { quote, errors } = priceBag(
        lines as RequestLine[],
        await repo.catalogMap(),
        promoCode,
      );
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
    }),
  );

  return app;
}

if (require.main === module) {
  const port = Number(process.env.PORT || 4201);
  createApp().listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`[api] listening on http://localhost:${port} (source: ${repo.source})`);
  });
}
