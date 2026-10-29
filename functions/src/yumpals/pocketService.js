// Donut pal ("pocket") care on the server: free care, a 1-donut treat, a fair
// 5-round game, 5-donut adoption, the daily visit gift and giving cheer, and the
// move of existing pals. Reached only through { pocket: 1 } requests on the two
// existing endpoints; the current app never sends them, so its path is unchanged.
// Rules come from donutPal.js (generated from the app's copy). The old paidCare
// state is never read for care or changed, so it stays as a rollback.
const { randomInt } = require('node:crypto');
const rules = require('./donutPal');
const { validateConfig, migrateLegacyPet, digest, requireValue, integer, aucklandNow } = require('./paidCareEngine');
const { isRestDate } = require('./elapsedCare');
const { holidayRefs, applyHolidayMode } = require('./holidayMode');
const { readDocuments } = require('./readDocuments');
const { isValidPersistedState, validateName, speciesById, validateCase, validateColor } = require('./rules');
const { walletNumber, debitAfter } = require('./walletNumber');
const { gaveOn, isCheerRestDay } = require('./givingCheer');
const { WELCOME_BACK_MS } = require('./visitGift');

const ADOPTION_PRICE = 5;
const ID = /^[A-Za-z0-9_-]{1,80}$/u;
const DATE = /^\d{4}-\d{2}-\d{2}$/u;
const MAX_MS = 253402214400000;
const CARE = ['meal', 'snack', 'clean', 'medicine', 'lights'];
const STAGES = ['egg', 'baby', 'child', 'teen', 'adult'];
const TIMERS = ['hunger', 'happy', 'mess', 'messAge', 'empty', 'sad'];
const WALLET_UNAVAILABLE = new Set(['TRUSTED_MAPPING_REQUIRED', 'INVALID_WALLET_MAPPING', 'WALLET_MIRROR_MISSING', 'WALLET_OWNER_CONFLICT', 'INVALID_WALLET_BALANCE', 'WALLET_BALANCE_CONFLICT', 'CORRUPT_WALLET']);

const plainObject = value => value !== null && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype;
const exact = (value, keys) => plainObject(value) && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const time = value => integer(value, 0, MAX_MS);
const optionalDate = value => value === undefined || (typeof value === 'string' && DATE.test(value));

function validPal(pal) {
  return plainObject(pal) && pal.version === 2 && STAGES.includes(pal.stage)
    && (pal.stage === 'adult' ? ['good', 'scruffy'].includes(pal.form) : pal.form === null)
    && time(pal.hatchAt) && (pal.bornAt === null || time(pal.bornAt)) && time(pal.at) && time(pal.napUntil)
    && integer(pal.hunger, 0, rules.NEEDS_MAX) && integer(pal.happy, 0, rules.NEEDS_MAX) && integer(pal.weight, 0, 999)
    && integer(pal.mess, 0, rules.MESS_MAX) && typeof pal.sick === 'boolean' && integer(pal.doses, 0, 3)
    && typeof pal.sleepy === 'boolean' && typeof pal.lightsOff === 'boolean' && integer(pal.gamesInRow, 0, 1000)
    && (pal.snackDate === '' || DATE.test(pal.snackDate)) && integer(pal.snacks, 0, rules.SNACKS_PER_DAY)
    && Array.isArray(pal.caredDates) && pal.caredDates.length <= 60 && pal.caredDates.every(date => DATE.test(date))
    && integer(pal.mistakes, 0, 100000) && optionalDate(pal.wakeDate)
    && exact(pal.timers, TIMERS) && TIMERS.every(key => integer(pal.timers[key], 0, 100000))
    && Array.isArray(pal.events) && pal.events.length === 0;
}

function validGame(game) {
  return game === null || (exact(game, ['id', 'results', 'startedAtMs']) && ID.test(game.id) && time(game.startedAtMs)
    && Array.isArray(game.results) && game.results.length < rules.GAME_ROUNDS && game.results.every(result => typeof result === 'boolean'));
}

