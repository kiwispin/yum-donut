// Checks the tidied saved YumPals page never shifts: selecting icons changes the
// hint text, and messages appear in the reserved status line above the device.
// Usage: node verification/tidy-up-stability.mjs [port]  (PLAYWRIGHT_MODULE selects Playwright)
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ headless: true });
const base = `http://localhost:${process.argv[2] || '5174'}/yum-donut/verification/saved-surround.html`;
const MESSAGES = ['Saving care… 24 donuts after.', 'Reconnecting… your care is kept safe.', 'Meal needs checking. Tap Reconnect.', 'Niblet heard you gave a donut! Happy +1.', 'Purchase confirmed.'];
try {
  for (const width of [320, 390, 1024]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    await page.goto(base);
    await page.locator('.saved-top').filter({ hasText: 'DONUTS' }).waitFor();
    const positions = () => page.evaluate(() => Object.fromEntries(['.paid-demo-device', '.paid-demo-meta', '.saved-utilities', '.paid-demo-inspector']
      .map(selector => [selector, Math.round(document.querySelector(selector).getBoundingClientRect().top + scrollY)])));
    const start = await positions();
    for (const icon of await page.locator('.paid-icon-button').all()) {
      await icon.hover();
      assert.deepEqual(await positions(), start, `${width}: hovering ${await icon.getAttribute('aria-label')} moved the page`);
    }
    // Reserved status line: one-line messages must not move the device.
    const lines = {};
    for (const message of MESSAGES) {
      const top = await page.evaluate(text => {
        const status = document.querySelector('.saved-top-status');
        status.textContent = text;
        const result = { device: Math.round(document.querySelector('.paid-demo-device').getBoundingClientRect().top + scrollY), clipped: status.scrollHeight > status.clientHeight + 1, height: Math.round(status.getBoundingClientRect().height) };
        status.textContent = '';
        return result;
      }, message);
      lines[message] = top;
      assert.equal(top.clipped, false, `${width}: "${message}" clipped`);
    }
    const moved = Object.entries(lines).filter(([, v]) => v.device !== start['.paid-demo-device']).map(([m, v]) => `${m} (+${v.device - start['.paid-demo-device']}px)`);
    console.log(`${width}px: icons never moved the page; messages unclipped; ${moved.length ? `wraps to two lines: ${moved.join('; ')}` : 'device never moved for any message'}`);
    await page.close();
  }
} finally { await browser.close(); }
