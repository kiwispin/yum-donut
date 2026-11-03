const fold = value => String(value || '').normalize('NFKC').trim().toLowerCase();

// Preselects a roster name only when the Teams name points to exactly one student:
// the full name, then "First L" for a surname initial, then a unique first name.
export function suggestRosterName(displayName, roster) {
    const parts = fold(displayName).split(/\s+/u).filter(Boolean);
    if (parts.length === 0) return '';
    const only = matches => (matches.length === 1 ? matches[0] : '');
    const exact = only(roster.filter(name => fold(name) === parts.join(' ')));
    if (exact) return exact;
    if (parts.length > 1) {
        const initial = only(roster.filter(name => fold(name) === `${parts[0]} ${[...parts.at(-1)][0]}`));
        if (initial) return initial;
    }
    return only(roster.filter(name => fold(name).split(/\s+/u)[0] === parts[0]));
}

// Other people already linked to this name; a second link needs the teacher's confirmation.
export function otherLinksForName(entries, yumName, id) {
    return entries.filter(entry => entry.yumName === yumName && entry.id !== id);
}

export function seenLabel(entry) {
    const when = entry.seenWhen === 'giving' ? 'Seen giving' : 'Seen when mentioned';
    if (!entry.lastSeenAt) return when;
    return `${when} · ${new Date(entry.lastSeenAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`;
}
