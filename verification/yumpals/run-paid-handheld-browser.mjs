// Parent-owned local presentation checks. No real account, external request or
// production endpoint is used. Supply an installed Playwright package/browser.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.YUMPALS_PLAYWRIGHT_MODULE || 'playwright');
const origin = 'http://127.0.0.1:5173';
const url = `${origin}/yum-donut/verification/yumpals/paid-handheld.html`;
const output = await mkdtemp(path.join(tmpdir(), 'yumpals-saved-browser-'));
let checks = 0;
const started = Date.now();
const browser = await chromium.launch({ headless: true,
  ...(process.env.YUMPALS_BROWSER_EXECUTABLE ? { executablePath: process.env.YUMPALS_BROWSER_EXECUTABLE } : {}) });
let page;
try {
  const context = await browser.newContext({ viewport: { width: 1100, height: 1000 }, reducedMotion: 'no-preference' });
  const outside = []; const errors = [];
  await context.route('**/*', route => {
    if (new URL(route.request().url()).origin === origin) return route.continue();
    outside.push(route.request().url()); return route.abort();
  });
  page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
  const handheld = page.getByRole('region', { name: 'Saved YumPals handheld', exact: true });
  const controls = page.getByRole('complementary', { name: 'Separate synthetic test controls' });
  const b = handheld.getByRole('button', { name: 'B CONFIRM', exact: true });
  const c = handheld.getByRole('button', { name: 'C CANCEL', exact: true });
  const pass = message => { checks++; console.log(`PASS ${message}`); };
  const fresh = async () => {
    await page.goto(url);
    await page.getByRole('heading', { name: 'Local test account — no real donuts', exact: true }).waitFor();
    await handheld.getByText('17 DONUTS', { exact: true }).waitFor();
  };
  const fixture = async pattern => {
    await controls.getByText(pattern).waitFor();
  };
  const openAction = async (icon, action) => {
    const iconButton = handheld.getByRole('button', { name: icon, exact: true });
    await iconButton.click();
    assert.equal(await iconButton.getAttribute('aria-pressed'), 'true', `${icon} must stay under the pointer when help appears`);
    assert.deepEqual(await iconButton.locator('.saved-icon > span').evaluateAll(nodes => [...new Set(nodes.map(node => getComputedStyle(node).backgroundColor).filter(color => color !== 'rgba(0, 0, 0, 0)'))]), ['rgb(245, 239, 172)'], 'selected icon pixels must contrast with the dark background');
    await b.click();
    if (action) await handheld.getByRole('button', { name: new RegExp(`^(?:▶ )?${action} `, 'u') }).click();
    await b.click();
  };
  await fresh();
  await fixture(/Balance 17 · Receipts 0 · Pending 0/u);
  for (const name of ['A SELECT', 'B CONFIRM', 'C CANCEL']) assert.equal(await handheld.getByRole('button', { name, exact: true }).count(), 1);
  assert.equal(await handheld.getByRole('button', { name: 'Food', exact: true }).getAttribute('title'), 'Food — Give a meal or snack to fill your pal’s tummy. Food hearts show how well fed your pal is.');
  await page.screenshot({ path: path.join(output, 'saved-desktop.png'), fullPage: true });
  pass('saved mount reads 17 synthetic donuts without adoption/payment and exposes classic controls/help');

  const feet = () => handheld.locator('.saved-blob > .saved-pixels > span').evaluateAll(nodes => nodes.slice(-64).map(node => node.getAttribute('style')));
  const beforeFeet = await feet();
  await page.waitForTimeout(2100);
  assert.deepEqual(await feet(), beforeFeet);
  pass('idle feet remain still across the former alternating-leg interval');

  await openAction('Food', 'Meal');
  await handheld.getByText('Cost 2 donuts', { exact: true }).waitFor();
  await fixture(/Balance 17 · Receipts 0 · Pending 0/u);
  await c.click(); await fixture(/Balance 17 · Receipts 0 · Pending 0/u);
  pass('price review and cancellation do not charge');

  await openAction('Food', 'Meal');
  await page.evaluate(() => {
    window.__observedFrames = [];
    const root = document.querySelector('[aria-label="Saved YumPals handheld"]');
    const record = () => {
      const sprite = root.querySelector('[data-frame-key]');
      if (sprite) {
        const next = `${sprite.dataset.frameKey}:${sprite.dataset.foodRemaining ?? ''}`;
        if (window.__observedFrames.at(-1) !== next) window.__observedFrames.push(next);
      }
    };
    window.__frameObserver = new MutationObserver(record);
    window.__frameObserver.observe(root, { subtree: true, attributes: true, childList: true }); record();
  });
  await b.click(); await fixture(/Balance 15 · Receipts 1 · Pending 0/u);
  await page.waitForFunction(() => window.__observedFrames.includes('feed-happy:0'));
  const frames = await page.evaluate(() => { window.__frameObserver.disconnect(); return window.__observedFrames.filter(value => value.startsWith('feed-')); });
  assert.deepEqual(frames, ['feed-open-1:3', 'feed-close-1:2', 'feed-open-2:2', 'feed-close-2:1', 'feed-open-3:1', 'feed-close-3:0', 'feed-happy:0']);
  await handheld.getByRole('img', { name: 'Niblet, resting', exact: true }).waitFor();
  await handheld.getByText('15 DONUTS', { exact: true }).waitFor();
  pass('one confirmed meal charges 2 and renders the exact seven open/close/disappearing-food frames');

  await openAction('Food', 'Meal');
  await handheld.getByText(/I’m full! No meal needed/u).waitFor();
  await fixture(/Balance 15 · Receipts 1 · Pending 0/u);
  assert.equal(await handheld.getByText(/\+0 Food/u).count(), 0);
  pass('full tummy gets plain-language feedback without a new purchase');

  await fresh();
  await controls.getByRole('button', { name: 'Drop next purchase reply', exact: true }).click();
  await openAction('Food', 'Meal'); await b.click();
  await fixture(/Balance 15 · Receipts 1 · Pending 1/u);
  await controls.getByRole('button', { name: 'Give +3', exact: true }).click();
  await controls.getByRole('button', { name: 'Remount same account', exact: true }).click();
  await handheld.getByRole('button', { name: 'Retry purchase', exact: true }).waitFor();
  await fixture(/Balance 18 · Receipts 1 · Pending 1/u);
  await handheld.getByRole('button', { name: 'Retry purchase', exact: true }).click();
  await handheld.getByText('18 DONUTS', { exact: true }).waitFor();
  await fixture(/Balance 18 · Receipts 1 · Pending 0/u);
  assert.equal(await handheld.getByRole('img', { name: 'Niblet, feed', exact: true }).count(), 0);
  pass('lost-reply remount keeps journal and explicit retry refreshes gifted balance with one receipt/no eating replay');

  await controls.getByRole('button', { name: 'Switch account', exact: true }).click();
  await handheld.getByText('17 DONUTS', { exact: true }).waitFor();
  assert.equal(await handheld.getByText('18 DONUTS', { exact: true }).count(), 0);
  pass('same-name account switch displays only the new owner wallet');

  await fresh();
  await controls.getByRole('button', { name: 'Give +3', exact: true }).click();
  await fixture(/Balance 20 · Receipts 0 · Pending 0/u);
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await handheld.getByText('20 DONUTS', { exact: true }).waitFor();
  await fixture(/Balance 20 · Receipts 0 · Pending 0/u);
  pass('returning focus refreshes the current wallet without buying care');

  await fresh();
  await controls.getByRole('button', { name: 'Hold next purchase reply', exact: true }).click();
  await openAction('Food', 'Meal'); await b.click();
  await fixture(/Balance 15 · Receipts 1 · Pending 1/u);
  await controls.getByRole('button', { name: 'Switch account', exact: true }).click();
  await handheld.getByText('17 DONUTS', { exact: true }).waitFor();
  await controls.getByRole('button', { name: 'Release held replies', exact: true }).click();
  await fixture(/Account fixture-other · Balance 17 · Receipts 1 · Pending 1/u);
  assert.equal(await handheld.getByRole('button', { name: 'Retry purchase', exact: true }).count(), 0);
  assert.equal(await handheld.getByRole('img', { name: 'Niblet, feed', exact: true }).count(), 0);
  await controls.getByRole('button', { name: 'Switch account', exact: true }).click();
  await handheld.getByRole('button', { name: 'Retry purchase', exact: true }).click();
  await fixture(/Account fixture-student · Balance 15 · Receipts 1 · Pending 0/u);
  pass('late reply after unmount/account switch leaves original recovery intact and never animates or spends for the other owner');

  await fresh();
  await controls.getByRole('button', { name: 'Toggle paused', exact: true }).click();
  await handheld.getByText(/Your teacher has paused care/u).waitFor();
  await openAction('Food', 'Meal');
  await fixture(/Balance 17 · Receipts 0 · Pending 0/u);
  assert.equal(await handheld.getByText('Cost 2 donuts', { exact: true }).count(), 0);
  pass('paused care preserves the saved pet and cannot reach payment');

  await fresh();
  await controls.getByRole('button', { name: 'Unavailable wallet', exact: true }).click();
  await handheld.getByText('DONUTS —', { exact: true }).waitFor();
  assert.equal(await handheld.getByText('0 DONUTS', { exact: true }).count(), 0);
  await openAction('Food', 'Meal');
  await fixture(/Balance unavailable · Receipts 0 · Pending 0/u);
  pass('unavailable funds are not displayed as zero and cannot reach payment');

  await fresh();
  await openAction('Game', 'Game');
  await handheld.getByText('Game is not ready yet. Pat is available.', { exact: true }).waitFor();
  await fixture(/Balance 17 · Receipts 0 · Pending 0/u);
  pass('unfinished game is not sold');

  await fresh();
  await controls.getByRole('button', { name: 'Night', exact: true }).click();
  await handheld.getByRole('img', { name: 'Niblet, sleep', exact: true }).waitFor();
  await openAction('Lights', 'Bedtime'); await b.click();
  await fixture(/Balance 16 · Receipts 1 · Pending 0/u);
  await handheld.locator('.paid-demo-lcd.is-sleeping.is-bedtime-set').waitFor();
  await page.screenshot({ path: path.join(output, 'saved-night.png'), fullPage: true });
  pass('trusted 19:00 quote shows sleep and confirmed bedtime dims the LCD for one donut');

  await fresh();
  await controls.getByRole('button', { name: 'Petless', exact: true }).click();
  await handheld.getByText('No pal yet. B to adopt.', { exact: true }).waitFor();
  await fixture(/Balance 17 · Receipts 0 · Pending 0/u);
  await b.click(); await handheld.getByLabel('Name', { exact: true }).fill('Mochi'); await b.click();
  await handheld.getByText('Cost 5 donuts', { exact: true }).waitFor();
  await b.click(); await fixture(/Balance 12 · Receipts 1 · Pending 0/u);
  await handheld.getByRole('img', { name: 'Mochi, resting', exact: true }).waitFor();
  pass('petless read does not adopt; named adoption requires separate review/payment and charges exactly five');

  await fresh(); await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: path.join(output, 'saved-mobile.png'), fullPage: true });
  assert.equal(await handheld.evaluate(node => node.scrollWidth <= node.clientWidth + 1), true);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openAction('Food', 'Meal'); await b.click();
  await fixture(/Balance 15 · Receipts 1 · Pending 0/u);
  await handheld.getByRole('img', { name: 'Niblet, resting', exact: true }).waitFor();
  pass('390px layout has no horizontal overflow and reduced-motion care completes normally');
  assert.deepEqual(errors, []); assert.deepEqual(outside, []);
  pass('no browser errors or attempted external network requests');
  console.log(`SAVED_HANDHELD_BROWSER_PASS checks=${checks} elapsedMs=${Date.now() - started} artifacts=${output}`);
} catch (error) {
  if (page) {
    await page.screenshot({ path: path.join(output, 'failure.png'), fullPage: true });
    await writeFile(path.join(output, 'failure.txt'), await page.locator('body').innerText());
  }
  console.error(`SAVED_HANDHELD_BROWSER_FAIL checks=${checks} artifacts=${output}`);
  throw error;
} finally { await browser.close(); console.log('SAVED_HANDHELD_BROWSER_CLEANUP_PASS'); }
