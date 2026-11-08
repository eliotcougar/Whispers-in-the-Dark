import { useCallback } from 'react';
import { setGeminiModel, useAIConnection } from '../services/aiProvider';
import { GEMINI_TEXT_MODELS, isGeminiTextModel } from '../shared/gemini';
import GeminiKeySettings from './GeminiKeySettings';

function GeminiConnection() {
  const { geminiModel } = useAIConnection();
  const handleModelChange = useCallback((event: React.ChangeEvent<HTMLSelectElement>) => {
    if (isGeminiTextModel(event.target.value)) setGeminiModel(event.target.value);
  }, []);
  return (
    <div className="space-y-3 text-slate-200">
      <label className="block">Text model{' '}
        <select aria-label="Gemini text model" className="block w-full p-2 bg-slate-700 rounded mt-1" onChange={handleModelChange} value={geminiModel}>
          {GEMINI_TEXT_MODELS.map(model => <option key={model.id} value={model.id}>{model.label}</option>)}
          <option value="auto">Automatic</option>
        </select>
      </label>
      <GeminiKeySettings />
    </div>
  );
}

export default GeminiConnection;
