/**
 * @file dialogueParsing.ts
 * @description Shared helpers for trimming dialogue-related hints and new item suggestions.
 */
import { NewItemSuggestion } from '../types';
import { isValidNewItemSuggestion } from '../services/parsers/validation';

/**
 * Interface describing optional dialogue hint fields that may be present
 * on AI responses.
 */
export interface DialogueHints {
  mapHint?: string;
  playerItemsHint?: string;
  worldItemsHint?: string;
  npcItemsHint?: string;
  newItems?: Array<NewItemSuggestion>;
}

/**
 * Trims whitespace from hint strings and filters invalid new item suggestions.
 * The provided object is mutated and returned for convenience.
 */
export const trimDialogueHints = <T extends DialogueHints>(obj: T): T => {
  if (obj.mapHint !== undefined) {
    obj.mapHint = obj.mapHint.trim();
  }
  if (obj.playerItemsHint !== undefined) {
    obj.playerItemsHint = obj.playerItemsHint.trim();
  }
  if (obj.worldItemsHint !== undefined) {
    obj.worldItemsHint = obj.worldItemsHint.trim();
  }
  if (obj.npcItemsHint !== undefined) {
    obj.npcItemsHint = obj.npcItemsHint.trim();
  }
  if (Array.isArray(obj.newItems)) {
    obj.newItems = obj.newItems.filter(isValidNewItemSuggestion);
  }
  return obj;
};
