import test from 'node:test';
import assert from 'node:assert/strict';
import { suggestRosterName, otherLinksForName, seenLabel } from './teamsLinks.js';

const roster = ['Mr Rayner', 'Aaishah', 'Lara', 'Lara C', 'Ben'];

test('A roster name is suggested only when the Teams name matches exactly one student', () => {
    assert.equal(suggestRosterName('Aaishah Khan', roster), 'Aaishah');
    assert.equal(suggestRosterName('mr rayner', roster), 'Mr Rayner');
    assert.equal(suggestRosterName('Lara C', roster), 'Lara C');
    assert.equal(suggestRosterName('Lara Smith', roster), '', 'two Laras, so the teacher must choose');
    assert.equal(suggestRosterName('Zed', roster), '');
    assert.equal(suggestRosterName('', roster), '');
});

test('Other links for a name ignore the record being changed', () => {
    const links = [{ mappingKey: 'a', yumName: 'Aaishah' }, { mappingKey: 'b', yumName: 'Aaishah' }, { mappingKey: 'c', yumName: 'Ben' }];
    assert.deepEqual(otherLinksForName(links, 'Aaishah', 'a').map(link => link.mappingKey), ['b']);
    assert.deepEqual(otherLinksForName(links, 'Ben', 'c'), []);
    assert.deepEqual(otherLinksForName(links, 'Lara', 'z'), []);
});

test('The seen label says how Teams showed the person', () => {
    assert.equal(seenLabel({ seenWhen: 'giving', lastSeenAt: null }), 'Seen giving');
    assert.equal(seenLabel({ seenWhen: 'mentioned', lastSeenAt: null }), 'Seen when mentioned');
    assert.match(seenLabel({ seenWhen: 'giving', lastSeenAt: Date.UTC(2026, 10, 3) }), /^Seen giving · /);
});
