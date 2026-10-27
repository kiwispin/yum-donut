// Checks the phone-only auto-scroll on the app-like test page (no account).
// Usage: node verification/autoscroll-check.mjs [port]  (PLAYWRIGHT_MODULE selects Playwright)
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ headless: true });
const base = `http://localhost:${process.argv[2] || '5174'}/yum-donut/verification/saved-in-app.html`;
const shots = process.env.SCREENSHOT_DIR || '.';
const errors = [];
const settle = page => page.waitForFunction(() => new Promise(resolve => {
  let last = -1; let same = 0;
  const tick = () => { if (scrollY === last) { if (++same > 5) return resolve(true); } else { same = 0; last = scrollY; } requestAnimationFrame(tick); };
  tick();
}), null, { timeout: 5000 });
async function open(width, height, { reducedMotion = 'no-preference', query = '' } = {}) {
  const page = await browser.newPage({ viewport: { width, height }, reducedMotion });
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${base}${query}`);
  return page;
}
const placement = page => page.evaluate(() => {
  const r = document.querySelector('.paid-demo-device').getBoundingClientRect();
  const bar = document.querySelector('.fake-bottom-bar'); const barTop = getComputedStyle(bar).display === 'none' ? innerHeight : bar.getBoundingClientRect().top;
  const buttons = document.querySelector('.paid-hardware').getBoundingClientRect();
  return { scrollY: Math.round(scrollY), deviceTop: Math.round(r.top), deviceBottom: Math.round(r.bottom), headerBottom: 80, barTop: Math.round(barTop),
    wholeDeviceVisible: r.top >= 80 && r.bottom <= barTop, screenAndButtonsVisible: r.top >= 80 && buttons.bottom <= barTop };
});
try {
  for (const [width, height] of [[390, 844], [375, 667], [360, 740], [414, 896]]) {
    const page = await open(width, height);
    await page.locator('.saved-top').filter({ hasText: 'DONUTS' }).waitFor();
    await settle(page);
    const p = await placement(page);
    console.log(`${width}x${height}`, JSON.stringify(p));
    assert.ok(p.scrollY > 0, `${width}x${height}: scrolled to the handheld`);
    // Phones too short for the whole casing (e.g. 375×667) must still show the screen and A/B/C buttons.
    assert.equal(height >= 700 ? p.wholeDeviceVisible : p.screenAndButtonsVisible, true, `${width}x${height}: handheld visible between header and bottom bar`);
    if (width === 390) await page.screenshot({ path: `${shots}/autoscroll-390.png` });
    await page.close();
  }

  // Desktop and tablet: never scrolls.
  for (const [width, height] of [[768, 900], [1280, 800]]) {
    const page = await open(width, height);
    await page.locator('.saved-top').filter({ hasText: 'DONUTS' }).waitFor();
    await page.waitForTimeout(600);
    assert.equal(await page.evaluate(() => scrollY), 0, `${width}px: no auto-scroll`);
    console.log(`${width}x${height} no auto-scroll`);
    await page.close();
  }

  // A student who scrolls while the pal is loading keeps their position.
  {
    const page = await open(390, 844, { query: '?delay=1500' });
    await page.mouse.move(195, 400); await page.mouse.wheel(0, 120);
    await page.waitForFunction(() => scrollY > 0);
    const theirs = await page.evaluate(() => Math.round(scrollY));
    await page.locator('.saved-top').filter({ hasText: 'DONUTS' }).waitFor();
    await page.waitForTimeout(800);
    assert.equal(await page.evaluate(() => Math.round(scrollY)), theirs, 'student scroll respected');
    console.log(`student scrolled first: stayed at ${theirs}px`);
    await page.close();
  }

  // Reduced motion: jumps straight there (no smooth scrolling).
  {
    const page = await open(390, 844, { reducedMotion: 'reduce' });
    await page.locator('.saved-top').filter({ hasText: 'DONUTS' }).waitFor();
    await page.waitForFunction(() => scrollY > 0, null, { timeout: 2000 });
    const first = await page.evaluate(() => Math.round(scrollY));
    await page.waitForTimeout(400);
    assert.equal(await page.evaluate(() => Math.round(scrollY)), first, 'reduced motion lands in one step');
    assert.equal((await placement(page)).wholeDeviceVisible, true);
    console.log(`reduced motion: instant to ${first}px`);
    await page.close();
  }

  // Only once: interacting afterwards (e.g. refreshing the pal) never scrolls again.
  {
    const page = await open(390, 844);
    await page.locator('.saved-top').filter({ hasText: 'DONUTS' }).waitFor();
    await settle(page);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.evaluate(() => document.querySelector('.saved-refresh-link').click());
    await page.waitForTimeout(800);
    assert.equal(await page.evaluate(() => scrollY), 0, 'no second auto-scroll after refresh');
    console.log('only once: refresh after scrolling back up did not scroll again');
    await page.close();
  }
  assert.deepEqual(errors, []);
  console.log('PASS all, zero page errors');
} finally { await browser.close(); }
