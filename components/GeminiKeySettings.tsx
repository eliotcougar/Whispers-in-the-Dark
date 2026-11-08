import { useCallback, useState } from 'react';
import { getApiKey, setApiKey } from '../services/geminiClient';
import Button from './elements/Button';

function GeminiKeySettings() {
  const [key, setKey] = useState(getApiKey() ?? '');
  const [saved, setSaved] = useState(false);
  const handleKeyChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => { setKey(event.target.value); setSaved(false); }, []);
  const handleSave = useCallback(() => { setApiKey(key.trim()); setSaved(true); }, [key]);
  return (<div className="space-y-3 text-slate-200">
    <label className="block">Gemini API key<input aria-label="Gemini API key" className="block w-full p-2 bg-slate-700 rounded mt-1" onChange={handleKeyChange} type="password" value={key} /></label>
    <div className="flex items-center gap-3">
      <Button disabled={!key.trim()} ariaLabel="Save Gemini key" label="Save Gemini key" onClick={handleSave} preset="green" />
      <a className="text-sky-400 underline hover:text-sky-300" href="https://aistudio.google.com/apikey" rel="noopener noreferrer" target="_blank">Get API key</a>
    </div>
    {saved ? <p className="text-emerald-300" role="status">Gemini key saved.</p> : null}
  </div>);
}

export default GeminiKeySettings;
