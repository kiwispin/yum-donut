// Plays the real Donut pal handheld against the in-page stand-in server: the move
// to an egg, hatching, the visit gift, free care, a treat, the 5-round game, a
// dropped connection, adoption, a failed first load, and phone layout.
// Usage: node verification/donut-saved-check.mjs [port]  (PLAYWRIGHT_MODULE, SCREENSHOT_DIR)
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ headless: true });
const base = `http://localhost:${process.argv[2] || '5174'}/yum-donut/verification/donut-saved.html`;
const shots = process.env.SCREENSHOT_DIR || '.';
const results = []; const check = (name, ok, detail = '') => { results.push(ok); console.log(ok ? 'PASS' : 'FAIL', name, detail); };
const errors = [];
// A school morning (Monday 2 November 2026, 10am Auckland) for the page and the stand-in server.
const MORNING = new Date('2026-11-01T21:00:00Z');
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.clock.install({ time: MORNING });
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(base);
  const label = () => page.locator('.donut-lcd').getAttribute('aria-label');
  const caption = () => page.locator('.donut-caption').innerText();
  const press = name => page.locator('.donut-button', { hasText: name }).click();
  const icon = async name => { await page.getByRole('button', { name, exact: true }).click(); await page.getByRole('button', { name, exact: true }).click(); };
  const server = () => page.evaluate(() => ({ wallet: window.__fakeServer.state.wallet, acts: window.__fakeServer.state.acts.length, reads: window.__fakeServer.state.reads }));
  const settle = () => page.waitForTimeout(5200);
  await page.locator('.donut-lcd').waitFor();
  check('loads the moved pal as an egg, with its name', (await label()).includes('Niblet is an egg') && (await page.locator('.donut-pal-name').innerText()) === 'Niblet');
  await page.clock.fastForward('05:01');
  await page.waitForTimeout(1200);
  check('hatches after about 5 minutes', (await label()).startsWith('Niblet is a baby') && (await caption()) === 'It hatched!', `${await label()} | ${await caption()}`);
  await settle();
  await page.evaluate(() => window.dispatchEvent(new Event('focus'))); await page.waitForTimeout(1200);
  check('then the visit gift plays after the hatching', (await caption()) === 'Daily gift: +1 food', await caption());
  await settle();
  const before = await server();
  await icon('Food'); await press('B'); await page.waitForTimeout(400);
  check('a free meal goes to the server and plays', (await caption()) === 'Yum!' && (await server()).acts === before.acts + 1 && (await server()).wallet === before.wallet, JSON.stringify(await server()));
  await settle();
  await icon('Food'); await press('A'); await press('B'); await page.waitForTimeout(400);
  check('a treat spends 1 donut on the server', (await caption()) === 'Cupcake! -1 donut' && (await server()).wallet === before.wallet - 1, JSON.stringify(await server()));
  await settle();
  let refusedSent = null;
  for (let i = 0; i < 5 && refusedSent === null; i++) {
    const sent = (await server()).acts;
    await icon('Food'); await press('B'); await page.waitForTimeout(400);
    if ((await caption()) === 'Too full!') refusedSent = (await server()).acts - sent;
    await settle();
  }
  check('a refusal the rules predict (full) sends nothing', refusedSent === 0, `extra requests: ${refusedSent}`);
  await icon('Play');
  for (let round = 0; round < 5; round++) { await press(round % 2 ? 'A' : 'B'); await page.waitForTimeout(1700); }
  await page.waitForTimeout(400);
  const gameText = await caption();
  check('a 5-round game on the server ends with a result', gameText.startsWith('You won!') || gameText.startsWith('Close!'), gameText);
  await settle(); await press('C');
  await page.evaluate(() => window.__fakeServer.failNextAct());
  await page.clock.fastForward('06:01:00'); // six hours: hungry again await page.waitForTimeout(600); await settle();
  const sentBefore = (await server()).acts;
  await icon('Food'); await press('B'); await page.waitForTimeout(600);
  const dropped = await caption();
  check('a dropped connection is explained, not hidden', dropped === 'No signal. Try again.' && (await server()).acts === sentBefore + 1, dropped);
  await settle();
  await page.screenshot({ path: `${shots}/donut-saved-390.png` });
  const layout = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth > innerWidth, minButton: Math.min(...[...document.querySelectorAll('.donut-button')].map(b => b.getBoundingClientRect().width)) }));
  check('phone layout', !layout.overflow && layout.minButton >= 40, JSON.stringify(layout));

  const adopt = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await adopt.clock.install({ time: MORNING });
  adopt.on('pageerror', error => errors.push(error.message));
  await adopt.goto(`${base}?nopal=1`);
  await adopt.getByRole('button', { name: /Adopt an egg for 5 donuts/ }).waitFor();
  check('no pal: the adoption form, disabled until named', await adopt.getByRole('button', { name: /Adopt an egg/ }).isDisabled());
  await adopt.getByLabel('Name').fill('Sprinkle'); await adopt.getByLabel('Pufflet').check(); await adopt.getByLabel('Lemon').check();
  await adopt.getByRole('button', { name: /Adopt an egg/ }).click();
  await adopt.locator('.donut-lcd').waitFor();
  check('adopting gives an egg and spends 5 donuts', (await adopt.locator('.donut-lcd').getAttribute('aria-label')).includes('Sprinkle is an egg')
    && await adopt.evaluate(() => window.__fakeServer.state.wallet) === 0);

  const fail = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await fail.clock.install({ time: MORNING });
  fail.on('pageerror', error => errors.push(error.message));
  await fail.goto(`${base}?fail=1`);
  await fail.getByRole('button', { name: 'Try again' }).waitFor();
  check('a failed first load offers Try again', (await fail.locator('.donut-status-text').innerText()).includes('could not be reached'));
  await fail.getByRole('button', { name: 'Try again' }).click();
  await fail.locator('.donut-lcd').waitFor();
  check('and Try again loads the pal', (await fail.locator('.donut-lcd').getAttribute('aria-label')).includes('Niblet'));
  check('no page errors', errors.length === 0, errors.join(' | '));
} finally { await browser.close(); }
const failed = results.filter(ok => !ok).length;
console.log(`${results.length - failed}/${results.length} passed`); process.exit(failed ? 1 : 0);
