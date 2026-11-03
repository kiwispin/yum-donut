const fold = value => String(value || '').normalize('NFKC').trim().toLowerCase();

// Preselects a roster name only when the Teams name points to exactly one student.
export function suggestRosterName(displayName, roster) {
    const full = fold(displayName);
    if (!full) return '';
    const exact = roster.filter(name => fold(name) === full);
    if (exact.length === 1) return exact[0];
    const first = full.split(/\s+/u)[0];
    const byFirstName = roster.filter(name => fold(name) === first || fold(name).split(/\s+/u)[0] === first);
    return byFirstName.length === 1 ? byFirstName[0] : '';
}

// Other Teams records already linked to this name; a second link needs the teacher's confirmation.
export function otherLinksForName(links, yumName, mappingKey) {
    return links.filter(link => link.yumName === yumName && link.mappingKey !== mappingKey);
}

export function seenLabel(entry) {
    const when = entry.seenWhen === 'giving' ? 'Seen giving' : 'Seen when mentioned';
    if (!entry.lastSeenAt) return when;
    return `${when} · ${new Date(entry.lastSeenAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`;
}
