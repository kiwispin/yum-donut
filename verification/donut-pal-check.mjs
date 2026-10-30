// Plays the Donut pal preview end to end on the test page (no account, no server):
// hatching with empty hearts, every icon, the looping game and its score, weight,
// mess, sickness and 1-3 medicine doses, growing up through teen to a well-raised
// adult, night (only Lights and Status), the clock, the sound toggle, keyboard
// keys, and layout at phone and desktop sizes.
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
  check('hatches into a baby with empty hearts, calling', (await label()).startsWith('Pip is a baby, hungry, sad')
    && await page.locator('.donut-led.is-on').count() === 1, await label());

  let meals = 0;
  for (let i = 0; i < 6; i++) {
    await icon('Food'); await press('B'); await page.waitForTimeout(300);
    const text = await caption(); if (text === 'Yum!') meals++; await settle();
    if (text === 'Too full!') break;
  }
  check('meals are free and stop when full', meals >= 1 && (await label()).includes('Food 4 of 4') && (await tools()).includes('10 pretend'), `${meals} meals; ${await tools()}`);

  await icon('Play');
  check('game starts with a hint', (await caption()) === 'A=left B=right C=stop');
  for (let round = 0; round < 5; round++) { await press(round % 2 ? 'A' : 'B'); await page.waitForTimeout(1600); }
  await page.waitForTimeout(400);
  const gameText = await caption();
  check('game ends with a result', gameText.startsWith('You won!') || gameText.startsWith('Close!'), gameText);
  await settle();
  check('the next game starts by itself', (await page.locator('.donut-button').first().getAttribute('aria-label')) === 'A: guess left');
  await press('C');
  check('C stops the game', (await page.locator('.donut-button').first().getAttribute('aria-label')) === 'A: next icon');

  await tool('+6 hours'); await tool('+1 hour'); await tool('+1 hour'); await page.waitForTimeout(600);
  check('a mess appears and the light turns on', (await label()).includes('mess') && await page.locator('.donut-led.is-on').count() === 1, await label());
  await icon('Clean'); await page.waitForTimeout(300);
  check('clean clears the mess', (await caption()) === 'All clean!' && !(await label()).includes('mess'));
  await settle();

  await icon('Food'); await press('A'); await press('B'); await page.waitForTimeout(300);
  check('a cupcake treat costs 1 pretend donut', (await caption()) === 'Cupcake! -1 donut' && (await tools()).includes('9 pretend'), await tools());
  await settle();

  await icon('Medicine'); await page.waitForTimeout(300);
  check('medicine is refused when well', (await caption()) === 'Not sick!');
  await settle();

  for (let i = 0; i < 3 && !(await label()).includes('sick'); i++) { await tool('Next morning'); await tool('+6 hours'); await tool('+6 hours'); }
  await page.waitForTimeout(600);
  check('neglect makes the pal sick', (await label()).includes('sick'), await label());
  await icon('Play'); await page.waitForTimeout(300);
  check('a sick pal will not play', (await caption()) === 'Too sick! Medicine?');
  await settle();
  let doses = 0;
  for (; doses < 3 && (await label()).includes('sick'); doses++) { await icon('Medicine'); await page.waitForTimeout(300); await settle(); }
  check('1 to 3 doses of medicine cure', doses >= 1 && doses <= 3 && !(await label()).includes('sick'), `${doses} doses`);

  // Good care on school days grows the pal: child after 2 care days, teen after 4, adult after 7.
  const stages = new Set();
  for (let day = 0; day < 12 && !(await tools()).includes('adult'); day++) {
    await tool('Next morning'); await tool('+1 hour'); await page.waitForTimeout(500);
    for (let i = 0; i < 3 && (await label()).includes('sick'); i++) { await icon('Medicine'); await settle(); }
    if ((await label()).includes('mess')) { await icon('Clean'); await settle(); }
    await icon('Food'); await press('B'); await settle();
    stages.add((await tools()).split(' · ')[1]);
  }
  // The adult's form must match its care mistakes (4 or fewer: well-raised).
  const grown = await tools(); const mistakes = Number(grown.match(/care mistakes (\d+)/)[1]);
  check('grows from baby to child to teen to the adult its care earned', stages.has('child') && stages.has('teen')
    && grown.includes(mistakes <= 4 ? 'adult (good)' : 'adult (scruffy)'), `${[...stages].join(', ')}; ${mistakes} mistakes`);
  await page.screenshot({ path: `${shots}/donut-adult-390.png` });

  await tool('Next morning'); for (let i = 0; i < 14; i++) await tool('+1 hour'); await page.waitForTimeout(600);
  check('asleep at night', (await label()).includes('asleep'), await label());
  await icon('Food'); await page.waitForTimeout(300);
  check('no feeding while asleep', (await caption()) === 'Shh! Asleep.');
  await settle();
  await icon('Status'); await page.waitForTimeout(300);
  check('Status still works while asleep', (await page.locator('.donut-button').first().getAttribute('aria-label')) === 'A: next page');
  await press('C');
  await settle();
  await icon('Lights'); await page.waitForTimeout(300);
  check('lights off at night', (await caption()) === 'Lights off. Zzz');
  await page.screenshot({ path: `${shots}/donut-night-390.png` });
  await settle();

  await press('C'); await press('C'); await page.keyboard.press('a');
  check('keyboard A selects the first icon', await page.getByRole('button', { name: 'Food', exact: true }).getAttribute('aria-pressed') === 'true');
  await page.keyboard.press('c');
  await press('B');
  check('B with no icon shows the clock', (await page.locator('.donut-button').nth(1).getAttribute('aria-label')) === 'B: back');
  await press('B');
  check('sound starts off', (await tools()).includes('sound off'), await tools());
  await page.keyboard.down('c'); await page.keyboard.press('a'); await page.keyboard.up('c');
  check('hold C and press A turns sound on', (await tools()).includes('sound on') && (await caption()) === 'Sound on.');
  await page.keyboard.down('c'); await page.keyboard.press('a'); await page.keyboard.up('c');
  check('and off again', (await tools()).includes('sound off'));

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
