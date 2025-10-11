import type { AdventureTheme, ItemChapter } from '../../../types';
import LoadingSpinner from '../../LoadingSpinner';
import { applyBasicMarkup } from '../../../utils/markup';

interface PageContentSectionProps {
  readonly pendingWrite: boolean;
  readonly isLoading: boolean;
  readonly isBook: boolean;
  readonly isJournal: boolean;
  readonly chapterIndex: number;
  readonly chapters: Array<ItemChapter>;
  readonly textClassNames: string;
  readonly displayedText: string | null;
  readonly isImageItem: boolean;
  readonly imageUrl: string | null;
  readonly tearOrientation: 'top' | 'bottom' | null;
  readonly theme: AdventureTheme;
  readonly itemName: string | null;
}

function PageContentSection({
  pendingWrite,
  isLoading,
  isBook,
  isJournal,
  chapterIndex,
  chapters,
  textClassNames,
  displayedText,
  isImageItem,
  imageUrl,
  tearOrientation,
  theme,
  itemName,
}: PageContentSectionProps) {
  if (pendingWrite || isLoading) {
    return <LoadingSpinner />;
  }

  if (isBook && !isJournal && chapterIndex === 0) {
    return (
      <ul className={`p-5 mt-4 list-disc list-inside overflow-y-auto text-left ${textClassNames}`}>
        {chapters.map((ch, idx) => (
          <p key={ch.heading}>
            {`${String(idx + 1)}. ${ch.heading}`}
          </p>
        ))}
      </ul>
    );
  }

  if (displayedText || (isImageItem && imageUrl)) {
    return (
      <div
        className={`whitespace-pre-wrap text-lg overflow-y-auto p-5 mt-4 ${textClassNames} ${tearOrientation ? `torn-${tearOrientation}` : ''}`}
      >
        {isImageItem && imageUrl ? (
          <div className="mb-4 flex justify-center">
            <img
              alt={itemName ?? 'Item image'}
              className="max-h-[24rem] object-contain mask-gradient-edges"
              src={imageUrl}
            />
          </div>
        ) : null}

        {displayedText ? applyBasicMarkup(displayedText) : null}
      </div>
    );
  }

  if (isJournal && chapters.length === 0) {
    return (
      <div
        className={`whitespace-pre-wrap text-lg overflow-y-auto p-5 mt-4 min-h-[20rem] tag-${theme.playerJournalStyle}`}
      />
    );
  }

  return null;
}

export default PageContentSection;

