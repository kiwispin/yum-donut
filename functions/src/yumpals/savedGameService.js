// Internal only: injected trusted paths, no deployed endpoint or wallet access.
const { randomInt } = require('node:crypto');
const { authenticatedUid, validateReceipt } = require('./paidCareService');
const { validateConfig, validatePet, requireValue, integer, digest, aucklandNow } = require('./paidCareEngine');
const { readDocuments } = require('./readDocuments');
const { holidayRefs, applyHolidayMode } = require('./holidayMode');
const ID = /^[A-Za-z0-9_-]{1,80}$/u;
const id = value => typeof value === 'string' && ID.test(value);
const direction = value => value === 'left' || value === 'right';
const exact = (value, keys) => value !== null && typeof value === 'object'
  && Object.getPrototypeOf(value) === Object.prototype && Object.keys(value).length === keys.length
  && keys.every(key => Object.hasOwn(value, key));
const TURN_KEYS = ['operationId', 'round', 'choice', 'target', 'correct', 'playedAtMs'];
const AUDIT_KEYS = ['schemaVersion', 'ownerUid', 'gameId', ...TURN_KEYS, 'binding'];
const canonical = data => ({ gameId: data.gameId, operationId: data.operationId, round: data.round, choice: data.choice });
const turnOf = value => Object.fromEntries(TURN_KEYS.map(key => [key, value[key]]));
function validTurn(value, round, earliest) {
  return exact(value, TURN_KEYS) && id(value.operationId) && value.round === round && integer(round, 0, 2)
    && direction(value.choice) && direction(value.target) && value.correct === (value.choice === value.target)
    && integer(value.playedAtMs, earliest, 253402214400000);
}
function validateAudit(value, uid, operationId) {
  requireValue(exact(value, AUDIT_KEYS) && value.schemaVersion === 1 && value.ownerUid === uid
    && value.operationId === operationId && id(value.gameId) && validTurn(turnOf(value), value.round, 0)
    && value.binding === digest(canonical(value)), 'CORRUPT_GAME_TURN');
}
function validateSession(value, uid, gameId, receipt) {
  requireValue(exact(value, ['schemaVersion', 'ownerUid', 'gameId', 'purchaseBinding', 'benefit', 'turns', 'complete'])
    && value.schemaVersion === 1 && value.ownerUid === uid && value.gameId === gameId
    && value.purchaseBinding === receipt.binding && value.benefit === receipt.benefit.amount
    && Array.isArray(value.turns) && value.turns.length >= 1 && value.turns.length <= 3
    && value.complete === (value.turns.length === 3), 'CORRUPT_GAME');
  let earliest = receipt.committedAtMs;
  const ids = new Set();
  value.turns.forEach((turn, round) => {
    requireValue(validTurn(turn, round, earliest) && !ids.has(turn.operationId), 'CORRUPT_GAME');
    ids.add(turn.operationId); earliest = turn.playedAtMs;
  });
  return value;
}
function createSavedGameService({ db, refs, ready, now = Date.now, chooseTarget = () => randomInt(2) === 0 ? 'left' : 'right' }) {
  requireValue(db && typeof db.runTransaction === 'function' && refs
    && ['config', 'pet', 'receipt', 'game', 'gameTurn'].every(key => typeof refs[key] === 'function')
    && typeof chooseTarget === 'function' && typeof now === 'function', 'INVALID_DEPENDENCIES');
  function authorize(request, keys) {
    const uid = authenticatedUid(request);
    requireValue(typeof ready === 'function' && ready() === true, 'ROLLOUT_NOT_READY');
    requireValue(exact(request.data, keys) && id(request.data.gameId), 'INVALID_REQUEST');
    return uid;
  }
  function paths(uid, gameId, operationId) {
    const result = { config: refs.config(uid), pet: refs.pet(uid), receipt: refs.receipt(uid, gameId), game: refs.game(uid, gameId),
      ...(operationId ? { audit: refs.gameTurn(uid, operationId) } : {}) };
    const values = Object.values(result).map(ref => typeof ref === 'string' ? ref : ref?.path);
    requireValue(values.every(value => typeof value === 'string' && value.length > 0)
      && new Set(values).size === values.length, 'INVALID_GAME_REFS');
    return result;
  }
  async function load(t, p, uid, gameId) {
    const [configSnap, petSnap, receiptSnap, gameSnap, ...extra] = await readDocuments(t,
      [p.config, p.pet, p.receipt, p.game, ...holidayRefs(refs), ...(p.audit ? [p.audit] : [])]);
    const prior = p.audit ? extra.pop() : null;
    requireValue(configSnap.exists, 'CONFIG_MISSING');
    const config = applyHolidayMode(validateConfig(configSnap.data()), extra);
    requireValue(receiptSnap.exists, 'GAME_PURCHASE_REQUIRED');
    const receipt = receiptSnap.data(); validateReceipt(receipt, uid, gameId);
    requireValue(receipt.action === 'game' && receipt.benefit.type === 'happiness', 'GAME_PURCHASE_REQUIRED');
    requireValue(petSnap.exists, 'NO_PET');
    const pet = petSnap.data(); const care = validatePet(pet, uid);
    const session = gameSnap.exists ? validateSession(gameSnap.data(), uid, gameId, receipt)
      : { schemaVersion: 1, ownerUid: uid, gameId, purchaseBinding: receipt.binding, benefit: receipt.benefit.amount, turns: [], complete: false };
    const audits = await readDocuments(t, session.turns.map(turn => refs.gameTurn(uid, turn.operationId)));
    audits.forEach((snapshot, round) => {
      requireValue(snapshot.exists, 'CORRUPT_GAME_TURN');
      const audit = snapshot.data(); validateAudit(audit, uid, session.turns[round].operationId);
      requireValue(audit.gameId === gameId && JSON.stringify(turnOf(audit)) === JSON.stringify(turnOf(session.turns[round])), 'CORRUPT_GAME_TURN');
    });
    if (session.complete) requireValue(care.game?.id !== gameId, 'CORRUPT_GAME');
    else requireValue(care.game?.id === gameId && care.game.benefit === receipt.benefit.amount, 'GAME_ENTITLEMENT_MISSING');
    return { config, pet, receipt, session, prior };
  }
  return {
    getGame: async request => {
      const uid = authorize(request, ['gameId']); const { gameId } = request.data;
      const p = paths(uid, gameId);
      return db.runTransaction(async t => {
        const { config, session } = await load(t, p, uid, gameId);
        return { schemaVersion: 1, ownerUid: uid, gameId, enabled: config.enabled,
          round: session.turns.length, complete: session.complete,
          score: session.turns.filter(turn => turn.correct).length, turns: session.turns.map(turnOf) };
      });
    },
    choose: async request => {
      const uid = authorize(request, ['gameId', 'operationId', 'round', 'choice']);
      const data = canonical(request.data);
      requireValue(id(data.operationId) && integer(data.round, 0, 2) && direction(data.choice), 'INVALID_REQUEST');
      const binding = digest(data); const p = paths(uid, data.gameId, data.operationId);
      const playedAtMs = now(); aucklandNow(playedAtMs);
      return db.runTransaction(async t => {
        // Independent reads share one network wait. All existing receipt,
        // entitlement, turn-audit and config checks still precede every write.
        const { config, pet, receipt, session, prior } = await load(t, p, uid, data.gameId);
        if (prior.exists) {
          validateAudit(prior.data(), uid, data.operationId);
          requireValue(prior.data().binding === binding, 'OPERATION_CONFLICT');
        }
        if (prior.exists) {
          const outcome = prior.data(); const saved = session.turns[data.round];
          requireValue(saved && JSON.stringify(turnOf(saved)) === JSON.stringify(turnOf(outcome)), 'CORRUPT_GAME_TURN');
          return { outcome, duplicate: true };
        }
        requireValue(config.enabled, 'DISABLED');
        requireValue(!session.complete && data.round === session.turns.length, 'GAME_ROUND_CONFLICT');
        requireValue(playedAtMs >= (session.turns.at(-1)?.playedAtMs ?? receipt.committedAtMs), 'CLOCK_REVERSED');
        const target = chooseTarget(); requireValue(direction(target), 'INVALID_GAME_TARGET');
        const turn = { operationId: data.operationId, round: data.round, choice: data.choice,
          target, correct: data.choice === target, playedAtMs };
        const turns = [...session.turns.map(turnOf), turn]; const complete = turns.length === 3;
        const outcome = { schemaVersion: 1, ownerUid: uid, gameId: data.gameId, ...turn, binding };
        t.set(p.game, { ...session, turns, complete });
        t.set(p.audit, outcome);
        if (complete) t.set(p.pet, { ...pet, paidCare: { ...pet.paidCare, game: null } });
        return { outcome, duplicate: false };
      });
    },
  };
}
module.exports = { createSavedGameService };
