const exact = (v, keys) => v !== null && typeof v === 'object' && Object.getPrototypeOf(v) === Object.prototype
  && Object.keys(v).length === keys.length && keys.every(key => Object.hasOwn(v, key));
const id = v => typeof v === 'string' && /^[A-Za-z0-9_-]{1,80}$/u.test(v);
const direction = v => v === 'left' || v === 'right';
const turnKeys = ['operationId', 'round', 'choice', 'target', 'correct', 'playedAtMs'];
const turnValid = (v, round, earliest) => exact(v, turnKeys) && id(v.operationId) && v.round === round
  && Number.isInteger(round) && round >= 0 && round <= 2 && direction(v.choice) && direction(v.target)
  && v.correct === (v.choice === v.target) && Number.isSafeInteger(v.playedAtMs)
  && v.playedAtMs >= earliest && v.playedAtMs <= 253402214400000;
export const validSavedGameRead = v => exact(v, ['gameId']) && id(v.gameId);
export const validSavedGameChoice = v => exact(v, ['gameId', 'operationId', 'round', 'choice'])
  && id(v.gameId) && id(v.operationId) && Number.isInteger(v.round) && v.round >= 0 && v.round <= 2 && direction(v.choice);
export function validSavedGameView(v, ownerUid, gameId) {
  if (!exact(v, ['schemaVersion', 'ownerUid', 'gameId', 'enabled', 'round', 'complete', 'score', 'turns'])
    || v.schemaVersion !== 1 || v.ownerUid !== ownerUid || v.gameId !== gameId || !id(gameId)
    || typeof v.enabled !== 'boolean' || !Array.isArray(v.turns) || v.turns.length > 3
    || v.round !== v.turns.length || v.complete !== (v.round === 3)) return false;
  let earliest = 0; const ids = new Set();
  for (const [round, turn] of v.turns.entries()) {
    if (!turnValid(turn, round, earliest) || ids.has(turn.operationId)) return false;
    earliest = turn.playedAtMs; ids.add(turn.operationId);
  }
  return v.score === v.turns.filter(turn => turn.correct).length;
}
// Only called after validating the immutable server outcome. A normal next
// round contains everything needed to advance; recovery still reads the server.
export function advanceSavedGameView(view, outcome) {
  if (!validSavedGameView(view, outcome.ownerUid, outcome.gameId) || view.round !== outcome.round || view.complete) return null;
  const turns = [...view.turns, Object.fromEntries(turnKeys.map(key => [key, outcome[key]]))];
  const next = { ...view, turns, round: turns.length, complete: turns.length === 3, score: turns.filter(turn => turn.correct).length };
  return validSavedGameView(next, outcome.ownerUid, outcome.gameId) ? next : null;
}
export async function validSavedGameOutcome(v, ownerUid, request) {
  if (!validSavedGameChoice(request) || !exact(v, ['outcome', 'duplicate']) || typeof v.duplicate !== 'boolean') return false;
  const o = v.outcome;
  if (!exact(o, ['schemaVersion', 'ownerUid', 'gameId', ...turnKeys, 'binding'])
    || o.schemaVersion !== 1 || o.ownerUid !== ownerUid
    || !Object.keys(request).every(key => o[key] === request[key])
    || !turnValid(Object.fromEntries(turnKeys.map(key => [key, o[key]])), request.round, 0)) return false;
  const canonical = { gameId: request.gameId, operationId: request.operationId, round: request.round, choice: request.choice };
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(canonical)));
  const hash = Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('');
  return o.binding === hash;
}
