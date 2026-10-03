// Real components and transport, synthetic accounts only. No production requests.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { chromium } from '/Users/crayner/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const require = createRequire(import.meta.url);
const { setup, request } = require('../functions/test/paidCareFixture.js');
const { createPaidCareCallables } = require('../functions/src/yumpals/paidCareCallables.js');
const baseline = process.argv.includes('--baseline');
const slow = process.argv.includes('--slow');
const browser = await chromium.launch({ headless: true, executablePath: '/Users/crayner/Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing' });
const results = [];
const errors = [];
try {
  for (const width of [390, 1440]) {
    for (const scenario of ['meal', 'lights', 'insufficient', 'refused']) {
      const f = setup({ balance: scenario === 'insufficient' ? 1 : 30, needs: { hunger: 0, happiness: 0, cleanliness: 0, health: 2 } });
      f.refs.refusal = (uid, id) => `refusals/${uid}/${id}`;
      const api = createPaidCareCallables({ ...f, HttpsError: Error, ready: () => true, now: () => Date.parse(scenario === 'lights' ? '2026-09-07T08:00:00Z' : '2026-09-07T00:00:00Z') });
      let release;
      const gate = new Promise(resolve => { release = resolve; });
      const calls = [];
      const page = await browser.newPage({ viewport: { width, height: 1000 } });
      page.setDefaultTimeout(5000);
      if (slow) await (await page.context().newCDPSession(page)).send('Emulation.setCPUThrottlingRate', { rate: 4 });
      page.on('pageerror', error => errors.push(error.message));
      await page.route('**/__speed-api/*', async route => {
        const method = route.request().url().endsWith('yumpalsPurchaseCare') ? 'purchase' : 'getState';
        const data = route.request().postDataJSON().data;
        calls.push({ method, data });
        if (method === 'purchase') await gate;
        const result = await api[method](request('student-a', data));
        await route.fulfill({ json: { result } }).catch(() => {});
      });
      try {
        await page.goto('http://127.0.0.1:5174/yum-donut/verification/care-speed.html?strict=1');
        await page.locator('.saved-top').getByText(`${scenario === 'insufficient' ? 1 : 30} DONUTS`).waitFor();
        await page.getByRole('button', { name: scenario === 'lights' ? 'Lights' : 'Food', exact: true }).click();
        await page.keyboard.press('b');
        await page.keyboard.press('b');
        if (scenario === 'insufficient') {
          const stuckChecking = await page.locator('.saved-confirm').isVisible();
          results.push({ width, scenario, stuckChecking, purchases: calls.filter(c => c.method === 'purchase').length });
          if (!baseline) { assert.equal(stuckChecking, false); assert.equal(calls.filter(c => c.method === 'purchase').length, 0); assert.match(await page.locator('.saved-top-status').innerText(), /enough|donuts/i); }
        } else {
          const start = performance.now();
          await page.keyboard.press('b');
          await page.waitForFunction(() => document.querySelector('.saved-queue-status')?.textContent.includes('1 care action'));
          const localMs = Math.round(performance.now() - start);
          if (scenario === 'lights') {
            const dim = await page.locator('.paid-demo-lcd').evaluate(e => e.classList.contains('is-bedtime-set'));
            results.push({ width, scenario, localMs, lightsReactBeforeServer: dim });
            if (!baseline) { assert.equal(dim, true); assert.ok(localMs < 250); }
          } else {
            await page.keyboard.press('b');
            if (!baseline) await page.locator('.saved-choices').waitFor({ state: 'visible', timeout: 250 });
            const keyboardWorksDuringFeed = await page.locator('.saved-choices').isVisible();
            await page.getByRole('button', { name: 'Health and status', exact: true }).click();
            await page.getByRole('button', { name: 'B CONFIRM', exact: true }).click();
            const hearts = await page.locator('.saved-hearts').first().getAttribute('aria-label');
            results.push({ width, scenario, localMs, keyboardWorksDuringFeed, immediateFoodHearts: hearts });
            if (!baseline) { assert.equal(keyboardWorksDuringFeed, true); assert.equal(hearts, '2 of 4 hearts'); assert.ok(localMs < 250); }
          }
          assert.equal(f.db.read('fixture/wallets/student-a').balance, 30, 'network is still blocked, no invented server debit');
          if (scenario === 'refused') {
            const wallet = f.db.read('fixture/wallets/student-a');
            f.db.seed('fixture/wallets/student-a', { ...wallet, balance: 1 });
          }
          release();
          await page.waitForFunction(() => document.querySelector('.saved-queue-status')?.classList.contains('is-empty'));
          assert.equal(calls.filter(c => c.method === 'purchase').length, 1);
          if (scenario === 'refused') {
            assert.equal(await page.locator('.saved-hearts').first().getAttribute('aria-label'), '0 of 4 hearts', 'refusal restores actual needs');
            assert.equal(f.db.read('fixture/wallets/student-a').balance, 1, 'refused care never charges');
            assert.match(await page.locator('.saved-top-status').innerText(), /No donuts spent/);
          }
        }
      } finally { release(); await page.close(); }
    }
  }
  const page = await browser.newPage({ viewport: { width: 390, height: 1000 } });
  await page.goto('http://127.0.0.1:5174/yum-donut/verification/surround.html');
  await page.locator('.paid-demo-inspector').last().evaluate(e => { e.open = true; });
  await page.locator('select').selectOption('needs-care');
  await page.getByRole('button', { name: 'B CONFIRM', exact: true }).click();
  await page.keyboard.press('b'); await page.keyboard.press('b');
  const demoButtonsReady = await page.getByRole('button', { name: 'A SELECT', exact: true }).isEnabled();
  results.push({ scenario: 'preview', demoButtonsReady });
  if (!baseline) assert.equal(demoButtonsReady, true);
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ baseline, cpuSlowdown: slow ? 4 : 1, results }, null, 2));
} finally { await browser.close(); }
