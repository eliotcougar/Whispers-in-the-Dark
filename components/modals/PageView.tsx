import { useEffect, useState, useMemo, useCallback } from 'react';
import { Item, ItemChapter, MapData, Character, AdventureTheme } from '../../types';
import { formatKnownPlacesForPrompt, charactersToString } from '../../utils/promptFormatters';
import { rot13, toGothic, toRunic } from '../../utils/textTransforms';
import Button from '../elements/Button';
import { Icon } from '../elements/icons';
import LoadingSpinner from '../LoadingSpinner';
import { generatePageText } from '../../services/page';
import { applyBasicMarkup } from '../../utils/markup';

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
  readonly updateItemContent: (itemId: string, actual: string, visible: string, chapterIndex?: number) => void;
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
  const [chapterIndex, setChapterIndex] = useState(0);

  const chapters = useMemo(() => {
    if (!item) return [];
    if (item.chapters && item.chapters.length > 0) return item.chapters;
    return [
      {
        heading: item.name,
        description: item.description,
        contentLength: item.contentLength ?? 30,
        actualContent: item.actualContent,
        visibleContent: item.visibleContent,
      },
    ];
  }, [item]);



  const handlePrevChapter = useCallback(() => {
    setChapterIndex(i => Math.max(0, i - 1));
  }, []);

  const handleNextChapter = useCallback(() => {
    setChapterIndex(i => Math.min(chapters.length, i + 1));
  }, [chapters.length]);

  const handleSelectChapter = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      setChapterIndex(Number(e.target.value));
    },
    []
  );

  const { name: themeName, systemInstructionModifier: themeDescription } = currentTheme;

  const handleToggleDecoded = useCallback(() => {
    setShowDecoded(prev => !prev);
  }, []);

  useEffect(() => {
    setShowDecoded(false);
    setChapterIndex(0);
  }, [item?.id, isVisible]);

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

    const idx = item?.type === 'book' ? chapterIndex - 1 : chapterIndex;
    const chapterValid = idx >= 0 && idx < chapters.length;
    const chapter: ItemChapter | undefined = chapterValid ? chapters[idx] : undefined;
    const showActual = showDecoded && Boolean(chapter?.actualContent);
    const hasForeign = !showActual && tags.includes('foreign');

    if (tags.includes('handwritten')) {
      classes.push(hasForeign ? 'tag-handwritten-foreign' : 'tag-handwritten');
    } else if (tags.includes('printed')) {
      classes.push(hasForeign ? 'tag-printed-foreign' : 'tag-printed');
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
    if (tags.includes('recovered') && showDecoded) classes.push('tag-recovered');

    return classes.join(' ');
  }, [item, showDecoded, chapterIndex, chapters]);


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
    if (!isVisible || !item) {
      setText(null);
      return;
    }

    if (item.type === 'book' && chapterIndex === 0) {
      setText(null);
      return;
    }

    const idx = item.type === 'book' ? chapterIndex - 1 : chapterIndex;
    const chapter = chapters[idx];

    if (chapter.visibleContent) {
      setText(chapter.visibleContent);
      return;
    }

    setIsLoading(true);
    void (async () => {
      const length = chapter.contentLength;
      const actual = await generatePageText(
        chapter.heading,
        chapter.description,
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
            chapter.heading,
            chapter.description,
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
        updateItemContent(item.id, actual, visible, idx);
        setText(visible);
      }
      setIsLoading(false);
    })();
  }, [
    isVisible,
    item,
    chapterIndex,
    chapters,
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
    if (!item) return text;
    const idx = item.type === 'book' ? chapterIndex - 1 : chapterIndex;
    const chapterValid = idx >= 0 && idx < chapters.length;
    if (!chapterValid) return text;
    const chapter = chapters[idx];
    if (showDecoded && chapter.actualContent) {
      return chapter.actualContent;
    }
    return text;
  }, [showDecoded, item, text, chapterIndex, chapters]);

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

        {item?.type === 'book' ? (
          <div className="flex justify-center items-center gap-2 mb-2">
            <Button
              ariaLabel="Previous chapter"
              disabled={chapterIndex === 0}
              label="◄"
              onClick={handlePrevChapter}
              preset="slate"
              variant="toolbar"
              size="lg"
            />
            <select
              aria-label="Select chapter"
              className="bg-slate-800 text-white text-md h-9 p-2"
              onChange={handleSelectChapter}
              value={chapterIndex}
            >
              <option value={0}>ToC</option>
              {chapters.map((ch, idx) => (
                <option key={ch.heading} value={idx + 1}>{ch.heading}</option>
              ))}
            </select>
            <Button
              ariaLabel="Next chapter"
              disabled={chapterIndex === chapters.length}
              label="►"
              onClick={handleNextChapter}
              preset="slate"
              variant="toolbar"
              size="lg"
            />
          </div>
        ) : null}

        {item?.tags?.includes('recovered') ? (
          <div className="flex justify-center">
            <Button
              ariaLabel={showDecoded ? 'Show encoded text' : 'Show decoded text'}
              label={showDecoded ? 'Hide' : 'Reveal'}
              onClick={handleToggleDecoded}
              preset={showDecoded ? 'sky' : 'slate'}
              pressed={showDecoded}
              size="sm"
              variant="toggle"
            />
          </div>
        ) : null}

        {isLoading ? (
          <LoadingSpinner loadingReason={item?.type === 'book' ? 'book' : 'page'} />
        ) : item?.type === 'book' && chapterIndex === 0 ? (
          <ul className={`p-5 mt-4 list-disc list-inside overflow-y-auto text-left ${textClassNames}`}>
            {chapters.map((ch, idx) => (
              <p key={ch.heading}>{`${String(idx + 1)}. ${ch.heading}`}</p>
            ))}
          </ul>
        ) : displayedText ? (
          <div className={`whitespace-pre-wrap text-lg overflow-y-auto p-5 mt-4 ${textClassNames}`}>
            {applyBasicMarkup(displayedText)}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default PageView;
