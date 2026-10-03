import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
test('outside polish preserves handheld markup and original device stylesheet exactly', () => {
 const path = 'src/yumpals/YumPalsHandheldDemo.jsx';
 const before = execFileSync('git',['show',`1649d82:${path}`],{encoding:'utf8'});
 const after = readFileSync(path,'utf8');
 const device = source => source.slice(source.indexOf('<div className="paid-demo-device-wrap">'),source.indexOf('{notice &&'));
 // Input fixes may remove animation lockouts; the artwork/structure is identical.
 const normalize = source => device(source).replaceAll('onSelect={chooseIcon}', 'onSelect={setSelectedIcon}')
   .replaceAll('disabled={gameInputLocked}', "disabled={Boolean((visualAction && screen === 'room') || gameInputLocked)}")
   .replace('className="paid-hardware-button" onClick={cancel}', 'className="paid-hardware-button" disabled={Boolean(visualAction && screen === \'room\')} onClick={cancel}');
 assert.equal(normalize(after),device(before));
 assert.equal(readFileSync('src/yumpals/paidCareDemo.css','utf8'),execFileSync('git',['show','1649d82:src/yumpals/paidCareDemo.css'],{encoding:'utf8'}));
});
test('saved surround preserves device artwork while background-save and immediate acknowledgement copy may change', () => {
 const path='src/yumpals/YumPalsSavedHandheld.jsx';
 const before=execFileSync('git',['show',`821d951:${path}`],{encoding:'utf8'});
 const after=readFileSync(path,'utf8');
 const device=s=>s.slice(s.indexOf('<div className="paid-demo-device"'),s.indexOf('<p className="saved-help'));
 const normalize=s=>device(s)
   .replace('{currentGame?.game && !openingGame ?', '{currentGame?.game ?')
   .replace("<p>{openingGame ? 'Starting game…' : 'Loading your game…'}</p>", '<p>Checking your game…</p>')
   .replace("{openingGame ? 'Saving your game. C to return to your pal.' : currentGame?.message || (currentGame?.busy ? currentGame.pendingChoice ? `${currentGame.pendingChoice === 'left' ? 'Left' : 'Right'} chosen. Waiting for your pal…` : 'Loading your game…'", "{currentGame?.message || (currentGame?.busy ? 'Saving…'")
   .replace('{savedEffect(interactionQuote, confirmation.action)}','{savedEffect(quote, confirmation.action)}')
   .replace("{quote?.wallet.available && projectedQuote?.wallet.available ? `Saved ${quote.wallet.balance} · after pending ${projectedQuote.wallet.balance - confirmation.quotedCost}` : 'Not enough donuts for this care'}", "{quote?.wallet.available && quote.wallet.balance >= confirmation.quotedCost ? `Donuts left: ${quote.wallet.balance - confirmation.quotedCost}` : 'Not enough donuts for this care'}")
   .replace("{icon === 'game' && pet?.game ? 'Your paid game is kept safely. Resume without paying again.' : state.pending && ['adoption', 'game'].includes(choices[choice]) ? 'Finish the saved care first.' : 'B opens price confirmation'}", "{icon === 'game' && pet?.game ? 'Your paid game is kept safely. Resume without paying again.' : 'B opens price confirmation'}")
   .replace("disabled={['confirm', 'adopt'].includes(screen) && locked && ['adoption', 'game'].includes(confirmation?.action || '')}", "disabled={Boolean(animation) || (['confirm', 'adopt'].includes(screen) && locked)}")
   .replace("{state.message || 'Keeping your care safe… C to go back.'}", 'Care is being checked. C to return.')
   .replace('Care is being checked. C to return.', "{sameOwner && state.pending ? 'Purchase needs checking below.' : 'Review your choices. C CANCEL to return.'}");
 assert.equal(normalize(after),device(before));
 const css = readFileSync('src/yumpals/savedHandheld.css','utf8').replace(/\.saved-queue-status \{[^}]*\}\n/u, '').replace(/\.saved-queue-status\.is-empty \{[^}]*\}\n/u, '').replace(/\.saved-top-status \{[^}]*\}\n/u, '').replace(/\.yumpals-embedded-saved \.saved-handheld > p\.saved-top-status\[role='status'\] \{[^}]*\}\n/u, '').replace(/\.yumpals-embedded-saved \.saved-handheld > p\.saved-top-status\[role='status'\]:empty \{[^}]*\}\n/u, '').replace(/\.saved-sync \{[^}]*\}\n/u, '').replace(/\.yumpals-embedded-saved \.saved-handheld > p\.saved-sync\.is-empty\[role='status'\] \{[^}]*\}\n/u, '');
 assert.equal(css,execFileSync('git',['show','821d951:src/yumpals/savedHandheld.css'],{encoding:'utf8'}));
});
