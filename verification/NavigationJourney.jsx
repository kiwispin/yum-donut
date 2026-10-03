import React, { useEffect, useState } from 'react';

// Keep the component separate from createRoot so Vite's component refresh
// cannot run the test entry point twice after a source edit.
export default function NavigationJourney({ transport, ownerUid, children }) {
  const [ready, setReady] = useState(false);
  const [opened, setOpened] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    void transport('yumpalsGetPaidCareState', {}, { ownerUid, isActive: () => active })
      .then(() => { if (active) setReady(true); })
      .catch(() => { if (active) setError('Preload failed'); });
    return () => { active = false; };
  }, [transport, ownerUid]);
  return <><button disabled={!ready} onClick={() => setOpened(true)}>Open YumPals</button><button onClick={() => setOpened(false)}>Leave YumPals</button>{error || (opened ? children : <p>Another app page</p>)}</>;
}
