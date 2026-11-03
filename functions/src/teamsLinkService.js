'use strict';

const { rosterDoc, usersCollection, teamsIntegrationDoc, teamsMappingsCollection } = require('./firestorePaths');

const MAPPING_KEY = /^[A-Za-z0-9_-]{1,512}$/u;
const text = value => (typeof value === 'string' && value ? value : null);
const millis = value => (typeof value?.toMillis === 'function' ? value.toMillis() : null);

function activeRoster(snap) {
  const data = snap.exists ? snap.data() : {};
  const removed = new Set(Array.isArray(data.removed_names) ? data.removed_names : []);
  return (Array.isArray(data.names) ? data.names : []).filter(name => typeof name === 'string' && !removed.has(name));
}

// Teams identity fields come from what the bot recorded, never from the browser.
function identityFrom(pending, mapping) {
  return {
    teamsUserId: text(pending?.teamsUserId) || text(mapping?.teamsUserId),
    teamsAadObjectId: text(pending?.aadObjectId) || text(mapping?.teamsAadObjectId),
    teamsEmail: text(pending?.userPrincipalName) || text(mapping?.teamsEmail),
    displayName: text(pending?.displayName) || text(mapping?.displayName),
  };
}

function createTeamsLinkService({ db, HttpsError, FieldValue }) {
  const fail = (code, message) => { throw new HttpsError(code, message); };
  const pendingCollection = () => teamsIntegrationDoc(db).collection('pendingMappings');

  async function list() {
    const [pendingSnap, linkSnap, rosterSnap] = await Promise.all([
      pendingCollection().get(), teamsMappingsCollection(db).get(), rosterDoc(db).get(),
    ]);
    const roster = activeRoster(rosterSnap);
    const pendingByKey = new Map(pendingSnap.docs.map(snap => [snap.id, snap.data()]));
    const linkedNames = [...new Set(linkSnap.docs.map(snap => text(snap.data().yumName)).filter(Boolean))];
    const profiles = new Map(await Promise.all(linkedNames.map(async name => {
      const snap = await usersCollection(db).doc(name).get();
      return [name, snap.exists ? snap.data() : null];
    })));

    const links = linkSnap.docs.map(snap => {
      const mapping = snap.data();
      const pending = pendingByKey.get(snap.id);
      const yumName = text(mapping.yumName);
      const identity = identityFrom(pending, mapping);
      return {
        mappingKey: snap.id,
        yumName,
        displayName: identity.displayName,
        email: identity.teamsEmail,
        seenWhen: identity.teamsAadObjectId ? 'giving' : 'mentioned',
        onRoster: Boolean(yumName && roster.includes(yumName)),
        hasAccount: Boolean(text(mapping.uid) || text(profiles.get(yumName)?.uid)),
        lastSeenAt: millis(pending?.lastSeenAt),
      };
    });
    const linkedKeys = new Set(links.map(link => link.mappingKey));
    const pending = [...pendingByKey].filter(([key]) => !linkedKeys.has(key)).map(([mappingKey, data]) => ({
      mappingKey,
      displayName: text(data.displayName),
      email: text(data.userPrincipalName),
      seenWhen: text(data.aadObjectId) ? 'giving' : 'mentioned',
      lastSeenAt: millis(data.lastSeenAt),
    }));
    return { roster, links, pending };
  }

  async function link({ mappingKey, yumName, alsoLinked }, callerUid) {
    const mappingRef = teamsMappingsCollection(db).doc(mappingKey);
    return db.runTransaction(async transaction => {
      const [rosterSnap, pendingSnap, mappingSnap, sameNameSnap] = await Promise.all([
        transaction.get(rosterDoc(db)),
        transaction.get(pendingCollection().doc(mappingKey)),
        transaction.get(mappingRef),
        transaction.get(teamsMappingsCollection(db).where('yumName', '==', yumName)),
      ]);
      if (!activeRoster(rosterSnap).includes(yumName)) {
        fail('failed-precondition', `${yumName} is not on the roster. Refresh and pick a name from the list.`);
      }
      const pending = pendingSnap.exists ? pendingSnap.data() : null;
      const mapping = mappingSnap.exists ? mappingSnap.data() : null;
      if (!pending && !mapping) {
        fail('not-found', 'Yum Donut has not seen this Teams user yet. Refresh and try again.');
      }
      // A second Teams record for the same name lets that person spend the student's donuts,
      // so it needs the teacher's explicit say-so.
      const others = sameNameSnap.docs.filter(snap => snap.id !== mappingKey);
      if (others.length > 0 && alsoLinked !== true) {
        fail('already-exists', `${yumName} is already linked to another Teams record. Confirm to link this one as well.`);
      }

      const identity = identityFrom(pending, mapping);
      if (mapping && mapping.yumName === yumName) {
        transaction.set(mappingRef, { ...identity, mappingKey }, { merge: true });
        return { mappingKey, yumName, changed: false };
      }
      // A new or changed link starts clean: a uid or isAdmin left from the old name must not carry over.
      transaction.set(mappingRef, {
        ...identity,
        mappingKey,
        yumName,
        linkedAt: FieldValue.serverTimestamp(),
        linkedBy: callerUid,
      });
      return { mappingKey, yumName, changed: true, previousName: text(mapping?.yumName) };
    });
  }

  async function unlink({ mappingKey }) {
    const mappingRef = teamsMappingsCollection(db).doc(mappingKey);
    const snap = await mappingRef.get();
    if (!snap.exists) return { mappingKey, removed: false };
    await mappingRef.delete();
    return { mappingKey, removed: true, previousName: text(snap.data().yumName) };
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

    const validKey = typeof data.mappingKey === 'string' && MAPPING_KEY.test(data.mappingKey);
    if (data.action === 'unlink' && keys === 'action,mappingKey' && validKey) return unlink(data);
    if (data.action === 'link' && validKey
      && ['action,mappingKey,yumName', 'action,alsoLinked,mappingKey,yumName'].includes(keys)
      && (data.alsoLinked === undefined || typeof data.alsoLinked === 'boolean')
      && typeof data.yumName === 'string' && data.yumName && data.yumName.length <= 80) {
      return link(data, caller.uid);
    }
    fail('invalid-argument', 'That Teams link request was not understood. Refresh and try again.');
  };
}

module.exports = { createTeamsLinkService };
