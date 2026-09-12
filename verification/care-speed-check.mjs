import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { chromium } from '/Users/crayner/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const require = createRequire(import.meta.url);
const { setup, request } = require('../functions/test/paidCareFixture.js');
const { createPaidCareCallables } = require('../functions/src/yumpals/paidCareCallables.js');
const browser = await chromium.launch({ headless: true, executablePath: '/Users/crayner/Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing' });
try {
  for (const width of [390, 1440]) {
    const f = setup(); f.refs.refusal = (uid, id) => `fixture/refusals/${uid}/${id}`;
    class HttpsError extends Error {}
    const api = createPaidCareCallables({ ...f, HttpsError, ready: () => true, now: () => Date.parse('2026-09-09T00:00:00Z') });
    const calls = []; const errors = [];
    const page = await browser.newPage({ viewport: { width, height: 1100 } });
    page.on('pageerror', e => errors.push(e.message));
    await page.route('**/__speed-api/*', async route => {
      const method = route.request().url().endsWith('yumpalsPurchaseCare') ? 'purchase' : 'getState'; calls.push(method);
      await new Promise(resolve => setTimeout(resolve, method === 'purchase' ? 10000 : 300));
      const result = await api[method](request('student-a', route.request().postDataJSON().data));
      await route.fulfill({ json: { result } });
    });
    await page.goto('http://127.0.0.1:5174/yum-donut/verification/care-speed.html');
    await page.locator('.saved-top').getByText('30 DONUTS').waitFor();
    const button = page.getByRole('button', { name: 'B CONFIRM', exact: true });
    await page.getByRole('button', { name: 'A SELECT', exact: true }).click();
    await button.click(); await button.click();
    await page.evaluate(() => {
      window.speedFrames = [];
      new MutationObserver(() => { const e = document.querySelector('.saved-blob'); if (e) window.speedFrames.push({ key: e.dataset.frameKey, food: e.dataset.foodRemaining, ms: performance.now() }); }).observe(document.querySelector('.saved-centre'), { subtree: true, attributes: true, childList: true });
    });
    const start = performance.now(); await button.click();
    await page.waitForFunction(() => window.speedFrames.some(f => f.food === '3'), null, { timeout: 5000 }).catch(async error => {
      console.log({ calls, text: await page.locator('body').innerText(), errors }); throw error;
    });
    const startEatingMs = Math.round(performance.now() - start);
    assert.ok(startEatingMs < 250, `Local animation took ${startEatingMs}ms`);
    assert.ok(await page.locator('.saved-top').getByText('30 DONUTS').isVisible(), 'No unconfirmed debit shown');
    await page.waitForFunction(() => !document.querySelector('.saved-blob')?.getAttribute('data-frame-key')?.includes('feed'));
    await page.keyboard.press('a');
    assert.equal(await page.getByRole('button', { name: 'Lights', exact: true }).getAttribute('aria-pressed'), 'true');
    await button.click();
    assert.ok(await page.locator('.saved-choices').isVisible(), 'Menus work during ten-second payment delay');
    await button.click(); assert.deepEqual(calls, ['getState', 'purchase']);
    await page.keyboard.press('c');
    await page.locator('.saved-top').getByText('28 DONUTS').waitFor();
    assert.deepEqual(calls, ['getState', 'purchase']);
    await page.waitForFunction(() => !document.querySelector('.saved-blob')?.getAttribute('data-frame-key')?.includes('feed'));
    const frames = await page.evaluate(() => window.speedFrames);
    for (const food of ['3', '2', '1', '0']) assert.ok(frames.some(f => f.food === food));
    await button.waitFor({ state: 'visible' }); assert.equal(await button.isEnabled(), true);
    assert.deepEqual(errors, []); assert.equal(f.db.read('fixture/wallets/student-a').balance, 28);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    console.log(JSON.stringify({ width, startEatingMs, calls, finalBalance: 28, noDuplicateCharge: true }));
    await page.screenshot({ path: `/tmp/yumpals-fast-care-${width}.png`, fullPage: true });
    await page.close();
  }
} finally { await browser.close(); }
