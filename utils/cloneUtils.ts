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
  if (typeof (globalThis as any).structuredClone === 'function') {
    return (globalThis as any).structuredClone(state);
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
    return new Date(value.getTime()) as any;
  }

  if (Array.isArray(value)) {
    return (value.map(v => deepCopy(v)) as unknown) as T;
  }

  const clonedObj: Record<string, any> = {};
  for (const key in value as Record<string, any>) {
    if (Object.prototype.hasOwnProperty.call(value, key)) {
      clonedObj[key] = deepCopy((value as Record<string, any>)[key]);
    }
  }
  return clonedObj as T;
}
