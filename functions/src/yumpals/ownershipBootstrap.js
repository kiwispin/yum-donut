// INTERNAL ONLY. No endpoint, live paths, caller-supplied manifest or approval default.
const { createHash } = require('node:crypto');

class ReviewConflict extends Error { constructor(code, conflicts) { super(code); this.code = code; this.conflicts = conflicts; } }
const check = (condition, code) => { if (!condition) throw new ReviewConflict(code); };
const id = (value) => typeof value === 'string' && value.trim().length > 0 && value.length <= 128 && !value.includes('/') && value !== '.' && value !== '..';
const hash = (value) => typeof value === 'string' && /^[a-f0-9]{64}$/u.test(value);
const { walletNumber: money } = require('./walletNumber');

// Plain manifest/audit canonicalization. Never pass entire profiles here.
function canonical(value) {
  if (value === null) return ['null'];
  if (typeof value === 'string' || typeof value === 'boolean') return [typeof value, value];
  if (typeof value === 'number') { check(Number.isFinite(value), 'UNSUPPORTED_SNAPSHOT_VALUE'); return ['number', Object.is(value, -0) ? '-0' : value]; }
  if (Array.isArray(value)) { check(Object.keys(value).length === value.length, 'UNSUPPORTED_SNAPSHOT_VALUE'); return ['array', value.map(canonical)]; }
  check(value && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null), 'UNSUPPORTED_SNAPSHOT_VALUE');
  return ['object', Object.keys(value).sort().map((key) => [key, canonical(value[key])])];
}
function manifestFingerprint(value) { return createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex'); }
const PROFILE_REVIEW_FIELDS_V1 = ['uid', 'name', 'claimed', 'ownerUid', 'balance', 'bank_balance',
  'lifetime_given', 'lifetime_received', 'given_today', 'last_given_date', 'training_earned_today', 'training_last_earned_date'];
function snapshotFingerprint(value) {
  check(value && typeof value === 'object' && !Array.isArray(value), 'PROFILE_MISSING');
  return manifestFingerprint({ projectionVersion: 1, fields: PROFILE_REVIEW_FIELDS_V1.map((key) =>
    [key, Object.hasOwn(value, key) ? ['present', value[key]] : ['missing']]) });
}
const exactKeys = (value, keys) => value && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));

function validateManifest(manifest, reviewId, approvedDigest) {
  check(exactKeys(manifest, ['schemaVersion', 'reviewId', 'approval', 'entries']) && manifest.schemaVersion === 1
    && manifest.reviewId === reviewId && id(reviewId), 'INVALID_MANIFEST');
  const approval = manifest.approval;
  check(exactKeys(approval, ['operatorUid', 'source', 'approvedAtMs', 'decision']) && id(approval.operatorUid)
    && typeof approval.source === 'string' && approval.source.trim().length > 0 && approval.source.length <= 1000
    && Number.isSafeInteger(approval.approvedAtMs) && approval.approvedAtMs > 0 && approval.decision === 'approved', 'INVALID_APPROVAL');
  check(Array.isArray(manifest.entries) && manifest.entries.length > 0 && manifest.entries.length <= 40, 'INVALID_MANIFEST');
  const uids = new Set(); const records = new Set();
  for (const entry of manifest.entries) {
    check(exactKeys(entry, ['uid', 'publicProfileId', 'expectedPublicHash', 'expectedPrivateHash'])
      && id(entry.uid) && id(entry.publicProfileId) && hash(entry.expectedPublicHash) && hash(entry.expectedPrivateHash)
      && !uids.has(entry.uid) && !records.has(entry.publicProfileId), 'INVALID_MANIFEST');
    uids.add(entry.uid); records.add(entry.publicProfileId);
  }
  check(hash(approvedDigest) && manifestFingerprint(manifest) === approvedDigest, 'APPROVAL_BINDING_MISMATCH');
}

function validateProfiles(a, b, uid) {
  check(a && b, 'PROFILE_MISSING');
  // Compatibility prerequisite only; the independently approved manifest is authority.
  check(a.uid === uid && a.claimed === true, 'PUBLIC_LINK_REPAIR_REQUIRED');
  for (const data of [a, b]) {
    check(!Object.hasOwn(data, 'ownerUid') || data.ownerUid === uid, 'OWNER_CONFLICT');
    check(!Object.hasOwn(data, 'uid') || data.uid === uid, 'LEGACY_UID_CONFLICT');
    // Preserve the existing numeric wallet domain without rounding or conversion.
    check(money(data.balance), 'INVALID_WALLET');
    check(typeof data.bank_balance === 'number' && Number.isFinite(data.bank_balance)
      && data.bank_balance >= 0 && data.bank_balance <= Number.MAX_SAFE_INTEGER, 'INVALID_BANK');
  }
  check(a.balance === b.balance && a.bank_balance === b.bank_balance, 'MIRROR_CONFLICT');
  // Names are bound by reviewed hashes, never used as ownership authority.
}

