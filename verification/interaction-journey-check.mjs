import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { chromium } from '/Users/crayner/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const require = createRequire(import.meta.url);
const { setup, request } = require('../functions/test/paidCareFixture');
const { createPaidCareCallables } = require('../functions/src/yumpals/paidCareCallables');
const { createSavedGameService } = require('../functions/src/yumpals/savedGameService');
const baseline = process.argv.includes('--baseline');
const browser = await chromium.launch({ headless: true, executablePath: '/Users/crayner/Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing' });
const reports = [];
async function fixture(width, saved) {
  const f = setup({ needs: { hunger: 2, happiness: 0, cleanliness: 2, health: 2 } });
  Object.assign(f.refs, { refusal: (uid,id)=>`refusals/${uid}/${id}`, game: (uid,id)=>`games/${uid}/${id}`, gameTurn: (uid,id)=>`turns/${uid}/${id}` });
  const now = () => Date.parse('2026-09-07T00:00:00Z');
  const care = createPaidCareCallables({ ...f, HttpsError: Error, ready: () => true, now });
  const game = createSavedGameService({ ...f, ready: () => true, now, chooseTarget: () => 'left' });
  if (saved) await f.service.purchase(f.purchaseRequest('game','existing'));
  const page = await browser.newPage({ viewport: { width, height: 1050 } });
  const calls = [], errors = [], gates = new Map();
  page.on('pageerror', e=>errors.push(e.message));
  page.on('console', m=>{ if(process.env.JOURNEY_DEBUG) console.error(m.type(),m.text()); });
  page.on('framenavigated', frame=>{ if(process.env.JOURNEY_DEBUG&&frame===page.mainFrame()) console.error('navigation',frame.url()); });
  await page.addInitScript(() => {
    window.journeyPaints = [];
    new MutationObserver(() => {
      const state = { at: performance.now(), confirm: Boolean(document.querySelector('.saved-confirm > strong')),
        round: document.querySelector('.saved-status > strong')?.textContent,
        status: document.querySelector('.saved-status [role="status"]')?.textContent,
        frame: document.querySelector('.saved-blob')?.dataset.frameKey };
      requestAnimationFrame(()=>window.journeyPaints.push({...state,at:performance.now()}));
    }).observe(document,{subtree:true,childList:true,characterData:true,attributes:true});
  });
  await page.route('**/__speed*-api/*', async route => {
    const name = route.request().url().split('/').at(-1), data = route.request().postDataJSON().data;
    calls.push({name,data,at:Date.now()}); if(process.env.JOURNEY_DEBUG) console.error('request',name,route.request().url()); const gate = gates.get(name);
    if (gate) { gates.delete(name); gate.reached(); await gate.wait; }
    const method = {yumpalsGetPaidCareState:care.getState,yumpalsPurchaseCare:care.purchase,yumpalsGetSavedGame:game.getGame,yumpalsChooseSavedGame:game.choose}[name];
    await route.fulfill({json:{result:await method(request('student-a',data))}});
  });
  const hold = name => {
    let release,reached; const wait = new Promise(r=>release=r), arrived=new Promise(r=>reached=r);
    gates.set(name,{wait,reached}); return {release,arrived};
  };
  const start = async () => { await page.goto('http://127.0.0.1:5174/yum-donut/verification/care-speed.html?game=1'); await page.locator('.saved-top').getByText(`${saved?28:30} DONUTS`).waitFor(); };
  const frames = () => page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  const icon = name=>page.getByRole('button',{name,exact:true}).click();
  const b = ()=>page.keyboard.press('b');
  return {...f,page,calls,errors,hold,start,frames,icon,b};
}
try {
 for(const width of [390,1440]) {
  if(!baseline) {
   const f=await fixture(width,false);
   await f.page.goto('http://127.0.0.1:5174/yum-donut/verification/care-speed.html?navigate=1');
   await f.page.getByRole('button',{name:'Open YumPals',exact:true}).click();
   await f.page.locator('.saved-top').getByText('30 DONUTS').waitFor();
   assert.equal(f.calls.filter(c=>c.name==='yumpalsGetPaidCareState').length,1,`opening reuses preloaded state: ${JSON.stringify(f.calls)}`);
   const gate=f.hold('yumpalsPurchaseCare'); await f.icon('Food'); await f.b(); await f.b(); await f.b(); await gate.arrived;
   const operation=f.calls.find(c=>c.name==='yumpalsPurchaseCare').data.operationId;
   await f.page.getByRole('button',{name:'Leave YumPals',exact:true}).click();
   const response=f.page.waitForResponse(r=>r.url().endsWith('yumpalsPurchaseCare')); gate.release(); await response;
   await f.page.getByRole('button',{name:'Open YumPals',exact:true}).click();
   await f.page.waitForFunction(()=>document.querySelector('.saved-top')?.textContent.includes('28 DONUTS'),null,{timeout:2000});
   const purchases=f.calls.filter(c=>c.name==='yumpalsPurchaseCare');
   assert.equal(purchases.length,2); assert.ok(purchases.every(c=>c.data.operationId===operation));
   assert.equal(f.db.read('fixture/wallets/student-a').balance,28); assert.deepEqual(f.errors,[]);
   reports.push({width,scenario:'leave-during-save-and-reopen',preloaded:true,sameOperation:true,oneDebit:true,noClaimTimeout:true});await f.page.close();
   // A refused game must exit its immediate starting screen, not load forever.
   const refused=await fixture(width,false); await refused.start(); const refusal=refused.hold('yumpalsPurchaseCare');
   await refused.icon('Game'); await refused.b(); await refused.b(); await refused.b(); await refusal.arrived;
   refused.db.seed('fixture/wallets/student-a',{...refused.db.read('fixture/wallets/student-a'),balance:1});
   refusal.release(); await refused.page.locator('.saved-top').getByText('1 DONUTS').waitFor();
   assert.equal(await refused.page.getByText('Starting game…',{exact:true}).count(),0);
   assert.match(await refused.page.locator('.saved-top-status').innerText(),/enough|donuts/i);
   assert.equal(refused.db.read('fixture/wallets/student-a').balance,1); assert.deepEqual(refused.errors,[]);
   reports.push({width,scenario:'game-refused',exitsStarting:true,noDebit:true}); await refused.page.close();
  }
  // A saved game's background prefetch must not gate ordinary paid care.
  {
   const f=await fixture(width,true), gate=f.hold('yumpalsGetSavedGame'); await f.start(); await gate.arrived;
   await f.icon('Food'); await f.b(); const at=await f.page.evaluate(()=>performance.now()); await f.b(); await f.frames();
   const ready=await f.page.locator('.saved-confirm > strong').count()>0;
   const ms=await f.page.evaluate(at=>window.journeyPaints.find(p=>p.at>=at&&p.confirm)?.at-at,at);
   assert.equal(ready,!baseline);
   if(ready){await f.b(); await f.page.waitForFunction(()=>document.querySelector('.saved-top')?.textContent.includes('26 DONUTS'));}
   const response=f.page.waitForResponse(r=>r.url().endsWith('yumpalsGetSavedGame')); gate.release(); await response;
   assert.equal(f.db.read('fixture/wallets/student-a').balance,ready?26:28); assert.deepEqual(f.errors,[]);
   reports.push({width,scenario:'feed-during-game-loading',ready,confirmationMs:Math.round(ms||0)}); await f.page.close();
  }
  // Payment saves in the background without stealing a later navigation.
  {
   const f=await fixture(width,false); await f.start(); const gate=f.hold('yumpalsPurchaseCare');
   await f.icon('Game'); await f.b(); await f.b(); await f.b(); await gate.arrived; await f.frames();
   const starting=await f.page.getByText('Starting game…',{exact:true}).count()>0;
   assert.equal(starting,!baseline);
   await f.page.keyboard.press('c'); await f.icon('Health and status'); await f.b();
   const response=f.page.waitForResponse(r=>r.url().endsWith('yumpalsPurchaseCare')); gate.release(); await response;
   await f.page.waitForFunction(()=>document.querySelector('[aria-label="Your donuts and care spending"]')?.textContent.includes('28'));
   await f.frames(); const stayed=await f.page.locator('.saved-hearts').count()===4;
   assert.equal(stayed,!baseline); assert.equal(f.db.read('fixture/wallets/student-a').balance,28);
   reports.push({width,scenario:'start-game-then-navigate-away',starting,stayed}); await f.page.close();
  }
  // Do not throw away a new guess just because the previous result is animating.
  {
   const f=await fixture(width,true); const loaded=f.page.waitForResponse(r=>r.url().endsWith('yumpalsGetSavedGame')); await f.start(); await loaded;
   await f.icon('Game'); await f.b(); await f.b(); await f.page.getByText('Round 1 of 3',{exact:true}).waitFor();
   await f.page.keyboard.press('a'); await f.page.getByText('Round 2 of 3',{exact:true}).waitFor();
   const animating=await f.page.locator('.saved-blob').getAttribute('data-frame-key'); assert.equal(animating,'look-left');
   const gate=f.hold('yumpalsChooseSavedGame'); const at=await f.page.evaluate(()=>performance.now()); await f.b(); await f.frames();
   const accepted=f.calls.filter(c=>c.name==='yumpalsChooseSavedGame').length===2;
   assert.equal(accepted,!baseline);
   let ackMs=null;
   if(accepted){
    await gate.arrived;
    assert.equal(await f.page.getByText('Right chosen. Waiting for your pal…',{exact:true}).count(),1);
    ackMs=await f.page.evaluate(at=>Math.round(window.journeyPaints.find(p=>p.at>=at&&p.status?.startsWith('Right chosen.'))?.at-at),at);
    await f.b(); await f.b(); assert.equal(f.calls.filter(c=>c.name==='yumpalsChooseSavedGame').length,2,'no duplicate guess while pending');
    await f.page.keyboard.press('c'); await f.icon('Food'); await f.b(); await f.b(); await f.b();
    await f.page.waitForFunction(()=>document.querySelector('.saved-top')?.textContent.includes('26 DONUTS'));
    assert.match(await f.page.locator('.saved-blob').getAttribute('data-frame-key'),/^feed-/);
    const response=f.page.waitForResponse(r=>r.url().endsWith('yumpalsChooseSavedGame')); gate.release(); await response; await f.frames();
    assert.equal(await f.page.locator('.saved-top').count(),1);
    assert.match(await f.page.locator('.saved-blob').getAttribute('data-frame-key'),/^feed-/,'late game result must not overwrite feeding');
   } else gate.release();
   assert.deepEqual(f.errors,[]); reports.push({width,scenario:'next-guess-during-animation',accepted,ackMs}); await f.page.close();
  }
 }
 console.log(JSON.stringify({baseline,reports},null,2));
} finally {await browser.close();}
