// First visit: YumPals waits for the server. Return visit: it shows at once.
// Switched off: it goes away and stays away next time.
// Usage: node verification/visibility-remember-check.mjs [port]
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ headless: true });
const base = `http://localhost:${process.argv[2] || '5174'}/yum-donut/verification/visibility-remember.html`;
const results = []; const check = (name, ok, detail = '') => { results.push(ok); console.log(ok ? 'PASS' : 'FAIL', name, detail); };
const shownAt = async (page, url) => {
  await page.goto(url); const start = Date.now();
  await page.getByRole('button', { name: 'Give' }).waitFor();
  const early = await page.getByRole('button', { name: 'YumPals' }).isVisible();
  const answeredEarly = await page.evaluate(() => window.__answered);
  await page.waitForTimeout(2600);
  return { early, answeredEarly, late: await page.getByRole('button', { name: 'YumPals' }).isVisible(), ms: Date.now() - start };
};
try {
  const page = await browser.newPage();
  const first = await shownAt(page, `${base}?delay=2000&enabled=1`);
  check('first visit: waits for the server, then shows', !first.early && first.late, JSON.stringify(first));
  const again = await shownAt(page, `${base}?delay=2000&enabled=1`);
  check('return visit: shows at once, before the server answers', again.early && !again.answeredEarly && again.late, JSON.stringify(again));
  const off = await shownAt(page, `${base}?delay=2000&enabled=0`);
  check('switched off: shown from memory, then removed when the server says off', off.early && !off.late, JSON.stringify(off));
  const afterOff = await shownAt(page, `${base}?delay=2000&enabled=0`);
  check('and not shown next time', !afterOff.early && !afterOff.late, JSON.stringify(afterOff));
} finally { await browser.close(); }
const failed = results.filter(ok => !ok).length;
console.log(`${results.length - failed}/${results.length} passed`); process.exit(failed ? 1 : 0);
