// The YumPals menu item with a slow server (?delay=ms) that answers enabled or not
// (?enabled=1|0), to check it shows at once on a return visit.
import React from 'react';
import { createRoot } from 'react-dom/client';
import { useSavedVisibility } from '../src/yumpals/useSavedVisibility.js';
const params = new URLSearchParams(window.location.search);
const delay = Number(params.get('delay') || 2000); const enabled = params.get('enabled') !== '0';
window.__answered = false;
const transport = async (_name, _data, context) => {
    await new Promise(resolve => setTimeout(resolve, delay)); window.__answered = true;
    return { schemaVersion: 1, ownerUid: context.ownerUid, enabled };
};
function Fixture() {
    const visible = useSavedVisibility({ eligible: true, uid: 'student-a', transport, refreshKey: false });
    return <nav><button>Give</button><button>Training</button>{visible && <button>YumPals</button>}</nav>;
}
createRoot(document.getElementById('root')).render(<Fixture />);
