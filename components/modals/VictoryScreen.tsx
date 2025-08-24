import Button from '../elements/Button';
import type { HeroSheet, StoryArc } from '../../types';

interface VictoryScreenProps {
  readonly heroSheet: HeroSheet;
  readonly storyArc: StoryArc;
  readonly onClose: () => void;
}

function VictoryScreen({ heroSheet, storyArc, onClose }: VictoryScreenProps) {
  return (
    <div
      aria-labelledby="victory-heading"
      aria-modal="true"
      className="animated-frame open"
      role="dialog"
    >
      <div className="animated-frame-content flex max-h-[80vh] w-full flex-col items-center p-8 text-center">
        <h2
          className="text-2xl font-bold"
          id="victory-heading"
        >
          Victory!
        </h2>

        <p className="mt-4">
          {`You guided ${heroSheet.name}, ${heroSheet.occupation}, through ${storyArc.title}.`}
        </p>

        <div className="mt-8 w-4/5 max-h-[60vh] flex-1 overflow-y-auto rounded p-4 text-left">
          <ul className="space-y-6">
            {storyArc.acts.map(act => (
              <li key={act.actNumber}>
                <p className="font-semibold text-center">
                  {`Act ${String(act.actNumber)}: ${act.title}`}
                </p>

                <p className="mt-2">
                  {act.description}
                </p>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-8 self-center">
          <Button
            ariaLabel="Return to Title Menu"
            label="Return to Title"
            onClick={onClose}
            preset="blue"
            size="lg"
          />
        </div>
      </div>
    </div>
  );
}

export default VictoryScreen;
