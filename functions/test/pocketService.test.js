const test = require('node:test');
const assert = require('node:assert/strict');
const { setup } = require('./paidCareFixture');
const { createPaidCareCallables } = require('../src/yumpals/paidCareCallables');
const { HATCH_MS, GAME_ROUNDS } = require('../src/yumpals/donutPal');

class HttpsError extends Error { constructor(code, message, details) { super(message); this.code = code; this.details = details; } }
const HOUR = 3600000;
const DAY = 24 * HOUR;
const NOW = Date.parse('2026-09-07T00:00:00Z'); // Monday noon Auckland.
const PET = 'fixture/pets/student-a';
const WALLET = 'fixture/wallets/student-a';

function pocketSetup({ ready = false, admin = true, balance = 30, pet = true, targets = [], config } = {}) {
  const f = setup({ balance, pet });
  Object.assign(f.refs, {
    refusal: (uid, id) => `fixture/refusals/${uid}/${id}`, visit: (uid, date) => `fixture/visits/${uid}/${date}`,
    giving: uid => `fixture/profiles/${uid}`, cheer: (uid, date) => `fixture/cheers/${uid}/${date}`,
    pocketAct: (uid, id) => `fixture/pocketActs/${uid}/${id}`, pocketMove: uid => `fixture/migrations/${uid}_pocket`,
  });
  if (config) f.db.seed(f.refs.config('student-a'), { ...f.config, ...config });
  let clock = NOW; const queue = [...targets]; let n = 0;
  const api = createPaidCareCallables({ db: f.db, refs: f.refs, walletAdapter: f.walletAdapter, HttpsError, ready: () => true,
    now: () => clock, elapsedCare: true, pocketReady: () => ready, chooseTarget: () => queue.shift() ?? 'left' });
  const auth = () => ({ uid: 'student-a', token: { firebase: { sign_in_provider: 'password' }, ...(admin ? { yumpalsAdmin: true } : {}) } });
  const read = () => api.getState({ auth: auth(), data: { pocket: 1 } });
  const act = (action, extra = {}, operationId = `op-${++n}`) => api.purchase({ auth: auth(), data: { pocket: 1, operationId, action, ...extra } });
  const setPal = fields => { const saved = f.db.read(PET); saved.pocket.pal = { ...saved.pocket.pal, ...fields }; f.db.seed(PET, saved); };
  // Moves the pal, lets it hatch, then sets its hearts (the visit gift for today is used up).
  const hatched = async (fields = {}) => { await read(); clock += HATCH_MS; await read(); setPal({ hunger: 2, happy: 2, ...fields }); };
  return { ...f, api, auth, read, act, setPal, hatched, at: ms => { clock = ms; }, later: ms => { clock += ms; } };
}
const reason = code => error => error?.details?.reason === code;

test('requests from the current app take the unchanged paid-care path', async () => {
  const f = pocketSetup({ ready: true });
  const old = await f.api.getState({ auth: f.auth(), data: {} });
  assert.equal(Object.hasOwn(old, 'kind'), false);
  assert.ok(old.pet.needs && old.prices.meal > 0);
  const receipt = await f.api.purchase({ auth: f.auth(), data: f.purchaseRequest('meal').data });
  assert.equal(receipt.outcome.status, 'REFUSED'); // full meters: NO_EFFECT, exactly as before
  assert.equal(Object.hasOwn(f.db.read(PET), 'pocket'), false, 'old requests never move the pal');
});

test('teacher only until YUMPALS_POCKET_READY is switched on', async () => {
  await assert.rejects(pocketSetup({ admin: false }).read(), reason('POCKET_NOT_READY'));
  await assert.rejects(pocketSetup({ admin: false }).act('meal'), reason('POCKET_NOT_READY'));
  assert.equal((await pocketSetup({ admin: true }).read()).kind, 'pocket');
  assert.equal((await pocketSetup({ admin: false, ready: true }).read()).kind, 'pocket');
});

test('an existing pal moves on its first visit: an egg that keeps its name, species, glaze and colour', async () => {
  const f = pocketSetup();
  const before = f.db.read(PET);
  const view = await f.read();
  assert.equal(view.pal.name, 'Niblet'); assert.equal(view.pal.species, 'mossbit');
  assert.equal(view.pal.casing, 'berry'); assert.equal(view.pal.color, '#d94878');
  assert.equal(view.pal.state.stage, 'egg'); assert.equal(view.pal.state.hatchAt, NOW + HATCH_MS);
  const after = f.db.read(PET);
  assert.deepEqual(after.paidCare, before.paidCare, 'old care state kept untouched for rollback');
  assert.deepEqual(after.possessions, before.possessions); assert.deepEqual(after.unknown, before.unknown);
  assert.equal(after.careDays, before.careDays);
  const move = f.db.read('fixture/migrations/student-a_pocket');
  assert.equal(move.type, 'pocket_move'); assert.equal(move.from, 'paid_care'); assert.equal(move.amount, 0); assert.equal(move.movedAtMs, NOW);
  f.later(60000); await f.read();
  assert.equal(f.db.read('fixture/migrations/student-a_pocket').movedAtMs, NOW, 'moves only once');
  assert.equal(f.db.read(PET).pocket.movedAtMs, NOW);
  const old = await f.api.getState({ auth: f.auth(), data: {} });
  assert.equal(old.pet.name, 'Niblet', 'the current handheld still loads a moved pal (rollback)');
  assert.ok(f.db.read(PET).pocket, 'and keeps the pocket data');
});

