const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { mkdtempSync, writeFileSync, rmSync } = require('node:fs');
const { join } = require('node:path');
const { tmpdir } = require('node:os');
const { createRelay, proxyKeyFromConfig } = require('./proxy-relay');

const key = 'synthetic-model-proxy-key';
const listen = server => new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const close = server => new Promise(resolve => server.close(resolve));

describe('restricted model relay', () => {
  let upstream, relay, base;
  const received = [];
  before(async () => {
    upstream = http.createServer(async (req, res) => {
      let body = '';
      for await (const chunk of req) body += chunk;
      received.push({ method: req.method, path: req.url, headers: req.headers, body });
      const parsed = body ? JSON.parse(body) : {};
      res.writeHead(parsed.reject ? 429 : 200, { 'Content-Type': parsed.stream ? 'text/event-stream' : 'application/json' });
      res.end(parsed.stream ? 'data: {"text":"ok"}\n\ndata: [DONE]\n\n' : '{"ok":true}');
    });
    await listen(upstream);
    relay = createRelay({ apiKey: key, upstreamPort: upstream.address().port });
    await listen(relay);
    base = `http://127.0.0.1:${relay.address().port}`;
  });
  after(async () => { await close(relay); await close(upstream); });

  it('rejects missing or wrong credentials without contacting the proxy', async () => {
    const count = received.length;
    for (const headers of [{}, { authorization: 'Bearer wrong' }, { 'x-api-key': 'wrong' }]) {
      assert.equal((await fetch(`${base}/v1/models`, { headers })).status, 401);
    }
    assert.equal(received.length, count);
  });

  it('blocks management, arbitrary targets, paths with queries, and unsupported methods', async () => {
    const count = received.length;
    for (const [method, path] of [
      ['GET', '/v0/management/auth-files'], ['GET', '/v8/management/auth-files'],
      ['GET', '/'], ['GET', '/v1/models?target=/v0/management'], ['DELETE', '/v1/models'],
      ['GET', '/v1/%2e%2e/v0/management/auth-files'], ['POST', '/v1/responses'],
    ]) {
      assert.equal((await fetch(`${base}${path}`, { method, headers: { authorization: `Bearer ${key}` } })).status, 404);
    }
    assert.equal(received.length, count);
  });

  it('forwards only the allowed API routes, auth headers, and exact JSON payload', async () => {
    for (const [method, path, auth] of [
      ['GET', '/v1/models', { authorization: `Bearer ${key}` }],
      ['POST', '/v1/chat/completions', { authorization: `Bearer ${key}` }],
      ['POST', '/v1/messages', { 'x-api-key': key, 'anthropic-version': '2023-06-01' }],
    ]) {
      const body = method === 'POST' ? JSON.stringify({ model: 'synthetic', messages: [] }) : undefined;
      const response = await fetch(`${base}${path}`, { method, headers: { ...auth, cookie: 'must-not-forward', 'x-forwarded-for': 'must-not-forward' }, body });
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), { ok: true });
      const request = received.at(-1);
      assert.equal(request.path, path);
      assert.equal(request.body, body || '');
      for (const [name, value] of Object.entries(auth)) assert.equal(request.headers[name], value);
      assert.equal(request.headers.cookie, undefined);
      assert.equal(request.headers['x-forwarded-for'], undefined);
    }
  });

  it('preserves SSE and upstream error status', async () => {
    for (const payload of [{ stream: true }, { reject: true }]) {
      const r = await fetch(`${base}/v1/chat/completions`, { method: 'POST', headers: { authorization: `Bearer ${key}` }, body: JSON.stringify(payload) });
      assert.equal(r.status, payload.reject ? 429 : 200);
      if (payload.stream) {
        assert.equal(r.headers.get('content-type'), 'text/event-stream');
        assert.equal(await r.text(), 'data: {"text":"ok"}\n\ndata: [DONE]\n\n');
      } else await r.text();
    }
  });

  it('rejects oversized JSON before contacting the proxy', async () => {
    const count = received.length;
    const r = await fetch(`${base}/v1/messages`, { method: 'POST', headers: { 'x-api-key': key }, body: 'x'.repeat(6 * 1024 * 1024 + 1) });
    assert.equal(r.status, 413);
    assert.equal(received.length, count);
  });

  it('loads the existing provider credential without creating a second key file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'resumex-relay-test-'));
    const file = join(dir, 'config.toml');
    try {
      writeFileSync(file, `api-keys = [{ key = "${key}", name = "test" }]\nmanagement-secret-key = "not-this-key"\n`);
      assert.equal(proxyKeyFromConfig(file), key);
      writeFileSync(file, 'management-secret-key = "not-this-key"\n');
      assert.throws(() => proxyKeyFromConfig(file), /No proxy key found/);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  it('authenticates clients separately from a remote upstream for both API formats', async () => {
    const remote = createRelay({ apiKey: key, upstreamUrl: `http://127.0.0.1:${upstream.address().port}`, upstreamApiKey: 'gateway-only-secret' });
    await listen(remote);
    try {
      const url = `http://127.0.0.1:${remote.address().port}`;
      assert.equal((await fetch(`${url}/v1/models`, { headers: { authorization: 'Bearer gateway-only-secret' } })).status, 401);
      for (const auth of [{ authorization: `Bearer ${key}` }, { 'x-api-key': key }]) {
        const response = await fetch(`${url}/v1/models`, { headers: auth });
        assert.equal(response.status, 200);
        await response.text();
        const headers = received.at(-1).headers;
        assert.equal(headers[Object.keys(auth)[0]], auth.authorization ? 'Bearer gateway-only-secret' : 'gateway-only-secret');
        assert.ok(!JSON.stringify(headers).includes(key));
      }
    } finally { await close(remote); }
  });
});
