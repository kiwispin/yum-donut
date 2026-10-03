import { createRequire } from 'node:module';
import { chromium } from '/Users/crayner/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const require = createRequire(import.meta.url);
const { setup, request } = require('../functions/test/paidCareFixture.js');
const { createPaidCareCallables } = require('../functions/src/yumpals/paidCareCallables.js');
const label = process.argv[2] || 'profile';
const port = process.argv[3] || '5174';
const browser = await chromium.launch({ headless: true, executablePath: '/Users/crayner/Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing' });
const results = [];
try {
  for (const width of [390, 1440]) {
    for (let run = 0; run < 3; run++) {
      const f = setup({ needs: { hunger: 0, happiness: 0, cleanliness: 0, health: 2 } });
      f.refs.refusal = (uid, id) => `refusals/${uid}/${id}`;
      const api = createPaidCareCallables({ ...f, HttpsError: Error, ready: () => true, now: () => Date.parse('2026-09-07T00:00:00Z') });
      const page = await browser.newPage({ viewport: { width, height: 1100 } });
      await page.addInitScript(() => {
        let seen = false;
        new MutationObserver(() => {
          if (!seen && /30 DONUTS/.test(document.querySelector('.saved-top')?.textContent || '')) {
            seen = true; requestAnimationFrame(() => { window.profileReadyMs = Math.round(performance.now()); });
          }
        }).observe(document, { subtree: true, childList: true, characterData: true });
      });
      const cdp = await page.context().newCDPSession(page);
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
      await cdp.send('Performance.enable');
      let reads = 0;
      await page.route('**/__speed-api/*', async route => {
        reads++;
        await new Promise(resolve => setTimeout(resolve, 300));
        await route.fulfill({ json: { result: await api.getState(request()) } });
      });
      await page.goto(`http://127.0.0.1:${port}/yum-donut/verification/care-speed.html?strict=1`);
      await page.locator('.saved-top').getByText('30 DONUTS').waitFor();
      await page.waitForFunction(() => window.profileReadyMs);
      const readyMs = await page.evaluate(() => window.profileReadyMs);
      const roomElements = await page.locator('.saved-handheld *').count();
      if (!run) await page.locator('.paid-demo-device').screenshot({ path: `/tmp/yumpals-${label}-${width}.png` });
      const metrics = async () => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m => [m.name, m.value]));
      const before = await metrics();
      const responses = await page.evaluate(async () => {
        const samples = [];
        for (let i = 0; i < 20; i++) {
          const t = performance.now();
          document.querySelector('[aria-label="A SELECT"]').click();
          await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
          samples.push(Math.round(performance.now() - t));
        }
        return samples;
      });
      await page.getByRole('button', { name: 'Health and status', exact: true }).click();
      await page.getByRole('button', { name: 'B CONFIRM', exact: true }).click();
      const statusElements = await page.locator('.saved-handheld *').count();
      const after = await metrics();
      results.push({ width, run, readyMs, reads, roomElements, statusElements,
        scriptMs: Math.round((after.ScriptDuration - before.ScriptDuration) * 1000),
        layoutMs: Math.round((after.LayoutDuration - before.LayoutDuration) * 1000),
        responseP50: responses.sort((a, b) => a - b)[10], responseMax: Math.max(...responses) });
      await page.close();
    }
  }
  console.log(JSON.stringify({ label, cpuSlowdown: 4, readDelayMs: 300, results }, null, 2));
} finally { await browser.close(); }
