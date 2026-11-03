#!/usr/bin/env node
const http = require('node:http');
const https = require('node:https');
const { timingSafeEqual } = require('node:crypto');
const { readFileSync } = require('node:fs');
const { homedir } = require('node:os');
const { join } = require('node:path');

const ROUTES = new Set(['POST /v1/chat/completions', 'POST /v1/messages', 'GET /v1/models']);
const MAX_BODY_BYTES = 6 * 1024 * 1024;

function createRelay({ apiKey, upstreamPort = 8317, upstreamUrl = `http://127.0.0.1:${upstreamPort}`, upstreamApiKey = apiKey }) {
  if (!apiKey) throw new Error('A proxy key is required');
  const target = new URL(upstreamUrl);
  if (!['http:', 'https:'].includes(target.protocol) || target.username || target.password || target.search || target.hash || target.pathname !== '/') throw new Error('Upstream must be an HTTP(S) origin');
  const transport = target.protocol === 'https:' ? https : http;
  const expected = Buffer.from(apiKey);
  const server = http.createServer((req, res) => {
    const fail = (status, message) => {
      if (res.writableEnded) return;
      if (!res.headersSent) {
        res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
        res.end(JSON.stringify({ error: { message } }));
      } else res.destroy();
    };
    // Match the raw URL exactly: no queries, encoded paths, or management routes.
    if (!ROUTES.has(`${req.method} ${req.url}`)) return fail(404, 'Not found');
    const token = req.headers.authorization?.replace(/^Bearer /, '') || req.headers['x-api-key'] || '';
    const supplied = Buffer.from(token);
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return fail(401, 'Unauthorized');
    if (Number(req.headers['content-length']) > MAX_BODY_BYTES) return fail(413, 'Request too large');

    const headers = { 'Content-Type': 'application/json' };
    for (const name of ['anthropic-version', 'anthropic-beta']) {
      if (req.headers[name]) headers[name] = req.headers[name];
    }
    if (req.headers.authorization) headers.authorization = `Bearer ${upstreamApiKey}`;
    if (req.headers['x-api-key']) headers['x-api-key'] = upstreamApiKey;
    const upstream = transport.request(new URL(req.url, target), { method: req.method, headers }, reply => {
      const responseHeaders = { 'Cache-Control': 'no-store' };
      if (reply.headers['content-type']) responseHeaders['Content-Type'] = reply.headers['content-type'];
      res.writeHead(reply.statusCode, responseHeaders);
      reply.on('error', () => res.destroy());
      reply.pipe(res);
    });
    upstream.setTimeout(870_000, () => { fail(504, 'Model request timed out'); upstream.destroy(); });
    upstream.on('error', () => fail(502, 'Model service unavailable'));
    req.on('aborted', () => upstream.destroy());
    req.on('error', () => upstream.destroy());
    res.on('close', () => upstream.destroy());
    let bytes = 0;
    req.on('data', chunk => {
      bytes += chunk.length;
      if (bytes > MAX_BODY_BYTES) {
        req.unpipe(upstream);
        fail(413, 'Request too large');
        upstream.destroy();
      }
    });
    req.pipe(upstream);
  });
  server.headersTimeout = 15_000;
  server.requestTimeout = 60_000;
  return server;
}

function proxyKeyFromConfig(file) {
  const config = readFileSync(file, 'utf8');
  const match = config.match(/^api-keys\s*=\s*\[\s*\{\s*key\s*=\s*("(?:[^"\\]|\\.)*")/m);
  if (!match) throw new Error('No proxy key found in EasyCLIProxyAPI config');
  return JSON.parse(match[1]);
}

if (require.main === module) {
  const file = process.env.CPA_CONFIG_PATH || join(homedir(), 'Library/Application Support/com.cpa.gui/config.toml');
  const apiKey = process.env.RELAY_API_KEY || proxyKeyFromConfig(file);
  const upstreamKeyFile = process.env.RELAY_UPSTREAM_KEY_FILE;
  const upstreamApiKey = upstreamKeyFile ? readFileSync(upstreamKeyFile, 'utf8').trim() : apiKey;
  if (!upstreamApiKey) throw new Error('An upstream proxy key is required');
  createRelay({ apiKey, upstreamUrl: process.env.RELAY_UPSTREAM_URL, upstreamApiKey }).listen(8318, '127.0.0.1', () => console.log('ResumeX model relay listening on 127.0.0.1:8318'));
}

module.exports = { createRelay, proxyKeyFromConfig };
