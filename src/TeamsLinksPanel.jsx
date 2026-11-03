import { useEffect, useState } from 'react';
import { suggestRosterName, otherLinksForName, seenLabel } from './teamsLinks.js';

const smallButton = 'px-3 py-1.5 border rounded-lg text-xs font-bold disabled:opacity-50';
const greyButton = `${smallButton} border-slate-300 text-slate-600 hover:bg-slate-50`;
const redButton = `${smallButton} bg-red-50 border-red-200 text-red-600 hover:bg-red-100`;

function NamePicker({ roster, taken, value, onChange, label }) {
    return (
        <select
            aria-label={label}
            value={value}
            onChange={event => onChange(event.target.value)}
            className="min-w-0 flex-1 sm:flex-none sm:w-48 p-2 border border-slate-300 rounded-lg text-sm bg-white"
        >
            <option value="">Choose a name…</option>
            {roster.map(name => <option key={name} value={name}>{taken.has(name) ? `${name} · linked` : name}</option>)}
        </select>
    );
}

function Person({ entry }) {
    return (
        <div className="min-w-0 flex-1">
            <p className="font-bold text-slate-800 truncate">{entry.displayName || 'Unknown Teams user'}</p>
            {entry.detail && <p className="text-xs text-slate-500 truncate">{entry.detail}</p>}
        </div>
    );
}

function Badge({ tone, title, children }) {
    const tones = {
        red: 'bg-red-50 text-red-700 border-red-200',
        amber: 'bg-amber-50 text-amber-700 border-amber-200',
    };
    return <span title={title} className={`text-xs font-bold px-2 py-1 rounded-full border ${tones[tone]}`}>{children}</span>;
}

