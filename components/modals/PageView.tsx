import { useEffect, useState, useMemo, useCallback } from 'react';
import { Item, MapData, Character, AdventureTheme } from '../../types';
import { formatKnownPlacesForPrompt, charactersToString } from '../../utils/promptFormatters';
import { rot13, toGothic, toRunic } from '../../utils/textTransforms';
import Button from '../elements/Button';
import { Icon } from '../elements/icons';
import LoadingSpinner from '../LoadingSpinner';
import { generatePageText } from '../../services/page';

interface PageViewProps {
  readonly item: Item | null;
  readonly currentTheme: AdventureTheme;
  readonly currentScene: string;
  readonly storytellerThoughts: string;
  readonly mapData: MapData;
  readonly allCharacters: Array<Character>;
  readonly currentQuest: string | null;
  readonly isVisible: boolean;
  readonly onClose: () => void;
  readonly updateItemContent: (itemId: string, actual: string, visible: string) => void;
}

function PageView({
  item,
  currentTheme,
  currentScene,
  storytellerThoughts,
  mapData,
  allCharacters,
  currentQuest,
  isVisible,
  onClose,
  updateItemContent,
}: PageViewProps) {
  const [text, setText] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showDecoded, setShowDecoded] = useState(false);

  const { name: themeName, systemInstructionModifier: themeDescription } = currentTheme;

  const handleToggleDecoded = useCallback(() => {
    setShowDecoded(prev => !prev);
  }, []);

  useEffect(() => {
    setShowDecoded(false);
  }, [item, isVisible]);

  /**
   * Close the view when clicking outside of the modal content.
   */
  const handleOverlayClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (event.target === event.currentTarget) {
        onClose();
      }
    },
    [onClose]
  );

  const textClassNames = useMemo(() => {
    const tags = item?.tags ?? [];
    const classes: Array<string> = [];
    const showActual = showDecoded && item?.actualContent;
    const hasForeign = !showActual && tags.includes('foreign');

    if (tags.includes('handwritten')) {
      classes.push(hasForeign ? 'tag-handwritten-foreign' : 'tag-handwritten');
    } else if (tags.includes('typed')) {
      classes.push(hasForeign ? 'tag-typed-foreign' : 'tag-typed');
    } else if (tags.includes('digital')) {
      classes.push(hasForeign ? 'tag-digital-foreign' : 'tag-digital');
    }

    if (tags.includes('faded')) classes.push('tag-faded');
    if (tags.includes('smudged')) classes.push('tag-smudged');
    if (tags.includes('torn')) classes.push('tag-torn');
    if (!showActual) {
      if (tags.includes('glitching')) classes.push('tag-glitching');
      if (tags.includes('encrypted')) classes.push('tag-encrypted');
      if (tags.includes('foreign')) classes.push('tag-foreign');
    }
    if (tags.includes('gothic')) classes.push('tag-gothic');
    if (tags.includes('runic')) classes.push('tag-runic');
    if (tags.includes('bloodstained')) classes.push('tag-bloodstained');
    if (tags.includes('water-damaged')) classes.push('tag-water-damaged');
    if (tags.includes('recovered')) classes.push('tag-recovered');

    return classes.join(' ');
  }, [item, showDecoded]);

  const knownPlaces = useMemo(() => {
    const nodes = mapData.nodes.filter(
      n =>
        n.themeName === themeName &&
        n.data.nodeType !== 'feature' &&
        n.data.nodeType !== 'room',
    );
    return formatKnownPlacesForPrompt(nodes, true);
  }, [mapData, themeName]);

  const knownCharacters = useMemo(() => {
    const chars = allCharacters.filter(c => c.themeName === themeName);
    return chars.length > 0
      ? charactersToString(chars, ' - ', false, false, false, true)
      : 'None specifically known in this theme yet.';
  }, [allCharacters, themeName]);

  useEffect(() => {
    if (isVisible && item) {
      if (item.visibleContent) {
        setText(item.visibleContent);
      } else {
        setIsLoading(true);
        void (async () => {
          const length = item.contentLength ?? 30;
          const actual = await generatePageText(
            item.name,
            item.description,
            length,
            themeName,
            themeDescription,
            currentScene,
            storytellerThoughts,
            knownPlaces,
            knownCharacters,
            currentQuest,
            'Write it exclusively in English without any foreign, encrypted, or gibberish text.'
          );
          if (actual) {
            let visible = actual;
            if (item.tags?.includes('foreign')) {
              const fake = await generatePageText(
                item.name,
                item.description,
                length,
                themeName,
                themeDescription,
                currentScene,
                storytellerThoughts,
                knownPlaces,
                knownCharacters,
                currentQuest,
                `Translate the following text into an artificial nonexistent language that fits the theme and context:\n"""${actual}"""`
              );
              visible = fake ?? actual;
            } else if (item.tags?.includes('encrypted')) {
              visible = rot13(actual);
            } else if (item.tags?.includes('gothic')) {
              visible = toGothic(actual);
            } else if (item.tags?.includes('runic')) {
              visible = toRunic(actual);
            }
            updateItemContent(item.id, actual, visible);
            setText(visible);
          }
          setIsLoading(false);
        })();
      }
    } else {
      setText(null);
    }
  }, [
    isVisible,
    item,
    themeName,
    themeDescription,
    currentScene,
    storytellerThoughts,
    knownPlaces,
    knownCharacters,
    currentQuest,
    updateItemContent,
  ]);

  const displayedText = useMemo(() => {
    if (showDecoded && item?.actualContent) {
      return item.actualContent;
    }
    return text;
  }, [showDecoded, item, text]);

  return (
    <div
      aria-labelledby="page-view-title"
      aria-modal="true"
      className={`animated-frame ${isVisible ? 'open' : ''}`}
      onClick={handleOverlayClick}
      role="dialog"
    >
      <div className="animated-frame-content page-view-content-area">
        <Button
          ariaLabel="Close page"
          icon={<Icon
            name="x"
            size={20}
          />}
          onClick={onClose}
          size="sm"
          variant="close"
        />

        {item?.name ? (
          <h2
            className="text-2xl font-bold text-amber-400 mb-4 text-center"
            id="page-view-title"
          >
            {item.name}
          </h2>
        ) : null}

        {item?.tags?.includes('recovered') && item.actualContent ? (
          <div className="flex justify-center mb-2">
            <Button
              ariaLabel={showDecoded ? 'Show encoded text' : 'Show decoded text'}
              label={showDecoded ? 'Hide Translation' : 'Show Translation'}
              onClick={handleToggleDecoded}
              preset={showDecoded ? 'sky' : 'slate'}
              pressed={showDecoded}
              size="sm"
              variant="toggle"
            />
          </div>
        ) : null}

        {isLoading ? (
          <LoadingSpinner loadingReason="page" />
        ) : displayedText ? (
          <div
            className={`whitespace-pre-wrap text-lg overflow-y-auto p-5 mt-4 ${textClassNames}`}
          >
            {displayedText}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default PageView;
