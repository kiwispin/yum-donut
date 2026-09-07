const {
  usersCollection,
  transactionsCollection,
  rosterDoc,
  teamsMappingsCollection,
  teamsDailyCollection,
  teamsProcessedCollection,
  privateProfileDoc,
} = require('./firestorePaths');
const { DAILY_LIMIT, DONUT_EMOJI } = require('./config');
const { localDateKey, localDateLabel } = require('./dateKeys');
const { mappingKeyForTeamsUser, stableTeamsId, displayNameForTeamsUser } = require('./identity');

function defaultPublicProfile(name, amountReceived = 0) {
  return {
    name,
    balance: amountReceived,
    bank_balance: 0,
    lifetime_given: 0,
    lifetime_received: amountReceived,
    avatar_color: `hsl(${Math.floor(Math.random() * 360)}, 60%, 80%)`,
    claimed: false,
    last_training_date: null,
  };
}

class GiftValidationError extends Error {
  constructor(code, details = {}) { super(code); this.code = code; this.details = details; }
}
const check = (condition, code, details) => { if (!condition) throw new GiftValidationError(code, details); };
const validId = (id) => typeof id === 'string' && id.length > 0 && !id.includes('/');
const money = (n) => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= Number.MAX_SAFE_INTEGER;
const plus = (a, b, code) => { check(money(a) && money(b) && money(a + b), code); return a + b; };
const count = (n, code) => { check(n === undefined || (Number.isSafeInteger(n) && n >= 0), code); return n ?? 0; };

// Read-only preparation. Nothing below may manufacture a missing claimed mirror.
async function readAccount(transaction, db, mapping, role) {
  const name = mapping.yumName;
  check(validId(name), role + '_UNMAPPED');
  const publicRef = usersCollection(db).doc(name);
  const snapshot = await transaction.get(publicRef);
  const data = snapshot.exists ? snapshot.data() : null;
  const mappedUid = mapping.uid;
  check(mappedUid === undefined || mappedUid === null || mappedUid === '' || validId(mappedUid), 'ACCOUNT_LINK_CONFLICT');
  if (!data) {
    check(!mappedUid && !Object.hasOwn(mapping, 'ownerUid'), 'ACCOUNT_LINK_CONFLICT');
    return { name, publicRef, data: null, uid: null, privateRef: null };
  }
  check(money(data.balance), role + '_BALANCE_CORRUPT');
  if (data.claimed !== true) {
    check((data.claimed === false || data.claimed === undefined) && (data.uid === undefined || data.uid === null || data.uid === '') && !mappedUid
      && !Object.hasOwn(data, 'ownerUid') && !Object.hasOwn(mapping, 'ownerUid'), 'ACCOUNT_LINK_CONFLICT');
    return { name, publicRef, data, uid: null, privateRef: null };
  }
  check(validId(data.uid) && (!mappedUid || mappedUid === data.uid), 'ACCOUNT_LINK_CONFLICT');
  const uid = data.uid;
  const privateRef = privateProfileDoc(db, uid);
  const privateSnap = await transaction.get(privateRef);
  check(privateSnap.exists, 'ACCOUNT_LINK_CONFLICT');
  const privateData = privateSnap.data();
  check(!Object.hasOwn(privateData, 'uid') || privateData.uid === uid, 'ACCOUNT_LINK_CONFLICT');
  const protectedOwner = Object.hasOwn(data, 'ownerUid') || Object.hasOwn(privateData, 'ownerUid') || Object.hasOwn(mapping, 'ownerUid');
  if (protectedOwner) check(data.ownerUid === uid && privateData.ownerUid === uid
    && (!Object.hasOwn(mapping, 'ownerUid') || mapping.ownerUid === uid), 'ACCOUNT_LINK_CONFLICT');
  check(money(privateData.balance) && privateData.balance === data.balance, 'ACCOUNT_BALANCE_CONFLICT');
  return { name, publicRef, data, uid, privateRef, privateData };
}

