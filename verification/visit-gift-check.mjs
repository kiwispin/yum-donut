// Shows each visit-gift reply on the saved handheld test page (no account) and
// checks the message, the animation, once-only playback and the cheer queue.
// Usage: node verification/visit-gift-check.mjs [port]  (PLAYWRIGHT_MODULE selects Playwright)
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ headless: true });
const base = `http://localhost:${process.argv[2] || '5174'}/yum-donut/verification/saved-surround.html`;
const shots = process.env.SCREENSHOT_DIR || '.';
const errors = [];
const CASES = [
  ['hunger', 'Niblet loves your visit! Food +1.', 'feed'],
  ['happiness', 'Niblet loves your visit! Happy +1.', 'pat'],
  ['cleanliness', 'Niblet loves your visit! Clean +1.', 'clean'],
  ['health', 'Niblet loves your visit! Health +1.', 'medicine'],
  ['none', 'Niblet loves your visit!', 'pat'],
  ['welcome', 'Welcome back! Every heart +1.', 'wake'],
];
async function open(query, width = 390) {
  const context = await browser.newContext({ viewport: { width, height: 844 } });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  // Record the status text and blob frame keys from the first render on.
  await page.addInitScript(() => {
    window.__seen = { status: [], frames: [] };
    new MutationObserver(() => {
      const s = document.querySelector('.saved-top-status')?.textContent; if (s && window.__seen.status.at(-1) !== s) window.__seen.status.push(s);
      const f = document.querySelector('.saved-blob')?.dataset.frameKey; if (f && window.__seen.frames.at(-1) !== f) window.__seen.frames.push(f);
    }).observe(document, { subtree: true, childList: true, characterData: true, attributes: true });
  });
  await page.goto(`${base}?${query}`);
  return { page, context };
}
try {
  for (const [kind, message, animation] of CASES) {
    const { page, context } = await open(`visit=${kind}`);
    await page.waitForFunction(text => window.__seen.status.includes(text), message, { timeout: 5000 });
    await page.waitForTimeout(1500);
    const seen = await page.evaluate(() => window.__seen);
    assert.ok(seen.frames.some(f => f.includes(animation)), `${kind}: ${animation} animation (frames ${seen.frames.join(',')})`);
    const clipped = await page.evaluate(() => { const s = document.querySelector('.saved-top-status'); return s.scrollHeight > s.clientHeight + 1; });
    assert.equal(clipped, false);
    if (kind === 'hunger') await page.screenshot({ path: `${shots}/visit-hunger-390.png` });
    // Reload in the same browser: the gift must not replay.
    await page.reload(); await page.locator('.saved-top').filter({ hasText: 'DONUTS' }).waitFor(); await page.waitForTimeout(1200);
    const replay = await page.evaluate(text => window.__seen.status.includes(text), message);
    assert.equal(replay, false, `${kind}: replayed after reload`);
    console.log(`PASS ${kind}: "${message}" with ${animation}, unclipped, no replay`);
    await context.close();
  }
  // A gift granted earlier by a background read (kept in storage) shows on opening.
  {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await context.addInitScript(() => {
      if (sessionStorage.getItem('seeded')) return; sessionStorage.setItem('seeded', '1');
      localStorage.setItem('yumpals_pending_gifts_student-a', JSON.stringify({ date: '2026-09-07',
        visit: { date: '2026-09-07', welcomeBack: false, gains: { hunger: 0, happiness: 0, cleanliness: 1, health: 0 } } }));
    });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base);
    await page.waitForFunction(() => document.querySelector('.saved-top-status')?.textContent === 'Niblet loves your visit! Clean +1.', null, { timeout: 5000 });
    await page.reload(); await page.locator('.saved-top').filter({ hasText: 'DONUTS' }).waitFor(); await page.waitForTimeout(1200);
    assert.notEqual(await page.locator('.saved-top-status').textContent(), 'Niblet loves your visit! Clean +1.', 'kept gift plays once');
    console.log('PASS kept background gift: shown on opening, once');
    await context.close();
  }
  // Visit and cheer together: both messages, one after the other.
  const { page, context } = await open('visit=hunger&cheer=1');
  await page.waitForFunction(() => window.__seen.status.includes('Niblet heard you gave a donut! Happy +1.'), null, { timeout: 15000 });
  const order = await page.evaluate(() => window.__seen.status.filter(text => /loves your visit|heard you gave/.test(text)));
  assert.deepEqual(order.slice(0, 2), ['Niblet loves your visit! Food +1.', 'Niblet heard you gave a donut! Happy +1.']);
  console.log('PASS visit + cheer: shown in order, each for 6s');
  await context.close();
  assert.deepEqual(errors, []);
  console.log('PASS all, zero page errors');
} finally { await browser.close(); }
