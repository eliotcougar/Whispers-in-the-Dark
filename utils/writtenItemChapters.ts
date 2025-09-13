/**
 * @file writtenItemChapters.ts
 * @description Helpers to normalize/synthesize chapters for written items.
 */
import type { Item, ItemChapter } from '../types';
import { PLAYER_JOURNAL_ID } from '../constants';

export interface ChapterNormalizeOptions {
  /**
   * When true, will synthesize a chapter for the journal if it lacks chapters.
   * Default: false (journal falls back to empty array if no chapters exist).
   */
  synthesizeForJournal?: boolean;
}

/**
 * Returns a canonical chapters array for an item. If the item already has
 * chapters, returns them. Otherwise, for non-journal items, synthesizes a
 * single chapter from the scalar fields (name, description and optional
 * content fields). Journal items default to an empty array unless explicitly
 * allowed via options.
 */
export const normalizeChapters = (
  item: Item,
  options?: ChapterNormalizeOptions,
): Array<ItemChapter> => {
  const existing = item.chapters;
  if (existing && existing.length > 0) return existing;

  const allowJournal = options?.synthesizeForJournal === true;
  if (item.id === PLAYER_JOURNAL_ID && !allowJournal) return existing ?? [];

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
};

/**
 * Returns the chapter at the given index, after normalization/synthesis.
 */
export const getChapter = (
  item: Item,
  index: number,
  options?: ChapterNormalizeOptions,
): ItemChapter | null => {
  const chapters = normalizeChapters(item, options);
  return chapters[index] ?? null;
};

