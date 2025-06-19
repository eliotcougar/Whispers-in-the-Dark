import { ItemType } from '../types';
import { VALID_ITEM_TYPES } from '../constants';
import itemTypeSynonymsRaw from '../resources/itemTypeSynonyms.json';

const itemTypeSynonyms = itemTypeSynonymsRaw as {
  type: Record<string, ItemType | undefined>;
};

export const ITEM_TYPE_SYNONYMS: Record<string, ItemType | undefined> =
  itemTypeSynonyms.type;

export const DESTROY_SYNONYMS = new Set([
  'destroyed',
  'consumed',
  'deleted',
  'removed',
  'lost',
  'gone',
  'broken',
]);

export function normalizeItemType(type: unknown): ItemType | null {
  if (typeof type !== 'string') return null;
  const lower = type.toLowerCase().trim();
  if ((VALID_ITEM_TYPES as ReadonlyArray<string>).includes(lower as ItemType)) {
    return lower as ItemType;
  }
  const mapped = ITEM_TYPE_SYNONYMS[lower];
  return mapped ?? null;
}
