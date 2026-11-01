// Launch image for the Teams post: the real handheld on its packaging card at the
// moment an egg hatches ("It hatched!", "New pal!"), at 2x, from the stand-in
// server page. Usage: node verification/launch-shot.mjs [port] [out]
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 480, height: 800 }, deviceScaleFactor: 2 });
  await page.clock.install({ time: new Date('2026-11-01T21:00:00Z') }); // a school morning
  await page.goto(`http://localhost:${process.argv[2] || '5174'}/yum-donut/verification/donut-saved.html`);
  await page.locator('.donut-lcd').waitFor(); await page.evaluate(() => document.fonts.ready);
  await page.clock.fastForward('05:01');
  for (let i = 0; i < 40; i++) {
    await page.clock.runFor(150);
    const ready = await page.evaluate(() => document.querySelector('.donut-caption')?.textContent === 'It hatched!'
      && document.querySelector('.pack-burst span')?.textContent === 'New pal!');
    if (ready) break;
  }
  await page.clock.runFor(3150); // the last frame of the hatching: the baby, happy
  await page.evaluate(() => { document.querySelector('.donut-pal-name').textContent = 'Your pal'; });
  console.log('caption:', await page.locator('.donut-caption').textContent(), '| burst:', await page.locator('.pack-burst span').textContent());
  // The sticker and starburst stand out past the card, so keep a margin around it.
  const box = await page.locator('.pack-card').boundingBox(); const m = 34;
  await page.screenshot({ path: process.argv[3] || 'donut-pal-launch.png', clip: { x: box.x - m, y: box.y - m, width: box.width + 2 * m, height: box.height + m + 6 } });
} finally { await browser.close(); }
