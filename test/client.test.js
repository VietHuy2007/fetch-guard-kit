import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { createClient, HttpError } from '../src/index.js';

const mockClient = (fetcher, options = {}) => createClient({ baseUrl: 'https://example.test/api/', fetch: fetcher, ...options });

test('preserves base path, encodes query, and merges headers', async () => {
  const api = mockClient(async (url, options) => {
    assert.equal(url.pathname, '/api/items');
    assert.equal(url.searchParams.get('q'), 'a & b');
    assert.equal(url.searchParams.has('skip'), false);
    assert.equal(options.headers.get('authorization'), 'Bearer demo');
    assert.equal(options.headers.get('x-mode'), 'request');
    return Response.json({ ok: true });
  }, { headers: { authorization: 'Bearer demo', 'X-Mode': 'default' } });
  assert.deepEqual(await api.request('items', { query: { q: 'a & b', skip: null }, headers: { 'x-mode': 'request' } }), { ok: true });
});

test('serializes JSON for POST', async () => {
  const api = mockClient(async (_, options) => {
    assert.equal(options.method, 'POST');
    assert.equal(options.body, '{"count":2}');
    assert.equal(options.headers.get('content-type'), 'application/json');
    return Response.json({ saved: true });
  });
  await api.request('items', { method: 'POST', json: { count: 2 } });
});

test('empty successful response returns null', async () => {
  assert.equal(await mockClient(async () => new Response(null, { status: 204 })).request('items'), null);
});

test('HTTP errors preserve JSON and text bodies', async () => {
  for (const body of ['{"message":"no"}', 'unavailable']) {
    const api = mockClient(async () => new Response(body, { status: 503 }));
    await assert.rejects(api.request('items'), error => {
      assert.ok(error instanceof HttpError);
      assert.equal(error.status, 503);
      assert.deepEqual(error.body, body.startsWith('{') ? { message: 'no' } : body);
      return true;
    });
  }
});

test('malformed successful JSON is rejected', async () => {
  await assert.rejects(mockClient(async () => new Response('oops')).request('items'), SyntaxError);
});

test('blocks cross-origin URLs without calling fetch', async () => {
  let called = false;
  const api = mockClient(async () => { called = true; });
  await assert.rejects(api.request('https://other.test/'), /origin/);
  assert.equal(called, false);
});

test('validates timeout and conflicting body options', async () => {
  const api = mockClient(async () => Response.json({}));
  for (const timeoutMs of [-1, NaN, Infinity]) {
    await assert.rejects(api.request('items', { timeoutMs }), /timeoutMs/);
  }
  await assert.rejects(api.request('items', { json: {}, body: 'raw' }), /not both/);
});

test('already canceled signal prevents fetch', async () => {
  let called = false;
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(mockClient(async () => { called = true; }).request('items', { signal: controller.signal }), { name: 'AbortError' });
  assert.equal(called, false);
});

test('network errors propagate without retry', async () => {
  let calls = 0;
  const failure = new TypeError('network failed');
  await assert.rejects(mockClient(async () => { calls++; throw failure; }).request('items'), error => error === failure);
  assert.equal(calls, 1);
});

test('real fetch supports timeout, cancellation, and disabled timeout', async t => {
  const server = createServer((req, res) => {
    if (req.url === '/slow') return;
    res.setHeader('content-type', 'application/json');
    res.end('{"ok":true}');
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => { server.closeAllConnections(); server.close(); });
  const api = createClient({ baseUrl: `http://127.0.0.1:${server.address().port}/` });
  await assert.rejects(api.request('slow', { timeoutMs: 40 }), { name: 'TimeoutError' });
  const controller = new AbortController();
  const pending = api.request('slow', { signal: controller.signal });
  setTimeout(() => controller.abort(), 30);
  await assert.rejects(pending, { name: 'AbortError' });
  assert.deepEqual(await api.request('fast', { timeoutMs: 0 }), { ok: true });
});