function createOwnershipBootstrap({ db, authAdmin, refs, loadApprovedManifest }) {
  check(db && typeof db.runTransaction === 'function' && authAdmin && typeof authAdmin.getUser === 'function'
    && typeof loadApprovedManifest === 'function' && refs
    && ['publicProfile', 'privateProfile', 'mapping', 'reverse', 'audit'].every((key) => typeof refs[key] === 'function'), 'TRUSTED_DEPENDENCIES_REQUIRED');

  async function execute(reviewId, apply) {
    check(id(reviewId), 'INVALID_REVIEW_ID');
    // Loader must resolve a separately approved immutable review, NOT client storage.
    const approved = await loadApprovedManifest(reviewId);
    check(approved && approved.manifest, 'REVIEW_NOT_APPROVED');
    validateManifest(approved.manifest, reviewId, approved.approvedDigest);
    const manifest = structuredClone(approved.manifest);
    const manifestHash = approved.approvedDigest;
    return db.runTransaction(async (transaction) => {
      const auditRef = refs.audit(reviewId);
      const auditSnap = await transaction.get(auditRef);
      const targets = [];
      const paths = new Set();
      const uniqueRef = (ref) => {
        const path = typeof ref === 'string' ? ref : ref?.path;
        check(typeof path === 'string' && path.length > 0 && !paths.has(path), 'REFERENCE_COLLISION'); paths.add(path);
        return ref;
      };
      uniqueRef(auditRef);
      for (const entry of manifest.entries) {
        const publicRef = uniqueRef(refs.publicProfile(entry.publicProfileId));
        const privateRef = uniqueRef(refs.privateProfile(entry.uid));
        const forwardRef = uniqueRef(refs.mapping(entry.uid));
        const reverseRef = uniqueRef(refs.reverse(entry.publicProfileId));
        const a = await transaction.get(publicRef); const b = await transaction.get(privateRef);
        const forward = await transaction.get(forwardRef); const reverse = await transaction.get(reverseRef);
        targets.push({ entry, publicRef, privateRef, forwardRef, reverseRef, a: a.exists ? a.data() : null, b: b.exists ? b.data() : null,
          forward: forward.exists ? forward.data() : null, reverse: reverse.exists ? reverse.data() : null });
      }
      // Verify eligibility on every transaction attempt; Auth and Firestore cannot
      // commit atomically together. Operator must hold a controlled migration window.
      const conflicts = [];
      for (const target of targets) {
        try {
        let record;
        try { record = await authAdmin.getUser(target.entry.uid); }
        catch (error) { if (error.code === 'auth/user-not-found') throw new ReviewConflict('AUTH_USER_MISSING'); throw error; }
        check(record?.uid === target.entry.uid && record.disabled === false && Array.isArray(record.providerData)
          && record.providerData.length > 0 && record.providerData.every((provider) => typeof provider.providerId === 'string'
            && provider.providerId.length > 0 && provider.providerId !== 'anonymous'), 'AUTH_USER_INELIGIBLE');
        } catch (error) {
          if (!(error instanceof ReviewConflict)) throw error;
          conflicts.push({ uid: target.entry.uid, publicProfileId: target.entry.publicProfileId, code: error.code });
        }
      }
      if (auditSnap.exists) {
        const audit = auditSnap.data();
        check(audit.schemaVersion === 1 && audit.reviewId === reviewId && audit.manifestHash === manifestHash
          && audit.status === 'APPLIED' && manifestFingerprint(audit.approval) === manifestFingerprint(manifest.approval)
          && manifestFingerprint(audit.entries) === manifestFingerprint(manifest.entries), 'AUDIT_CONFLICT');
      }
      for (const target of targets) {
        try {
        const { entry, a, b, forward, reverse } = target;
        validateProfiles(a, b, entry.uid);
        check(Boolean(forward) === Boolean(reverse), 'MAPPING_INCOMPLETE');
        if (forward) {
          check(forward.schemaVersion === 1 && forward.ownerUid === entry.uid && forward.publicProfileId === entry.publicProfileId
            && reverse.schemaVersion === 1 && reverse.ownerUid === entry.uid && reverse.publicProfileId === entry.publicProfileId, 'MAPPING_CONFLICT');
          check(a.ownerUid === entry.uid && b.ownerUid === entry.uid, 'OWNER_CONFLICT');
        }
        if (auditSnap.exists) check(forward && reverse && a.ownerUid === entry.uid && b.ownerUid === entry.uid, 'AUDIT_STATE_CONFLICT');
        else check(snapshotFingerprint(a) === entry.expectedPublicHash && snapshotFingerprint(b) === entry.expectedPrivateHash, 'SNAPSHOT_CHANGED');
        } catch (error) {
          if (!(error instanceof ReviewConflict)) throw error;
          conflicts.push({ uid: target.entry.uid, publicProfileId: target.entry.publicProfileId, code: error.code });
        }
      }
      if (conflicts.length) throw new ReviewConflict('REVIEW_CONFLICTS', conflicts);
      const plan = { ok: true, reviewId, manifestHash, duplicate: auditSnap.exists, applied: apply,
        assignments: targets.map(({ entry, forward }) => ({ uid: entry.uid, publicProfileId: entry.publicProfileId, alreadyMapped: Boolean(forward) })) };
      if (!apply || auditSnap.exists) return plan;
      // ALL reads and validation complete. Never modify money or replace profiles.
      for (const target of targets) {
        if (target.forward) continue;
        transaction.update(target.publicRef, { ownerUid: target.entry.uid });
        transaction.update(target.privateRef, { ownerUid: target.entry.uid });
        const mapping = { schemaVersion: 1, ownerUid: target.entry.uid, publicProfileId: target.entry.publicProfileId };
        transaction.set(target.forwardRef, mapping);
        transaction.set(target.reverseRef, mapping);
      }
      transaction.set(auditRef, { schemaVersion: 1, reviewId, manifestHash, status: 'APPLIED', approval: manifest.approval, entries: manifest.entries });
      return plan;
    });
  }
  return {
    dryRun: async (reviewId) => {
      try { return await execute(reviewId, false); }
      catch (error) { if (error instanceof ReviewConflict) return { ok: false, reviewId, conflicts: error.conflicts || [{ code: error.code }] }; throw error; }
    },
    apply: (reviewId) => execute(reviewId, true),
  };
}

module.exports = { createOwnershipBootstrap, snapshotFingerprint, manifestFingerprint };
