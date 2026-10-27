// Measures the saved YumPals page layout on the synthetic test page (no account).
// Usage: node verification/tidy-up-measure.mjs [port]  (PLAYWRIGHT_MODULE selects Playwright)
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ headless: true });
const base = `http://localhost:${process.argv[2] || '5174'}/yum-donut/verification/saved-surround.html`;
const shots = process.env.SCREENSHOT_DIR || '.';
const label = process.env.LABEL || 'measure';
try {
  for (const [width, height] of [[390, 844], [1024, 900]]) {
    const page = await browser.newPage({ viewport: { width, height } });
    await page.goto(base);
    await page.locator('.saved-top').filter({ hasText: 'DONUTS' }).waitFor();
    const m = await page.evaluate(() => {
      const shell = document.querySelector('.saved-handheld');
      const device = shell.querySelector('.paid-demo-device');
      const y = el => Math.round(el.getBoundingClientRect().top + scrollY);
      const b = el => Math.round(el.getBoundingClientRect().bottom + scrollY);
      const scrollbars = [...shell.querySelectorAll('*')].filter(el => /auto|scroll/.test(getComputedStyle(el).overflowY) && el.scrollHeight > el.clientHeight + 1 && el.getBoundingClientRect().height > 2).length;
      return { pageTop: y(shell), deviceTop: y(device), deviceBottom: b(device), pageBottom: b(shell),
        aboveDevice: y(device) - y(shell), belowDevice: b(shell) - b(device), total: b(shell) - y(shell),
        wholeDeviceOnFirstScreen: b(device) <= innerHeight, strayScrollbars: scrollbars,
        visibleWordsBelow: [...shell.children].filter(el => el.compareDocumentPosition(device) & Node.DOCUMENT_POSITION_PRECEDING)
          .map(el => (el.getBoundingClientRect().height > 2 ? el.innerText : '')).join(' ').split(/\s+/).filter(Boolean).length,
        noHorizontalScroll: document.documentElement.scrollWidth <= innerWidth };
    });
    console.log(label, `${width}x${height}`, JSON.stringify(m));
    await page.screenshot({ path: `${shots}/tidy-${label}-${width}.png`, fullPage: true });
    await page.close();
  }
} finally { await browser.close(); }