test('it hatches after about 5 minutes with empty hearts, then gets its first daily visit gift', async () => {
  const f = pocketSetup();
  const egg = await f.read();
  assert.equal(Object.hasOwn(egg, 'visit'), false, 'no gift for an egg');
  f.later(HATCH_MS);
  const baby = await f.read();
  assert.equal(baby.pal.state.stage, 'baby');
  assert.deepEqual(baby.visit, { date: '2026-09-07', welcomeBack: false, gains: { hunger: 1, happy: 0 } });
  assert.equal(baby.pal.state.hunger, 1); assert.equal(baby.pal.state.happy, 0);
  assert.equal(f.db.read('fixture/visits/student-a/pocket-2026-09-07').type, 'pocket_daily_visit');
  assert.equal(Object.hasOwn(await f.read(), 'visit'), false, 'once a day');
});

test('care is free: the wallet is untouched, and every action is recorded, refusals too', async () => {
  const f = pocketSetup(); await f.hatched();
  const wallet = f.db.read(WALLET);
  const meal = await f.act('meal', {}, 'meal-1');
  assert.equal(meal.outcome.ok, true); assert.equal(meal.outcome.animation, 'eat'); assert.equal(meal.outcome.amount, 0);
  assert.equal(meal.view.pal.state.hunger, 3);
  assert.deepEqual(f.db.read(WALLET), wallet);
  assert.equal(f.db.read('fixture/pocketActs/student-a/meal-1').outcome.ok, true);
  const clean = await f.act('clean', {}, 'clean-1');
  assert.equal(clean.outcome.ok, false); assert.equal(clean.outcome.reason, 'clean');
  assert.equal(f.db.read('fixture/pocketActs/student-a/clean-1').outcome.reason, 'clean');
});

test('a retry returns the original outcome; reusing its id for something else is refused', async () => {
  const f = pocketSetup(); await f.hatched();
  await f.act('meal', {}, 'same');
  const retry = await f.act('meal', {}, 'same');
  assert.equal(retry.duplicate, true); assert.equal(retry.view.pal.state.hunger, 3, 'fed once');
  await assert.rejects(f.act('clean', {}, 'same'), reason('OPERATION_CONFLICT'));
});

test('a cupcake treat costs exactly 1 donut, with a receipt; no donuts, no treat', async () => {
  const f = pocketSetup({ balance: 30 }); await f.hatched();
  const treat = await f.act('snack', {}, 'treat-1');
  assert.equal(treat.outcome.ok, true);
  assert.deepEqual([treat.outcome.amount, treat.outcome.walletBefore, treat.outcome.walletAfter, treat.outcome.category], [1, 30, 29, 'pet_spend']);
  assert.equal(f.db.read(WALLET).balance, 29); assert.equal(treat.view.wallet.balance, 29);
  assert.equal(treat.view.pal.state.happy, 3); assert.equal(treat.view.pal.state.snacks, 1);
  const g = pocketSetup({ balance: 0 }); await g.hatched();
  const broke = await g.act('snack');
  assert.equal(broke.outcome.reason, 'donuts'); assert.equal(g.db.read(WALLET).balance, 0);
});

test('the game is fair: the server picks every turn, and 3 wins of 5 cheer the pal up', async () => {
  const targets = ['left', 'left', 'right', 'left', 'right'];
  const f = pocketSetup({ targets }); await f.hatched({ happy: 1 });
  const outcomes = [];
  for (let round = 0; round < GAME_ROUNDS; round++) outcomes.push((await f.act('guess', { gameId: 'game-1', round, choice: 'left' })).outcome);
  assert.deepEqual(outcomes.map(o => o.game.target), targets);
  assert.deepEqual(outcomes.map(o => o.game.correct), [true, true, false, true, false]);
  const last = outcomes.at(-1);
  assert.equal(last.game.complete, true); assert.equal(last.game.wins, 3); assert.equal(last.animation, 'happy');
  const saved = f.db.read(PET).pocket;
  assert.equal(saved.pal.happy, 2); assert.equal(saved.game, null); assert.equal(saved.pal.gamesInRow, 1);
  await assert.rejects(f.act('guess', { gameId: 'game-2', round: 2, choice: 'left' }), reason('GAME_ROUND_CONFLICT'));
  const g = pocketSetup(); await g.hatched({ sick: true, doses: 1 });
  const refused = await g.act('guess', { gameId: 'game-1', round: 0, choice: 'left' });
  assert.equal(refused.outcome.reason, 'sick'); assert.equal(g.db.read(PET).pocket.game, null);
});

