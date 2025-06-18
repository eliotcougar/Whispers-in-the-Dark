import { ItemType } from '../types';
import { VALID_ITEM_TYPES } from '../constants';

export const ITEM_TYPE_SYNONYMS: Record<string, ItemType | undefined> = {
  'single use': 'single-use',
  'single-use item': 'single-use',
  'one use': 'single-use',
  'multi use': 'multi-use',
  'multi-use item': 'multi-use',
  gear: 'equipment',
  armour: 'equipment',
  armor: 'equipment',
  tool: 'equipment',
  ammo: 'ammunition',
  ammunition: 'ammunition',
  projectiles: 'ammunition',
};

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
  if ((VALID_ITEM_TYPES as readonly string[]).includes(lower as ItemType)) {
    return lower as ItemType;
  }
  const mapped = ITEM_TYPE_SYNONYMS[lower];
  return mapped || null;
}
