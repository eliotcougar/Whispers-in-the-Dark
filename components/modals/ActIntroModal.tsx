import Button from '../elements/Button';
import type { StoryAct } from '../../types';

interface ActIntroModalProps {
  readonly act: StoryAct;
  readonly onContinue: () => void;
}

function ActIntroModal({ act, onContinue }: ActIntroModalProps) {
  return (
    <div
      aria-labelledby="act-intro-heading"
      aria-modal="true"
      className="animated-frame open"
      role="dialog"
    >
      <div className="animated-frame-content flex flex-col items-center p-4 text-center">
        <h2 id="act-intro-heading" className="text-2xl font-bold">
          {`Act ${String(act.actNumber)}: ${act.title}`}
        </h2>

        <p className="mt-4">
          {act.description}
        </p>

        <div className="mt-6">
          <Button
            ariaLabel="Continue"
            label="Continue"
            onClick={onContinue}
            preset="blue"
            size="lg"
          />
        </div>
      </div>
    </div>
  );
}

export default ActIntroModal;
