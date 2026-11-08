import { useCallback, useEffect, useState } from 'react';
import Button from './elements/Button';
import { localAIRequest, refreshChatGPTStatus, setChatGPTModel, useAIConnection, isLocalGame } from '../services/aiProvider';
import { CHATGPT_USAGE_URL } from '../shared/chatgpt';

function ChatGPTConnection() {
  const { available, status, models, model } = useAIConnection();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const active = status?.profiles.find(profile => profile.id === status.activeProfileId);

  const refresh = useCallback(async () => {
    try { await refreshChatGPTStatus(); setError(null); }
    catch (failure: unknown) { setError(failure instanceof Error ? failure.message : 'Could not connect to the local ChatGPT service.'); }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    if (!status?.pending) return;
    const timer = setInterval(() => { void refresh(); }, 2000);
    return () => { clearInterval(timer); };
  }, [status?.pending, refresh]);
  const signIn = useCallback(async (newAccount: boolean) => {
    const popup = window.open('about:blank', '_blank');
    if (popup) popup.opener = null;
    setBusy(true); setError(null); setNotice(null);
    try {
      const result = await localAIRequest<{ url: string }>('sign-in', newAccount ? {} : { profileId: active?.id });
      if (!popup) { await localAIRequest('cancel', {}); throw new Error('Allow pop-ups for the local game, then try Continue with ChatGPT again.'); }
      popup.location.href = result.url;
      await refresh();
    } catch (failure: unknown) { popup?.close(); setError(failure instanceof Error ? failure.message : 'Could not start ChatGPT sign-in.'); }
    finally { setBusy(false); }
  }, [active?.id, refresh]);
  const handleSignIn = useCallback(() => { void signIn(false); }, [signIn]);
  const handleAddAccount = useCallback(() => { void signIn(true); }, [signIn]);
  const handleRefresh = useCallback(() => { void refresh(); }, [refresh]);
  const handleCancel = useCallback(() => {
    void localAIRequest('cancel', {}).then(refresh).catch((failure: unknown) => { setError(failure instanceof Error ? failure.message : 'Could not cancel sign-in.'); });
  }, [refresh]);
  const handleProfileChange = useCallback((event: React.ChangeEvent<HTMLSelectElement>) => {
    setBusy(true);
    void localAIRequest('select', { profileId: event.target.value }).then(refresh).catch((failure: unknown) => { setError(failure instanceof Error ? failure.message : 'Could not select this account.'); }).finally(() => { setBusy(false); });
  }, [refresh]);
  const handleModelChange = useCallback((event: React.ChangeEvent<HTMLSelectElement>) => { setChatGPTModel(event.target.value); }, []);
  const handleSignOut = useCallback(() => {
    setBusy(true); setNotice(null);
    void localAIRequest<{ warning: string | null }>('sign-out', {}).then(async result => { setNotice(result.warning); await refresh(); }).catch((failure: unknown) => { setError(failure instanceof Error ? failure.message : 'Could not sign out.'); }).finally(() => { setBusy(false); });
  }, [refresh]);

  if (!isLocalGame()) return <p className="text-amber-300">ChatGPT sign-in is available in the local game.</p>;
  return (
    <div className="space-y-3 text-slate-200">
      {status?.profiles.length ? (
        <label className="block">ChatGPT account{' '}
          <select aria-label="ChatGPT account" className="block w-full p-2 bg-slate-700 rounded mt-1" disabled={busy || status.pending} onChange={handleProfileChange} value={status.activeProfileId ?? ''}>
            {!status.activeProfileId ? <option value="">Select an account</option> : null}
            {status.profiles.map(profile => <option key={profile.id} value={profile.id}>{profile.label}{profile.connected ? '' : ' · signed out'}</option>)}
          </select>
        </label>
      ) : null}
      {active?.sharing ? <p className="text-emerald-300">Connected</p> : null}
      {active?.connected && !active.sharing ? <p className="text-amber-300">Reconnect to enable gameplay.</p> : null}
      {status?.pending ? <div role="status"><p>Complete sign-in in the other browser tab.</p><Button ariaLabel="Cancel sign-in" label="Cancel sign-in" onClick={handleCancel} preset="gray" variant="compact" /></div> : (
        <div className="flex flex-wrap gap-2">
          <Button disabled={busy || !available} ariaLabel="Continue with ChatGPT" label="Continue with ChatGPT" onClick={handleSignIn} preset="gray" />
          {status?.profiles.length ? <Button disabled={busy} ariaLabel="Add account" label="Add account" onClick={handleAddAccount} preset="indigo" variant="compact" /> : null}
          {active?.connected ? <Button disabled={busy} ariaLabel="Sign out" label="Sign out" onClick={handleSignOut} preset="gray" variant="compact" /> : null}
        </div>
      )}
      {active?.sharing ? <label className="block">Model{' '}
        <select aria-label="ChatGPT model" className="block w-full p-2 bg-slate-700 rounded mt-1" disabled={busy || !!status?.pending || !models.length} onChange={handleModelChange} value={model}>
          {!models.length ? <option value="">No models loaded</option> : null}
          {models.map(item => <option key={item.slug} value={item.slug}>{item.displayName}</option>)}
        </select>
      </label> : null}
      <div className="flex items-center gap-3">
        <a className="text-sky-400 underline hover:text-sky-300" href={CHATGPT_USAGE_URL} rel="noopener noreferrer" target="_blank">Manage usage</a>
        <Button disabled={busy} ariaLabel="Refresh connection" label="Refresh connection" onClick={handleRefresh} preset="blue" variant="compact" />
      </div>
      {error ?? status?.error ? <p className="text-red-300" role="alert">{error ?? status?.error}</p> : null}
      {notice ? <p className="text-amber-300" role="status">{notice}</p> : null}
    </div>
  );
}

export default ChatGPTConnection;
