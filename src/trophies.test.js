import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TROPHIES, trophyCounts, cabinetValue, payForTrophy } from './trophies.js';

test('four trophy tiers, cheapest first', () => {
    assert.deepEqual(TROPHIES.map(t => [t.id, t.cost]), [['medal', 25], ['trophy', 75], ['diamond', 200], ['crown', 500]]);
});

test('counts ignore missing, broken or unknown entries', () => {
    assert.deepEqual(trophyCounts(undefined), { medal: 0, trophy: 0, diamond: 0, crown: 0 });
    assert.deepEqual(trophyCounts({ medal: 2, trophy: -1, diamond: 1.5, crown: '3', cup: 4 }), { medal: 2, trophy: 0, diamond: 0, crown: 0 });
});

test('cabinet value is what the trophies cost', () => {
    assert.equal(cabinetValue({ medal: 2, diamond: 1 }), 250);
    assert.equal(cabinetValue(null), 0);
});

test('a trophy is paid from the chosen source only', () => {
    assert.deepEqual(payForTrophy({ wallet: 30, bank: 300 }, 'wallet', 25), { wallet: 5, bank: 300 });
    assert.deepEqual(payForTrophy({ wallet: 30, bank: 300 }, 'bank', 200), { wallet: 30, bank: 100 });
    assert.deepEqual(payForTrophy({ wallet: 25, bank: 0 }, 'wallet', 25), { wallet: 0, bank: 0 });
});

test('a source that cannot cover the cost is refused, never topped up from the other', () => {
    assert.equal(payForTrophy({ wallet: 20, bank: 300 }, 'wallet', 25), null);
    assert.equal(payForTrophy({ wallet: 300, bank: 20 }, 'bank', 25), null);
    assert.equal(payForTrophy({ wallet: 300, bank: 300 }, 'savings', 25), null);
});
