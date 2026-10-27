// Plays Vision Mixer on the synthetic preview page (no account or donuts).
// Usage: node verification/vision-mixer-check.mjs [port]
// Set PLAYWRIGHT_MODULE to a playwright index.mjs path if it is not installed here.
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ headless: true });
const base = `http://localhost:${process.argv[2] || '5174'}/yum-donut/verification/vision-mixer.html`;
const shots = process.env.SCREENSHOT_DIR || '.';
const started = performance.now();
const errors = [];

async function open(width, height = 800) {
  const page = await browser.newPage({ viewport: { width, height } });
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(base);
  await page.getByRole('button', { name: 'START THE SHOW' }).click();
  return page;
}
// Waits for the next "TAKE n!" and returns n.
const nextTake = page => page.waitForFunction(() => {
  const match = document.querySelector('[role="status"]')?.textContent.match(/^TAKE (\d)!$/);
  return match ? Number(match[1]) : false;
}, null, { timeout: 5000, polling: 20 }).then(handle => handle.jsonValue());
const waitReady = page => page.waitForFunction(() => /^Ready Cam \d/.test(document.querySelector('[role="status"]')?.textContent || ''), null, { timeout: 5000, polling: 20 });
// Plays a whole show inside the page like a listening player: remembers the last
// Ready camera (following changes of mind), cuts on TAKE, does nothing on HOLD.
const playShow = (page, options) => page.evaluate(async ({ mode, earlyFirst, screenshotAt }) => {
  const status = () => document.querySelector('[role="status"]')?.textContent || '';
  const press = n => mode === 'key'
    ? window.dispatchEvent(new KeyboardEvent('keydown', { key: String(n) }))
    : document.querySelector(`button[aria-label^="Camera ${n},"]`).click();
  const seen = { takes: 0, unnumbered: 0, decoys: 0, holds: 0, heldOk: 0, windows: [], stagePaused: false };
  let readyCamera = null; let last = ''; let early = earlyFirst;
  const t0 = performance.now();
  while (performance.now() - t0 < 180000) {
    const text = document.body.innerText;
    if (text.includes("THAT'S A WRAP!") || text.includes('OFF AIR')) break;
    const s = status();
    if (s !== last) {
      last = s;
      let m;
      if ((m = s.match(/^Ready Cam (\d)…$/))) { readyCamera = Number(m[1]); if (early) { early = false; press(readyCamera); } }
      else if ((m = s.match(/^No, Ready Cam (\d)!$/))) { readyCamera = Number(m[1]); seen.decoys++; }
      else if (s === 'HOLD!') seen.holds++;
      else if (s === 'Good hold.') seen.heldOk++;
      else if ((m = s.match(/^TAKE( \d)?!$/))) {
        if (!m[1]) seen.unnumbered++;
        const bar = document.querySelector('[style*="vision-mixer-drain"]');
        if (bar) seen.windows.push(parseInt(bar.style.animation.match(/(\d+)ms/)[1], 10));
        press(readyCamera);
        seen.takes++;
        if (seen.takes === screenshotAt) window.__visionMixerShot = true;
      }
    }
    await new Promise(r => setTimeout(r, 5));
  }
  seen.seconds = Math.round((performance.now() - t0) / 1000);
  return seen;
}, { mode: 'click', earlyFirst: false, screenshotAt: 0, ...options });

