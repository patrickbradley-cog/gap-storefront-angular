import { test } from 'node:test';
import assert from 'node:assert/strict';
import { diffCatalogs } from '../src/catalog-diff';
import { JsonCatalogRepository, PostgresCatalogRepository, Product } from '../src/repository';

const byId = (products: Product[]) => new Map(products.map((p) => [p.id, p]));

test('diffCatalogs: identical catalogs have no mismatches', async () => {
  const repo = new JsonCatalogRepository();
  const a = await repo.catalogMap();
  const b = byId(JSON.parse(JSON.stringify(await repo.listProducts())) as Product[]);
  assert.deepEqual(diffCatalogs(a, b), []);
});

test('diffCatalogs: reports changed fields, missing and extra products', async () => {
  const products = await new JsonCatalogRepository().listProducts();
  const copy = JSON.parse(JSON.stringify(products)) as Product[];
  copy[0].price = copy[0].price + 1;
  const removed = copy.splice(1, 1)[0];
  copy.push({ ...copy[0], id: 'EXTRA' });

  const problems = diffCatalogs(byId(products), byId(copy), 'oracle', 'postgres');
  assert.ok(problems.some((p) => p.startsWith(`product ${products[0].id}.price: oracle=`)));
  assert.ok(problems.includes(`product ${removed.id}: missing from postgres`));
  assert.ok(problems.includes('product EXTRA: only in postgres'));
  assert.equal(problems.length, 3);
});

/** What a seeded DB serves: rows ordered by PRODUCT_ID, '' stored as NULL. */
function asSeeded(products: Product[]): Map<string, unknown> {
  const nul = (v: unknown) => (v === '' ? null : v);
  return new Map(
    [...products]
      .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
      .map((p) => [
        p.id,
        {
          ...p,
          promo: nul(p['promo']),
          badge: nul(p['badge']),
          description: nul(p['description']),
          colors: (p['colors'] as Array<Record<string, unknown>>).map((c) => ({
            ...c,
            flag: nul(c['flag']),
            badge: nul(c['badge']),
          })),
        },
      ]),
  );
}

// Opt-in: needs `docker compose up -d` + `npm run seed:postgres` (or migrate:db).
test(
  'PostgresCatalogRepository serves the seeded catalog',
  { skip: process.env.PG_TEST ? false : 'set PG_TEST=1 with a seeded Postgres to run' },
  async () => {
    const pg = new PostgresCatalogRepository();
    try {
      assert.equal(pg.source, 'postgres');
      const expected = asSeeded(await new JsonCatalogRepository().listProducts());
      const actual = await pg.catalogMap();
      assert.deepEqual(diffCatalogs(expected, actual, 'json', 'postgres'), []);
      assert.equal((await pg.getProduct('907280'))?.name, 'Relaxed Polo Sweater');
      assert.equal(await pg.getProduct('nope'), undefined);
    } finally {
      await pg.close();
    }
  },
);
