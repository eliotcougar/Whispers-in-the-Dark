import {
  useState,
  useMemo,
  useEffect,
  useCallback,
  useRef,
} from 'react';
import type {
  AdventureTheme,
  Item,
  ItemChapter,
  MapData,
  NPC,
} from '../types';
import { PLAYER_JOURNAL_ID, IMAGE_ITEM_TYPES } from '../constants';
import { normalizeChapters } from '../utils/writtenItemChapters';
import { rot13, toRunic, tornVisibleText } from '../utils/textTransforms';
import { generatePageText } from '../services/page';
import { generateChapterImage } from '../services/image';
import { setLoadingReason } from '../utils/loadingState';
import {
  loadChapterImage,
  saveChapterImage,
  makeImageRef,
  isImageRef,
} from '../services/imageDb';

interface UsePageViewContentParams {
  readonly item: Item | null;
  readonly theme: AdventureTheme;
  readonly currentScene: string;
  readonly storytellerThoughts: string;
  readonly mapData: MapData;
  readonly allNPCs: Array<NPC>;
  readonly currentQuest: string | null;
  readonly isVisible: boolean;
  readonly startIndex: number;
  readonly isWritingJournal: boolean;
  readonly updateItemContent: (
    itemId: string,
    actual?: string,
    visible?: string,
    chapterIndex?: number,
    imageData?: string,
  ) => void;
}

interface PageViewContentState {
  readonly chapters: Array<ItemChapter>;
  readonly chapterIndex: number;
  readonly isBook: boolean;
  readonly isJournal: boolean;
  readonly isPage: boolean;
  readonly isImageItem: boolean;
  readonly unlockedChapterCount: number;
  readonly allChaptersGenerated: boolean;
  readonly text: string | null;
  readonly displayedText: string | null;
  readonly showDecoded: boolean;
  readonly textClassNames: string;
  readonly tearOrientation: 'top' | 'bottom' | null;
  readonly imageUrl: string | null;
  readonly isLoading: boolean;
  readonly canInspectItem: boolean;
  readonly pendingWrite: boolean;
  readonly handlePrevChapter: () => void;
  readonly handleNextChapter: () => void;
  readonly handleSelectChapter: (value: number) => void;
  readonly toggleDecoded: () => void;
}