async function giveDonutsFromTeams({ db, FieldValue, activityId, senderTeamsUser, recipientTeamsUsers, donutCount, message, now = new Date() }) {
  if (typeof activityId !== 'string' || !activityId.trim() || Buffer.byteLength(activityId, 'utf8') > 1000) return { ok: false, code: 'ACTIVITY_ID_REQUIRED' };
  if (!senderTeamsUser || !mappingKeyForTeamsUser(senderTeamsUser)) return { ok: false, code: 'SENDER_UNMAPPED' };
  if (!Array.isArray(recipientTeamsUsers) || recipientTeamsUsers.length === 0) return { ok: false, code: 'NO_RECIPIENTS' };
  if (!Number.isSafeInteger(donutCount) || donutCount < 1) return { ok: false, code: 'NO_DONUTS' };
  if (!(now instanceof Date) || !Number.isFinite(now.getTime()) || (message !== undefined && typeof message !== 'string')) return { ok: false, code: 'INVALID_REQUEST' };
  const senderKey = mappingKeyForTeamsUser(senderTeamsUser);
  const unique = new Map();
  for (const recipient of recipientTeamsUsers) {
    const key = mappingKeyForTeamsUser(recipient);
    if (!key) return { ok: false, code: 'RECIPIENT_UNMAPPED' };
    unique.set(key, recipient);
  }
  const recipients = [...unique].sort(([a], [b]) => a.localeCompare(b));
  const requestBinding = require('node:crypto').createHash('sha256').update(JSON.stringify({
    senderKey, recipientKeys: recipients.map(([key]) => key), donutCount, message: message || '',
  })).digest('hex');
  const dateKey = localDateKey(now);
  const dateLabel = localDateLabel(now);
  const processedRef = teamsProcessedCollection(db).doc(Buffer.from(activityId, 'utf8').toString('base64url'));
  try {
    return await db.runTransaction(async (transaction) => {
      const processed = await transaction.get(processedRef);
      if (processed.exists) {
        const prior = processed.data();
        // Old committed records retain duplicate protection, with explicit payload comparison.
        const matches = prior.requestBinding ? prior.requestBinding === requestBinding
          : prior.senderTeamsId === stableTeamsId(senderTeamsUser) && prior.amountEach === donutCount
            && prior.message === (message || '') && Array.isArray(prior.recipientTeamsIds)
            && JSON.stringify([...prior.recipientTeamsIds].sort()) === JSON.stringify(recipients.map(([, u]) => stableTeamsId(u)).sort());
        check(prior.ok === true && matches, 'ACTIVITY_CONFLICT');
        return { ok: false, code: 'DUPLICATE' };
      }
      const senderMappingSnap = await transaction.get(teamsMappingsCollection(db).doc(senderKey));
      check(senderMappingSnap.exists, 'SENDER_UNMAPPED');
      const senderMapping = senderMappingSnap.data();
      const rosterSnap = await transaction.get(rosterDoc(db));
      const roster = rosterSnap.exists ? rosterSnap.data() : {};
      const removed = new Set(Array.isArray(roster.removed_names) ? roster.removed_names : []);
      const active = new Set((Array.isArray(roster.names) ? roster.names : []).filter((name) => !removed.has(name)));
      const mappings = [];
      for (const [key, recipient] of recipients) {
        const snap = await transaction.get(teamsMappingsCollection(db).doc(key));
        check(snap.exists && validId(snap.data().yumName), 'RECIPIENT_UNMAPPED', { displayName: displayNameForTeamsUser(recipient) });
        mappings.push(snap.data());
      }
      const sender = await readAccount(transaction, db, senderMapping, 'SENDER');
      const seenNames = new Set([sender.name]); const seenUids = new Set(sender.uid ? [sender.uid] : []);
      const targets = [];
      for (const mapping of mappings) {
        check(mapping.yumName !== sender.name, 'SELF_GIVE');
        check(!seenNames.has(mapping.yumName), 'RECIPIENT_ALIAS');
        check(active.has(mapping.yumName), 'RECIPIENT_NOT_ACTIVE', { yumName: mapping.yumName });
        seenNames.add(mapping.yumName);
        const target = await readAccount(transaction, db, mapping, 'RECIPIENT');
        check(!target.uid || target.uid !== sender.uid, 'SELF_GIVE');
        check(!target.uid || !seenUids.has(target.uid), 'RECIPIENT_ALIAS');
        if (target.uid) seenUids.add(target.uid);
        target.balance = plus(target.data ? target.data.balance : 0, donutCount, 'RECIPIENT_BALANCE_CORRUPT');
        target.lifetime = plus(target.data ? target.data.lifetime_received : 0, donutCount, 'RECIPIENT_BALANCE_CORRUPT');
        targets.push(target);
      }
      const total = donutCount * targets.length;
      check(Number.isSafeInteger(total) && total > 0, 'NO_DONUTS');
      const dailyRef = teamsDailyCollection(db).doc(`${dateKey}_${senderKey}`);
      const dailySnap = sender.privateRef ? null : await transaction.get(dailyRef);
      const counterData = sender.privateRef ? sender.privateData : dailySnap.exists ? dailySnap.data() : {};
      const expectedDate = sender.privateRef ? dateLabel : dateKey;
      const savedGiven = count(counterData.given_today, 'SENDER_BALANCE_CORRUPT');
      const given = counterData.last_given_date === expectedDate ? savedGiven : 0;
      const nextGiven = plus(given, total, 'SENDER_BALANCE_CORRUPT');
      check(Number.isSafeInteger(nextGiven), 'SENDER_BALANCE_CORRUPT');
      const remaining = Math.max(0, DAILY_LIMIT - given);
      const isAdmin = sender.name === 'Mr Rayner' || senderMapping.isAdmin === true;
      check(isAdmin || total <= remaining, 'DAILY_LIMIT', { remaining, requested: total });
      const lifetimeGiven = plus(count(sender.data?.lifetime_given, 'SENDER_BALANCE_CORRUPT'), total, 'SENDER_BALANCE_CORRUPT');

      // WRITE PHASE: all reads and validation above; no failure-result returns below.
      if (sender.privateRef) transaction.update(sender.privateRef, { given_today: nextGiven, last_given_date: dateLabel });
      else transaction.set(dailyRef, { teamsUserId: stableTeamsId(senderTeamsUser), yumName: sender.name,
        given_today: nextGiven, last_given_date: dateKey, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      if (sender.data) transaction.update(sender.publicRef, { lifetime_given: lifetimeGiven });
      else transaction.set(sender.publicRef, { ...defaultPublicProfile(sender.name), lifetime_given: lifetimeGiven });
      for (const target of targets) {
        if (target.data) transaction.update(target.publicRef, { balance: target.balance, lifetime_received: target.lifetime });
        else transaction.set(target.publicRef, defaultPublicProfile(target.name, donutCount));
        if (target.privateRef) transaction.update(target.privateRef, { balance: target.balance });
        transaction.set(transactionsCollection(db).doc(), { fromName: sender.name, toName: target.name, message: message || '',
          timestamp: FieldValue.serverTimestamp(), emoji: DONUT_EMOJI, amount: donutCount, likes: [], source: 'teams',
          teamsActivityId: activityId, teamsSenderId: stableTeamsId(senderTeamsUser) });
      }
      const result = { ok: true, sender: sender.name, recipients: targets.map((t) => t.name), amountEach: donutCount, total };
      transaction.set(processedRef, { ...result, requestBinding, senderTeamsId: stableTeamsId(senderTeamsUser),
        recipientTeamsIds: recipients.map(([, u]) => stableTeamsId(u)), message: message || '', createdAt: FieldValue.serverTimestamp() });
      return result;
    });
  } catch (error) {
    if (error instanceof GiftValidationError) return { ok: false, code: error.code, ...error.details };
    throw error; // SDK/staging failures must abort, never return success.
  }
}

module.exports = { giveDonutsFromTeams, defaultPublicProfile };
