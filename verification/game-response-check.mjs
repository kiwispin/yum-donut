import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { chromium } from '/Users/crayner/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const require = createRequire(import.meta.url);
const { setup, request } = require('../functions/test/paidCareFixture.js');
const { createPaidCareCallables } = require('../functions/src/yumpals/paidCareCallables.js');
const { createSavedGameService } = require('../functions/src/yumpals/savedGameService.js');
const browser = await chromium.launch({ headless: true, executablePath: '/Users/crayner/Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing' });
try {
  for (const saved of [false, true]) {
    const f = setup({ needs: { hunger: 2, happiness: 0, cleanliness: 2, health: 2 } });
    f.refs.refusal = (uid, id) => `refusals/${uid}/${id}`;
    f.refs.game = (uid, id) => `games/${uid}/${id}`; f.refs.gameTurn = (uid, id) => `turns/${uid}/${id}`;
    const now = () => Date.parse('2026-09-07T00:00:00Z');
    const care = createPaidCareCallables({ ...f, HttpsError: Error, ready: () => true, now });
    const game = createSavedGameService({ ...f, ready: () => true, now, chooseTarget: () => 'left' });
    if (saved) await f.service.purchase(f.purchaseRequest('game', 'existing-game'));
    const page = await browser.newPage({ viewport: { width: 390, height: 1000 } });
    await page.addInitScript(() => {
      window.gamePaints = []; let previous = '';
      new MutationObserver(() => {
        const text = document.querySelector('.saved-status > strong')?.textContent || '';
        if (text && text !== previous) { previous = text; requestAnimationFrame(() => window.gamePaints.push({ text, at: performance.now() })); }
      }).observe(document, { subtree: true, childList: true, characterData: true });
    });
    const calls = []; const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.route('**/__speed*-api/*', async route => {
      const name = route.request().url().split('/').at(-1); const data = route.request().postDataJSON().data;
      calls.push(name); await new Promise(resolve => setTimeout(resolve, 300));
      const method = { yumpalsGetPaidCareState: care.getState, yumpalsPurchaseCare: care.purchase,
        yumpalsGetSavedGame: game.getGame, yumpalsChooseSavedGame: game.choose }[name];
      assert.ok(method); await route.fulfill({ json: { result: await method(request('student-a', data)) } });
    });
    const preloadedGame = saved ? page.waitForResponse(response => response.url().endsWith('yumpalsGetSavedGame')) : null;
    await page.goto('http://127.0.0.1:5174/yum-donut/verification/care-speed.html?strict=1&game=1');
    await page.locator('.saved-top').getByText(`${saved ? 28 : 30} DONUTS`).waitFor();
    if (saved) await preloadedGame;
    await page.getByRole('button', { name: 'Game', exact: true }).click();
    await page.keyboard.press('b');
    if (!saved) await page.keyboard.press('b');
    const at = await page.evaluate(() => performance.now()); await page.keyboard.press('b');
    await page.locator('.saved-status > strong').getByText('Round 1 of 3', { exact: true }).waitFor();
    await page.waitForFunction(() => window.gamePaints.some(p => p.text === 'Round 1 of 3'));
    const openingMs = await page.evaluate(at => Math.round(window.gamePaints.find(p => p.text === 'Round 1 of 3').at - at), at);
    assert.equal(calls.filter(n => n === 'yumpalsGetSavedGame').length, saved ? 1 : 0);
    const initialCalls = calls.length;
    await page.keyboard.press('c');
    await page.getByRole('button', { name: 'Game', exact: true }).click();
    await page.keyboard.press('b'); await page.keyboard.press('b');
    await page.locator('.saved-status > strong').getByText('Round 1 of 3', { exact: true }).waitFor();
    assert.equal(calls.length, initialCalls, 'pause/resume has no request');
    const rounds = [];
    for (let i = 0; i < 3; i++) {
      const start = await page.evaluate(() => performance.now()); await page.keyboard.press('a');
      await page.locator('.saved-status > strong').getByText(i === 2 ? 'Finished! 3 of 3' : `Round ${i + 2} of 3`, { exact: true }).waitFor();
      await page.waitForFunction(i => window.gamePaints.some(p => p.text === (i === 2 ? 'Finished! 3 of 3' : `Round ${i + 2} of 3`)), i);
      rounds.push(await page.evaluate(({ start, i }) => Math.round(window.gamePaints.find(p => p.text === (i === 2 ? 'Finished! 3 of 3' : `Round ${i + 2} of 3`)).at - start), { start, i }));
      await page.waitForFunction(() => document.querySelector('.saved-blob')?.dataset.frameKey === 'idle-a');
    }
    assert.equal(calls.filter(n => n === 'yumpalsChooseSavedGame').length, 3);
    assert.equal(calls.filter(n => n === 'yumpalsGetSavedGame').length, saved ? 1 : 0);
    assert.equal(f.db.read('fixture/wallets/student-a').balance, 28);
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ saved, openingMs, rounds, calls, balance: 28 })); await page.close();
  }
} finally { await browser.close(); }
