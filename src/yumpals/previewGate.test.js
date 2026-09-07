import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { canShowYumPalsPreview } from './previewGate.js';

test('pretend preview defaults off and is limited to its opted-in admin session', () => {
    const base = { uid: 'teacher', previewUid: 'teacher', isAdmin: true, isSandbox: false };
    assert.equal(canShowYumPalsPreview(base), true);
    for (const override of [
        { previewUid: null }, { uid: null }, { uid: 'other' },
        { isAdmin: false }, { isSandbox: true }, { uid: undefined, previewUid: undefined },
    ]) assert.equal(canShowYumPalsPreview({ ...base, ...override }), false);
});

test('app wires isolated preview, session resets and separate exit without replacing cloud route', () => {
    const source = readFileSync(new URL('../App.jsx', import.meta.url), 'utf8');
    assert.ok(source.includes('const [yumpalsPreviewUid, setYumpalsPreviewUid] = useState(null)'));
    assert.match(source, /setYumpalsPreviewUid\(null\);\s*\}, \[user\?\.uid, isSandbox\]\)/u);
    assert.match(source, /const handleLogout = \(\) => \{\s*setYumpalsPreviewUid\(null\)/u);
    assert.ok(source.includes("...(yumpalsPreviewAvailable ? ['yumpals-preview'] : [])"));
    assert.ok(source.includes("view === 'yumpals-preview' && yumpalsPreviewAvailable"));
    assert.ok(source.includes("view === 'yumpals' && yumpalsAvailable"));
    assert.ok(source.includes('<YumPalsHandheldDemo key={user.uid} />'));
    assert.ok(source.includes('>Back to app</button>'));
    assert.ok(source.includes('Show YumPals preview'));
    assert.ok(source.includes('checked={yumpalsPreviewEnabled} disabled={isSandbox}'));
    assert.ok(source.includes('enabled && isAdmin && !isSandbox ? user?.uid : null'));
});
