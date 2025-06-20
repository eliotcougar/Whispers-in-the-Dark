
/**
 * @file InfoDisplay.tsx
 * @description Modal summarizing version and build info.
 */
import Button from '../elements/Button';
import { Icon } from '../elements/icons';
import TextBox from '../elements/TextBox';
import ChangelogVersion from '../elements/ChangelogVersion';
import infoContentRaw from '../../resources/infoDisplayContent.json';
import {
  CURRENT_SAVE_GAME_VERSION,
  GEMINI_MODEL_NAME,
} from '../../constants';

interface InfoSection {
  readonly header: string;
  readonly text: ReadonlyArray<string>;
}

interface ChangelogEntry {
  readonly title: string;
  readonly items: ReadonlyArray<string>;
}

interface InfoContent {
  readonly title: string;
  readonly sections: ReadonlyArray<InfoSection>;
  readonly changelog: ReadonlyArray<ChangelogEntry>;
  readonly footer: string;
}

const infoContent = infoContentRaw as InfoContent;

function replacePlaceholders(text: string): string {
  return text
    .replace(/\{\{CURRENT_SAVE_GAME_VERSION\}\}/g, CURRENT_SAVE_GAME_VERSION)
    .replace(/\{\{GEMINI_MODEL_NAME\}\}/g, GEMINI_MODEL_NAME);
}

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
          icon={<Icon
            name="x"
            size={20}
                />}
          onClick={onClose}
          size="sm"
          variant="close"
        />

        <div className="info-content-area">
          <TextBox
            borderColorClass="border-sky-700"
            borderWidthClass="border-b-2"
            containerClassName="mb-6"
            header={infoContent.title}
            headerFont="3xl"
            headerPreset="sky"
            headerTag="h1"
            headerWrapperClassName="text-center"
          />

          {infoContent.sections.map(section => (
            <TextBox
              contentFontClass="leading-relaxed space-y-3"
              header={section.header}
              key={section.header}
              text={section.text.map(t => replacePlaceholders(t)).join('\n')}
            />
          ))}

          <TextBox
            contentFontClass="leading-relaxed space-y-4"
            header="Changelog"
          >
            {infoContent.changelog.map(entry => (
              <ChangelogVersion
                items={entry.items}
                key={entry.title}
                title={entry.title}
              />
            ))}
          </TextBox>

          <TextBox
            containerClassName="mt-8"
            contentColorClass="text-slate-500"
            contentFontClass="text-sm text-center"
            text={infoContent.footer}
          />

        </div>
      </div>
    </div>
  );
}

export default InfoDisplay;
