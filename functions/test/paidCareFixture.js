// Synthetic optimistic transaction fixture; never imports Admin SDK or credentials.
const { createPaidCareService } = require('../src/yumpals/paidCareService');
const { defaultConfig, digest, migrateLegacyPet } = require('../src/yumpals/paidCareEngine');

class FakeDb {
  constructor() { this.values = new Map(); this.versions = new Map(); this.failCommit = false; this.commits = 0; this.conflicts = 0; }
  seed(path, value) { this.values.set(path, structuredClone(value)); this.versions.set(path, (this.versions.get(path) || 0) + 1); }
  read(path) { return structuredClone(this.values.get(path)); }
  async runTransaction(callback) {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const reads = new Map();
      const writes = new Map();
      const transaction = {
        get: async (path) => {
          if (writes.size) throw new Error('READ_AFTER_WRITE');
          reads.set(path, this.versions.get(path) || 0);
          const value = this.read(path);
          return { exists: value !== undefined, data: () => structuredClone(value) };
        },
        set: (path, value, options = {}) => { writes.set(path, structuredClone(options.merge ? { ...this.read(path), ...value } : value)); },
      };
      const result = await callback(transaction);
      if ([...reads].some(([path, version]) => (this.versions.get(path) || 0) !== version)) { this.conflicts += 1; continue; }
      if (this.failCommit && writes.size) { this.failCommit = false; throw new Error('COMMIT_FAILURE'); }
      for (const [path, value] of writes) this.seed(path, value);
      if (writes.size) this.commits += 1;
      return result;
    }
    throw new Error('RETRY_EXHAUSTED');
  }
}

function legacy(uid = 'student-a') {
  return { schemaVersion: 1, ownerUid: uid, name: 'Niblet', species: 'mossbit', casing: 'berry', color: '#d94878', reducedMotion: false, careDays: 12, earnedMilestones: ['trick', 'accessory'], possessions: ['old-hat'], unknown: { keep: true } };
}
function request(uid = 'student-a', data = {}) { return { auth: { uid, token: { firebase: { sign_in_provider: 'password' } } }, data }; }

function setup({ needs, balance = 30, pet = true } = {}) {
  const db = new FakeDb();
  let clock = Date.parse('2026-09-07T00:00:00Z'); // Monday noon Auckland.
  const refs = { config: (uid) => `fixture/config/${uid}`, pet: (uid) => `fixture/pets/${uid}`, receipt: (uid, id) => `fixture/receipts/${uid}/${id}`, migration: (uid) => `fixture/migrations/${uid}` };
  const config = { ...defaultConfig('2026-01-01'), enabled: true };
  const walletAdapter = {
    read: async (transaction, uid) => {
      const mapping = await transaction.get(`fixture/trustedMapping/${uid}`);
      if (!mapping.exists || mapping.data().ownerUid !== uid || mapping.data().walletId !== uid) throw new Error('TRUSTED_MAPPING_REQUIRED');
      const ref = `fixture/wallets/${uid}`;
      const snapshot = await transaction.get(ref);
      if (!snapshot.exists) throw new Error('WALLET_MISSING');
      return { ...snapshot.data(), ref };
    },
    debit: (transaction, wallet, amount) => { const { ref, ...fields } = wallet; transaction.set(ref, { ...fields, balance: wallet.balance - amount }); },
  };
  const service = createPaidCareService({ db, refs, walletAdapter, now: () => clock });
  for (const uid of ['student-a', 'student-b']) {
    db.seed(refs.config(uid), config);
    db.seed(`fixture/trustedMapping/${uid}`, { ownerUid: uid, walletId: uid });
    db.seed(`fixture/wallets/${uid}`, { ownerUid: uid, balance, bank_balance: 100, given_today: 3, lifetime_given: 50, lifetime_received: 80, metadata: { fixture: true } });
    if (pet) {
      const migrated = migrateLegacyPet(legacy(uid), uid, config, clock);
      if (needs) migrated.paidCare.needs = { ...needs };
      db.seed(refs.pet(uid), migrated);
    }
  }
  const purchaseRequest = (action, operationId = 'purchase-1', uid = 'student-a', extra = {}) => {
    const current = db.read(refs.config(uid));
    return request(uid, { action, operationId, expectedConfigVersion: current.version, expectedConfigHash: digest(current), ...extra });
  };
  return { db, refs, config, service, walletAdapter, purchaseRequest, setNow: (iso) => { clock = Date.parse(iso); } };
}

module.exports = { FakeDb, legacy, request, setup };
