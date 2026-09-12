// Synthetic browser fixture. Only loopback test interception can serve requests.
import React from 'react';
import { createRoot } from 'react-dom/client';
import Saved from '../src/yumpals/YumPalsSavedHandheld.jsx';
import { createPaidCareTransport } from '../src/yumpals/paidCareTransport.js';
import '../src/index.css';
import '../src/yumpals/appSurround.css';
const user = { uid: 'student-a', isAnonymous: false, getIdToken: async () => 'synthetic-only' };
const getIdentity = () => ({ uid: user.uid, isAnonymous: false, sandbox: false });
const transport = createPaidCareTransport({ projectId: 'demo-speed', enabled: true, getCurrentUser: () => user,
  fetchImpl: (url, options) => fetch(`/__speed-api/${url.split('/').at(-1)}`, options) });
const entries = new Map();
const storage = { getItem: k => entries.get(k) ?? null, setItem: (k, v) => entries.set(k, v), removeItem: k => entries.delete(k) };
createRoot(document.getElementById('root')).render(<div className="max-w-md md:max-w-2xl mx-auto p-4 yumpals-embedded-saved"><Saved ownerUid="student-a" projectId="demo-speed" enabled getIdentity={getIdentity} transport={transport} storage={storage}/></div>);