test('a new pal costs 5 donuts and starts as an egg, with old-style care kept for rollback', async () => {
  const f = pocketSetup({ pet: false, balance: 7 });
  assert.equal((await f.read()).pal, null);
  const adoption = { name: 'Sprinkle', species: 'pufflet', casing: 'mint', color: '#336699' };
  const adopted = await f.act('adopt', { adoption });
  assert.equal(adopted.outcome.ok, true); assert.equal(adopted.outcome.amount, 5);
  assert.equal(f.db.read(WALLET).balance, 2);
  const pet = f.db.read(PET);
  assert.equal(pet.name, 'Sprinkle'); assert.equal(pet.pocket.pal.stage, 'egg'); assert.ok(pet.paidCare);
  const again = await f.act('adopt', { adoption });
  assert.equal(again.outcome.reason, 'adopted'); assert.equal(f.db.read(WALLET).balance, 2);
  const g = pocketSetup({ pet: false, balance: 4 });
  assert.equal((await g.act('adopt', { adoption })).outcome.reason, 'donuts');
  assert.equal(g.db.read(PET), undefined);
  await assert.rejects(g.act('adopt', { adoption: { ...adoption, species: 'dragon' } }), reason('INVALID_ADOPTION'));
});

test('rest days freeze the pal; switched off, nothing can be done and nothing fades', async () => {
  const plain = pocketSetup(); await plain.hatched({ hunger: 4, happy: 4 });
  plain.later(DAY); const faded = (await plain.read()).pal.state;
  const rest = pocketSetup({ config: { calendar: [{ effectiveFrom: '2026-01-01', paused: false, holidays: ['2026-09-07', '2026-09-08'], absences: [] }] } });
  await rest.hatched({ hunger: 4, happy: 4 });
  rest.later(DAY); const frozen = (await rest.read()).pal.state;
  assert.ok(faded.hunger < 4 && faded.mess > 0);
  assert.equal(frozen.hunger, 4); assert.equal(frozen.mess, 0);
  const off = pocketSetup(); await off.hatched({ hunger: 4 });
  off.db.seed(off.refs.config('student-a'), { ...off.config, enabled: false, pauses: [{ from: '2026-09-07', to: null }] });
  off.later(DAY);
  const paused = await off.act('meal');
  assert.equal(paused.outcome.reason, 'paused');
  assert.equal(off.db.read(PET).pocket.pal.hunger, 4);
});

test('a giving cheer adds a free happy heart once a school day', async () => {
  const f = pocketSetup(); await f.hatched();
  f.db.seed('fixture/profiles/student-a', { given_today: 1, last_given_date: 'Mon Sep 07 2026' });
  const cheered = await f.read();
  assert.deepEqual(cheered.cheer, { date: '2026-09-07', gain: 1 });
  assert.equal(cheered.pal.state.happy, 3);
  assert.equal(f.db.read('fixture/cheers/student-a/pocket-2026-09-07').type, 'pocket_giving_cheer');
  assert.equal(Object.hasOwn(await f.read(), 'cheer'), false);
});

test('after 7 days away, a welcome back fills one food and one happy heart', async () => {
  const f = pocketSetup(); await f.hatched();
  f.later(8 * DAY);
  const back = await f.read();
  assert.equal(back.visit.welcomeBack, true);
  assert.deepEqual(back.visit.gains, { hunger: 1, happy: 1 });
});

test('broken pocket data fails closed', async () => {
  const f = pocketSetup(); await f.read();
  const saved = f.db.read(PET); saved.pocket.pal.hunger = 9; f.db.seed(PET, saved);
  await assert.rejects(f.read(), reason('CORRUPT_POCKET'));
  await assert.rejects(f.api.getState({ auth: f.auth(), data: { pocket: 1, extra: true } }), reason('INVALID_POCKET_REQUEST'));
});

test('two weeks away catches up quickly', async () => {
  const f = pocketSetup(); await f.hatched();
  f.later(14 * DAY);
  const started = performance.now();
  const view = await f.read();
  assert.ok(performance.now() - started < 1000);
  assert.equal(view.pal.state.sick, true);
});
