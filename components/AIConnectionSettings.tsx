import { useCallback } from 'react';
import { setAIProvider, useAIConnection, type AIProvider } from '../services/aiProvider';
import ChatGPTConnection from './ChatGPTConnection';
import GeminiConnection from './GeminiConnection';
import ImageConnectionSettings from './ImageConnectionSettings';

function AIConnectionSettings() {
  const { provider } = useAIConnection();
  const handleProviderChange = useCallback((event: React.ChangeEvent<HTMLSelectElement>) => { setAIProvider(event.target.value as AIProvider); }, []);
  return (
    <div className="space-y-4 w-full max-w-xl mx-auto">
      <label className="block text-slate-200">Text AI provider{' '}
        <select aria-label="Text AI provider" className="block w-full p-2 bg-slate-700 rounded mt-1" onChange={handleProviderChange} value={provider}>
          <option value="gemini">Google Gemini</option>
          <option value="chatgpt">ChatGPT</option>
        </select>
      </label>
      {provider === 'chatgpt' ? <ChatGPTConnection /> : <GeminiConnection />}
      <ImageConnectionSettings />
    </div>
  );
}

export default AIConnectionSettings;
