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

test('API routes are rate limited per client', async () => {
  const prev = process.env.API_RATE_LIMIT_PER_MIN;
  process.env.API_RATE_LIMIT_PER_MIN = '3';
  const limited = createApp().listen(0);
  try {
    await new Promise<void>((resolve) => limited.once('listening', resolve));
    const url = `http://127.0.0.1:${(limited.address() as AddressInfo).port}/api/health`;
    const statuses: number[] = [];
    for (let i = 0; i < 4; i++) statuses.push((await fetch(url)).status);
    assert.deepEqual(statuses, [200, 200, 200, 429]);

    // Clients behind a loopback proxy get their own bucket via X-Forwarded-For.
    const via = (ip: string) => fetch(url, { headers: { 'X-Forwarded-For': ip } });
    const flooder: number[] = [];
    for (let i = 0; i < 4; i++) flooder.push((await via('203.0.113.9')).status);
    assert.deepEqual(flooder, [200, 200, 200, 429]);
    assert.equal((await via('198.51.100.7')).status, 200);
  } finally {
    limited.close();
    if (prev === undefined) delete process.env.API_RATE_LIMIT_PER_MIN;
    else process.env.API_RATE_LIMIT_PER_MIN = prev;
  }
});
