import React from 'react';
import { createRoot } from 'react-dom/client';
import Saved from '../src/yumpals/YumPalsSavedHandheld.jsx';
import quote from './saved-surround-quote.json';
import '../src/index.css';
import '../src/yumpals/appSurround.css';

// The saved handheld inside stand-ins for the live app's chrome, at the sizes
// measured live on a 390×844 phone: studio bar 96px, pinned header 80px, menu 49px
// + 20px, bottom icon bar 73px (phones only). No account. ?delay=ms slows the pal's load.
const delay = Number(new URLSearchParams(window.location.search).get('delay') || 0);
const getIdentity = () => ({ uid: 'student-a', isAnonymous: false, sandbox: false });
const transport = async name => {
  if (name !== 'yumpalsGetPaidCareState') throw Error('No purchases in layout fixture');
  if (delay) await new Promise(resolve => setTimeout(resolve, delay));
  return structuredClone(quote);
};
const storage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
createRoot(document.getElementById('root')).render(<>
  <div className="fake-studio">LIVE STUDIO</div>
  <div className="fake-header">YumDonut</div>
  <main className="fake-main">
    <nav className="fake-nav">Give Goal Feed Arcade Bank More</nav>
    <section className="yumpals-embedded-saved" aria-label="Saved YumPals">
      <Saved ownerUid="student-a" projectId="demo-style" enabled getIdentity={getIdentity} transport={transport} storage={storage} />
    </section>
  </main>
  <div className="fake-bottom-bar">Give · Jobs · Arcade · Shop · Bank · Train · Feed · Pals</div>
</>);
