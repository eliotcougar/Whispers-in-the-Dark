import { useCallback, type ChangeEvent } from 'react';
import type { ItemChapter } from '../../../types';
import Button from '../../elements/Button';

interface ChapterNavigationProps {
  readonly isBook: boolean;
  readonly isJournal: boolean;
  readonly chapters: Array<ItemChapter>;
  readonly chapterIndex: number;
  readonly unlockedChapterCount: number;
  readonly isLoading: boolean;
  readonly canInspectItem: boolean;
  readonly canInspectJournal: boolean;
  readonly canWriteJournal: boolean;
  readonly isWritingJournal: boolean;
  readonly onInspect?: () => void;
  readonly onWriteJournal?: () => void;
  readonly onPrev: () => void;
  readonly onNext: () => void;
  readonly onSelectChapter: (value: number) => void;
}

function ChapterNavigation({
  isBook,
  isJournal,
  chapters,
  chapterIndex,
  unlockedChapterCount,
  isLoading,
  canInspectItem,
  canInspectJournal,
  canWriteJournal,
  isWritingJournal,
  onInspect,
  onWriteJournal,
  onPrev,
  onNext,
  onSelectChapter,
}: ChapterNavigationProps) {
  const handleSelectChange = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) => {
      onSelectChapter(Number(event.target.value));
    },
    [onSelectChapter]
  );

  if (!isBook && !isJournal) {
    return null;
  }

  const disableNext = isLoading ||
    (isBook && !isJournal
      ? chapterIndex >= unlockedChapterCount || chapterIndex === chapters.length
      : chapterIndex >= chapters.length - 1);

  return (
    <div className="flex justify-center items-center gap-2 mb-2">
      {isJournal && onInspect ? (
        <Button
          ariaLabel="Inspect"
          disabled={!canInspectItem || !canInspectJournal}
          label="Inspect"
          onClick={onInspect}
          preset="indigo"
          size="sm"
          variant="compact"
        />
      ) : null}

      <Button
        ariaLabel="Previous chapter"
        disabled={chapterIndex === 0}
        label="◄"
        onClick={onPrev}
        preset="slate"
        size="lg"
        variant="toolbar"
      />

      <select
        aria-label="Select chapter"
        className="bg-slate-800 text-white text-md h-9 p-2"
        onChange={handleSelectChange}
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
        disabled={disableNext}
        label="►"
        onClick={onNext}
        preset="slate"
        size="lg"
        variant="toolbar"
      />

      {isJournal && onWriteJournal ? (
        <Button
          ariaLabel="Write entry"
          disabled={!canWriteJournal || isWritingJournal}
          label="Write"
          onClick={onWriteJournal}
          preset="blue"
          size="sm"
          title="Write a new journal entry"
          variant="compact"
        />
      ) : null}
    </div>
  );
}

ChapterNavigation.defaultProps = {
  onInspect: undefined,
  onWriteJournal: undefined,
};

export default ChapterNavigation;
