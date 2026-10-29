// Measures the visible gaps below the saved YumPals handheld (text to text, box to
// box), plus no-jump checks, on the app-like test page (no account).
// Usage: node verification/bottom-spacing-measure.mjs [port]  (PLAYWRIGHT_MODULE, SCREENSHOT_DIR, LABEL)
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ headless: true });
const base = `http://localhost:${process.argv[2] || '5174'}/yum-donut/verification/saved-in-app.html`;
const shots = process.env.SCREENSHOT_DIR || '.'; const label = process.env.LABEL || 'measure';
try {
  for (const [width, height] of [[320, 640], [390, 844], [1280, 900]]) {
    const page = await browser.newPage({ viewport: { width, height }, reducedMotion: 'reduce' });
    await page.goto(base);
    await page.locator('.saved-top').filter({ hasText: 'DONUTS' }).waitFor();
    await page.waitForTimeout(500);
    const m = await page.evaluate(() => {
      const shell = document.querySelector('.saved-handheld');
      const textBox = el => { const range = document.createRange(); range.selectNodeContents(el); const r = range.getBoundingClientRect(); return { top: r.top + scrollY, bottom: r.bottom + scrollY }; };
      const box = el => { const r = el.getBoundingClientRect(); return { top: r.top + scrollY, bottom: r.bottom + scrollY }; };
      const parts = [
        ['handheld', box(shell.querySelector('.paid-demo-device'))],
        ['hint text', textBox(shell.querySelector('.paid-hint-current'))],
        ['counters', box(shell.querySelector('.paid-demo-meta'))],
        ['Refresh pal text', textBox(shell.querySelector('.saved-refresh-link'))],
        ['How to play box', box(shell.querySelector('details.paid-demo-inspector'))],
        ['page end', { top: box(shell).bottom, bottom: box(shell).bottom }],
      ];
      const gaps = {};
      for (let i = 1; i < parts.length; i++) gaps[`${parts[i - 1][0]} → ${parts[i][0]}`] = Math.round(parts[i][1].top - parts[i - 1][1].bottom);
      return { gaps, belowHandheld: Math.round(box(shell).bottom - parts[0][1].bottom) };
    });
    // No jump: hovering each icon must not move anything below the handheld.
    const positions = () => page.evaluate(() => ['.paid-demo-meta', '.saved-utilities', 'details.paid-demo-inspector'].map(s => Math.round(document.querySelector(s).getBoundingClientRect().top + scrollY)).join(','));
    const start = await positions(); let moved = 0;
    for (const icon of await page.locator('.paid-icon-button').all()) { await icon.hover(); if (await positions() !== start) moved++; }
    console.log(label, `${width}x${height}`, JSON.stringify({ ...m, iconHoverMoves: moved }));
    await page.locator('.paid-demo-device').scrollIntoViewIfNeeded();
    await page.evaluate(() => window.scrollBy(0, 360));
    await page.screenshot({ path: `${shots}/spacing-${label}-${width}.png` });
    await page.close();
  }
} finally { await browser.close(); }