export function usePageViewContent({
  item,
  theme,
  currentScene,
  storytellerThoughts,
  mapData,
  allNPCs,
  currentQuest,
  isVisible,
  startIndex,
  isWritingJournal,
  updateItemContent,
}: UsePageViewContentParams): PageViewContentState {
  const [chapterIndex, setChapterIndex] = useState(startIndex);
  const [showDecoded, setShowDecoded] = useState(false);
  const [text, setText] = useState<string | null>(null);
  const [isTextLoading, setIsTextLoading] = useState(false);
  const [isImageLoading, setIsImageLoading] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const isGeneratingImageRef = useRef(false);
  const textRequestTokenRef = useRef<symbol | null>(null);
  const imageRequestTokenRef = useRef<symbol | null>(null);

  const isBook = item?.type === 'book';
  const isPage = item?.type === 'page';
  const isJournal = item?.id === PLAYER_JOURNAL_ID;
  const isImageItem = item
    ? IMAGE_ITEM_TYPES.includes(item.type as (typeof IMAGE_ITEM_TYPES)[number])
    : false;

  const chapters = useMemo(
    () => (item ? normalizeChapters(item) : []),
    [item]
  );

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
    () => chapters.every(ch => !!ch.actualContent),
    [chapters]
  );

  const updateChapterIndex = useCallback(
    (updater: (current: number) => number) => {
      setChapterIndex(current => {
        const next = updater(current);
        if (item?.type === 'book' && !isJournal) {
          return Math.min(Math.max(next, 0), chapters.length);
        }
        return Math.min(Math.max(next, 0), Math.max(chapters.length - 1, 0));
      });
    },
    [chapters.length, isJournal, item?.type]
  );

  const handlePrevChapter = useCallback(() => {
    updateChapterIndex(i => i - 1);
  }, [updateChapterIndex]);

  const handleNextChapter = useCallback(() => {
    updateChapterIndex(i => {
      if (isJournal) {
        return Math.min(chapters.length - 1, i + 1);
      }
      if (isBook) {
        const limit = Math.min(unlockedChapterCount, chapters.length);
        return Math.min(limit, i + 1);
      }
      return Math.min(chapters.length - 1, i + 1);
    });
  }, [chapters.length, isBook, isJournal, unlockedChapterCount, updateChapterIndex]);

  const handleSelectChapter = useCallback(
    (value: number) => {
      if (isBook && !isJournal) {
        if (value <= unlockedChapterCount) {
          setChapterIndex(value);
        }
        return;
      }
      if (value < unlockedChapterCount) {
        setChapterIndex(value);
      }
    },
    [isBook, isJournal, unlockedChapterCount]
  );

  const toggleDecoded = useCallback(() => {
    setShowDecoded(prev => !prev);
  }, []);

  useEffect(() => {
    setShowDecoded(false);
    setChapterIndex(startIndex);
  }, [item?.id, isVisible, startIndex]);

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

    const requestToken = Symbol('page-text');
    textRequestTokenRef.current = requestToken;
    const reason = item.type === 'book' ? 'read_book' : 'read_page';
    setIsTextLoading(true);
    setLoadingReason(reason);

    void (async () => {
      try {
        const length = chapter.contentLength;
        const actual = await generatePageText(
          chapter.heading,
          chapter.description,
          length,
          theme.name,
          theme.storyGuidance,
          currentScene,
          storytellerThoughts,
          mapData.nodes,
          allNPCs,
          currentQuest,
          'Write it exclusively in English without any foreign, encrypted, or gibberish text.',
          item.type === 'book' && !isJournal && idx > 0
            ? chapters[idx - 1].actualContent ?? ''
            : undefined
        );
        if (textRequestTokenRef.current !== requestToken || !actual) return;

        const tags = item.tags ?? [];
        let visible = actual;
        if (tags.includes('foreign')) {
          const fake = await generatePageText(
            chapter.heading,
            chapter.description,
            length,
            theme.name,
            theme.storyGuidance,
            currentScene,
            storytellerThoughts,
            mapData.nodes,
            allNPCs,
            currentQuest,
            `Translate the following text into an artificial nonexistent language that fits the theme and context:\n"""${actual}"""`
          );
          if (textRequestTokenRef.current !== requestToken) return;
          visible = fake ?? actual;
        } else if (tags.includes('encrypted')) {
          visible = rot13(actual);
        } else if (tags.includes('runic')) {
          visible = toRunic(actual);
        }
        if (tags.includes('torn') && !tags.includes('recovered')) {
          visible = tornVisibleText(visible);
        }
        if (textRequestTokenRef.current !== requestToken) return;
        updateItemContent(item.id, actual, visible, idx);
        setText(visible);
      } finally {
        if (textRequestTokenRef.current === requestToken) {
          setIsTextLoading(false);
          setLoadingReason(null);
        }
      }
    })();

    return () => {
      if (textRequestTokenRef.current === requestToken) {
        textRequestTokenRef.current = null;
      }
    };
  }, [
    allNPCs,
    chapters,
    chapterIndex,
    currentQuest,
    currentScene,
    isJournal,
    isVisible,
    item,
    mapData.nodes,
    storytellerThoughts,
    theme.name,
    theme.storyGuidance,
    updateItemContent,
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

    const requestToken = Symbol('page-image');
    imageRequestTokenRef.current = requestToken;

    void (async () => {
      if (isImageRef(chapters[idx].imageData)) {
        const data = await loadChapterImage(item.id, idx);
        if (imageRequestTokenRef.current !== requestToken) return;
        if (data) {
          setImageUrl(`data:image/jpeg;base64,${data}`);
          setIsImageLoading(false);
        }
        return;
      }

      if (chapters[idx].imageData) {
        await saveChapterImage(item.id, idx, chapters[idx].imageData);
        if (imageRequestTokenRef.current !== requestToken) return;
        updateItemContent(
          item.id,
          undefined,
          undefined,
          idx,
          makeImageRef(item.id, idx),
        );
        if (imageRequestTokenRef.current !== requestToken) return;
        setImageUrl(`data:image/jpeg;base64,${chapters[idx].imageData}`);
        setIsImageLoading(false);
        return;
      }

      const cached = await loadChapterImage(item.id, idx);
      if (imageRequestTokenRef.current !== requestToken) return;
      if (cached) {
        updateItemContent(
          item.id,
          undefined,
          undefined,
          idx,
          makeImageRef(item.id, idx),
        );
        if (imageRequestTokenRef.current !== requestToken) return;
        setImageUrl(`data:image/jpeg;base64,${cached}`);
        setIsImageLoading(false);
        return;
      }

      if (isGeneratingImageRef.current || imageRequestTokenRef.current !== requestToken) return;
      isGeneratingImageRef.current = true;
      setIsImageLoading(true);
      setLoadingReason(item.type === 'book' ? 'read_book' : 'read_page');
      try {
        const img = await generateChapterImage(item, theme, idx);
        if (imageRequestTokenRef.current !== requestToken || !img) return;
        await saveChapterImage(item.id, idx, img);
        if (imageRequestTokenRef.current !== requestToken) return;
        updateItemContent(
          item.id,
          undefined,
          undefined,
          idx,
          makeImageRef(item.id, idx),
        );
        if (imageRequestTokenRef.current !== requestToken) return;
        setImageUrl(`data:image/jpeg;base64,${img}`);
      } finally {
        if (imageRequestTokenRef.current === requestToken) {
          setIsImageLoading(false);
          setLoadingReason(null);
        }
        isGeneratingImageRef.current = false;
      }
    })();

    return () => {
      if (imageRequestTokenRef.current === requestToken) {
        imageRequestTokenRef.current = null;
      }
    };
  }, [
    chapters,
    chapterIndex,
    isVisible,
    item,
    theme,
    updateItemContent,
  ]);

  const idx = isBook && !isJournal ? chapterIndex - 1 : chapterIndex;
  const chapterValid = idx >= 0 && idx < chapters.length;

  const displayedText = useMemo(() => {
    if (!chapterValid) return text;
    const chapter = chapters[idx];
    if (showDecoded && chapter.actualContent) {
      return chapter.actualContent;
    }
    return text;
  }, [chapterValid, chapters, idx, showDecoded, text]);

  const tearOrientation = useMemo(() => {
    if (
      !item ||
      !item.tags?.includes('torn') ||
      item.tags.includes('recovered') ||
      !displayedText
    ) {
      return null;
    }
    const trimmed = displayedText.trim();
    if (trimmed.startsWith('--- torn ---')) return 'top';
    if (trimmed.endsWith('--- torn ---')) return 'bottom';
    return null;
  }, [displayedText, item]);

  const textClassNames = useMemo(() => {
    const tags = item?.tags ?? [];
    const classes: Array<string> = [];

    const chapter: ItemChapter | undefined = chapterValid ? chapters[idx] : undefined;
    const showActual = showDecoded && !!chapter?.actualContent;
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
  }, [chapterValid, chapters, idx, item, showDecoded]);

  const pendingWrite = useMemo(
    () => isJournal && isWritingJournal,
    [isJournal, isWritingJournal]
  );

  useEffect(() => {
    if (!pendingWrite) return undefined;
    setLoadingReason('write_journal');
    return () => {
      setLoadingReason(null);
    };
  }, [pendingWrite]);

  const canInspectItem = useMemo(() => {
    if (!item) return false;
    if (isJournal) return true;
    if (isBook || isPage) return allChaptersGenerated;
    return true;
  }, [allChaptersGenerated, isBook, isJournal, isPage, item]);

  const isLoading = isTextLoading || isImageLoading;

  return {
    chapters,
    chapterIndex,
    isBook,
    isJournal,
    isPage,
    isImageItem,
    unlockedChapterCount,
    allChaptersGenerated,
    text,
    displayedText,
    showDecoded,
    textClassNames,
    tearOrientation,
    imageUrl,
    isLoading,
    canInspectItem,
    pendingWrite,
    handlePrevChapter,
    handleNextChapter,
    handleSelectChapter,
    toggleDecoded,
  };
}
