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

try {
  // 1. Perfect show by tapping: 15 takes, no lives lost, 2 donuts.
  let page = await open(390);
  const reactions = [];
  for (let n = 0; n < 15; n++) {
    const camera = await nextTake(page);
    const t = Date.now();
    await page.getByRole('button', { name: new RegExp(`^Camera ${camera},`) }).click();
    reactions.push(Date.now() - t);
    if (n === 7) await page.screenshot({ path: `${shots}/vision-mixer-390-playing.png` });
  }
  await page.getByText("THAT'S A WRAP!").waitFor();
  assert.equal(await page.getByText('You earned 2 donuts!').count(), 1);
  const wins = JSON.parse(await page.locator('#fixture-wins').textContent());
  assert.deepEqual(wins, [{ type: 'donut', amount: 2, label: 'Vision Mixer Perfect Show', icon: '🎛️' }], 'onWin called exactly once with 2 donuts');
  await page.screenshot({ path: `${shots}/vision-mixer-390-won.png` });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'no horizontal overflow at 390px');
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('button', { name: 'Open Vision Mixer' }).click();
  await page.getByText('DAILY LIMIT REACHED').waitFor();
  console.log(`PASS perfect show at 390px: 15/15, 2 donuts, reward once, daily lock; tap-to-cut ${Math.min(...reactions)}–${Math.max(...reactions)}ms`);
  await page.close();

  // 2. One early press, then 15 takes by keyboard: 1 donut.
  page = await open(1280);
  await waitReady(page);
  await page.keyboard.press('1');
  await page.getByText('Too early. Wait for TAKE.').waitFor();
  for (let n = 0; n < 15; n++) await page.keyboard.press(String(await nextTake(page)));
  await page.getByText('You earned 1 donut!').waitFor();
  assert.equal(JSON.parse(await page.locator('#fixture-wins').textContent()).length, 1);
  console.log('PASS keyboard show with one early press: 1 donut');
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
  assert.equal(await page.getByText('Takes: 0/15').count(), 1);
  console.log('PASS three misses end the show, no reward, Try again resets');
  await page.close();

  assert.deepEqual(errors, []);
  console.log(`PASS all; elapsed ${Math.round(performance.now() - started)}ms`);
} finally { await browser.close(); }
