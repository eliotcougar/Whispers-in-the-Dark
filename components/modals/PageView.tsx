import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { Item, ItemChapter, MapData, NPC, AdventureTheme } from '../../types';
import { formatKnownPlacesForPrompt, npcsToString } from '../../utils/promptFormatters';
import { PLAYER_JOURNAL_ID } from '../../constants';
import { rot13, toRunic, tornVisibleText } from '../../utils/textTransforms';
import Button from '../elements/Button';
import { Icon } from '../elements/icons';
import LoadingSpinner from '../LoadingSpinner';
import { generatePageText } from '../../services/page';
import { generateChapterImage } from '../../services/image';
import { setLoadingReason } from '../../utils/loadingState';
import {
  loadChapterImage,
  saveChapterImage,
  makeImageRef,
  isImageRef,
} from '../../services/imageDb';
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
  readonly updateItemContent: (
    itemId: string,
    actual?: string,
    visible?: string,
    chapterIndex?: number,
    imageData?: string,
  ) => void;
  readonly onInspect?: () => void;
  readonly onWriteJournal?: () => void;
  readonly canWriteJournal?: boolean;
  readonly canInspectJournal?: boolean;
  readonly isWritingJournal?: boolean;
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
  canWriteJournal = true,
  canInspectJournal = true,
  isWritingJournal = false,
}: PageViewProps) {
  const [text, setText] = useState<string | null>(null);
  const [isTextLoading, setIsTextLoading] = useState(false);
  const [isImageLoading, setIsImageLoading] = useState(false);
  const isLoading = isTextLoading || isImageLoading;
  const [showDecoded, setShowDecoded] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [chapterIndex, setChapterIndex] = useState(startIndex);
  const isGeneratingImageRef = useRef(false);
  const isBook = item?.type === 'book';
  const isPage = item?.type === 'page';
  const isJournal = item?.id === PLAYER_JOURNAL_ID;

  const chapters = useMemo(() => {
    if (!item) return [];
    if (item.id === PLAYER_JOURNAL_ID) return item.chapters ?? [];
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

  const allChaptersGenerated = useMemo(
    () => chapters.every(ch => Boolean(ch.actualContent)),
    [chapters]
  );



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
      if (isBook && !isJournal) {
        if (value <= unlockedChapterCount) setChapterIndex(value);
      } else if (value < unlockedChapterCount) {
        setChapterIndex(value);
      }
    },
    [unlockedChapterCount, isBook, isJournal]
  );

  const { name: themeName, storyGuidance: themeDescription } = currentTheme;

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

    const idx = item?.type === 'book' && !isJournal ? chapterIndex - 1 : chapterIndex;
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
  }, [item, showDecoded, chapterIndex, chapters, isJournal]);


  const knownPlaces = useMemo(() => {
    const nodes = mapData.nodes.filter(
      n =>
        n.data.nodeType !== 'feature' &&
        n.data.nodeType !== 'room',
    );
    return formatKnownPlacesForPrompt(nodes, true);
  }, [mapData]);

  const knownNPCs = useMemo(() => {
    return allNPCs.length > 0
      ? npcsToString(allNPCs, ' - ', false, false, false, true)
      : 'None specifically known in this theme yet.';
  }, [allNPCs]);

  useEffect(() => {
    if (!isVisible || !item) {
      setText(null);
      setImageUrl(null);
      setIsTextLoading(false);
      return;
    }

    if (item.type === 'book' && !isJournal && chapterIndex === 0) {
      setText(null);
      setIsTextLoading(false);
      return;
    }

    const idx = item.type === 'book' && !isJournal ? chapterIndex - 1 : chapterIndex;
    if (idx < 0 || idx >= chapters.length) {
      setText(null);
      setIsTextLoading(false);
      return;
    }
    const chapter = chapters[idx];
    if (chapter.visibleContent) {
      setText(chapter.visibleContent);
      setIsTextLoading(false);
      return;
    }
    if (item.id === PLAYER_JOURNAL_ID && chapter.actualContent) {
      setText(chapter.actualContent);
      setIsTextLoading(false);
      return;
    }

    setIsTextLoading(true);
    setLoadingReason(item.type === 'book' ? 'book' : 'page');
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
        item.type === 'book' && !isJournal && idx > 0
          ? chapters[idx - 1].actualContent ?? ''
          : undefined
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
      setIsTextLoading(false);
      setLoadingReason(null);
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
    isJournal,
  ]);

  useEffect(() => {
    setIsImageLoading(false);
    if (
      !isVisible ||
      !item ||
      (item.type !== 'picture' && item.type !== 'map')
    ) {
      setImageUrl(null);
      setIsImageLoading(false);
      return;
    }
    const idx = chapterIndex;
    if (idx < 0 || idx >= chapters.length) {
      setImageUrl(null);
      setIsImageLoading(false);
      return;
    }
    const chapter = chapters[idx];
    void (async () => {
      if (isImageRef(chapter.imageData)) {
        const data = await loadChapterImage(item.id, idx);
        if (data) {
          setImageUrl(`data:image/jpeg;base64,${data}`);
          setIsImageLoading(false);
          return;
        }
      } else if (chapter.imageData) {
        await saveChapterImage(item.id, idx, chapter.imageData);
        updateItemContent(item.id, undefined, undefined, idx, makeImageRef(item.id, idx));
        setImageUrl(`data:image/jpeg;base64,${chapter.imageData}`);
        setIsImageLoading(false);
        return;
      } else {
        const cached = await loadChapterImage(item.id, idx);
        if (cached) {
          updateItemContent(item.id, undefined, undefined, idx, makeImageRef(item.id, idx));
          setImageUrl(`data:image/jpeg;base64,${cached}`);
          setIsImageLoading(false);
          return;
        }
      }
      if (isGeneratingImageRef.current) return;
      isGeneratingImageRef.current = true;
      setIsImageLoading(true);
      setLoadingReason(item.type === 'book' ? 'book' : 'page');
      const img = await generateChapterImage(item, currentTheme, idx);
      if (img) {
        await saveChapterImage(item.id, idx, img);
        updateItemContent(
          item.id,
          undefined,
          undefined,
          idx,
          makeImageRef(item.id, idx),
        );
        setImageUrl(`data:image/jpeg;base64,${img}`);
      }
      setIsImageLoading(false);
      setLoadingReason(null);
      isGeneratingImageRef.current = false;
    })();
  }, [
    isVisible,
    item,
    chapterIndex,
    chapters,
    currentTheme,
    updateItemContent,
  ]);

  const displayedText = useMemo(() => {
    if (!item) return text;
    const idx = item.type === 'book' && !isJournal ? chapterIndex - 1 : chapterIndex;
    const chapterValid = idx >= 0 && idx < chapters.length;
    if (!chapterValid) return text;
    const chapter = chapters[idx];
    if (showDecoded && chapter.actualContent) {
      return chapter.actualContent;
    }
    return text;
  }, [showDecoded, item, text, chapterIndex, chapters, isJournal]);


  const pendingWrite = useMemo(
    () => isJournal && isWritingJournal,
    [isJournal, isWritingJournal]
  );

  useEffect(() => {
    if (!pendingWrite) return undefined;
    setLoadingReason('journal');
    return () => {
      setLoadingReason(null);
    };
  }, [pendingWrite]);

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

  const canInspectItem = useMemo(() => {
    if (!item) return false;
    if (isJournal) return canInspectJournal;
    if (isBook || isPage) return allChaptersGenerated;
    return true;
  }, [item, isJournal, isBook, isPage, canInspectJournal, allChaptersGenerated]);

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

        {isBook || isJournal ? (
          <div className="flex justify-center items-center gap-2 mb-2">
            {isJournal && onInspect ? (
              <Button
                ariaLabel="Inspect"
                disabled={!canInspectItem}
                label="Inspect"
                onClick={handleInspectClick}
                preset="indigo"
                size="sm"
                variant="compact"
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
              {isBook && !isJournal ? (
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
                (isBook && !isJournal
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
                disabled={!canWriteJournal || isWritingJournal}
                label="Write"
                onClick={handleWriteClick}
                preset="blue"
                size="sm"
                title="Write a new journal entry"
                variant="compact"
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
          <LoadingSpinner />
        ) : isLoading ? (
          <LoadingSpinner />
        ) : item?.type === 'book' && !isJournal && chapterIndex === 0 ? (
          <ul className={`p-5 mt-4 list-disc list-inside overflow-y-auto text-left ${textClassNames}`}>
            {chapters.map((ch, idx) => (
              <p key={ch.heading}>
                {`${String(idx + 1)}. ${ch.heading}`}
              </p>
            ))}
          </ul>
        ) : displayedText || ((item?.type === 'picture' || item?.type === 'map') && imageUrl) ? (
          <div
            className={`whitespace-pre-wrap text-lg overflow-y-auto p-5 mt-4 ${textClassNames} ${tearOrientation ? `torn-${tearOrientation}` : ''}`}
          >
            {(item?.type === 'picture' || item?.type === 'map') && imageUrl ? (
              <div className="mb-4 flex justify-center">
                <img
                  alt={item.name}
                  className="max-h-[24rem] object-contain mask-gradient-edges"
                  src={imageUrl}
                />
              </div>
            ) : null}

            {displayedText ? applyBasicMarkup(displayedText) : null}
          </div>
        ) : isJournal && chapters.length === 0 ? (
          <div
            className={`whitespace-pre-wrap text-lg overflow-y-auto p-5 mt-4 min-h-[20rem] tag-${currentTheme.playerJournalStyle}`}
          />
        ) : null}
      </div>
    </div>
  );
}

export default PageView;

PageView.defaultProps = {
  canInspectJournal: true,
  canWriteJournal: true,
  isWritingJournal: false,
  onInspect: undefined,
  onWriteJournal: undefined,
  startIndex: 0,
};
