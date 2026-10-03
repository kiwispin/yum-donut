import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import AppNavigation from '../src/yumpals/AppNavigation.jsx';
import '../src/index.css';

const labels = { give: 'Give', jobs: 'Jobs', arcade: 'Arcade', shop: 'Shop', bank: 'Bank', training: 'Training', goal: 'Goal', feed: 'Feed', leaderboard: 'Leaderboard', 'yumpals-saved': 'YumPals', 'yumpals-preview': 'YumPals preview' };
function Fixture() {
  const [view, setView] = useState('feed');
  const [pals, setPals] = useState(true);
  const [preview, setPreview] = useState(false);
  const [count, setCount] = useState(0);
  const tabs = ['give', 'jobs', 'arcade', 'shop', 'bank', 'training', 'goal', 'feed', 'leaderboard', ...(pals ? ['yumpals-saved'] : []), ...(preview ? ['yumpals-preview'] : [])];
  return <main className="max-w-md md:max-w-2xl mx-auto px-4 py-8" id="navigation-fixture">
    <p className="text-xs text-slate-400 mb-5">Navigation preview · no live account or payments</p>
    <AppNavigation activeView={view}>{tabs.map(tab => <button type="button" key={tab} data-nav-id={tab} aria-current={view === tab ? 'page' : undefined} onClick={() => { setView(tab); setCount(value => value + 1); }}>
      {labels[tab]}{tab === 'jobs' && <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow-sm">3</span>}
    </button>)}</AppNavigation>
    <section className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm" id="fixture-content">
      <h1 className="text-xl font-bold text-slate-800">{labels[view]}</h1>
      <p className="text-sm text-slate-500 mt-2">Use the navigation above to try the layout.</p>
    </section>
    <details className="mt-12 text-xs text-slate-500" id="fixture-controls"><summary>Preview controls</summary>
      <div className="flex gap-5 mt-4"><label><input type="checkbox" checked={pals} onChange={event => setPals(event.target.checked)} /> Show YumPals</label><label><input type="checkbox" checked={preview} onChange={event => setPreview(event.target.checked)} /> Show admin preview</label></div>
      <p className="mt-3" data-picks={count}>Selections: {count}</p>
    </details>
  </main>;
}
createRoot(document.getElementById('root')).render(<Fixture />);
