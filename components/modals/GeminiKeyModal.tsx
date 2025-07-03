import { useState, useCallback, useEffect } from 'react';
import Button from '../elements/Button';
import { Icon } from '../elements/icons';
import { getApiKey, setApiKey } from '../../services/apiClient';

interface GeminiKeyModalProps {
  readonly isVisible: boolean;
  readonly onClose: () => void;
}

function GeminiKeyModal({ isVisible, onClose }: GeminiKeyModalProps) {
  const [key, setKey] = useState('');

  useEffect(() => {
    if (isVisible) {
      setKey(getApiKey() ?? '');
    }
  }, [isVisible]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setKey(e.target.value);
  }, []);

  const handleSave = useCallback(() => {
    setApiKey(key.trim());
    onClose();
  }, [key, onClose]);

  if (!isVisible) return null;

  return (
    <div
      aria-labelledby="gemini-key-title"
      aria-modal="true"
      className="animated-frame open"
      role="dialog"
    >
      <div className="animated-frame-content flex flex-col items-center">
        <Button
          ariaLabel="Close Gemini key setup"
          icon={<Icon name="x" size={20} />}
          onClick={onClose}
          size="sm"
          variant="close"
        />

        <h1 className="text-2xl font-bold text-sky-300 mb-4" id="gemini-key-title">
          Configure Gemini API Key
        </h1>

        <div className="mb-4 text-slate-200 text-center">
          Visit
          
          {' '}

          <a
            href="https://aistudio.google.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sky-400 underline hover:text-sky-300"
          >
            https://aistudio.google.com

          </a>

          {' '}

          to generate a free API key. Paste it below.
        </div>

        <div className="flex w-full max-w-md space-x-2">
          <input
            aria-label="Gemini API key"
            className="flex-grow p-2 bg-slate-700 text-slate-200 border border-slate-600 rounded-md shadow-sm focus:ring-sky-500 focus:border-sky-500"
            onChange={handleChange}
            placeholder="Enter API key"
            type="password"
            value={key}
          />

          <Button
            ariaLabel="Save API key"
            disabled={key.trim() === ''}
            label="Save"
            onClick={handleSave}
            preset="green"
            variant="compact"
          />
        </div>

        <div className="mb-4 text-amber-400 text-center">
          The game runs entirely in your browser. The key never leaves your device and will be stored in the Browser&apos;s Local Storage.
        </div>
      </div>
    </div>
  );
}

export default GeminiKeyModal;
