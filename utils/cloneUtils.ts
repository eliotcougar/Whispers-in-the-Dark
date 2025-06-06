/**
 * @file cloneUtils.ts
 * @description Utility for deep cloning game state objects using `structuredClone`
 *              when available, with a fallback custom deep copy implementation.
 */

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
  return deepCopy(state);
}

/**
 * Recursively clones a value. Handles arrays, plain objects and Date instances.
 *
 * @param value - The value to clone.
 * @returns A deeply cloned copy of `value`.
 */
function deepCopy<T>(value: T): T {
  if (value === null || typeof value !== 'object') {
    return value;
  }

  if (value instanceof Date) {
    return new Date(value.getTime()) as unknown as T;
  }

  if (Array.isArray(value)) {
    return (value.map(v => deepCopy(v)) as unknown) as T;
  }

  const clonedObj: Record<string, unknown> = {};
  for (const key in value as Record<string, unknown>) {
    if (Object.prototype.hasOwnProperty.call(value, key)) {
      clonedObj[key] = deepCopy((value as Record<string, unknown>)[key]);
    }
  }
  return clonedObj as T;
}
