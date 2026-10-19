import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { AddressInfo } from 'net';
import { Server } from 'http';
import { createApp } from '../src/index';

let server: Server;
let base: string;

before(async () => {
  server = createApp().listen(0);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(() => server.close());

test('GET /api/catalog returns the catalog', async () => {
  const res = await fetch(`${base}/api/catalog`);
  assert.equal(res.status, 200);
  const products = (await res.json()) as Array<{ id: string; name: string; price: number }>;
  assert.ok(products.length >= 40, 'expected >= 40 products');
  const polo = products.find((p) => p.id === '907280');
  assert.ok(polo, 'Relaxed Polo Sweater present');
  assert.equal(polo.name, 'Relaxed Polo Sweater');
  assert.equal(polo.price, 79.95);
});

test('GET /api/products/:id returns one product and 404s on misses', async () => {
  const ok = await fetch(`${base}/api/products/907280`);
  assert.equal(ok.status, 200);
  const p = (await ok.json()) as { colors: Array<{ ccId: string }> };
  assert.equal(p.colors.length, 6);

  const missing = await fetch(`${base}/api/products/nope`);
  assert.equal(missing.status, 404);
});

test('POST /api/bag/price applies the 40% Friends & Family markdown', async () => {
  const res = await fetch(`${base}/api/bag/price`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      lines: [{ productId: '907280', ccId: '907280012', size: 'M', qty: 2 }],
    }),
  });
  assert.equal(res.status, 200);
  const q = (await res.json()) as {
    subtotal: number;
    markdown: number;
    total: number;
    itemCount: number;
  };
  assert.equal(q.subtotal, 159.9);
  assert.equal(q.markdown, 63.96); // 40% of eligible lines
  assert.equal(q.itemCount, 2);
  assert.ok(q.total < q.subtotal);
});

test('POST /api/bag/price handles promo codes and bad lines', async () => {
  const res = await fetch(`${base}/api/bag/price`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      lines: [{ productId: '907280', ccId: '907280012', size: 'M', qty: 1 }],
      promoCode: 'EXTRA10',
    }),
  });
  const q = (await res.json()) as { promoDiscount: number; promoError: string | null };
  assert.equal(res.status, 200);
  assert.equal(q.promoDiscount, 8.0); // 10% of 79.95
  assert.equal(q.promoError, null);

  const bad = await fetch(`${base}/api/bag/price`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      lines: [{ productId: '907280', ccId: 'wrong', size: 'M', qty: 1 }],
    }),
  });
  assert.equal(bad.status, 422);
});

test('POST /api/checkout returns an order number and validates input', async () => {
  const res = await fetch(`${base}/api/checkout`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      shipping: {
        firstName: 'Ada',
        lastName: 'Demo',
        email: 'ada@example.com',
        address: '1 Demo Way',
        city: 'SF',
        state: 'CA',
        zip: '94105',
      },
      payment: { cardLast4: '1111' },
      lines: [{ productId: '907280', ccId: '907280012', size: 'L', qty: 1 }],
    }),
  });
  assert.equal(res.status, 201);
  const order = (await res.json()) as { orderNumber: string; total: number; itemCount: number };
  assert.match(order.orderNumber, /^GAP-\d{8}$/);
  assert.equal(order.itemCount, 1);
  assert.ok(order.total > 0);

  const empty = await fetch(`${base}/api/checkout`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ shipping: { firstName: 'X' }, lines: [] }),
  });
  assert.equal(empty.status, 400);
});

test('POST /api/bag/price prices the selected colourway, not the style', async () => {
  const price = async (productId: string, ccId: string) => {
    const res = await fetch(`${base}/api/bag/price`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ lines: [{ productId, ccId, size: 'M', qty: 1 }] }),
    });
    assert.equal(res.status, 200);
    return (await res.json()) as { subtotal: number; markdown: number };
  };

  // Style 524246 is $31.00; its Beige colourway lists at $89.95 with 40% off.
  const beige = await price('524246', '915242002');
  assert.equal(beige.subtotal, 89.95);
  assert.equal(beige.markdown, 35.98);

  // Already-reduced colourway: $35.00, no extra Friends & Family markdown.
  const reduced = await price('863808', '863809002');
  assert.equal(reduced.subtotal, 35.0);
  assert.equal(reduced.markdown, 0);

  // Final sale and promo-excluded colourways are not discounted.
  const finalSale = await price('863808', '883102002');
  assert.equal(finalSale.subtotal, 49.97);
  assert.equal(finalSale.markdown, 0);
  const excluded = await price('906998', '906998012');
  assert.equal(excluded.markdown, 0);

  // "Extra 40% off at checkout" stays eligible.
  const extra = await price('863808', '863799002');
  assert.equal(extra.subtotal, 74.99);
  assert.equal(extra.markdown, 30.0);
});

test('POST /api/checkout totals the selected colourway price', async () => {
  const res = await fetch(`${base}/api/checkout`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      shipping: {
        firstName: 'Ada',
        lastName: 'Demo',
        email: 'ada@example.com',
        address: '1 Demo Way',
        city: 'SF',
        state: 'CA',
        zip: '94105',
      },
      payment: { cardLast4: '1111' },
      lines: [{ productId: '524246', ccId: '915242002', size: 'M', qty: 9 }],
    }),
  });
  assert.equal(res.status, 201);
  const order = (await res.json()) as { total: number };
  // 9 x 89.95 = 809.55, less 40% = 485.73, plus 8.5% tax = 527.02
  assert.equal(order.total, 527.02);
});
