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
      <div className="animated-frame-content flex flex-col items-center p-4 text-center">
        <h2 id="victory-heading" className="text-2xl font-bold">
          Victory!
        </h2>

        <p className="mt-4">
          {`You guided ${heroSheet.name}, ${heroSheet.occupation}, through ${storyArc.title}.`}
        </p>

        <ul className="mt-4 list-inside list-disc text-left">
          {storyArc.acts.map(act => (
            <li key={act.actNumber}>
              {`Act ${String(act.actNumber)}: ${act.title} - ${act.mainObjective}`}
            </li>
          ))}
        </ul>

        <div className="mt-6">
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