function validatePocket(pocket, uid) {
  requireValue(plainObject(pocket) && pocket.schemaVersion === 1 && pocket.ownerUid === uid && time(pocket.movedAtMs)
    && validPal(pocket.pal) && validGame(pocket.game) && optionalDate(pocket.visitDate) && optionalDate(pocket.cheerDate), 'CORRUPT_POCKET');
  return pocket;
}

// Stored without the name and species, which always come from the pal record.
function storedPal(pal) {
  return Object.fromEntries(Object.entries({ ...pal, events: [] }).filter(([key]) => key !== 'name' && key !== 'species'));
}
function palFor(pet, pocket) {
  return { ...pocket.pal, name: pet.name, species: pet.species };
}

// Rest time freezes the pal: holidays, absences, pauses (YumPals switched off)
// and Holiday Mode. Dates are cached, since the catch-up checks every minute.
function frozenCheck(config, fromMs, toMs) {
  const periods = (config.holidayPeriods || []).filter(p => p.from < toMs && (p.to === null || p.to > fromMs));
  const byDate = new Map();
  return ms => {
    if (periods.some(p => p.from <= ms && (p.to === null || ms < p.to))) return true;
    const date = rules.aucklandDate(ms);
    if (!byDate.has(date)) byDate.set(date, isRestDate(config, date));
    return byDate.get(date);
  };
}

function readRequest(data) {
  requireValue(exact(data, ['pocket']) && data.pocket === 1, 'INVALID_POCKET_REQUEST');
}

function actRequest(data) {
  requireValue(plainObject(data) && data.pocket === 1 && typeof data.operationId === 'string' && ID.test(data.operationId), 'INVALID_POCKET_REQUEST');
  const base = { operationId: data.operationId, action: data.action };
  if (CARE.includes(data.action)) {
    requireValue(exact(data, ['pocket', 'operationId', 'action']), 'INVALID_POCKET_REQUEST');
    return base;
  }
  if (data.action === 'guess') {
    requireValue(exact(data, ['pocket', 'operationId', 'action', 'gameId', 'round', 'choice']) && typeof data.gameId === 'string' && ID.test(data.gameId)
      && integer(data.round, 0, rules.GAME_ROUNDS - 1) && ['left', 'right'].includes(data.choice), 'INVALID_POCKET_REQUEST');
    return { ...base, gameId: data.gameId, round: data.round, choice: data.choice };
  }
  if (data.action === 'adopt') {
    requireValue(exact(data, ['pocket', 'operationId', 'action', 'adoption']) && exact(data.adoption, ['name', 'species', 'casing', 'color'])
      && ['name', 'species', 'casing', 'color'].every(key => typeof data.adoption[key] === 'string'), 'INVALID_ADOPTION');
    const { name, species, casing, color } = data.adoption;
    return { ...base, adoption: { name, species, casing, color } };
  }
  return requireValue(false, 'INVALID_POCKET_REQUEST');
}

