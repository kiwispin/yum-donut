// Synthetic browser fixture. Only loopback test interception can serve requests.
import React from 'react';
import { createRoot } from 'react-dom/client';
import Saved from '../src/yumpals/YumPalsSavedHandheld.jsx';
import { createPaidCareTransport } from '../src/yumpals/paidCareTransport.js';
import { createSavedGameTransport } from '../src/yumpals/savedGameTransport.js';
import NavigationJourney from './NavigationJourney.jsx';
import '../src/index.css';
import '../src/yumpals/appSurround.css';
const user = { uid: 'student-a', isAnonymous: false, getIdToken: async () => 'synthetic-only' };
const getIdentity = () => ({ uid: user.uid, isAnonymous: false, sandbox: false });
const transport = createPaidCareTransport({ projectId: 'demo-speed', enabled: true, getCurrentUser: () => user,
  fetchImpl: (url, options) => fetch(`/__speed-api/${url.split('/').at(-1)}`, options) });
const entries = new Map();
const game = new URLSearchParams(location.search).has('game');
const gameTransport = createSavedGameTransport({ projectId: 'demo-speed', enabled: game, getCurrentUser: () => user,
  fetchImpl: (url, options) => fetch(`/__speed-game-api/${url.split('/').at(-1)}`, options) });
const storage = { getItem: k => entries.get(k) ?? null, setItem: (k, v) => entries.set(k, v), removeItem: k => entries.delete(k) };
const fixture = <div className="max-w-md md:max-w-2xl mx-auto p-4 yumpals-embedded-saved"><Saved ownerUid="student-a" projectId="demo-speed" enabled gameEnabled={game} gameTransport={gameTransport} getIdentity={getIdentity} transport={transport} storage={storage}/></div>;
const content = new URLSearchParams(location.search).has('navigate') ? <NavigationJourney transport={transport} ownerUid={user.uid}>{fixture}</NavigationJourney> : fixture;
createRoot(document.getElementById('root')).render(new URLSearchParams(location.search).has('strict') ? <React.StrictMode>{content}</React.StrictMode> : content);
