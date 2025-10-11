import { useCallback, type MouseEvent } from 'react';
import type { AdventureTheme, Item, MapData, NPC } from '../../types';
import Button from '../elements/Button';
import { Icon } from '../elements/icons';
import { usePageViewContent } from '../../hooks/usePageViewContent';
import ChapterNavigation from './pageView/ChapterNavigation';
import PageContentSection from './pageView/PageContentSection';

interface PageViewProps {
  readonly item: Item | null;
  readonly theme: AdventureTheme;
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
  theme,
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
  const {
    chapters,
    chapterIndex,
    isBook,
    isJournal,
    isImageItem,
    unlockedChapterCount,
    showDecoded,
    textClassNames,
    tearOrientation,
    imageUrl,
    isLoading,
    pendingWrite,
    canInspectItem,
    handlePrevChapter,
    handleNextChapter,
    handleSelectChapter,
    toggleDecoded,
    displayedText,
  } = usePageViewContent({
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
  });

  const handleOverlayClick = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      if (event.target === event.currentTarget) {
        onClose();
      }
    },
    [onClose]
  );

  const shouldShowDecodedToggle = Boolean(
    item?.tags?.includes('recovered')
  );

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

        <ChapterNavigation
          canInspectItem={canInspectItem}
          canInspectJournal={canInspectJournal}
          canWriteJournal={canWriteJournal}
          chapterIndex={chapterIndex}
          chapters={chapters}
          isBook={isBook}
          isJournal={isJournal}
          isLoading={isLoading}
          isWritingJournal={isWritingJournal}
          onInspect={onInspect}
          onNext={handleNextChapter}
          onPrev={handlePrevChapter}
          onSelectChapter={handleSelectChapter}
          onWriteJournal={onWriteJournal}
          unlockedChapterCount={unlockedChapterCount}
        />

        {shouldShowDecodedToggle ? (
          <div className="flex justify-center">
            <Button
              ariaLabel={showDecoded ? 'Show encoded text' : 'Show decoded text'}
              label={showDecoded ? 'Hide' : 'Reveal'}
              onClick={toggleDecoded}
              preset={showDecoded ? 'sky' : 'slate'}
              pressed={showDecoded}
              size="sm"
              variant="toggle"
            />
          </div>
        ) : null}

        <PageContentSection
          chapterIndex={chapterIndex}
          chapters={chapters}
          displayedText={displayedText}
          imageUrl={imageUrl}
          isBook={isBook}
          isImageItem={isImageItem}
          isJournal={isJournal}
          isLoading={isLoading}
          itemName={item?.name ?? null}
          pendingWrite={pendingWrite}
          tearOrientation={tearOrientation}
          textClassNames={textClassNames}
          theme={theme}
        />
      </div>
    </div>
  );
}

PageView.defaultProps = {
  canInspectJournal: true,
  canWriteJournal: true,
  isWritingJournal: false,
  onInspect: undefined,
  onWriteJournal: undefined,
  startIndex: 0,
};

export default PageView;
