#!/usr/bin/env node

const { mappingKeyForTeamsUser } = require('../src/identity');

const rawId = process.argv[2];

if (!rawId) {
  console.error('Usage: node scripts/mappingKey.js <teams-user-id-or-aad-object-id>');
  process.exit(1);
}

console.log(mappingKeyForTeamsUser({ aadObjectId: rawId }));
