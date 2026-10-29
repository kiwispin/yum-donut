// The background YumPals check, paused while the Donut pal is open: counts reads.
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { useSavedVisibility } from '../src/yumpals/useSavedVisibility.js';
window.__reads = 0;
const transport = async (_name, _data, context) => { window.__reads++; return { schemaVersion: 1, ownerUid: context.ownerUid, enabled: true }; };
function Fixture() {
    const [paused, setPaused] = useState(false);
    const visible = useSavedVisibility({ eligible: true, uid: 'fixture', transport, refreshKey: false, paused });
    return <><button onClick={() => setPaused(!paused)}>{paused ? 'Unpause' : 'Pause'}</button>{visible && <p>YumPals visible</p>}</>;
}
createRoot(document.getElementById('root')).render(<Fixture />);
