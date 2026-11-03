// Run from either example with npm test. Database calls are mocked; Web Crypto is real.
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { createRequire } = require('node:module');
const path = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');

const worker = process.argv[2] === 'worker';
const project = path.join(__dirname, worker ? 'prisma-cloudflare-worker-example' : 'prisma-vercel-example');
const projectRequire = createRequire(path.join(project, 'package.json'));
const ts = projectRequire('typescript');
const token = 'a'.repeat(64);

function harness(overrides = {}) {
  const env = { API_AUTH_TOKEN: token, DATABASE_URL: 'mock-database-url', ...overrides };
  const calls = { connections: 0, clients: 0, writes: [], reads: 0, logs: [] };
  const rows = [{ id: 1 }];
  const mocks = {
    '@tidbcloud/serverless': { connect: () => { calls.connections++; return {}; } },
    '@tidbcloud/prisma-adapter': { PrismaTiDBCloud: class {} },
    '@prisma/client': { PrismaClient: class {
      constructor() {
        calls.clients++;
        this.log = {
          create: async (args) => { calls.writes.push(args.data); },
          findMany: async () => { calls.reads++; return rows; },
        };
        this.user = { findMany: async () => { calls.reads++; return rows; } };
      }
    } },
  };
  if (!worker) mocks['next/server'] = projectRequire('next/server');

  function load(filename) {
    const source = ts.transpileModule(readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021 },
    }).outputText;
    const module = { exports: {} };
    const localRequire = (name) => {
      if (name === './auth') return load(path.join(path.dirname(filename), 'auth.ts'));
      assert.ok(name in mocks, `Unexpected dependency: ${name}`);
      return mocks[name];
    };
    const evaluate = vm.runInNewContext(`(function(require, module, exports) { ${source}\n})`, {
      Request, Response, URL, TextEncoder, crypto: globalThis.crypto,
      process: { env }, console: { log: (...args) => calls.logs.push(args) },
    }, { filename });
    evaluate(localRequire, module, module.exports);
    return module.exports;
  }

  const entry = load(path.join(project, worker ? 'src/index.ts' : 'app/api/edge/route.ts'));
  return {
    calls, env,
    async request(authorization, url = 'https://example.test/api/edge', headers = {}) {
      if (authorization !== undefined) headers.Authorization = authorization;
      const request = new Request(url, { headers });
      return worker ? entry.default.fetch(request, env, {}) : entry.GET(request);
    },
  };
}

function assertNoDatabase(calls) {
  assert.equal(calls.connections, 0);
  assert.equal(calls.clients, 0);
  assert.equal(calls.reads, 0);
  assert.equal(calls.writes.length, 0);
}

for (const [label, authorization] of [
  ['missing', undefined], ['empty', ''], ['wrong', `Bearer ${'b'.repeat(64)}`],
  ['basic', `Basic ${token}`], ['missing token', 'Bearer'],
  ['multiple values', `Bearer ${token}, Bearer ${token}`],
  ['prefix', `Bearer x${token}`], ['suffix', `Bearer ${token}x`],
  ['embedded whitespace', `Bearer ${token.slice(0, 32)} ${token.slice(32)}`],
]) {
  test(`${label} credential returns 401 before any database access`, async () => {
    const h = harness();
    const response = await h.request(authorization);
    assert.equal(response.status, 401);
    assert.equal(response.headers.get('WWW-Authenticate'), 'Bearer');
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
    assertNoDatabase(h.calls);
  });
}

test('query parameters and cookies cannot supply the credential', async () => {
  const h = harness();
  const response = await h.request(undefined, `https://example.test/?token=${token}&API_AUTH_TOKEN=${token}`, {
    Cookie: `API_AUTH_TOKEN=${token}`, 'X-API-Key': token,
  });
  assert.equal(response.status, 401);
  assertNoDatabase(h.calls);
});

for (const value of [undefined, '', 'too-short', ' '.repeat(64)]) {
  test(`unconfigured or weak token (${JSON.stringify(value)}) fails closed`, async () => {
    const h = harness({ API_AUTH_TOKEN: value });
    const response = await h.request(`Bearer ${token}`);
    assert.equal(response.status, 503);
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
    assertNoDatabase(h.calls);
  });
}

test('missing database configuration fails closed', async () => {
  const h = harness({ DATABASE_URL: undefined });
  const response = await h.request(`Bearer ${token}`);
  assert.equal(response.status, 503);
  assertNoDatabase(h.calls);
});

for (const scheme of ['Bearer', 'bearer']) {
  test(`${scheme} authentication allows the database operation without caching or logging secrets`, async () => {
    const h = harness();
    const response = await h.request(`${scheme} ${token}`, `https://example.test/api/edge?token=${token}`, {
      Cookie: `session=${token}`,
    });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
    assert.deepEqual(await response.json(), [{ id: 1 }]);
    assert.equal(h.calls.connections, 1);
    assert.equal(h.calls.clients, 1);
    assert.equal(h.calls.reads, 1);
    assert.equal(h.calls.writes.length, worker ? 1 : 0);
    if (worker) {
      assert.equal(h.calls.writes[0].message, 'GET /api/edge');
      assert.equal(JSON.stringify(h.calls.writes[0].meta), '{}');
    }
    assert.deepEqual(h.calls.logs, []);
    assert.ok(!JSON.stringify(h.calls.writes).includes(token));
  });
}

test('rotating the configured token rejects the old token', async () => {
  const h = harness();
  assert.equal((await h.request(`Bearer ${token}`)).status, 200);
  h.env.API_AUTH_TOKEN = 'b'.repeat(64);
  assert.equal((await h.request(`Bearer ${token}`)).status, 401);
  assert.equal(h.calls.connections, 1);
  assert.equal((await h.request(`Bearer ${h.env.API_AUTH_TOKEN}`)).status, 200);
  assert.equal(h.calls.connections, 2);
});
