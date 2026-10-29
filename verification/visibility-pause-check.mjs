// The background check pauses while the Donut pal is open, keeps YumPals visible,
// and resumes afterwards. Usage: node verification/visibility-pause-check.mjs [port]
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ headless: true });
const results = []; const check = (name, ok, detail = '') => { results.push(ok); console.log(ok ? 'PASS' : 'FAIL', name, detail); };
try {
  const page = await browser.newPage();
  await page.clock.install({ time: new Date('2026-11-01T21:00:00Z') });
  await page.goto(`http://localhost:${process.argv[2] || '5174'}/yum-donut/verification/visibility-pause.html`);
  await page.getByText('YumPals visible').waitFor();
  const reads = () => page.evaluate(() => window.__reads);
  const focus = () => page.evaluate(() => window.dispatchEvent(new Event('focus')));
  const start = await reads();
  await focus(); await page.waitForTimeout(200);
  check('a focus reads again while not paused', await reads() === start + 1);
  await page.getByRole('button', { name: 'Pause' }).click();
  const paused = await reads();
  await focus(); await page.clock.fastForward('02:00'); await page.waitForTimeout(200);
  check('paused: no reads on focus or the minute timer', await reads() === paused, `${await reads() - paused} extra`);
  check('paused: YumPals stays visible', await page.getByText('YumPals visible').isVisible());
  await page.getByRole('button', { name: 'Unpause' }).click();
  await focus(); await page.waitForTimeout(200);
  check('unpaused: reads resume', await reads() === paused + 1);
} finally { await browser.close(); }
const failed = results.filter(ok => !ok).length;
console.log(`${results.length - failed}/${results.length} passed`); process.exit(failed ? 1 : 0);
