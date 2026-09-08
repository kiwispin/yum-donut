import {chromium} from '/Users/crayner/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const browser = await chromium.launch({headless:true,executablePath:'/Users/crayner/Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'});
try {
 const page = await browser.newPage();
 for (const width of [320,390,1440]) {
  await page.setViewportSize({width,height:600});
  await page.goto('http://127.0.0.1:5174/yum-donut/verification/navigation.html');
  await page.getByRole('button',{name:'YumPals',exact:true}).waitFor();
  const menu=page.getByRole('button',{name:'Menu',exact:true});
  await menu.click();
  await page.getByRole('button',{name:'Leaderboard',exact:true}).waitFor();
  if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)) throw Error('overflow');
  await page.screenshot({path:'/tmp/yumpals-menu-'+width+'.png'});
  await page.getByRole('button',{name:'Bank',exact:true}).click();
  if(await menu.getAttribute('aria-expanded')!=='false') throw Error('did not close');
  await menu.click(); await page.keyboard.press('Escape');
  if(!await menu.evaluate(e=>e===document.activeElement)) throw Error('focus');
  await menu.click(); await page.mouse.click(4,550);
  if(await menu.getAttribute('aria-expanded')!=='false') throw Error('outside close');
  console.log('PASS '+width+' direct Pals, destinations, selection, Escape, outside, no overflow');
 }
} finally { await browser.close(); }
