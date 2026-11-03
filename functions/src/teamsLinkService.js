'use strict';

const { rosterDoc, usersCollection, teamsIntegrationDoc, teamsMappingsCollection } = require('./firestorePaths');
const { mappingKeyForTeamsUser } = require('./identity');

const MAPPING_KEY = /^[A-Za-z0-9_-]{1,512}$/u;
const text = value => (typeof value === 'string' && value ? value : null);
const millis = value => (typeof value?.toMillis === 'function' ? value.toMillis() : null);
const decodeKey = key => Buffer.from(key, 'base64url').toString('utf8');

function activeRoster(snap) {
  const data = snap.exists ? snap.data() : {};
  const removed = new Set(Array.isArray(data.removed_names) ? data.removed_names : []);
  return (Array.isArray(data.names) ? data.names : []).filter(name => typeof name === 'string' && !removed.has(name));
}

// The bot finds a giver by their Entra id and a mentioned person by their Teams id, so a
// Team member is linked under both keys. The first key is the person's id on this screen.
function keysForMember(member) {
  const keys = [member.aadObjectId, member.id].filter(Boolean).map(id => mappingKeyForTeamsUser({ aadObjectId: id }));
  return [...new Set(keys)];
}

function memberIdentity(member) {
  return {
    teamsUserId: text(member.id),
    teamsAadObjectId: text(member.aadObjectId),
    teamsEmail: text(member.email) || text(member.userPrincipalName),
    displayName: text(member.name),
  };
}

// Teams identity fields come from what the bot recorded, never from the browser.
function recordIdentity(pending, mapping) {
  return {
    teamsUserId: text(pending?.teamsUserId) || text(mapping?.teamsUserId),
    teamsAadObjectId: text(pending?.aadObjectId) || text(mapping?.teamsAadObjectId),
    teamsEmail: text(pending?.userPrincipalName) || text(mapping?.teamsEmail),
    displayName: text(pending?.displayName) || text(mapping?.displayName),
  };
}

