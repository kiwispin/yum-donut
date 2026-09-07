import { useEffect, useId, useRef, useState } from 'react';
import { createTeacherSettingsController } from './teacherSettingsClient.js';

const browserStorage = {
  getItem: key => window.localStorage.getItem(key),
  setItem: (key, value) => window.localStorage.setItem(key, value),
  removeItem: key => window.localStorage.removeItem(key),
};
const newOperationId = () => crypto.randomUUID();

export default function YumPalsTeacherSettings({ ownerUid, projectId, enabled = false, getIdentity, transport, storage = browserStorage, operationId = newOperationId }) {
  const id = useId(); const controller = useRef(null);
  const [state, setState] = useState({ status: 'loading', quote: null, draft: false, pending: false, busy: false, message: '' });
  useEffect(() => {
    const instance = createTeacherSettingsController({ ownerUid, projectId, enabled, getIdentity, transport, storage, operationId, onChange: setState });
    controller.current = instance;
    setState(instance.getState());
    void instance.start();
    return () => { instance.dispose(); controller.current = null; };
  }, [ownerUid, projectId, enabled, getIdentity, transport, storage, operationId]);
  const locked = state.busy || state.pending || !state.quote || state.status !== 'ready';
  return <section aria-labelledby={`${id}-title`} className="space-y-3 text-sm text-slate-700">
    <h3 id={`${id}-title`} className="font-bold text-pink-700">YumPals for students</h3>
    <p>Disabling YumPals stops new care charges and lets pets rest. Their saved pets and donuts stay safe.</p>
    <p aria-live="polite">{state.quote ? `${state.uncertain || state.busy && state.pending ? 'Last confirmed setting' : 'Saved setting'}: ${state.quote.enabled ? 'On' : 'Off'}${state.quote.configured ? '' : ' · Not set up yet'}` : 'Saved setting: Not checked yet'}</p>
    <label htmlFor={`${id}-enabled`} className="flex items-center gap-2 font-semibold">
      <input id={`${id}-enabled`} type="checkbox" checked={state.draft} disabled={locked}
        onChange={event => controller.current?.setDraft(event.target.checked)} aria-describedby={`${id}-help`} />
      Enable YumPals for students
    </label>
    <p id={`${id}-help`}>Choose a setting, then save. The saved setting changes only after the school confirms it.</p>
    <div className="flex flex-wrap gap-2">
      {!state.pending && <button type="button" className="border rounded-lg px-3 py-2 disabled:opacity-50" disabled={locked}
        onClick={() => void controller.current?.save()}>Save changes</button>}
      {state.pending && <button type="button" className="border rounded-lg px-3 py-2 disabled:opacity-50" disabled={state.busy || state.storageBlocked}
        onClick={() => void controller.current?.retry()}>Retry save</button>}
      {state.status !== 'blocked' && <button type="button" className="border rounded-lg px-3 py-2 disabled:opacity-50" disabled={state.busy || state.storageBlocked}
        onClick={() => void controller.current?.refresh()}>Refresh settings</button>}
    </div>
    <p role="status">{state.message || (state.busy || state.status === 'loading' ? 'Checking settings…' : '')}</p>
  </section>;
}
