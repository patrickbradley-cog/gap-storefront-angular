import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { OracleCatalogRepository, oracleConnectionConfig } from '../src/repository';

const ROOT = path.resolve(__dirname, '../..');

test('oracleConnectionConfig fails fast without ORACLE_PASSWORD (no default password)', () => {
  assert.throws(() => oracleConnectionConfig({}), /ORACLE_PASSWORD must be set/);
  assert.throws(() => oracleConnectionConfig({ ORACLE_USER: 'GAPCAT' }), /ORACLE_PASSWORD/);
  assert.throws(() => oracleConnectionConfig({ ORACLE_PASSWORD: '' }), /ORACLE_PASSWORD/);
});

test('oracleConnectionConfig uses the configured password', () => {
  assert.deepEqual(oracleConnectionConfig({ ORACLE_PASSWORD: 's3cret' }), {
    user: 'GAPCAT',
    password: 's3cret',
    connectString: 'localhost:1521/XEPDB1',
  });
});

test('OracleCatalogRepository refuses to start without ORACLE_PASSWORD', () => {
  const saved = process.env.ORACLE_PASSWORD;
  delete process.env.ORACLE_PASSWORD;
  try {
    assert.throws(() => new OracleCatalogRepository(), /ORACLE_PASSWORD must be set/);
  } finally {
    if (saved !== undefined) process.env.ORACLE_PASSWORD = saved;
  }
});

test('docker-compose publishes DB ports on loopback and takes passwords from .env', () => {
  const compose = fs.readFileSync(path.join(ROOT, 'docker-compose.yml'), 'utf8');
  const ports = [...compose.matchAll(/^\s*-\s*'([^']+:\d+)'\s*$/gm)].map((m) => m[1]);
  assert.ok(ports.length >= 2, 'expected published ports');
  for (const p of ports) assert.match(p, /^127\.0\.0\.1:/, `port ${p} must bind to 127.0.0.1`);

  const passwords = [...compose.matchAll(/^\s*\w*PASSWORD:\s*(.+)$/gm)].map((m) => m[1].trim());
  assert.ok(passwords.length >= 3, 'expected password settings');
  for (const v of passwords)
    assert.match(v, /^\$\{\w+:\?/, `password must come from required env, got ${v}`);

  const example = fs.readFileSync(path.join(ROOT, '.env.example'), 'utf8');
  for (const name of ['ORACLE_SYS_PASSWORD', 'ORACLE_PASSWORD', 'POSTGRES_PASSWORD']) {
    assert.match(
      example,
      new RegExp(`^${name}=$`, 'm'),
      `.env.example lists ${name} with no value`,
    );
  }
});
