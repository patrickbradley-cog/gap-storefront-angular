import { test, mock, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import oracledb from 'oracledb';
import { OracleCatalogRepository } from '../src/repository';

const tick = () => new Promise((r) => setTimeout(r, 5));

/** Stubs oracledb.createPool with an in-memory pool and counts DB work. */
function fakeOracle(opts: { failConnections?: number } = {}) {
  const calls = { createPool: 0, getConnection: 0, execute: 0, poolOptions: [] as unknown[] };
  let failuresLeft = opts.failConnections ?? 0;
  const rowsFor = (sql: string): unknown[] => {
    if (/FROM PRODUCTS /.test(sql)) return [{ PRODUCT_ID: '907280', NAME: 'Relaxed Polo Sweater' }];
    if (/FROM PRODUCT_COLORS/.test(sql))
      return [{ COLOR_ID: 1, PRODUCT_ID: '907280', CC_ID: 'c1' }];
    return [];
  };
  const connection = {
    execute: async (sql: string) => {
      calls.execute++;
      await tick();
      return { rows: rowsFor(sql) };
    },
    close: async () => undefined,
  };
  const pool = {
    getConnection: async () => {
      calls.getConnection++;
      await tick();
      if (failuresLeft > 0) {
        failuresLeft--;
        throw new Error('ORA-12541: no listener');
      }
      return connection;
    },
  };
  mock.method(oracledb, 'createPool', async (options: unknown) => {
    calls.createPool++;
    calls.poolOptions.push(options);
    await tick();
    return pool;
  });
  return calls;
}

afterEach(() => mock.restoreAll());

test('concurrent cold-start requests share one pool and one catalog load', async () => {
  const calls = fakeOracle();
  const repo = new OracleCatalogRepository();

  const results = await Promise.all(
    Array.from({ length: 50 }, (_, i) =>
      i % 3 === 0
        ? repo.getProduct('907280')
        : i % 3 === 1
        ? repo.catalogMap()
        : repo.listProducts(),
    ),
  );

  assert.equal(calls.createPool, 1, 'exactly one pool is created');
  assert.equal(calls.getConnection, 1, 'one connection serves the whole burst');
  assert.equal(calls.execute, 5, 'the five catalog queries run once');
  assert.equal((results[0] as { name: string }).name, 'Relaxed Polo Sweater');

  await repo.getProduct('907280');
  await repo.catalogMap();
  assert.equal(calls.execute, 5, 'warm requests are served from the cache');
});

test('pool has a bounded wait queue and timeout', async () => {
  const calls = fakeOracle();
  await new OracleCatalogRepository().listProducts();
  const options = calls.poolOptions[0] as {
    poolMax: number;
    queueMax: number;
    queueTimeout: number;
  };
  assert.ok(options.queueMax > 0 && options.queueMax < 500, `queueMax ${options.queueMax}`);
  assert.ok(
    options.queueTimeout > 0 && options.queueTimeout < 60_000,
    `queueTimeout ${options.queueTimeout}`,
  );
});

test('cache expires after its TTL and failed loads are not cached', async () => {
  const calls = fakeOracle({ failConnections: 1 });
  const repo = new OracleCatalogRepository(0);

  await assert.rejects(repo.listProducts(), /ORA-12541/);
  assert.equal((await repo.listProducts()).length, 1, 'retries after a failed load');
  await repo.listProducts();
  assert.equal(calls.createPool, 1);
  assert.equal(calls.execute, 10, 'TTL 0 re-queries on each call');
});
