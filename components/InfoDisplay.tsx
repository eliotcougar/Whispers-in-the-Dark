
/**
 * @file InfoDisplay.tsx
 * @description Modal summarizing version and build info.
 */
import About from './elements/About';
import GameMechanics from './elements/GameMechanics';
import NotableFeatures from './elements/NotableFeatures';
import SaveGameFunctionality from './elements/SaveGameFunctionality';
import AiModels from './elements/AiModels';
import Changelog from './elements/Changelog';

interface InfoDisplayProps {
  readonly isVisible: boolean;
  readonly onClose: () => void;
}

/**
 * Shows build and version information in a modal window.
 */
function InfoDisplay({ isVisible, onClose }: InfoDisplayProps) {

  return (
    <div
      aria-labelledby="info-title"
      aria-modal="true"
      className={`animated-frame ${isVisible ? 'open' : ''}`}
      role="dialog"
    >
      <div className="animated-frame-content">
        <button
          aria-label="Close game information"
          className="animated-frame-close-button"
          onClick={onClose}
          type="button"
        >
          &times;
        </button>

        <div className="info-content-area">
          <h1
            className="text-3xl font-bold text-sky-300 mb-6 text-center"
            id="info-title"
          >
            About Whispers in the Dark
          </h1>

          <About />

          <GameMechanics />

          <NotableFeatures />

          <SaveGameFunctionality />

          <AiModels />

          <Changelog />

          <p className="text-center text-slate-500 mt-8 text-sm">
            Thank you for playing Whispers in the Dark!
          </p>

        </div>
      </div>
    </div>
  );
}

export default InfoDisplay;
