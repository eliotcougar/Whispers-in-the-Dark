import { useEffect, useState, useMemo, useCallback } from 'react';
import { Item, ItemChapter, MapData, NPC, AdventureTheme } from '../../types';
import { formatKnownPlacesForPrompt, npcsToString } from '../../utils/promptFormatters';
import { rot13, toRunic, tornVisibleText } from '../../utils/textTransforms';
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
  readonly allNPCs: Array<NPC>;
  readonly currentQuest: string | null;
  readonly isVisible: boolean;
  readonly startIndex?: number;
  readonly onClose: () => void;
  readonly updateItemContent: (itemId: string, actual: string, visible: string, chapterIndex?: number) => void;
  readonly onInspect?: () => void;
  readonly onWriteJournal?: () => void;
}

function PageView({
  item,
  currentTheme,
  currentScene,
  storytellerThoughts,
  mapData,
  allNPCs,
  currentQuest,
  isVisible,
  startIndex = 0,
  onClose,
  updateItemContent,
  onInspect,
  onWriteJournal,
}: PageViewProps) {
  const [text, setText] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showDecoded, setShowDecoded] = useState(false);
  const [chapterIndex, setChapterIndex] = useState(startIndex);
  const isBook = item?.type === 'book';
  const isJournal = item?.type === 'journal';

  const chapters = useMemo(() => {
    if (!item) return [];
    if (item.type === 'journal') return item.chapters ?? [];
    if (item.chapters && item.chapters.length > 0) return item.chapters;
    const legacy = item as Item & {
      contentLength?: number;
      actualContent?: string;
      visibleContent?: string;
    };
    return [
      {
        heading: item.name,
        description: item.description,
        contentLength: legacy.contentLength ?? 30,
        actualContent: legacy.actualContent,
        visibleContent: legacy.visibleContent,
      },
    ];
  }, [item]);

  const unlockedChapterCount = useMemo(() => {
    if (!item) return chapters.length;
    if (item.type !== 'book') return chapters.length;
    let idx = 0;
    for (; idx < chapters.length; idx += 1) {
      if (!chapters[idx].actualContent) break;
    }
    return Math.min(chapters.length, idx + 1);
  }, [chapters, item]);



  const handlePrevChapter = useCallback(() => {
    setChapterIndex(i => Math.max(0, i - 1));
  }, []);

  const handleNextChapter = useCallback(() => {
    setChapterIndex(i => {
      if (isJournal) {
        return Math.min(chapters.length - 1, i + 1);
      }
      return Math.min(unlockedChapterCount, i + 1);
    });
  }, [isJournal, chapters.length, unlockedChapterCount]);

  const handleInspectClick = useCallback(() => {
    onInspect?.();
  }, [onInspect]);

  const handleWriteClick = useCallback(() => {
    onWriteJournal?.();
  }, [onWriteJournal]);

  const handleSelectChapter = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const value = Number(e.target.value);
      if (item?.type === 'book') {
        if (value <= unlockedChapterCount) setChapterIndex(value);
      } else if (value < unlockedChapterCount) {
        setChapterIndex(value);
      }
    },
    [unlockedChapterCount, item]
  );

  const { name: themeName, systemInstructionModifier: themeDescription } = currentTheme;

  const handleToggleDecoded = useCallback(() => {
    setShowDecoded(prev => !prev);
  }, []);

  useEffect(() => {
    setShowDecoded(false);
    setChapterIndex(startIndex);
  }, [item?.id, isVisible, startIndex]);

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

  const knownNPCs = useMemo(() => {
    const npcs = allNPCs.filter(npc => npc.themeName === themeName);
    return npcs.length > 0
      ? npcsToString(npcs, ' - ', false, false, false, true)
      : 'None specifically known in this theme yet.';
  }, [allNPCs, themeName]);

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
    if (idx < 0 || idx >= chapters.length) {
      setText(null);
      return;
    }
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
        knownNPCs,
        currentQuest,
        'Write it exclusively in English without any foreign, encrypted, or gibberish text.',
        item.type === 'book' && idx > 0 ? chapters[idx - 1].actualContent ?? '' : undefined
      );
      if (actual) {
        const tags = item.tags ?? [];
        let visible = actual;
        if (tags.includes('foreign')) {
          const fake = await generatePageText(
            chapter.heading,
            chapter.description,
            length,
            themeName,
            themeDescription,
            currentScene,
            storytellerThoughts,
            knownPlaces,
            knownNPCs,
            currentQuest,
            `Translate the following text into an artificial nonexistent language that fits the theme and context:\n"""${actual}"""`
          );
          visible = fake ?? actual;
        } else if (tags.includes('encrypted')) {
          visible = rot13(actual);
        } else if (tags.includes('runic')) {
          visible = toRunic(actual);
        }
        if (tags.includes('torn') && !tags.includes('recovered')) {
          visible = tornVisibleText(visible);
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
    knownNPCs,
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

  const pendingWrite = useMemo(
    () => isJournal && chapters.length > 0 && chapterIndex === chapters.length,
    [isJournal, chapterIndex, chapters.length]
  );

  const tearOrientation = useMemo(() => {
    if (
      !item ||
      !item.tags?.includes('torn') ||
      item.tags.includes('recovered') ||
      !displayedText
    )
      return null;
    const trimmed = displayedText.trim();
    if (trimmed.startsWith('--- torn ---')) return 'top';
    if (trimmed.endsWith('--- torn ---')) return 'bottom';
    return null;
  }, [displayedText, item]);

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

        {item?.type === 'book' || item?.type === 'journal' ? (
          <div className="flex justify-center items-center gap-2 mb-2">
            {onInspect ? (
              <Button
                ariaLabel="Inspect"
                icon={<Icon name="log" size={20} />}
                onClick={handleInspectClick}
                preset="indigo"
                size="sm"
                variant="toolbar"
              />
            ) : null}

            <Button
              ariaLabel="Previous chapter"
              disabled={chapterIndex === 0}
              label="◄"
              onClick={handlePrevChapter}
              preset="slate"
              size="lg"
              variant="toolbar"
            />

            <select
              aria-label="Select chapter"
              className="bg-slate-800 text-white text-md h-9 p-2"
              onChange={handleSelectChapter}
              value={chapterIndex}
            >
              {item.type === 'book' ? (
                <>
                  <option value={0}>
                    ToC
                  </option>

                  {chapters.slice(0, unlockedChapterCount).map((ch, idx) => (
                    <option
                      key={ch.heading}
                      value={idx + 1}
                    >
                      {ch.heading}
                    </option>
                  ))}
                </>
              ) : (
                chapters.map((ch, idx) => (
                  <option
                    key={ch.heading}
                    value={idx}
                  >
                    {ch.heading}
                  </option>
                ))
              )}
            </select>

            <Button
              ariaLabel="Next chapter"
              disabled={
                isLoading ||
                (isBook
                  ? chapterIndex >= unlockedChapterCount ||
                    chapterIndex === chapters.length
                  : chapterIndex >= chapters.length - 1)
              }
              label="►"
              onClick={handleNextChapter}
              preset="slate"
              size="lg"
              variant="toolbar"
            />

            {isJournal && onWriteJournal ? (
              <Button
                ariaLabel="Write entry"
                icon={<Icon name="journalPen" size={20} />}
                onClick={handleWriteClick}
                preset="blue"
                size="sm"
                variant="toolbar"
              />
            ) : null}
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

        {pendingWrite ? (
          <LoadingSpinner loadingReason="journal" />
        ) : isLoading ? (
          <LoadingSpinner loadingReason={item?.type === 'book' ? 'book' : 'page'} />
        ) : item?.type === 'book' && chapterIndex === 0 ? (
          <ul className={`p-5 mt-4 list-disc list-inside overflow-y-auto text-left ${textClassNames}`}>
            {chapters.map((ch, idx) => (
              <p key={ch.heading}>
                {`${String(idx + 1)}. ${ch.heading}`}
              </p>
            ))}
          </ul>
        ) : displayedText ? (
          <div
            className={`whitespace-pre-wrap text-lg overflow-y-auto p-5 mt-4 ${textClassNames} ${tearOrientation ? `torn-${tearOrientation}` : ''}`}
          >
            {applyBasicMarkup(displayedText)}
          </div>
        ) : item?.type === 'journal' && chapters.length === 0 ? (
          <div className="whitespace-pre-wrap text-lg overflow-y-auto p-5 mt-4 tag-handwritten" />
        ) : null}
      </div>
    </div>
  );
}

export default PageView;

PageView.defaultProps = {
  startIndex: 0,
  onInspect: undefined,
  onWriteJournal: undefined,
};