function createPocketService({ db, refs, walletAdapter, now = Date.now, pocketReady = () => false, chooseTarget = () => (randomInt(2) === 0 ? 'left' : 'right') }) {
  requireValue(db && typeof db.runTransaction === 'function' && ['config', 'pet', 'pocketAct', 'pocketMove'].every(key => typeof refs?.[key] === 'function')
    && typeof walletAdapter?.read === 'function' && typeof walletAdapter.debit === 'function' && typeof chooseTarget === 'function', 'INVALID_DEPENDENCIES');

  // Teacher-only until YUMPALS_POCKET_READY is switched on for everyone.
  function authorize(request) {
    const uid = request.auth.uid;
    requireValue(pocketReady() === true || request.auth.token?.yumpalsAdmin === true, 'POCKET_NOT_READY');
    return uid;
  }

  async function readWallet(transaction, uid) {
    try {
      const wallet = await walletAdapter.read(transaction, uid);
      requireValue(wallet && wallet.ownerUid === uid && walletNumber(wallet.balance), 'CORRUPT_WALLET');
      return { available: true, wallet };
    } catch (error) {
      if (!WALLET_UNAVAILABLE.has(error?.code)) throw error;
      return { available: false, wallet: null };
    }
  }

  // Every read happens here, before any write, as Firestore transactions require.
  async function load(transaction, uid, extraRefs = []) {
    const [configSnap, petSnap, ...rest] = await readDocuments(transaction, [refs.config(uid), refs.pet(uid), ...holidayRefs(refs), ...extraRefs]);
    const holiday = rest.splice(0, holidayRefs(refs).length);
    requireValue(configSnap.exists, 'CONFIG_MISSING');
    const config = applyHolidayMode(validateConfig({ ...configSnap.data(), elapsedCare: true }), holiday);
    const pet = petSnap.exists ? petSnap.data() : null;
    if (pet) requireValue(isValidPersistedState(pet, uid), 'CORRUPT_STATE');
    return { config, pet, extra: rest };
  }

  // The move: an existing pal keeps its name, species, glaze and colour and starts
  // again as an egg that hatches about 5 minutes after its first visit.
  function pocketOf(pet, uid, nowMs) {
    if (Object.hasOwn(pet, 'pocket')) return { pocket: validatePocket(pet.pocket, uid), moved: false };
    const pal = rules.createDonutPal({ name: pet.name, species: pet.species, nowMs });
    return { pocket: { schemaVersion: 1, ownerUid: uid, movedAtMs: nowMs, pal: storedPal(pal), game: null }, moved: true };
  }

  function moveRecord(pet, uid, nowMs) {
    return { schemaVersion: 1, ownerUid: uid, type: 'pocket_move', from: Object.hasOwn(pet, 'paidCare') ? 'paid_care' : 'legacy',
      name: pet.name, species: pet.species, casing: pet.casing, color: pet.color, movedAtMs: nowMs, amount: 0 };
  }

  function advanced(pet, pocket, config, nowMs) {
    const pal = palFor(pet, pocket);
    return rules.takeEvents(rules.advance(pal, nowMs, { isFrozen: frozenCheck(config, pal.at, nowMs) })).pal;
  }

  function view(uid, config, nowMs, pet, pocket, wallet) {
    const { date, hour } = aucklandNow(nowMs);
    return { schemaVersion: 1, kind: 'pocket', ownerUid: uid, enabled: config.enabled, serverNowMs: nowMs,
      aucklandDate: date, aucklandHour: hour, aucklandMinute: rules.aucklandParts(nowMs).minute,
      prices: { snack: rules.SNACK_PRICE, adoption: ADOPTION_PRICE },
      wallet: wallet.available ? { available: true, balance: wallet.wallet.balance } : { available: false },
      pal: pet ? { name: pet.name, species: pet.species, casing: pet.casing, color: pet.color, reducedMotion: pet.reducedMotion,
        state: palFor(pet, pocket), game: pocket.game ? { id: pocket.game.id, results: [...pocket.game.results] } : null } : null };
  }

  // Free gifts, once a day, paused with the pal, and not for an egg.
  function visitGift(pocket, pal, config, nowMs, lastSeenMs, frozenNow) {
    const { date } = aucklandNow(nowMs);
    if (!config.enabled || frozenNow || pal.stage === 'egg' || pocket.visitDate === date) return null;
    const welcomeBack = time(lastSeenMs) && nowMs - lastSeenMs >= WELCOME_BACK_MS;
    const next = { ...pal }; const gains = { hunger: 0, happy: 0 };
    const give = key => { if (next[key] < rules.NEEDS_MAX) { next[key] += 1; gains[key] = 1; } };
    if (welcomeBack) { give('hunger'); give('happy'); } else give(pal.happy < pal.hunger ? 'happy' : 'hunger');
    return { pal: next, visit: { date, welcomeBack, gains } };
  }

  function givingCheer(pocket, pal, config, nowMs, profile) {
    const { date } = aucklandNow(nowMs);
    if (!config.enabled || pal.stage === 'egg' || pocket.cheerDate === date || !gaveOn(profile, date) || isCheerRestDay(config, date, nowMs)) return null;
    const gain = Math.min(1, rules.NEEDS_MAX - pal.happy);
    return { pal: { ...pal, happy: pal.happy + gain }, cheer: { date, gain } };
  }

  function needs(pal) { return { hunger: pal.hunger, happy: pal.happy }; }

  return {
    getState: async request => {
      const uid = authorize(request);
      readRequest(request.data);
      const nowMs = now(); aucklandNow(nowMs);
      return db.runTransaction(async transaction => {
        const { config, pet, extra } = await load(transaction, uid, refs.giving ? [refs.giving(uid)] : []);
        const wallet = await readWallet(transaction, uid);
        if (!pet) return view(uid, config, nowMs, null, null, wallet);
        const profile = refs.giving && extra[0]?.exists ? extra[0].data() : null;
        const { pocket, moved } = pocketOf(pet, uid, nowMs);
        const lastSeenMs = moved ? null : pocket.pal.at;
        let pal = advanced(pet, pocket, config, nowMs);
        let next = { ...pocket };
        const gifts = {}; const records = [];
        const visit = visitGift(pocket, pal, config, nowMs, lastSeenMs, frozenCheck(config, nowMs, nowMs + 1)(nowMs));
        if (visit) {
          records.push([refs.visit?.(uid, `pocket-${visit.visit.date}`), { schemaVersion: 1, ownerUid: uid, type: visit.visit.welcomeBack ? 'pocket_welcome_back' : 'pocket_daily_visit',
            date: visit.visit.date, gains: visit.visit.gains, amount: 0, needsBefore: needs(pal), needsAfter: needs(visit.pal), lastSeenMs, committedAtMs: nowMs }]);
          ({ pal } = visit); next.visitDate = visit.visit.date; gifts.visit = visit.visit;
        }
        const cheer = refs.cheer ? givingCheer(pocket, pal, config, nowMs, profile) : null;
        if (cheer) {
          records.push([refs.cheer(uid, `pocket-${cheer.cheer.date}`), { schemaVersion: 1, ownerUid: uid, type: 'pocket_giving_cheer', date: cheer.cheer.date,
            gain: cheer.cheer.gain, amount: 0, needsBefore: needs(pal), needsAfter: needs(cheer.pal), givingDate: profile.last_given_date,
            givenToday: profile.given_today, committedAtMs: nowMs }]);
          ({ pal } = cheer); next.cheerDate = cheer.cheer.date; gifts.cheer = cheer.cheer;
        }
        next = { ...next, pal: storedPal(pal) };
        if (moved) transaction.set(refs.pocketMove(uid), moveRecord(pet, uid, nowMs));
        for (const [ref, record] of records) if (ref) transaction.set(ref, record);
        if (moved || digest(next) !== digest(pocket)) transaction.set(refs.pet(uid), { ...pet, pocket: next });
        return { ...view(uid, config, nowMs, pet, next, wallet), ...gifts };
      });
    },

    act: async request => {
      const uid = authorize(request);
      const data = actRequest(request.data);
      const binding = digest(data);
      const nowMs = now(); aucklandNow(nowMs);
      return db.runTransaction(async transaction => {
        const { config, pet, extra: [priorSnap] } = await load(transaction, uid, [refs.pocketAct(uid, data.operationId)]);
        const wallet = await readWallet(transaction, uid);
        const current = pet ? pocketOf(pet, uid, nowMs) : null;
        if (priorSnap.exists) {
          const prior = priorSnap.data();
          requireValue(plainObject(prior) && prior.schemaVersion === 1 && prior.ownerUid === uid && prior.operationId === data.operationId
            && plainObject(prior.outcome), 'CORRUPT_ACT');
          requireValue(prior.binding === binding, 'OPERATION_CONFLICT');
          // A retry returns the original outcome, never doing anything twice.
          return { outcome: prior.outcome, duplicate: true, view: view(uid, config, nowMs, pet, current?.pocket, wallet) };
        }
        const balance = wallet.available ? wallet.wallet.balance : 0;
        const outcome = { action: data.action, ok: false, reason: null, animation: 'no', amount: 0, walletBefore: null, walletAfter: null };
        let petAfter = pet; let debit = 0;
        const refuse = reason => Object.assign(outcome, { ok: false, reason, animation: 'no' });

        if (!config.enabled) refuse('paused');
        else if (data.action === 'adopt') {
          const { name, species, casing, color } = data.adoption;
          requireValue(validateName(name) && speciesById(species) && validateCase(casing) && validateColor(color), 'INVALID_ADOPTION');
          if (pet) refuse('adopted');
          else if (!wallet.available || balance < ADOPTION_PRICE) refuse('donuts');
          else {
            const legacy = { schemaVersion: 1, ownerUid: uid, name: validateName(name), species, casing: validateCase(casing), color: validateColor(color),
              reducedMotion: false, careDays: 0, earnedMilestones: [] };
            // paidCare too, so the current handheld still works if we roll back.
            const withPaid = migrateLegacyPet(legacy, uid, config, nowMs);
            const pal = rules.createDonutPal({ name: legacy.name, species, nowMs });
            petAfter = { ...withPaid, pocket: { schemaVersion: 1, ownerUid: uid, movedAtMs: nowMs, pal: storedPal(pal), game: null } };
            Object.assign(outcome, { ok: true, animation: 'adopted' }); debit = ADOPTION_PRICE;
          }
        } else {
          requireValue(pet, 'NO_PET');
          const { pocket } = current;
          const isFrozen = frozenCheck(config, pocket.pal.at, nowMs);
          let pal = advanced(pet, pocket, config, nowMs);
          let game = pocket.game;
          if (data.action === 'guess') {
            if (data.round === 0) {
              const check = rules.act(pal, 'game', { nowMs, wins: 0, isFrozen });
              if (!check.ok) { refuse(check.reason); game = null; } else game = { id: data.gameId, results: [], startedAtMs: nowMs };
            } else requireValue(game && game.id === data.gameId && game.results.length === data.round, 'GAME_ROUND_CONFLICT');
            if (game) {
              const target = chooseTarget(); requireValue(['left', 'right'].includes(target), 'INVALID_GAME_TARGET');
              const results = [...game.results, data.choice === target];
              outcome.game = { gameId: data.gameId, round: data.round, choice: data.choice, target, correct: data.choice === target,
                wins: results.filter(Boolean).length, complete: results.length === rules.GAME_ROUNDS };
              if (outcome.game.complete) {
                const result = rules.act(pal, 'game', { nowMs, wins: outcome.game.wins, isFrozen });
                if (result.ok) { pal = rules.takeEvents(result.pal).pal; Object.assign(outcome, { ok: true, animation: result.animation }); } else refuse(result.reason);
                game = null;
              } else { game = { ...game, results }; Object.assign(outcome, { ok: true, animation: outcome.game.correct ? 'right' : 'wrong' }); }
            }
          } else {
            const result = rules.act(pal, data.action, { nowMs, donuts: balance, isFrozen });
            pal = rules.takeEvents(result.pal).pal;
            if (result.ok) { Object.assign(outcome, { ok: true, animation: result.animation }); debit = result.cost || 0; } else refuse(result.reason);
          }
          petAfter = { ...pet, pocket: { ...pocket, pal: storedPal(pal), game } };
        }
        if (debit) {
          requireValue(wallet.available, 'TRUSTED_MAPPING_REQUIRED');
          const walletAfter = debitAfter(balance, debit); requireValue(walletAfter !== null, 'INVALID_WALLET_DEBIT');
          Object.assign(outcome, { amount: debit, walletBefore: balance, walletAfter, category: 'pet_spend' });
        }
        // Writes, after every read.
        // Paused or refused adoptions leave the pal record (and any pending move) alone.
        const savePet = petAfter !== null && petAfter !== pet;
        if (debit) await walletAdapter.debit(transaction, wallet.wallet, debit);
        if (savePet && pet && current.moved) transaction.set(refs.pocketMove(uid), moveRecord(pet, uid, nowMs));
        if (savePet) transaction.set(refs.pet(uid), petAfter);
        transaction.set(refs.pocketAct(uid, data.operationId), { schemaVersion: 1, ownerUid: uid, operationId: data.operationId, binding,
          request: data, outcome, committedAtMs: nowMs });
        const walletView = debit ? { available: true, wallet: { ...wallet.wallet, balance: outcome.walletAfter } } : wallet;
        return { outcome, duplicate: false, view: view(uid, config, nowMs, petAfter, petAfter?.pocket, walletView) };
      });
    },
  };
}

const isPocketRequest = request => plainObject(request?.data) && request.data.pocket === 1;

module.exports = { createPocketService, isPocketRequest, ADOPTION_PRICE, validatePocket };
