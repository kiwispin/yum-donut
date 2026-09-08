import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import AppNavigation from '../src/yumpals/AppNavigation.jsx';
import '../src/index.css';
function Fixture() {
  const [view, setView] = useState('Give');
  return <div className="max-w-md md:max-w-2xl mx-auto p-4"><AppNavigation activeView={view}>{['Give','Jobs','Arcade','Shop','Bank','Training','Goal','Feed','Leaderboard','YumPals','YumPals preview'].map(tab => <button key={tab} aria-current={view === tab ? 'page' : undefined} onClick={() => setView(tab)} className={`shrink-0 px-3 py-2 font-medium text-sm border-b-2 whitespace-nowrap ${view === tab ? 'border-pink-500 text-pink-600' : 'border-transparent text-slate-500'}`}>{tab}</button>)}</AppNavigation></div>;
}
createRoot(document.getElementById('root')).render(<Fixture />);
