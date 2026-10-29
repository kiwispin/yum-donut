// Who sees the Donut pal instead of the current saved handheld. Build mode
// (VITE_YUMPALS_POCKET): 'teacher' = only an account with the server's teacher
// claim; 'enabled' = everyone; anything else = no one. Never in sandbox mode.
export function donutPalShown({ mode, sandbox, uid, teacher }) {
    if (sandbox || typeof uid !== 'string' || !uid) return false;
    if (mode === 'enabled') return true;
    return mode === 'teacher' && teacher === true;
}
