import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { chromium } from '/Users/crayner/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const require = createRequire(new URL('../functions/package.json', import.meta.url));
const express = require('express');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { withPreflightCache } = require('./src/yumpals/preflightCache');
const app = express(); const calls = { baseline: [], cached: [] };
app.use(express.json());
// Use the real SDK, no browser routing/interception (which alters caching).
const callable = onCall({ region: 'us-central1' }, request => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required');
  throw new Error('This test never supplies a real account');
});
for (const variant of ['baseline', 'cached']) app.all('/' + variant, async (req, res) => {
  calls[variant].push(req.method);
  await new Promise(resolve => setTimeout(resolve, 150));
  return (variant === 'cached' ? withPreflightCache(callable) : callable)(req, res);
});
const api = createServer(app);
const origin = createServer((_req, res) => { res.setHeader('Content-Type', 'text/html'); res.end('<title>Cross-origin permission test</title>'); });
await Promise.all([api, origin].map(server => new Promise(resolve => server.listen(0, '127.0.0.1', resolve))));
const browser = await chromium.launch({ headless: true, executablePath: '/Users/crayner/Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing' });
try {
  const results = await Promise.all(['baseline', 'cached'].map(async variant => {
    const context = await browser.newContext(); const page = await context.newPage();
    await page.goto(`http://127.0.0.1:${origin.address().port}`);
    const responses = await page.evaluate(async url => {
      const results = [];
      for (let i = 0; i < 3; i++) {
        if (i) await new Promise(resolve => setTimeout(resolve, 6100));
        const at = performance.now();
        const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"data":{}}' });
        const body = await response.json();
        results.push({ ms: Math.round(performance.now() - at), status: response.status, error: body.error.status });
      }
      return results;
    }, `http://127.0.0.1:${api.address().port}/${variant}`);
    assert.equal(calls[variant].filter(method => method === 'OPTIONS').length, variant === 'cached' ? 1 : 3);
    assert.equal(calls[variant].filter(method => method === 'POST').length, 3);
    responses.forEach(response => { assert.equal(response.status, 401); assert.equal(response.error, 'UNAUTHENTICATED'); });
    await context.close(); return { variant, responses, requests: calls[variant] };
  }));
  console.log(JSON.stringify({ injectedDelayPerRequestMs: 150, gapMs: 6100, results }, null, 2));
} finally {
  await browser.close();
  await Promise.all([api, origin].map(server => new Promise(resolve => server.close(resolve))));
}
