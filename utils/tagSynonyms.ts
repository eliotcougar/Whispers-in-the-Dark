import { ItemTag } from '../types';
import { VALID_TAGS } from '../constants';
import tagSynonymsRaw from '../resources/itemTagSynonyms';
import { createHeuristicRegexes } from './mapSynonyms';

const tagSynonyms = tagSynonymsRaw as {
  tag: Record<string, ItemTag | undefined>;
};

export const TAG_SYNONYMS: Record<string, ItemTag | undefined> =
  tagSynonyms.tag;

let tagHeuristics: Array<[RegExp, ItemTag]> | null = null;

export function createTagHeuristicRegexes(): Array<[RegExp, ItemTag]> {
  if (tagHeuristics) return tagHeuristics;
  tagHeuristics = createHeuristicRegexes(
    TAG_SYNONYMS as Record<string, ItemTag>,
    VALID_TAGS,
  );
  return tagHeuristics;
}

export function normalizeTag(tag: unknown): ItemTag | null {
  if (typeof tag !== 'string') return null;
  const lower = tag.toLowerCase().trim();
  if ((VALID_TAGS as ReadonlyArray<string>).includes(lower as ItemTag)) {
    return lower as ItemTag;
  }
  return TAG_SYNONYMS[lower] ?? null;
}

export function normalizeTags(tags: unknown): Array<ItemTag> | null {
  if (!Array.isArray(tags)) return null;
  const normalized: Array<ItemTag> = [];
  for (const t of tags) {
    const nt = normalizeTag(t);
    if (nt) normalized.push(nt);
  }
  return normalized;
}
