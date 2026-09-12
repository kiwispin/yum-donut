import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { chromium } from '/Users/crayner/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const require = createRequire(import.meta.url);
const { setup, request } = require('../functions/test/paidCareFixture.js');
const { createPaidCareCallables } = require('../functions/src/yumpals/paidCareCallables.js');
const port = process.argv[2] || '5174';
const browser = await chromium.launch({ headless: true, executablePath: '/Users/crayner/Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing' });
try {
  for (const width of [390, 1440]) {
    const f = setup(); f.refs.refusal = (uid, id) => `fixture/refusals/${uid}/${id}`;
    const pet = f.db.read(f.refs.pet('student-a')); pet.paidCare.needs = { hunger: 0, happiness: 4, cleanliness: 0, health: 4 }; f.db.seed(f.refs.pet('student-a'), pet);
    class HttpsError extends Error {}
    const api = createPaidCareCallables({ ...f, HttpsError, ready: () => true, now: () => Date.parse('2026-09-09T00:00:00Z') });
    const calls = []; const outcomes = []; const errors = []; let purchases = 0;
    const page = await browser.newPage({ viewport: { width, height: 1100 } });
    page.on('pageerror', e => errors.push(e.message));
    await page.route('**/__speed-api/*', async route => {
      const method = route.request().url().endsWith('yumpalsPurchaseCare') ? 'purchase' : 'getState'; const payload = route.request().postDataJSON().data;
      calls.push({ method, operationId: payload.operationId || null });
      if (method === 'purchase') { purchases += 1; await new Promise(resolve => setTimeout(resolve, purchases === 1 ? 10000 : 300)); }
      else await new Promise(resolve => setTimeout(resolve, 300));
      const result = await api[method](request('student-a', payload));
      if (method === 'purchase') outcomes.push({ operationId: result.outcome.operationId, status: result.outcome.status, duplicate: result.duplicate, amount: result.outcome.amount || 0, walletAfter: result.outcome.walletAfter || null });
      await route.fulfill({ json: { result } });
    });
    await page.goto(`http://127.0.0.1:${port}/yum-donut/verification/care-speed.html`);
    await page.locator('.saved-top').getByText('30 DONUTS').waitFor();
    const button = page.getByRole('button', { name: 'B CONFIRM', exact: true });
    await page.getByRole('button', { name: 'A SELECT', exact: true }).click();
    await button.click(); await button.click();
    await page.evaluate(() => {
      window.speedFrames = [];
      new MutationObserver(() => { const e = document.querySelector('.saved-blob'); if (e) window.speedFrames.push({ key: e.dataset.frameKey, food: e.dataset.foodRemaining, ms: performance.now() }); }).observe(document.querySelector('.saved-centre'), { subtree: true, attributes: true, childList: true });
    });
    const layout = () => page.evaluate(() => Object.fromEntries(['.paid-demo-header', '.paid-demo-warning', '.saved-top-status', '.paid-demo-device', '.paid-demo-hint', '.saved-queue-status', '.paid-demo-meta', '.saved-sync', '.saved-utilities'].map(selector => {
      const rect = document.querySelector(selector).getBoundingClientRect();
      return [selector, { x: rect.x + window.scrollX, y: rect.y + window.scrollY, width: rect.width, height: rect.height }];
    })));
    const chrome = () => page.evaluate(() => Object.fromEntries(['.saved-queue-status', '.saved-sync'].map(selector => {
      const style = getComputedStyle(document.querySelector(selector));
      return [selector, { background: style.backgroundColor, border: style.borderColor, boxShadow: style.boxShadow, color: style.color }];
    })));
    const layoutBefore = await layout();
    const chromeBefore = await chrome();
    for (const selector of Object.keys(chromeBefore)) { assert.equal(chromeBefore[selector].background, 'rgba(0, 0, 0, 0)', `${selector} empty background is visible`); assert.equal(chromeBefore[selector].boxShadow, 'none', `${selector} empty shadow is visible`); }
    const start = performance.now(); await button.click();
    await page.waitForFunction(() => window.speedFrames.some(f => f.food === '3'), null, { timeout: 5000 }).catch(async error => {
      console.log({ calls, text: await page.locator('body').innerText(), errors }); throw error;
    });
    const startEatingMs = Math.round(performance.now() - start);
    assert.ok(startEatingMs < 250, `Local animation took ${startEatingMs}ms`);
    assert.ok(await page.locator('.saved-top').getByText('30 DONUTS').isVisible(), 'No unconfirmed debit shown');
    await page.waitForFunction(() => !document.querySelector('.saved-blob')?.getAttribute('data-frame-key')?.includes('feed'));
    await page.getByRole('button', { name: 'Clean', exact: true }).click();
    await button.click();
    assert.ok(await page.locator('.saved-choices').isVisible(), 'Menus work during ten-second payment delay');
    await button.click();
    const secondStart = performance.now(); await button.click();
    const secondConfirmMs = Math.round(performance.now() - secondStart);
    assert.ok(secondConfirmMs < 250, `Second care confirmation took ${secondConfirmMs}ms`);
    await page.getByText('2 care actions waiting to finish', { exact: true }).waitFor();
    const layoutDuring = await layout();
    const chromeDuring = await chrome();
    const beforePurchaseCalls = calls.filter(call => call.method === 'purchase');
    assert.equal(beforePurchaseCalls.length, 1);
    assert.ok(calls.filter(call => call.method === 'getState').length <= 2, `Unexpected fresh-state call count: ${calls.map(call => call.method).join(',')}`);
    for (const selector of Object.keys(chromeDuring)) assert.notEqual(chromeDuring[selector].background, 'rgba(0, 0, 0, 0)', `${selector} populated background is hidden`);
    for (const selector of Object.keys(layoutBefore)) assert.deepEqual(layoutDuring[selector], layoutBefore[selector], `${selector} moved while care was queued`);
    await page.keyboard.press('c');
    await page.locator('.saved-top').getByText('27 DONUTS').waitFor();
    const purchaseCalls = calls.filter(call => call.method === 'purchase');
    assert.equal(purchaseCalls.length, 2, `Unexpected purchase sequence: ${JSON.stringify({ purchaseCalls, outcomes })}`);
    assert.equal(new Set(purchaseCalls.map(call => call.operationId)).size, 2, `Expected two unique operation IDs: ${JSON.stringify(purchaseCalls)}`);
    assert.deepEqual(outcomes, purchaseCalls.map((call, index) => ({ operationId: call.operationId, status: 'COMMITTED', duplicate: false, amount: index === 0 ? 2 : 1, walletAfter: index === 0 ? 28 : 27 })));
    assert.ok(purchaseCalls.every(call => f.db.read(f.refs.receipt('student-a', call.operationId))?.operationId === call.operationId), 'Each unique operation has one durable receipt');
    await page.waitForFunction(() => !document.querySelector('.saved-blob')?.getAttribute('data-frame-key')?.includes('feed'));
    const frames = await page.evaluate(() => window.speedFrames);
    for (const food of ['3', '2', '1', '0']) assert.ok(frames.some(f => f.food === food));
    const layoutAfter = await layout();
    const chromeAfter = await chrome();
    for (const selector of Object.keys(layoutBefore)) assert.deepEqual(layoutAfter[selector], layoutBefore[selector], `${selector} moved after care completed`);
    for (const selector of Object.keys(chromeAfter)) { assert.equal(chromeAfter[selector].background, 'rgba(0, 0, 0, 0)', `${selector} empty background remains visible`); assert.equal(chromeAfter[selector].boxShadow, 'none', `${selector} empty shadow remains visible`); }
    await button.waitFor({ state: 'visible' }); assert.equal(await button.isEnabled(), true);
    assert.deepEqual(errors, []); assert.equal(f.db.read('fixture/wallets/student-a').balance, 27);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    console.log(JSON.stringify({ width, startEatingMs, secondConfirmMs, calls, outcomes, chromeBefore, chromeDuring, chromeAfter, layoutBefore, layoutDuring, layoutAfter, finalBalance: 27, noDuplicateCharge: true }));
    await page.screenshot({ path: `/tmp/yumpals-fast-care-${width}.png`, fullPage: true });
    await page.close();
  }
} finally { await browser.close(); }
