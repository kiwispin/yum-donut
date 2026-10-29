// Plays the Donut pal preview end to end on the test page (no account, no server):
// hatching, every icon, the game, mess, sickness and medicine, growing up, night
// lights, keyboard keys, and layout at phone and desktop sizes.
// Usage: node verification/donut-pal-check.mjs [port]  (PLAYWRIGHT_MODULE, SCREENSHOT_DIR)
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ headless: true });
const url = `http://localhost:${process.argv[2] || '5174'}/yum-donut/verification/donut-pal.html`;
const shots = process.env.SCREENSHOT_DIR || '.';
const results = []; const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(ok ? 'PASS' : 'FAIL', name, detail); };
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(url); await page.evaluate(() => localStorage.clear()); await page.reload();
  const label = () => page.locator('.donut-lcd').getAttribute('aria-label');
  const caption = () => page.locator('.donut-caption').innerText();
  const tools = () => page.locator('.donut-tools-clock').innerText();
  const tool = name => page.getByRole('button', { name, exact: true }).click();
  const press = name => page.locator('.donut-button', { hasText: name }).click();
  const settle = () => page.waitForTimeout(5200); // longest animation is 10 frames of 450ms
  const icon = async name => { await page.getByRole('button', { name, exact: true }).click(); await page.getByRole('button', { name, exact: true }).click(); };

  check('starts as an egg', (await label()).includes('is an egg'));
  await tool('Next morning'); await tool('+1 hour'); await tool('+1 hour'); await settle();
  check('hatches into a baby', (await label()).startsWith('Pip is a baby'), await label());

  let meals = 0;
  for (let i = 0; i < 6; i++) {
    await icon('Food'); await press('B'); await page.waitForTimeout(300);
    const text = await caption(); if (text === 'Yum!') meals++; await settle();
    if (text === 'Your pal is full.') break;
  }
  check('meals are free and stop when full', meals >= 1 && (await label()).includes('Food 4 of 4') && (await tools()).includes('10 pretend'), `${meals} meals; ${await tools()}`);

  await icon('Play');
  check('game starts with a hint', (await caption()).includes('A left, B right'));
  for (let round = 0; round < 5; round++) { await press(round % 2 ? 'A' : 'B'); await page.waitForTimeout(1600); }
  await page.waitForTimeout(400);
  const gameText = await caption();
  check('game ends with a result', gameText.startsWith('You won!') || gameText.startsWith('Close!'), gameText);
  await settle();

  await tool('+6 hours'); await tool('+1 hour'); await tool('+1 hour'); await page.waitForTimeout(600);
  check('a mess appears and the light turns on', (await label()).includes('mess') && await page.locator('.donut-led.is-on').count() === 1, await label());
  await icon('Clean'); await page.waitForTimeout(300);
  check('clean clears the mess', (await caption()) === 'All clean!' && !(await label()).includes('mess'));
  await settle();

  await icon('Food'); await press('A'); await press('B'); await page.waitForTimeout(300);
  check('a cupcake treat costs 1 pretend donut', (await caption()).startsWith('A cupcake treat') && (await tools()).includes('9 pretend'), await tools());
  await settle();

  await icon('Medicine'); await page.waitForTimeout(300);
  check('medicine is refused when well', (await caption()) === 'Your pal is not sick.');
  await settle();

  for (let i = 0; i < 3 && !(await label()).includes('sick'); i++) { await tool('Next morning'); await tool('+6 hours'); await tool('+6 hours'); }
  await page.waitForTimeout(600);
  check('neglect makes the pal sick', (await label()).includes('sick'), await label());
  await icon('Play'); await page.waitForTimeout(300);
  check('a sick pal will not play', (await caption()).includes('too sick'));
  await settle();
  await icon('Medicine'); await page.waitForTimeout(300);
  check('one dose of medicine cures', (await caption()) === 'All better!' && !(await label()).includes('sick'));
  await settle();

  // Good care on school days grows the pal: child after 2 care days, adult after 5.
  const stages = new Set();
  for (let day = 0; day < 8 && !(await tools()).includes('adult'); day++) {
    await tool('Next morning'); await tool('+1 hour'); await page.waitForTimeout(500);
    if ((await label()).includes('sick')) { await icon('Medicine'); await settle(); }
    if ((await label()).includes('mess')) { await icon('Clean'); await settle(); }
    await icon('Food'); await press('B'); await settle();
    stages.add((await tools()).split(' · ')[1]);
  }
  check('grows from baby to child to adult', stages.has('child') && (await tools()).includes('adult'), [...stages].join(', '));
  await page.screenshot({ path: `${shots}/donut-adult-390.png` });

  await tool('Next morning'); for (let i = 0; i < 14; i++) await tool('+1 hour'); await page.waitForTimeout(600);
  check('asleep at night', (await label()).includes('asleep'), await label());
  await icon('Food'); await page.waitForTimeout(300);
  check('no feeding while asleep', (await caption()).includes('asleep'));
  await settle();
  await icon('Lights'); await page.waitForTimeout(300);
  check('lights off at night', (await caption()) === 'Lights off. Sleep tight.');
  await page.screenshot({ path: `${shots}/donut-night-390.png` });
  await settle();

  await press('C'); await page.keyboard.press('a');
  check('keyboard A selects the first icon', await page.getByRole('button', { name: 'Food', exact: true }).getAttribute('aria-pressed') === 'true');
  await page.keyboard.press('c');

  for (const [width, height] of [[320, 640], [390, 844], [1280, 900]]) {
    await page.setViewportSize({ width, height }); await page.waitForTimeout(300);
    const layout = await page.evaluate(() => {
      const r = el => el.getBoundingClientRect();
      const device = r(document.querySelector('.donut-device')); const lcd = r(document.querySelector('.donut-lcd'));
      const buttons = [...document.querySelectorAll('.donut-button')].map(r); const icons = [...document.querySelectorAll('.donut-icon')].map(r);
      return { overflow: document.documentElement.scrollWidth > innerWidth, deviceLeft: device.left, deviceRight: device.right, lcdW: Math.round(lcd.width),
        minButton: Math.round(Math.min(...buttons.map(b => b.width))), minIcon: Math.round(Math.min(...icons.map(b => b.height))),
        buttonsInside: buttons.every(b => b.bottom < device.bottom) };
    });
    check(`layout at ${width}px`, !layout.overflow && layout.deviceLeft >= 0 && layout.deviceRight <= width && layout.minButton >= 40 && layout.minIcon >= 32 && layout.buttonsInside, JSON.stringify(layout));
    await page.screenshot({ path: `${shots}/donut-${width}.png` });
  }
  check('no page errors', errors.length === 0, errors.join(' | '));
} finally { await browser.close(); }
const failed = results.filter(r => !r.ok).length;
console.log(`${results.length - failed}/${results.length} passed`); process.exit(failed ? 1 : 0);
