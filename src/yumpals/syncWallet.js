// Narrow paid-pet compatibility: an old public snapshot must not undo a newer
// atomic pet deduction. Existing app actions and earning rules are unchanged.
export async function synchronizePetWallet(transaction, { publicRef, privateRef, uid, isActive }) {
  const active = () => { if (!isActive()) throw new Error('SESSION_CHANGED'); };
  const exists = s => typeof s.exists === 'function' ? s.exists() : s.exists === true;
  const balance = n => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= Number.MAX_SAFE_INTEGER;
  active(); const pub = await transaction.get(publicRef); const priv = await transaction.get(privateRef); active();
  if (!exists(pub) || !exists(priv)) throw new Error('WALLET_MISSING');
  const p = pub.data(); const q = priv.data();
  if (p.uid !== uid || p.claimed !== true || (Object.hasOwn(q, 'uid') && q.uid !== uid)) throw new Error('WALLET_OWNER_CONFLICT');
  if (!balance(p.balance) || !balance(q.balance)) throw new Error('INVALID_WALLET_BALANCE');
  // Retain the app's existing public-authoritative synchronization policy, but
  // use current transactional values, never the original listener event.
  if (p.balance !== q.balance) transaction.set(privateRef, { ...q, balance: p.balance });
}