function createTeamsLinkService({ db, HttpsError, FieldValue, roster }) {
  const fail = (code, message) => { throw new HttpsError(code, message); };
  const pendingCollection = () => teamsIntegrationDoc(db).collection('pendingMappings');

  async function teamMember(personId) {
    const reference = await roster.reference();
    if (!reference) fail('failed-precondition', 'Yum Donut does not know your Team yet. Write @YumDonut once in the Team, then refresh.');
    let member;
    try {
      member = await roster.member(reference, decodeKey(personId));
    } catch (error) {
      console.error('Could not read the Teams member:', error?.message);
      fail('unavailable', 'Could not reach Teams just now. Please try again.');
    }
    if (!member) fail('not-found', 'This person is no longer in the Team. Refresh and try again.');
    return member;
  }

  async function list() {
    const [pendingSnap, linkSnap, rosterSnap] = await Promise.all([
      pendingCollection().get(), teamsMappingsCollection(db).get(), rosterDoc(db).get(),
    ]);
    const rosterNames = activeRoster(rosterSnap);
    const pendingByKey = new Map(pendingSnap.docs.map(snap => [snap.id, snap.data()]));
    const mappingByKey = new Map(linkSnap.docs.map(snap => [snap.id, snap.data()]));
    const linkedNames = [...new Set([...mappingByKey.values()].map(mapping => text(mapping.yumName)).filter(Boolean))];
    const profiles = new Map(await Promise.all(linkedNames.map(async name => {
      const snap = await usersCollection(db).doc(name).get();
      return [name, snap.exists ? snap.data() : null];
    })));
    const status = (yumName, mappings) => ({
      onRoster: Boolean(yumName && rosterNames.includes(yumName)),
      hasAccount: Boolean(mappings.some(mapping => text(mapping?.uid)) || text(profiles.get(yumName)?.uid)),
    });

    let team = { status: 'unknown', name: null };
    let members = [];
    try {
      const reference = await roster.reference();
      if (reference) {
        members = await roster.members(reference);
        team = { status: 'ok', name: text(reference.teamName) };
      }
    } catch (error) {
      console.error('Could not read the Teams team members:', error?.message);
      team = { status: 'error', name: null };
    }

    const claimed = new Set();
    const memberAadIds = new Set();
    const people = members.map(member => {
      const keys = keysForMember(member);
      keys.forEach(key => claimed.add(key));
      if (member.aadObjectId) memberAadIds.add(member.aadObjectId);
      const mappings = keys.map(key => mappingByKey.get(key));
      const names = mappings.map(mapping => text(mapping?.yumName));
      const yumName = names.find(Boolean) || null;
      return {
        personId: keys[0],
        displayName: text(member.name),
        email: text(member.email) || text(member.userPrincipalName),
        yumName,
        complete: Boolean(yumName) && names.every(name => name === yumName),
        ...status(yumName, mappings),
      };
    }).filter(person => person.personId);

    const records = [...new Set([...pendingByKey.keys(), ...mappingByKey.keys()])]
      .filter(key => !claimed.has(key))
      .filter(key => {
        const aad = text(pendingByKey.get(key)?.aadObjectId) || text(mappingByKey.get(key)?.teamsAadObjectId);
        return !(aad && memberAadIds.has(aad));
      })
      .map(mappingKey => {
        const pending = pendingByKey.get(mappingKey);
        const mapping = mappingByKey.get(mappingKey);
        const identity = recordIdentity(pending, mapping);
        const yumName = text(mapping?.yumName);
        return {
          mappingKey,
          displayName: identity.displayName,
          email: identity.teamsEmail,
          seenWhen: identity.teamsAadObjectId ? 'giving' : 'mentioned',
          lastSeenAt: millis(pending?.lastSeenAt),
          yumName,
          ...status(yumName, [mapping]),
        };
      });
    return { roster: rosterNames, team, people, records };
  }

  // Writes one mapping per key in a single transaction. A key already linked to this name keeps
  // its fields; a new or changed key starts clean, so a uid or isAdmin for an old name never carries over.
  async function writeLinks({ keys, identityFor, sameOwner, yumName, alsoLinked, callerUid, missing }) {
    return db.runTransaction(async transaction => {
      const [rosterSnap, sameNameSnap, ...snaps] = await Promise.all([
        transaction.get(rosterDoc(db)),
        transaction.get(teamsMappingsCollection(db).where('yumName', '==', yumName)),
        ...keys.flatMap(key => [transaction.get(teamsMappingsCollection(db).doc(key)), transaction.get(pendingCollection().doc(key))]),
      ]);
      if (!activeRoster(rosterSnap).includes(yumName)) {
        fail('failed-precondition', `${yumName} is not on the roster. Refresh and pick a name from the list.`);
      }
      const existing = keys.map((key, index) => ({
        key,
        mapping: snaps[index * 2].exists ? snaps[index * 2].data() : null,
        pending: snaps[index * 2 + 1].exists ? snaps[index * 2 + 1].data() : null,
      }));
      if (missing && missing(existing)) fail('not-found', 'Yum Donut has not seen this Teams user yet. Refresh and try again.');
      // Another person linked to the same name could spend this student's donuts, so it needs the teacher's say-so.
      const others = sameNameSnap.docs.filter(snap => !keys.includes(snap.id) && !sameOwner(snap.data()));
      if (others.length > 0 && alsoLinked !== true) {
        fail('already-exists', `${yumName} is already linked to someone else in Teams. Confirm to link this person as well.`);
      }

      let changed = false;
      let previousName = null;
      for (const { key, mapping, pending } of existing) {
        const ref = teamsMappingsCollection(db).doc(key);
        const identity = identityFor(pending, mapping);
        if (mapping && mapping.yumName === yumName) {
          transaction.set(ref, { ...identity, mappingKey: key }, { merge: true });
          continue;
        }
        changed = true;
        previousName = previousName || text(mapping?.yumName);
        transaction.set(ref, {
          ...identity, mappingKey: key, yumName, linkedAt: FieldValue.serverTimestamp(), linkedBy: callerUid,
        });
      }
      return { yumName, changed, previousName };
    });
  }

  async function linkPerson({ personId, yumName, alsoLinked }, callerUid) {
    const member = await teamMember(personId);
    const identity = memberIdentity(member);
    const result = await writeLinks({
      keys: keysForMember(member), identityFor: () => identity, yumName, alsoLinked, callerUid,
      sameOwner: mapping => Boolean(member.aadObjectId) && mapping.teamsAadObjectId === member.aadObjectId,
    });
    return { personId, ...result };
  }

  async function linkRecord({ mappingKey, yumName, alsoLinked }, callerUid) {
    const result = await writeLinks({
      keys: [mappingKey], identityFor: recordIdentity, yumName, alsoLinked, callerUid,
      sameOwner: () => false,
      missing: ([entry]) => !entry.mapping && !entry.pending,
    });
    return { mappingKey, ...result };
  }

  async function removeDocs(refs) {
    return db.runTransaction(async transaction => {
      const snaps = await Promise.all(refs.map(ref => transaction.get(ref)));
      const found = snaps.filter(snap => snap.exists);
      const previousName = found.map(snap => text(snap.data().yumName)).find(Boolean) || null;
      refs.forEach((ref, index) => { if (snaps[index].exists) transaction.delete(ref); });
      return { removed: found.length > 0, previousName };
    });
  }

  async function unlinkPerson({ personId }) {
    let keys = [personId];
    try {
      const reference = await roster.reference();
      const member = reference ? await roster.member(reference, decodeKey(personId)) : null;
      if (member) keys = [...new Set([personId, ...keysForMember(member)])];
    } catch (error) {
      console.warn('Could not read the Teams member while unlinking:', error?.message);
    }
    const sameOwner = await teamsMappingsCollection(db).where('teamsAadObjectId', '==', decodeKey(personId)).get();
    sameOwner.docs.forEach(snap => { if (!keys.includes(snap.id)) keys.push(snap.id); });
    const result = await removeDocs(keys.map(key => teamsMappingsCollection(db).doc(key)));
    return { personId, ...result };
  }

  async function unlinkRecord({ mappingKey }) {
    return { mappingKey, ...await removeDocs([teamsMappingsCollection(db).doc(mappingKey)]) };
  }

  // For people who are no longer in the Team: removes their link and the bot's record of them.
  async function forgetRecord({ mappingKey }) {
    return { mappingKey, ...await removeDocs([teamsMappingsCollection(db).doc(mappingKey), pendingCollection().doc(mappingKey)]) };
  }

  return async request => {
    const caller = request.auth;
    if (!caller?.uid || caller.token?.yumpalsAdmin !== true
      || caller.token?.firebase?.sign_in_provider === 'anonymous') {
      fail('permission-denied', 'Only the signed-in teacher can link Teams accounts.');
    }
    const data = request.data || {};
    const keys = Object.keys(data).sort().join(',');
    if (data.action === 'list' && keys === 'action') return list();

    const target = typeof data.personId === 'string' ? 'personId' : 'mappingKey';
    const validTarget = typeof data[target] === 'string' && MAPPING_KEY.test(data[target]);
    if (!validTarget) fail('invalid-argument', 'That Teams link request was not understood. Refresh and try again.');
    if (data.action === 'unlink' && keys === `action,${target}`) {
      return target === 'personId' ? unlinkPerson(data) : unlinkRecord(data);
    }
    if (data.action === 'forget' && keys === 'action,mappingKey') return forgetRecord(data);
    if (data.action === 'link'
      && [`action,${target},yumName`, `action,alsoLinked,${target},yumName`].includes(keys)
      && (data.alsoLinked === undefined || typeof data.alsoLinked === 'boolean')
      && typeof data.yumName === 'string' && data.yumName && data.yumName.length <= 80) {
      return target === 'personId' ? linkPerson(data, caller.uid) : linkRecord(data, caller.uid);
    }
    fail('invalid-argument', 'That Teams link request was not understood. Refresh and try again.');
  };
}

module.exports = { createTeamsLinkService, keysForMember };
