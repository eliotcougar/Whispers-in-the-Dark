import { useCallback, useEffect, useState } from 'react';
import { isLocalGame, useAIConnection } from '../services/aiProvider';
import { getImageModel, refreshOpenAIImageStatus, saveOpenAIImageKey, setImageModel, setImageProvider, setImageQuality, useImageConnection } from '../services/imageProvider';
import { isImageQuality, OPENAI_IMAGE_MODELS, GEMINI_IMAGE_MODELS, type ImageProvider } from '../shared/images';
import Button from './elements/Button';
import GeminiKeySettings from './GeminiKeySettings';

function ImageConnectionSettings() {
  const { provider: textProvider } = useAIConnection();
  const connection = useImageConnection();
  const { provider, quality, available, keyConfigured } = connection;
  const models = provider === 'openai' ? OPENAI_IMAGE_MODELS : GEMINI_IMAGE_MODELS;
  const [apiKey, setApiKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    if (!isLocalGame()) return;
    void refreshOpenAIImageStatus().catch((failure: unknown) => { setError(failure instanceof Error ? failure.message : 'Could not connect to the local image service.'); });
  }, []);
  const handleProviderChange = useCallback((event: React.ChangeEvent<HTMLSelectElement>) => { setImageProvider(event.target.value as ImageProvider); }, []);
  const handleKeyChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => { setApiKey(event.target.value); setSaved(false); }, []);
  const handleQualityChange = useCallback((event: React.ChangeEvent<HTMLSelectElement>) => { if (isImageQuality(event.target.value)) setImageQuality(event.target.value); }, []);
  const handleModelChange = useCallback((event: React.ChangeEvent<HTMLSelectElement>) => { setImageModel(event.target.value); }, []);
  const updateKey = useCallback(async (value: string) => {
    setBusy(true); setError(null); setSaved(false);
    try { await saveOpenAIImageKey(value); setApiKey(''); setSaved(true); }
    catch (failure: unknown) { setError(failure instanceof Error ? failure.message : 'Could not save the image API key.'); }
    finally { setBusy(false); }
  }, []);
  const handleSave = useCallback(() => { void updateKey(apiKey); }, [apiKey, updateKey]);
  const handleRemove = useCallback(() => { void updateKey(''); }, [updateKey]);

  return (
    <section className="space-y-3 text-slate-200 border-t border-slate-600 pt-4">
      <h2 className="text-xl text-amber-300 font-semibold">Images</h2>
      <label className="block">Image provider{' '}
        <select aria-label="Image provider" className="block w-full p-2 bg-slate-700 rounded mt-1" disabled={busy} onChange={handleProviderChange} value={provider}>
          <option value="disabled">Disabled</option>
          <option value="gemini">Google Gemini</option>
          <option value="openai">OpenAI</option>
        </select>
      </label>
      {provider !== 'disabled' ? (
        <label className="block">Image model{' '}
          <select aria-label="Image model" className="block w-full p-2 bg-slate-700 rounded mt-1" disabled={busy} onChange={handleModelChange} value={getImageModel(connection)}>
            {models.map(model => <option key={model.id} value={model.id}>{model.label}</option>)}
          </select>
        </label>
      ) : null}
      {provider === 'gemini' && textProvider !== 'gemini' ? <GeminiKeySettings /> : null}
      {provider === 'openai' ? (
        <div className="space-y-3">
          {!isLocalGame() ? <p className="text-amber-300">OpenAI images are available in the local game.</p> : (
            <div className="space-y-3">
              {!saved && keyConfigured ? <p className="text-emerald-300">Image key saved.</p> : null}
              <label className="block">OpenAI API key for images<input aria-label="OpenAI API key for images" autoComplete="off" className="block w-full p-2 bg-slate-700 rounded mt-1" disabled={busy} onChange={handleKeyChange} placeholder={keyConfigured ? 'Enter a replacement API key' : 'Enter your OpenAI API key'} type="password" value={apiKey} /></label>
              <div className="flex gap-2">
                <Button ariaLabel="Save OpenAI image key" disabled={busy || !available || !apiKey.trim()} label="Save image key" onClick={handleSave} preset="green" variant="compact" />
                {keyConfigured ? <Button ariaLabel="Remove OpenAI image key" disabled={busy} label="Remove key" onClick={handleRemove} preset="gray" variant="compact" /> : null}
              </div>
              {saved ? <p className="text-emerald-300" role="status">{keyConfigured ? 'Image key saved.' : 'Image key removed.'}</p> : null}
              <label className="block">Image quality{' '}
                <select aria-label="Image quality" className="block w-full p-2 bg-slate-700 rounded mt-1" onChange={handleQualityChange} value={quality}>
                  <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
                </select>
              </label>
            </div>
          )}
          {error ? <p className="text-red-300" role="alert">{error}</p> : null}
        </div>
      ) : null}
    </section>
  );
}

export default ImageConnectionSettings;
