
/**
 * @file InfoDisplay.tsx
 * @description Modal summarizing version and build info.
 */
import About from '../elements/About';
import GameMechanics from '../elements/GameMechanics';
import NotableFeatures from '../elements/NotableFeatures';
import SaveGameFunctionality from '../elements/SaveGameFunctionality';
import AiModels from '../elements/AiModels';
import Button from '../elements/Button';
import { Icon } from '../elements/icons';
import Changelog from '../elements/Changelog';
import TextBox from '../elements/TextBox';

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
        <Button
          ariaLabel="Close game information"
          className="animated-frame-close-button"
          icon={<Icon
            name="x"
            size={20}
                />}
          onClick={onClose}
          size="sm"
        />

        <div className="info-content-area">
          <TextBox
            borderColorClass="border-sky-700"
            borderWidthClass="border-b-2"
            containerClassName="mb-6"
            header="About Whispers in the Dark"
            headerColorClass="text-sky-300"
            headerFontClass="text-3xl font-bold text-center"
            headerTag="h1"
          />

          <About />

          <GameMechanics />

          <NotableFeatures />

          <SaveGameFunctionality />

          <AiModels />

          <Changelog />

          <TextBox
            containerClassName="mt-8"
            contentColorClass="text-slate-500"
            contentFontClass="text-sm text-center"
            text="Thank you for playing Whispers in the Dark!"
          />

        </div>
      </div>
    </div>
  );
}

export default InfoDisplay;
