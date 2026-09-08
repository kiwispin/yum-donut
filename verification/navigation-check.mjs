import { chromium } from '/Users/crayner/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const browser = await chromium.launch({headless:true, executablePath:'/Users/crayner/Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'});
try {
 const page = await browser.newPage();
 for (const width of [390,768,1440]) {
  await page.setViewportSize({width,height:700});
  await page.goto('http://127.0.0.1:5174/yum-donut/verification/navigation.html');
  await page.getByRole('button',{name:'Give',exact:true}).waitFor();
  for(let i=0;i<8 && await page.getByRole('button',{name:'Show more navigation items'}).isEnabled();i++) {
   await page.getByRole('button',{name:'Show more navigation items'}).click();
   await page.waitForTimeout(350);
  }
  const visible = await page.locator('.app-navigation-track').evaluate(el=>{const b=el.lastElementChild.getBoundingClientRect(),r=el.getBoundingClientRect();return b.left>=r.left-1 && b.right<=r.right+1;});
  if(!visible) throw Error('Preview clipped '+width);
  await page.getByRole('button',{name:'YumPals preview',exact:true}).click();
  const ys = await page.locator('.app-navigation-track > button').evaluateAll(items=>new Set(items.map(x=>Math.round(x.getBoundingClientRect().top))).size);
  if(ys!==1) throw Error('Wrapped');
  await page.screenshot({path:'/tmp/yumpals-navigation-'+width+'.png'});
  console.log('PASS '+width+': one row, arrows reach full preview, selection works');
 }
} finally { await browser.close(); }
