/**
 * @file dialogueParsing.ts
 * @description Shared helpers for trimming storyteller auxiliary fields.
 */

import { ItemDirective } from '../types';

/**
 * Interface describing optional storyteller auxiliary fields that may be present
 * on AI responses.
 */
export interface DialogueHints {
  mapHint?: string;
  itemDirectives?: Array<ItemDirective>;
}

const normalizeDirective = (candidate: unknown): ItemDirective | null => {
  if (!candidate || typeof candidate !== 'object') return null;
  const raw = candidate as Record<string, unknown>;
  const directiveId = typeof raw.directiveId === 'string' ? raw.directiveId.trim() : '';
  const instruction = typeof raw.instruction === 'string' ? raw.instruction.trim() : '';
  if (!directiveId || !instruction) return null;

  const normalizeIds = (value: unknown): Array<string> | undefined => {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      return trimmed ? [trimmed] : undefined;
    }
    if (Array.isArray(value)) {
      const ids = value
        .map(v => (typeof v === 'string' ? v.trim() : ''))
        .filter(Boolean);
      return ids.length > 0 ? ids : undefined;
    }
    return undefined;
  };

  const provisionalNames = Array.isArray(raw.provisionalNames)
    ? raw.provisionalNames
        .map(v => (typeof v === 'string' ? v.trim() : ''))
        .filter(Boolean)
    : undefined;
  const suggestedHandler =
    raw.suggestedHandler === 'inventory' ||
    raw.suggestedHandler === 'librarian' ||
    raw.suggestedHandler === 'either' ||
    raw.suggestedHandler === 'unknown'
      ? raw.suggestedHandler
      : undefined;

  return {
    directiveId,
    instruction,
    itemIds: normalizeIds(raw.itemIds),
    provisionalNames,
    suggestedHandler,
    metadata:
      raw.metadata && typeof raw.metadata === 'object'
        ? (raw.metadata as Record<string, unknown>)
        : undefined,
  };
};

export const normalizeDirectives = (
  directives: Array<unknown> | undefined,
): Array<ItemDirective> => {
  if (!Array.isArray(directives)) return [];
  const sanitized: Array<ItemDirective> = [];
  directives.forEach(entry => {
    const normalized = normalizeDirective(entry);
    if (normalized) sanitized.push(normalized);
  });
  return sanitized;
};

/**
 * Trims whitespace from map hints and sanitizes directives.
 * The provided object is mutated and returned for convenience.
 */
export const trimDialogueHints = <T extends DialogueHints>(obj: T): T => {
  if (obj.mapHint !== undefined && typeof obj.mapHint === 'string') {
    obj.mapHint = obj.mapHint.trim();
  }
  if (obj.itemDirectives !== undefined) {
    obj.itemDirectives = normalizeDirectives(obj.itemDirectives);
  }
  return obj;
};
