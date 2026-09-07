import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import YumPalsTeacherSettings from '../../src/yumpals/YumPalsTeacherSettings.jsx';
const H = 'a'.repeat(64);
let mode = 'normal'; let identity = { uid: 'test-teacher', isAnonymous: false, sandbox: false };
let version = 1; let saved = false; const receipts = new Map(); const journal = new Map(); const held = [];
const storage = { getItem: key => journal.get(key) ?? null, setItem: (key, value) => journal.set(key, value), removeItem: key => journal.delete(key) };
const getIdentity = () => identity;
const view = () => ({ configured: true, enabled: saved, version: `v${version}`, settingsHash: H, settings: { schemaVersion: 1, controlVersion: 1, version: `v${version}`, enabled: saved } });
const transport = async (name, data) => {
  if (mode === 'denied') throw { details: { reason: 'PERMISSION_DENIED' } };
  if (mode === 'offline') throw new Error('Synthetic offline');
  let result;
  if (name === 'yumpalsGetPaidSettings') result = view();
  else if (receipts.has(data.operationId)) result = { ...receipts.get(data.operationId), duplicate: true };
  else {
    if (data.expectedVersion !== `v${version}`) throw { details: { reason: 'SETTINGS_CONFLICT' } };
    const before = view().settings; saved = data.enabled; version++;
    result = { ...view(), duplicate: false, receipt: { schemaVersion: 1, actorUid: identity.uid, operationId: data.operationId,
      request: { ...data }, binding: H, before, beforeHash: H, after: view().settings, afterHash: H, committedAtMs: 1000 } };
    receipts.set(data.operationId, result);
    if (mode === 'lost') { mode = 'normal'; throw new Error('Synthetic response lost after commit'); }
  }
  if (mode === 'hold') await new Promise(resolve => held.push(resolve));
  return result;
};
function Fixture() {
  const [mount, setMount] = useState(1); const [owner, setOwner] = useState(identity.uid);
  return <>
    {mount > 0 && <YumPalsTeacherSettings key={mount} ownerUid={owner} projectId="demo-settings-fixture" enabled getIdentity={getIdentity} transport={transport} storage={storage} />}
    <aside aria-label="Separate test controls"><h2>Test controls</h2>
      <label>Next response <select defaultValue="normal" onChange={e => { mode = e.target.value; }}>
        <option value="normal">Normal</option><option value="offline">Offline</option><option value="lost">Commit then lose response once</option><option value="hold">Hold response</option><option value="denied">Permission denied</option>
      </select></label>
      <button onClick={() => { mode = 'normal'; while (held.length) held.shift()(); }}>Release held responses</button>
      <button onClick={() => { saved = !saved; version++; }}>Other teacher changes saved setting</button>
      <button onClick={() => setMount(n => n + 1)}>Remount (keep pending save)</button>
      <button onClick={() => { identity = { ...identity, uid: owner === 'test-teacher' ? 'other-teacher' : 'test-teacher' }; setOwner(identity.uid); setMount(n => n + 1); }}>Switch test account</button>
      <p>For late-response checks: hold a save, switch account or remount, then release. No save is retried automatically.</p>
    </aside>
  </>;
}
createRoot(document.getElementById('root')).render(<Fixture />);
