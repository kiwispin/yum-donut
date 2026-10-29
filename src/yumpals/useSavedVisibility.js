import { useEffect, useRef, useState } from 'react';
import { stashGifts } from './giftStash.js';

export function confirmedVisibility(result, uid) {
  return result?.schemaVersion === 1 && result.ownerUid === uid && result.enabled === true;
}

// While `paused` (the Donut pal is open and doing its own reads) the timer, focus
// and visibility refreshes are skipped, so the two never race on the pal record.
// The last answer is kept, so pausing never hides the YumPals menu item.
export function useSavedVisibility({ eligible, uid, transport, refreshKey, paused = false }) {
  const [confirmed, setConfirmed] = useState(null);
  const pausedRef = useRef(paused);
  useEffect(() => { pausedRef.current = paused; }, [paused]);
  useEffect(() => {
    let active = true;
    let request = 0;
    setConfirmed(null);
    if (!eligible) return;
    const refresh = async () => {
      const current = ++request;
      try {
        const result = await transport('yumpalsGetPaidCareState', {}, { ownerUid: uid, isActive: () => active && request === current });
        // This background read can be the one that grants today's gift; keep it for the handheld.
        stashGifts(uid, result);
        if (active && request === current) setConfirmed({ uid, enabled: confirmedVisibility(result, uid) });
      } catch {
        if (active && request === current) setConfirmed(null);
      }
    };
    const visible = () => { if (document.visibilityState === 'visible' && !pausedRef.current) void refresh(); };
    const settingsChanged = () => { setConfirmed(null); void refresh(); };
    void refresh();
    const timer = setInterval(visible, 60000);
    window.addEventListener('focus', visible);
    window.addEventListener('yumpals-settings-confirmed', settingsChanged);
    document.addEventListener('visibilitychange', visible);
    return () => { active = false; clearInterval(timer); window.removeEventListener('focus', visible); window.removeEventListener('yumpals-settings-confirmed', settingsChanged); document.removeEventListener('visibilitychange', visible); };
  }, [eligible, uid, transport, refreshKey]);
  return eligible && confirmed?.uid === uid && confirmed.enabled === true;
}
