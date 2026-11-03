import { useEffect, useState } from 'react';
import { suggestRosterName, otherLinksForName, seenLabel } from './teamsLinks.js';

function NamePicker({ roster, value, onChange, label }) {
    return (
        <select
            aria-label={label}
            value={value}
            onChange={event => onChange(event.target.value)}
            className="min-w-0 flex-1 sm:flex-none sm:w-44 p-2 border border-slate-300 rounded-lg text-sm bg-white"
        >
            <option value="">Choose a name…</option>
            {roster.map(name => <option key={name} value={name}>{name}</option>)}
        </select>
    );
}

function TeamsPerson({ entry }) {
    return (
        <div className="min-w-0 flex-1">
            <p className="font-bold text-slate-800 truncate">{entry.displayName || 'Unknown Teams user'}</p>
            <p className="text-xs text-slate-500 truncate">
                {entry.email ? `${entry.email} · ` : ''}{seenLabel(entry)}
            </p>
        </div>
    );
}

// Teacher-only: links Teams accounts to roster names through the teamsManageLinks callable.
export default function TeamsLinksPanel({ manageLinks, isSandbox }) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [busyKey, setBusyKey] = useState(null);
    const [choices, setChoices] = useState({});
    const [editingKey, setEditingKey] = useState(null);
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
    const links = data?.links || [];
    const pending = data?.pending || [];
    const choiceFor = entry => choices[entry.mappingKey] ?? suggestRosterName(entry.displayName, roster);
    const setChoice = (mappingKey, name) => setChoices(prev => ({ ...prev, [mappingKey]: name }));

    const handleLink = async (entry, yumName) => {
        if (!yumName) return;
        const others = otherLinksForName(links, yumName, entry.mappingKey);
        if (others.length > 0) {
            const names = others.map(other => `"${other.displayName || 'Unknown Teams user'}"`).join(', ');
            if (!confirm(`${yumName} is already linked to ${names} in Teams.\n\nLink "${entry.displayName || 'this Teams user'}" to ${yumName} as well? Only do this if both are the same person — they will be able to give ${yumName}'s donuts.`)) return;
        }
        setBusyKey(entry.mappingKey);
        setMessage(null);
        try {
            await manageLinks({ action: 'link', mappingKey: entry.mappingKey, yumName, ...(others.length > 0 && { alsoLinked: true }) });
            setMessage({ type: 'success', text: `Linked ${entry.displayName || 'Teams user'} to ${yumName}.` });
            setEditingKey(null);
            await load();
        } catch (e) {
            console.error(e);
            setMessage({ type: 'error', text: e.message || 'Could not save the link. Please try again.' });
        } finally {
            setBusyKey(null);
        }
    };

    const handleUnlink = async (link) => {
        if (!confirm(`Remove the link between ${link.displayName || 'this Teams user'} and ${link.yumName}?\n\nThey will not be able to give or receive donuts in Teams until they are linked again.`)) return;
        setBusyKey(link.mappingKey);
        setMessage(null);
        try {
            await manageLinks({ action: 'unlink', mappingKey: link.mappingKey });
            setMessage({ type: 'success', text: `Removed the link for ${link.yumName}.` });
            await load();
        } catch (e) {
            console.error(e);
            setMessage({ type: 'error', text: e.message || 'Could not remove the link. Please try again.' });
        } finally {
            setBusyKey(null);
        }
    };

    const sortedLinks = [...links].sort((a, b) => String(a.yumName).localeCompare(String(b.yumName)));
    const sortedPending = [...pending].sort((a, b) => (b.lastSeenAt || 0) - (a.lastSeenAt || 0));

    return (
        <div className="space-y-6">
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                        <h3 className="font-bold text-slate-800">Teams accounts</h3>
                        <p className="text-sm text-slate-500 mt-1">
                            Yum Donut lists everyone who has used <span className="font-mono">@YumDonut</span> in Teams. Link each person to their roster name so they can give and receive donuts there.
                        </p>
                        <p className="text-xs text-slate-500 mt-2">
                            Teams can show the same student twice: once when they give and once when they are mentioned. Link both to the same name.
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
                {message && (
                    <p role="status" className={`mt-4 p-3 rounded-lg text-sm font-bold ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                        {message.text}
                    </p>
                )}
            </div>

            {data && (
                <>
                    <section className="bg-white p-6 rounded-xl border border-amber-200 shadow-sm">
                        <h3 className="font-bold text-amber-700 text-sm mb-3">Waiting to be linked ({sortedPending.length})</h3>
                        {sortedPending.length === 0 ? (
                            <p className="text-sm text-slate-500">Nobody new. When a student mentions <span className="font-mono">@YumDonut</span> in Teams, they appear here.</p>
                        ) : (
                            <ul className="divide-y divide-slate-100">
                                {sortedPending.map(entry => (
                                    <li key={entry.mappingKey} className="py-3 flex flex-wrap items-center gap-2">
                                        <TeamsPerson entry={entry} />
                                        <div className="flex w-full sm:w-auto gap-2">
                                            <NamePicker roster={roster} value={choiceFor(entry)} label={`Roster name for ${entry.displayName || 'Teams user'}`}
                                                onChange={name => setChoice(entry.mappingKey, name)} />
                                            <button
                                                onClick={() => void handleLink(entry, choiceFor(entry))}
                                                disabled={!choiceFor(entry) || busyKey !== null}
                                                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 disabled:opacity-50"
                                            >
                                                {busyKey === entry.mappingKey ? 'Linking…' : 'Link'}
                                            </button>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>

                    <section className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                        <h3 className="font-bold text-slate-700 text-sm mb-3">Linked ({sortedLinks.length})</h3>
                        {sortedLinks.length === 0 ? (
                            <p className="text-sm text-slate-500">No Teams accounts are linked yet.</p>
                        ) : (
                            <ul className="divide-y divide-slate-100">
                                {sortedLinks.map(link => (
                                    <li key={link.mappingKey} className="py-3 flex flex-wrap items-center gap-2">
                                        <TeamsPerson entry={link} />
                                        {editingKey === link.mappingKey ? (
                                            <div className="flex w-full sm:w-auto gap-2">
                                                <NamePicker roster={roster} value={choices[link.mappingKey] ?? link.yumName ?? ''} label={`New roster name for ${link.displayName || 'Teams user'}`}
                                                    onChange={name => setChoice(link.mappingKey, name)} />
                                                <button
                                                    onClick={() => void handleLink(link, choices[link.mappingKey] ?? link.yumName)}
                                                    disabled={!(choices[link.mappingKey] ?? link.yumName) || busyKey !== null}
                                                    className="px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 disabled:opacity-50"
                                                >
                                                    {busyKey === link.mappingKey ? 'Saving…' : 'Save'}
                                                </button>
                                                <button
                                                    onClick={() => setEditingKey(null)}
                                                    className="px-3 py-2 border border-slate-300 rounded-lg text-sm font-bold text-slate-600 hover:bg-slate-50"
                                                >
                                                    Cancel
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="flex w-full sm:w-auto flex-wrap items-center gap-2">
                                                <span className="font-bold text-indigo-700">→ {link.yumName || '(no name)'}</span>
                                                {!link.onRoster && (
                                                    <span className="text-xs font-bold px-2 py-1 rounded-full bg-red-50 text-red-700 border border-red-200">Not on roster</span>
                                                )}
                                                {link.onRoster && !link.hasAccount && link.yumName !== 'Mr Rayner' && (
                                                    <span className="text-xs font-bold px-2 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200"
                                                        title="They can receive donuts in Teams. To give, they must sign in to Yum Donut once.">
                                                        Can't give yet
                                                    </span>
                                                )}
                                                <span className="ml-auto flex gap-2">
                                                    <button
                                                        onClick={() => { setChoice(link.mappingKey, link.yumName || ''); setEditingKey(link.mappingKey); }}
                                                        disabled={busyKey !== null}
                                                        className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                                                    >
                                                        Change
                                                    </button>
                                                    <button
                                                        onClick={() => void handleUnlink(link)}
                                                        disabled={busyKey !== null}
                                                        className="px-3 py-1.5 bg-red-50 border border-red-200 rounded-lg text-xs font-bold text-red-600 hover:bg-red-100 disabled:opacity-50"
                                                    >
                                                        {busyKey === link.mappingKey ? 'Removing…' : 'Remove'}
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
                </>
            )}
        </div>
    );
}
