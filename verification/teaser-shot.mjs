// Renders verification/teaser.html to a 2400x1350 PNG (1200x675 at 2x).
// Usage: node verification/teaser-shot.mjs [port] [out]
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 675 }, deviceScaleFactor: 2 });
  await page.goto(`http://localhost:${process.argv[2] || '5174'}/yum-donut/verification/teaser.html`);
  await page.locator('.donut-lcd').waitFor(); await page.waitForTimeout(400);
  await page.locator('.teaser').screenshot({ path: process.argv[3] || 'donut-pal-teaser.png' });
} finally { await browser.close(); }