try {
  // 1. Perfect show by tapping: 20 takes through all three stages, no lives lost, 2 donuts.
  let page = await open(390);
  const perfect = await playShow(page);
  await page.getByText("THAT'S A WRAP!").waitFor();
  assert.equal(perfect.takes, 20);
  assert.ok(perfect.unnumbered >= 10, 'TAKE drops the number from stage 2');
  assert.equal(perfect.holds, perfect.heldOk, 'every hold survived by not cutting');
  assert.equal(Math.max(...perfect.windows), 1500);
  assert.equal(Math.min(...perfect.windows), 500, 'take window reaches half a second');
  assert.equal(await page.getByText('You earned 2 donuts!').count(), 1);
  const wins = JSON.parse(await page.locator('#fixture-wins').textContent());
  assert.deepEqual(wins, [{ type: 'donut', amount: 2, label: 'Vision Mixer Perfect Show', icon: '🎛️' }], 'onWin called exactly once with 2 donuts');
  await page.screenshot({ path: `${shots}/vision-mixer-390-won.png` });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'no horizontal overflow at 390px');
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('button', { name: 'Open Vision Mixer' }).click();
  await page.getByText('DAILY LIMIT REACHED').waitFor();
  console.log(`PASS perfect show at 390px: 20/20 in ${perfect.seconds}s, ${perfect.unnumbered} unnumbered TAKEs, ${perfect.decoys} changes of mind, ${perfect.holds} holds held, take window ${Math.max(...perfect.windows)}→${Math.min(...perfect.windows)}ms, 2 donuts once, daily lock`);
  await page.close();

  // 2. One early press, then a full show by keyboard: 1 donut.
  page = await open(1280);
  const keyed = await playShow(page, { mode: 'key', earlyFirst: true });
  await page.getByText('You earned 1 donut!').waitFor();
  assert.equal(JSON.parse(await page.locator('#fixture-wins').textContent()).length, 1);
  console.log(`PASS keyboard show with one early press: 1 donut (${keyed.takes} takes, ${keyed.decoys} changes of mind, ${keyed.holds} holds)`);
  await page.close();

  // 2b. Cutting to the decoy camera after a change of mind costs a life.
  page = await open(1280);
  await page.evaluate(async () => {
    const status = () => document.querySelector('[role="status"]')?.textContent || '';
    let decoy = null; let last = '';
    const t0 = performance.now();
    while (performance.now() - t0 < 120000) {
      const s = status();
      if (s !== last) {
        last = s; let m;
        if ((m = s.match(/^Ready Cam (\d)…$/))) decoy = Number(m[1]);
        else if (/^No, Ready Cam \d!$/.test(s)) { /* keep the decoy */ }
        else if ((m = s.match(/^TAKE( \d)?!$/))) {
          const changed = document.body.dataset.sawChange === '1';
          document.querySelector(`button[aria-label^="Camera ${changed ? decoy : (m[1] ? m[1].trim() : decoy)},"]`).click();
          if (changed) return;
        }
        document.body.dataset.sawChange = /^No, Ready Cam/.test(s) ? '1' : (/^Ready Cam/.test(s) ? '0' : document.body.dataset.sawChange);
      }
      await new Promise(r => setTimeout(r, 5));
    }
  });
  await page.waitForFunction(() => document.querySelector('[role="status"]')?.textContent === 'Wrong camera!', null, { timeout: 5000, polling: 10 });
  console.log('PASS cutting to the decoy after a change of mind is a wrong cut');
  await page.close();

  // 3. Three missed takes end the show; Try again restarts cleanly.
  page = await open(320, 640);
  for (let n = 0; n < 3; n++) { await nextTake(page); await page.waitForFunction(() => document.querySelector('[role="status"]')?.textContent === 'Missed the take!', null, { timeout: 5000, polling: 20 }); }
  await page.getByText('OFF AIR').waitFor();
  assert.equal(await page.locator('#fixture-wins').textContent(), '[]', 'no reward for a lost show');
  const box = await page.getByRole('button', { name: /^Camera 4,/ }).boundingBox();
  assert.ok(box.y + box.height <= 640, 'all cameras visible on a 320×640 screen');
  await page.screenshot({ path: `${shots}/vision-mixer-320-lost.png` });
  await page.getByRole('button', { name: 'Try again' }).click();
  await waitReady(page);
  assert.equal(await page.getByText('Takes: 0/20').count(), 1);
  console.log('PASS three misses end the show, no reward, Try again resets');
  await page.close();

  assert.deepEqual(errors, []);
  console.log(`PASS all; elapsed ${Math.round(performance.now() - started)}ms`);
} finally { await browser.close(); }