// Teacher-only: links Teams accounts to roster names through the teamsManageLinks callable.
export default function TeamsLinksPanel({ manageLinks, isSandbox }) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [busy, setBusy] = useState(null);
    const [choices, setChoices] = useState({});
    const [editingId, setEditingId] = useState(null);
    const [message, setMessage] = useState(null);

    const load = async () => {
        setLoading(true);
        try {
            const result = await manageLinks({ action: 'list' });
            setData(result.data);
        } catch (e) {
            console.error(e);
            setMessage({ type: 'error', text: e.message || 'Could not load Teams links. Please try again.' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!isSandbox) void load();
    }, [isSandbox]);

    if (isSandbox) {
        return <p className="text-sm text-slate-600">Switch to your live teacher account to link Teams accounts.</p>;
    }

    const roster = data?.roster || [];
    const teamKnown = data?.team?.status === 'ok';
    // In a known Team each member is one row; otherwise fall back to the records the bot has seen.
    const people = (data?.people || []).map(person => ({ ...person, id: person.personId, kind: 'person', detail: person.email || '' }));
    const records = (data?.records || []).map(record => ({
        ...record, id: record.mappingKey, kind: 'record',
        detail: [record.email, seenLabel(record)].filter(Boolean).join(' · '),
    }));
    const rows = teamKnown ? people : records;
    const everyone = [...people, ...records];
    const taken = new Set(everyone.map(entry => entry.yumName).filter(Boolean));
    const byName = (a, b) => String(a.displayName).localeCompare(String(b.displayName));
    const waiting = rows.filter(entry => !entry.yumName).sort(byName);
    const linked = rows.filter(entry => entry.yumName).sort((a, b) => String(a.yumName).localeCompare(String(b.yumName)));
    const gone = teamKnown ? [...records].sort(byName) : [];
    const freeRoster = roster.filter(name => !taken.has(name));
    const choiceFor = entry => choices[entry.id] ?? suggestRosterName(entry.displayName, freeRoster);
    const setChoice = (id, name) => setChoices(prev => ({ ...prev, [id]: name }));
    const target = entry => (entry.kind === 'person' ? { personId: entry.id } : { mappingKey: entry.id });

    const run = async (id, request, success) => {
        setBusy(id);
        setMessage(null);
        try {
            await manageLinks(request);
            setMessage({ type: 'success', text: success });
            setEditingId(null);
            await load();
        } catch (e) {
            console.error(e);
            setMessage({ type: 'error', text: e.message || 'Could not save that change. Please try again.' });
        } finally {
            setBusy(null);
        }
    };

    const handleLink = (entry, yumName) => {
        if (!yumName) return;
        const others = otherLinksForName(everyone, yumName, entry.id);
        if (others.length > 0) {
            const names = others.map(other => `"${other.displayName || 'Unknown Teams user'}"`).join(', ');
            if (!confirm(`${yumName} is already linked to ${names} in Teams.\n\nLink "${entry.displayName || 'this Teams user'}" to ${yumName} as well? Only do this if both are the same person — they will be able to give ${yumName}'s donuts.`)) return;
        }
        void run(entry.id, { action: 'link', ...target(entry), yumName, ...(others.length > 0 && { alsoLinked: true }) },
            yumName === entry.yumName ? `Saved the link for ${yumName}.` : `Linked ${entry.displayName || 'Teams user'} to ${yumName}.`);
    };

    const handleUnlink = (entry) => {
        if (!confirm(`Remove the link between ${entry.displayName || 'this Teams user'} and ${entry.yumName}?\n\nThey will not be able to give or receive donuts in Teams until they are linked again.`)) return;
        void run(entry.id, { action: 'unlink', ...target(entry) }, `Removed the link for ${entry.yumName}.`);
    };

    const handleForget = (entry) => {
        const what = entry.yumName ? ` and their link to ${entry.yumName}` : '';
        if (!confirm(`Remove ${entry.displayName || 'this Teams user'}${what} from this list?\n\nIf they use @YumDonut again they will reappear.`)) return;
        void run(entry.id, { action: 'forget', mappingKey: entry.id }, `Removed ${entry.displayName || 'that Teams user'}.`);
    };

    const handleForgetAll = async () => {
        if (!confirm(`Remove all ${gone.length} people who are not in the Team, and their links?`)) return;
        setBusy('all');
        setMessage(null);
        try {
            for (const entry of gone) await manageLinks({ action: 'forget', mappingKey: entry.id });
            setMessage({ type: 'success', text: `Removed ${gone.length} people who are not in the Team.` });
        } catch (e) {
            console.error(e);
            setMessage({ type: 'error', text: e.message || 'Could not remove everyone. Please try again.' });
        } finally {
            setBusy(null);
            await load();
        }
    };

    return (
        <div className="space-y-6">
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                        <h3 className="font-bold text-slate-800">Teams accounts</h3>
                        <p className="text-sm text-slate-500 mt-1">
                            Link each person in your Team to their roster name so they can give and receive donuts with <span className="font-mono">@YumDonut</span>.
                        </p>
                    </div>
                    <button
                        onClick={() => void load()}
                        disabled={loading}
                        className="px-3 py-2 border border-slate-300 rounded-lg text-sm font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                    >
                        {loading ? 'Loading…' : 'Refresh'}
                    </button>
                </div>
                {data && teamKnown && (
                    <p className="mt-3 text-sm text-slate-600">
                        {data.team.name ? <>Showing everyone in <span className="font-bold">{data.team.name}</span>: </> : 'Showing everyone in your Team: '}
                        {linked.length} of {rows.length} linked.
                    </p>
                )}
                {data && data.team?.status === 'unknown' && (
                    <p className="mt-3 p-3 rounded-lg text-sm bg-amber-50 text-amber-800 border border-amber-200">
                        Yum Donut does not know your Team yet. Write <span className="font-mono">@YumDonut hello</span> once in the Team, then press Refresh to see everyone. Until then, you can link the people the bot has already seen.
                    </p>
                )}
                {data && data.team?.status === 'error' && (
                    <p className="mt-3 p-3 rounded-lg text-sm bg-red-50 text-red-700 border border-red-200">
                        Could not reach Teams just now, so this shows only the people the bot has seen. Press Refresh to try again.
                    </p>
                )}
                {message && (
                    <p role="status" className={`mt-4 p-3 rounded-lg text-sm font-bold ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                        {message.text}
                    </p>
                )}
            </div>

            {data && (
                <>
                    <section className="bg-white p-6 rounded-xl border border-amber-200 shadow-sm">
                        <h3 className="font-bold text-amber-700 text-sm mb-3">Waiting to be linked ({waiting.length})</h3>
                        {waiting.length === 0 ? (
                            <p className="text-sm text-slate-500">{teamKnown ? 'Everyone in the Team is linked.' : 'Nobody new.'}</p>
                        ) : (
                            <ul className="divide-y divide-slate-100">
                                {waiting.map(entry => (
                                    <li key={entry.id} className="py-3 flex flex-wrap items-center gap-2">
                                        <Person entry={entry} />
                                        <div className="flex w-full sm:w-auto gap-2">
                                            <NamePicker roster={roster} taken={taken} value={choiceFor(entry)} label={`Roster name for ${entry.displayName || 'Teams user'}`}
                                                onChange={name => setChoice(entry.id, name)} />
                                            <button
                                                onClick={() => handleLink(entry, choiceFor(entry))}
                                                disabled={!choiceFor(entry) || busy !== null}
                                                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 disabled:opacity-50"
                                            >
                                                {busy === entry.id ? 'Linking…' : 'Link'}
                                            </button>
                                            {!teamKnown && (
                                                <button onClick={() => handleForget(entry)} disabled={busy !== null} className={greyButton} title="Remove from this list">
                                                    Dismiss
                                                </button>
                                            )}
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>

                    <section className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                        <h3 className="font-bold text-slate-700 text-sm mb-3">Linked ({linked.length})</h3>
                        {linked.length === 0 ? (
                            <p className="text-sm text-slate-500">No Teams accounts are linked yet.</p>
                        ) : (
                            <ul className="divide-y divide-slate-100">
                                {linked.map(entry => (
                                    <li key={entry.id} className="py-3 flex flex-wrap items-center gap-2">
                                        <Person entry={entry} />
                                        {editingId === entry.id ? (
                                            <div className="flex w-full sm:w-auto gap-2">
                                                <NamePicker roster={roster} taken={taken} value={choices[entry.id] ?? entry.yumName} label={`New roster name for ${entry.displayName || 'Teams user'}`}
                                                    onChange={name => setChoice(entry.id, name)} />
                                                <button
                                                    onClick={() => handleLink(entry, choices[entry.id] ?? entry.yumName)}
                                                    disabled={!(choices[entry.id] ?? entry.yumName) || busy !== null}
                                                    className="px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 disabled:opacity-50"
                                                >
                                                    {busy === entry.id ? 'Saving…' : 'Save'}
                                                </button>
                                                <button onClick={() => setEditingId(null)} className="px-3 py-2 border border-slate-300 rounded-lg text-sm font-bold text-slate-600 hover:bg-slate-50">
                                                    Cancel
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="flex w-full sm:w-auto flex-wrap items-center gap-2">
                                                <span className="font-bold text-indigo-700">→ {entry.yumName}</span>
                                                {!entry.onRoster && <Badge tone="red">Not on roster</Badge>}
                                                {entry.onRoster && !entry.hasAccount && entry.yumName !== 'Mr Rayner' && (
                                                    <Badge tone="amber" title="They can receive donuts in Teams. To give, they must sign in to Yum Donut once.">Can't give yet</Badge>
                                                )}
                                                <span className="ml-auto flex gap-2">
                                                    {entry.kind === 'person' && !entry.complete && (
                                                        <button onClick={() => handleLink(entry, entry.yumName)} disabled={busy !== null}
                                                            className={`${smallButton} bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100`}
                                                            title="This link was made before Yum Donut could see the Team, so it only works one way. Fix links it both ways.">
                                                            {busy === entry.id ? 'Fixing…' : 'Fix link'}
                                                        </button>
                                                    )}
                                                    <button onClick={() => { setChoice(entry.id, entry.yumName); setEditingId(entry.id); }} disabled={busy !== null} className={greyButton}>
                                                        Change
                                                    </button>
                                                    <button onClick={() => handleUnlink(entry)} disabled={busy !== null} className={redButton}>
                                                        {busy === entry.id ? 'Removing…' : 'Remove'}
                                                    </button>
                                                </span>
                                            </div>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        )}
                        <p className="text-xs text-slate-500 mt-4">
                            "Can't give yet" means the student can receive donuts in Teams, but must sign in to Yum Donut once before they can give.
                        </p>
                    </section>

                    {gone.length > 0 && (
                        <section className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                            <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                                <h3 className="font-bold text-slate-700 text-sm">Not in the Team ({gone.length})</h3>
                                <button onClick={() => void handleForgetAll()} disabled={busy !== null} className={redButton}>
                                    {busy === 'all' ? 'Removing…' : 'Remove all'}
                                </button>
                            </div>
                            <p className="text-xs text-slate-500 mb-3">The bot has seen these people, but they are not in the Team now. Removing them also removes any link.</p>
                            <ul className="divide-y divide-slate-100">
                                {gone.map(entry => (
                                    <li key={entry.id} className="py-3 flex flex-wrap items-center gap-2">
                                        <Person entry={entry} />
                                        <div className="flex w-full sm:w-auto flex-wrap items-center gap-2">
                                            {entry.yumName && <span className="font-bold text-slate-500">→ {entry.yumName}</span>}
                                            {entry.yumName && !entry.onRoster && <Badge tone="red">Not on roster</Badge>}
                                            <span className="ml-auto">
                                                <button onClick={() => handleForget(entry)} disabled={busy !== null} className={redButton}>
                                                    {busy === entry.id ? 'Removing…' : 'Remove'}
                                                </button>
                                            </span>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </section>
                    )}
                </>
            )}
        </div>
    );
}
