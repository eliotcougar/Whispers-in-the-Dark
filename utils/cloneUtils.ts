/**
 * @file cloneUtils.ts
 * @description Utility for deep cloning game state objects using `structuredClone`
 *              when available, with a fallback custom deep copy implementation.
*/
import type { FullGameState } from '../types';

/**
 * Performs a deep clone of the provided object.
 * Uses the built-in `structuredClone` if available; otherwise falls back to a
 * recursive cloning function.
 *
 * @param state - The object to clone.
 * @returns A deep copy of the input object.
 */
export function structuredCloneGameState<T>(state: T): T {
  const globalObj = globalThis as unknown as { structuredClone?: (value: unknown) => unknown };
  if (typeof globalObj.structuredClone === 'function') {
    return globalObj.structuredClone(state) as T;
  }
  return deepCopy(state) as T;
}

/**
 * Returns a deep cloned copy of the game state with any embedded image data
 * removed. The imageData fields are omitted to keep debug output concise while
 * preserving the rest of the state structure.
 */
export function cloneGameStateWithoutImages(
  state: FullGameState,
): FullGameState {
  const cloned = structuredCloneGameState(state);

  cloned.inventory = cloned.inventory.map(item => ({
    ...item,
    chapters: item.chapters?.map(ch => ({ ...ch, imageData: undefined })),
  }));

  cloned.playerJournal = cloned.playerJournal.map(ch => ({
    ...ch,
    imageData: undefined,
  }));

  return cloned;
}

/**
 * Recursively clones a value. Handles arrays, plain objects and Date instances.
 *
 * @param value - The value to clone.
 * @returns A deeply cloned copy of `value`.
 */
function deepCopy(value: unknown): unknown {
  if (value === null || typeof value !== 'object') {
    return value;
  }

  if (value instanceof Date) {
    return new Date(value.getTime());
  }

  if (Array.isArray(value)) {
    return value.map(v => deepCopy(v));
  }

  const clonedObj: Record<string, unknown> = {};
  for (const key in value as Record<string, unknown>) {
    if (Object.prototype.hasOwnProperty.call(value, key)) {
      clonedObj[key] = deepCopy((value as Record<string, unknown>)[key]);
    }
  }
  return clonedObj;
}
