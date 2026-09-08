import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import YumPalsSavedHandheld from '../../src/yumpals/YumPalsSavedHandheld.jsx';
const HASH = 'a'.repeat(64); const journal = new Map(); const outcomes = new Map();
let uid = 'fixture-student'; let drop = false; let hold = false; const held = []; let update = () => {};
const fresh = owner => ({ schemaVersion: 1, ownerUid: owner, enabled: true, configVersion: 'fixture-v1', configHash: HASH,
  prices: { adoption: 5, meal: 2, snack: 1, game: 2, pat: 1, clean: 1, medicine: 2, bedtime: 1, reminder: 1 },
  restores: { meal: 2, snack: 1, game: 2, pat: 1, clean: 2, medicine: 2 }, careCap: 25,
  serverNowMs: Date.parse('2026-09-16T00:00:00Z'), aucklandDate: '2026-09-16', aucklandHour: 12,
  wallet: { available: true, balance: 17 }, pet: { name: 'Niblet', species: 'mossbit', casing: 'berry', color: '#d94878', reducedMotion: false,
    careDays: 3, earnedMilestones: ['trick'], needs: { hunger: 2, happiness: 2, cleanliness: 2, health: 2 }, daily: { date: '2026-09-16', spent: 0 }, sleepDate: null, attention: true, game: null } });
const accounts = new Map([[uid, fresh(uid)]]);
const getIdentity = () => ({ uid, isAnonymous: false, sandbox: false });
const storage = { getItem: k => journal.get(k) ?? null, setItem: (k, v) => { journal.set(k, v); update(); }, removeItem: k => { journal.delete(k); update(); } };
async function transport(name, request) {
  const owner = uid; const view = accounts.get(owner);
  if (name === 'yumpalsGetPaidCareState') return structuredClone(view);
  if (name !== 'yumpalsPurchaseCare') throw new Error('Unsupported synthetic request');
  const key = `${owner}:${request.operationId}`;
  if (outcomes.has(key)) return { outcome: structuredClone(outcomes.get(key)), duplicate: true };
  const canonical = { operationId: request.operationId, action: request.action, expectedConfigVersion: request.expectedConfigVersion, expectedConfigHash: request.expectedConfigHash,
    adoption: request.adoption ? { name: request.adoption.name, species: request.adoption.species, casing: request.adoption.casing, color: request.adoption.color } : null };
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(canonical)));
  const binding = [...new Uint8Array(bytes)].map(b => b.toString(16).padStart(2, '0')).join('');
  const action = request.action; const amount = view.prices[action]; const need = { meal: 'hunger', snack: 'hunger', pat: 'happiness', clean: 'cleanliness', medicine: 'health' }[action];
  let reason = !view.enabled ? 'DISABLED' : !view.wallet.available || view.wallet.balance < amount ? 'INSUFFICIENT_FUNDS' : action === 'adoption' && view.pet ? 'ALREADY_ADOPTED' : action !== 'adoption' && !view.pet ? 'NO_PET' : null;
  if (!reason && (need && view.pet.needs[need] === 4 || action === 'reminder' && !view.pet.attention || action === 'bedtime' && view.pet.sleepDate === view.aucklandDate)) reason = 'NO_EFFECT';
  const common = { schemaVersion: 1, ownerUid: owner, operationId: request.operationId, request: canonical, binding, committedAtMs: view.serverNowMs };
  let outcome;
  if (reason) outcome = { ...common, status: 'REFUSED', reason };
  else {
    let benefit;
    if (action === 'adoption') { view.pet = { ...fresh(owner).pet, ...request.adoption, careDays: 0, earnedMilestones: [], needs: { hunger: 4, happiness: 4, cleanliness: 4, health: 4 } }; benefit = { type: 'adoption', needs: { ...view.pet.needs } }; }
    else if (need) { const n = Math.min(view.restores[action], 4 - view.pet.needs[need]); view.pet.needs[need] += n; benefit = { type: need, amount: n }; }
    else if (action === 'bedtime') { view.pet.sleepDate = view.aucklandDate; benefit = { type: 'sleep', date: view.aucklandDate }; }
    else if (action === 'reminder') { view.pet.attention = false; benefit = { type: 'attention', cleared: true }; }
    else throw new Error('Game is not supported by fixture');
    outcome = { ...common, status: 'COMMITTED', action, amount, configVersion: view.configVersion, configHash: HASH, walletBefore: view.wallet.balance, walletAfter: view.wallet.balance - amount, benefit };
    view.wallet.balance -= amount; if (action !== 'adoption') view.pet.daily.spent += amount;
  }
  outcomes.set(key, outcome); update();
  if (drop) { drop = false; throw new Error('Synthetic reply lost after outcome'); }
  if (hold) { hold = false; await new Promise(resolve => held.push(resolve)); }
  return { outcome: structuredClone(outcome), duplicate: false };
}
function Fixture() {
  const [mount, setMount] = useState(0); const [, rerender] = useState(0); update = () => rerender(n => n + 1);
  const remount = () => setMount(n => n + 1);
  const change = fn => { fn(accounts.get(uid)); remount(); };
  return <><YumPalsSavedHandheld key={`${uid}:${mount}`} ownerUid={uid} projectId="demo-handheld-fixture" enabled getIdentity={getIdentity} transport={transport} storage={storage} />
    <aside id="fixture-controls" aria-label="Separate synthetic test controls"><h2>Local test controls</h2>
      <p>Account {uid} · Balance {accounts.get(uid).wallet.available ? accounts.get(uid).wallet.balance : 'unavailable'} · Receipts {outcomes.size} · Pending {journal.size}</p>
      <button onClick={() => change(v => Object.assign(v, fresh(uid)))}>Fresh saved pal</button>
      <button onClick={() => change(v => { v.pet = null; })}>Petless</button>
      <button onClick={() => change(v => { v.enabled = !v.enabled; })}>Toggle paused</button>
      <button onClick={() => change(v => { v.wallet = { available: false }; })}>Unavailable wallet</button>
      <button onClick={() => change(v => { v.aucklandHour = 19; v.serverNowMs = Date.parse('2026-09-16T07:00:00Z'); })}>Night</button>
      <button onClick={() => { drop = true; update(); }}>Drop next purchase reply</button>
      <button onClick={() => { hold = true; update(); }}>Hold next purchase reply</button>
      <button onClick={() => { while (held.length) held.shift()(); }}>Release held replies</button>
      <button onClick={remount}>Remount same account</button>
      <button onClick={() => { const v = accounts.get(uid); if (v.wallet.available) v.wallet.balance += 3; update(); }}>Give +3</button>
      <button onClick={() => { uid = uid === 'fixture-student' ? 'fixture-other' : 'fixture-student'; if (!accounts.has(uid)) accounts.set(uid, fresh(uid)); remount(); }}>Switch account</button>
    </aside></>;
}
createRoot(document.getElementById('root')).render(<React.StrictMode><Fixture /></React.StrictMode>);
