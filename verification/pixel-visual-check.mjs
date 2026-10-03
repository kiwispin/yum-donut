import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { chromium } from '/Users/crayner/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const require = createRequire('/Users/crayner/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json');
const { PNG } = require('pngjs');
const browser = await chromium.launch({ headless: true, executablePath: '/Users/crayner/Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing' });
try {
  for (const width of [390, 1440]) {
    const captures = [];
    for (const port of [5182, 5181]) {
      const page = await browser.newPage({ viewport: { width, height: 1100 } });
      await page.clock.install({ time: new Date('2026-10-04T00:00:00Z') });
      await page.goto(`http://127.0.0.1:${port}/yum-donut/verification/surround.html`);
      await page.getByRole('button', { name: 'B CONFIRM', exact: true }).waitFor();
      const states = [];
      states.push(PNG.sync.read(await page.locator('.paid-demo-device').screenshot()));
      await page.getByRole('button', { name: 'Health and status', exact: true }).click();
      await page.getByRole('button', { name: 'B CONFIRM', exact: true }).click();
      states.push(PNG.sync.read(await page.locator('.paid-demo-device').screenshot()));
      await page.locator('.paid-demo-inspector').last().evaluate(e => { e.open = true; });
      await page.locator('select').selectOption('night');
      states.push(PNG.sync.read(await page.locator('.paid-demo-device').screenshot()));
      captures.push(states); await page.close();
    }
    for (let state = 0; state < 3; state++) {
      const [a, b] = captures.map(group => group[state]);
      assert.equal(a.width, b.width); assert.equal(a.height, b.height);
      let different = 0;
      for (let p = 0; p < a.data.length; p += 4) if (!a.data.subarray(p, p + 4).equals(b.data.subarray(p, p + 4))) different++;
      console.log({ width, state: ['room', 'status', 'night'][state], different });
      assert.equal(different, 0, 'pixel artwork/layout must match production baseline exactly');
    }
  }
} finally { await browser.close(); }
