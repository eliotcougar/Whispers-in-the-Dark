import Button from '../elements/Button';
import { Icon } from '../elements/icons';
import AIConnectionSettings from '../AIConnectionSettings';

interface GeminiKeyModalProps {
  readonly isVisible: boolean;
  readonly onClose: () => void;
}

function GeminiKeyModal({ isVisible, onClose }: GeminiKeyModalProps) {
  if (!isVisible) return null;
  return (
    <div aria-labelledby="ai-connection-title" aria-modal="true" className="animated-frame open" role="dialog">
      <div className="animated-frame-content flex flex-col items-center">
        <Button ariaLabel="Close AI connection" icon={<Icon name="x" size={20} />} onClick={onClose} size="sm" variant="close" />
        <h1 className="text-2xl font-bold text-sky-300 mb-4" id="ai-connection-title">AI Connection</h1>
        <div className="w-full min-h-0 flex-1 overflow-y-auto px-2">
          <AIConnectionSettings />
        </div>
        <div className="mt-4 shrink-0"><Button ariaLabel="Done" label="Done" onClick={onClose} preset="blue" /></div>
      </div>
    </div>
  );
}

export default GeminiKeyModal;
