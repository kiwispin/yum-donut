import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import VisionMixerModal from '../src/arcade/VisionMixerModal.jsx';
import '../src/index.css';

// Synthetic preview: no account, wallet or Firestore. Wins are only recorded on the page.
function Fixture() {
  const [open, setOpen] = useState(true);
  const [wins, setWins] = useState([]);
  const [session] = useState(() => `preview-${Date.now()}`);
  return <main className="p-6 text-sm text-slate-600">
    <p className="mb-3">Vision Mixer preview · no live account or donuts</p>
    <button type="button" className="px-4 py-2 rounded-lg bg-slate-800 text-white" onClick={() => setOpen(true)}>Open Vision Mixer</button>
    <pre id="fixture-wins" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }} data-wins={wins.length}>{JSON.stringify(wins)}</pre>
    {open && <VisionMixerModal user={{ uid: session }} lastPlayed={null} onWin={prize => setWins(list => [...list, prize])} onClose={() => setOpen(false)} />}
  </main>;
}
createRoot(document.getElementById('root')).render(<Fixture />);
