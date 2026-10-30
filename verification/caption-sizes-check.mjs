// Every caption must fit the fixed caption box at every width, so the box never
// changes size between messages. Usage: node verification/caption-sizes-check.mjs [port]
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ headless: true });
const results = []; const check = (name, ok, detail = '') => { results.push(ok); console.log(ok ? 'PASS' : 'FAIL', name, detail); };
try {
  for (const width of [320, 360, 390, 1280]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    await page.goto(`http://localhost:${process.argv[2] || '5174'}/yum-donut/verification/caption-sizes.html`);
    await page.locator('.donut-caption').first().waitFor();
    await page.evaluate(() => document.fonts.ready);
    const m = await page.evaluate(() => [...document.querySelectorAll('.donut-caption')].map(p => {
      const range = document.createRange(); range.selectNodeContents(p);
      const lines = new Set([...range.getClientRects()].map(r => Math.round(r.top))).size;
      return { text: p.textContent, lines, height: Math.round(p.getBoundingClientRect().height), overflow: p.scrollHeight > p.clientHeight + 1 };
    }));
    const heights = new Set(m.map(x => x.height)); const maxLines = Math.max(...m.map(x => x.lines));
    const over = m.filter(x => x.overflow).map(x => x.text);
    console.log(`${width}px: ${m.length} captions, lines max ${maxLines}, by lines`, JSON.stringify(m.reduce((a, x) => ({ ...a, [x.lines]: (a[x.lines] || 0) + 1 }), {})));
    check(`${width}px: every caption box is the same height`, heights.size === 1, [...heights].join(', '));
    check(`${width}px: no caption spills out of its box`, over.length === 0, over.join(' | '));
    await page.close();
  }
} finally { await browser.close(); }
const failed = results.filter(ok => !ok).length;
console.log(`${results.length - failed}/${results.length} passed`); process.exit(failed ? 1 : 0);
