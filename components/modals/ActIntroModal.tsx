import Button from '../elements/Button';
import LoadingSpinner from '../LoadingSpinner';
import type { StoryAct } from '../../types';

interface ActIntroModalProps {
  readonly act: StoryAct;
  readonly isTurnGenerating: boolean;
  readonly onContinue: () => void;
}

function ActIntroModal({ act, isTurnGenerating, onContinue }: ActIntroModalProps) {
  return (
    <div
      aria-labelledby="act-intro-heading"
      aria-modal="true"
      className="animated-frame open"
      role="dialog"
    >
      <div className="animated-frame-content flex max-h-[80vh] w-full flex-col items-center p-8 text-center">
        <h2
          className="mb-4 text-center text-3xl font-bold text-amber-400"
          id="act-intro-heading"
        >
          {`Act ${String(act.actNumber)}: ${act.title}`}
        </h2>

        <div className="mt-4 w-4/5 flex-1 max-h-[60vh] overflow-y-auto rounded p-4 text-left text-slate-300 space-y-6">
          <section className="space-y-2 text-lg">
            <p className="whitespace-pre-line text-center">
              {act.description}
            </p>
          </section>
        </div>

        <div className="mt-8 flex items-center space-x-4 self-center">
          <Button
            ariaLabel="Continue"
            label="Continue"
            onClick={onContinue}
            preset="blue"
            size="lg"
          />

          {isTurnGenerating ? (
            <LoadingSpinner
              showText={false}
              size="sm"
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default ActIntroModal;
