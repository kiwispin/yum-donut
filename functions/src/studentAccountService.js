'use strict';

const APP_ID = 'yum-donut-school';
const DOMAIN = '@yumdonut.school';
const normalize = value => String(value || '').normalize('NFKC').trim();

function emailForName(name) {
  let hash = 2166136261;
  for (const character of normalize(name)) {
    hash ^= character.codePointAt(0);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  const slug = normalize(name).toLowerCase().replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'user';
  return `${slug}-${hash.toString(36)}${DOMAIN}`;
}

function legacyEmailForName(name) {
  return `${normalize(name).replace(/\s+/g, '').toLowerCase()}${DOMAIN}`;
}

function createStudentAccountService({ authAdmin, db, HttpsError, arrayUnion, arrayRemove }) {
  const fail = (code, message) => { throw new HttpsError(code, message); };
  const missingAuthUser = error => error?.code === 'auth/user-not-found';
  const refs = name => ({
    roster: db.doc(`artifacts/${APP_ID}/public/data/config/roster`),
    publicUser: db.doc(`artifacts/${APP_ID}/public/data/users/${name}`),
  });
  const profile = async uid => {
    const snap = await db.doc(`artifacts/${APP_ID}/users/${uid}/profile/data`).get();
    return snap.exists ? snap.data() : null;
  };
  const exactStudent = async (user, name, allowDisplayName = true) => {
    const data = await profile(user.uid);
    if (data) return normalize(data.name) === name;
    return allowDisplayName && normalize(user.displayName) === name;
  };
  async function findStudentAccount(name, publicData) {
    if (publicData?.uid) {
      let linked;
      try { linked = await authAdmin.getUser(publicData.uid); }
      catch (error) {
        if (missingAuthUser(error)) fail('failed-precondition', 'This student already has a saved Yum Donut account, but its sign-in record is missing. Do not create a replacement account; ask the administrator to restore the linked account.');
        throw error;
      }
      if (!await exactStudent(linked, name) || (publicData.name && normalize(publicData.name) !== name)) {
        fail('failed-precondition', 'The saved account name does not match this roster entry. Ask the administrator to review it.');
      }
      for (const email of new Set([emailForName(name), legacyEmailForName(name)])) {
        try {
          const candidate = await authAdmin.getUserByEmail(email);
          if (candidate.uid !== linked.uid && await exactStudent(candidate, name)) {
            fail('failed-precondition', 'More than one sign-in record matches this saved account. Ask the administrator to review it.');
          }
        } catch (error) {
          if (error instanceof HttpsError) throw error;
          if (!missingAuthUser(error)) throw error;
        }
      }
      return linked;
    }

    const emails = [...new Set([emailForName(name), legacyEmailForName(name)])];
    const matches = [];
    for (const email of emails) {
      try {
        const user = await authAdmin.getUserByEmail(email);
        if (!await exactStudent(user, name)) {
          fail('failed-precondition', 'A sign-in record with a different or unverified student name already exists. Ask the administrator to review it.');
        }
        matches.push(user);
      } catch (error) {
        if (error instanceof HttpsError) throw error;
        if (!missingAuthUser(error)) throw error;
      }
    }
    const unique = [...new Map(matches.map(user => [user.uid, user])).values()];
    if (unique.length > 1) fail('failed-precondition', 'More than one sign-in record matches this student. Ask the administrator to review it.');
    return unique[0] || null;
  }

  return async request => {
    const caller = request.auth;
    if (!caller?.uid || caller.token?.yumpalsAdmin !== true
      || caller.token?.firebase?.sign_in_provider === 'anonymous') {
      fail('permission-denied', 'Only the signed-in teacher can set up student accounts.');
    }
    const data = request.data;
    if (!data || Object.keys(data).length !== 3
      || !['add', 'set-password'].includes(data.action)
      || typeof data.name !== 'string' || data.name.length > 80
      || normalize(data.name) !== data.name || !data.name
      || /[/\\]/u.test(data.name) || [...data.name].some(character => character.codePointAt(0) < 32)
      || typeof data.password !== 'string' || data.password.length < 6 || data.password.length > 128) {
      fail('invalid-argument', 'Enter a student name and a password between 6 and 128 characters.');
    }
    const name = normalize(data.name);
    const { roster, publicUser } = refs(name);
    const [rosterSnap, publicSnap] = await Promise.all([roster.get(), publicUser.get()]);
    const rosterData = rosterSnap.exists ? rosterSnap.data() : {};
    const names = Array.isArray(rosterData.names) ? rosterData.names : [];
    const removed = Array.isArray(rosterData.removed_names) ? rosterData.removed_names : [];
    const nameKey = name.toLowerCase();
    const rosterMatch = names.find(entry => typeof entry === 'string' && entry.toLowerCase() === nameKey
      && !removed.includes(entry));
    if (data.action === 'set-password' && rosterMatch !== name) {
      fail('failed-precondition', 'Add this student to the roster before setting up their account.');
    }
    if (data.action === 'add' && rosterMatch) {
      fail('already-exists', 'This student is already on the roster. Use the key button to set or reset their password.');
    }

    const publicData = publicSnap.exists ? publicSnap.data() : null;
    let user = await findStudentAccount(name, publicData);
    let created = false;
    if (!user) {
      try {
        user = await authAdmin.createUser({ email: emailForName(name), password: data.password, displayName: name, emailVerified: true });
        created = true;
      } catch (error) {
        if (error?.code === 'auth/email-already-exists') {
          fail('failed-precondition', 'A sign-in record already uses this student name but could not be safely matched. Ask the administrator to review it.');
        }
        throw error;
      }
    } else {
      try { await authAdmin.updateUser(user.uid, { password: data.password }); }
      catch (error) {
        if (missingAuthUser(error)) fail('failed-precondition', 'The linked sign-in record disappeared. Refresh Settings and try again.');
        throw error;
      }
    }

    if (data.action === 'add') {
      await roster.set({ names: arrayUnion(name), removed_names: arrayRemove(name) }, { merge: true });
    }
    return { name, created, rosterAdded: data.action === 'add' };
  };
}

module.exports = { createStudentAccountService, emailForName, legacyEmailForName };
