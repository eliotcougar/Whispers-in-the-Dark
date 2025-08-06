/**
 * @file services/cartographer/loadCorrections.ts
 * @description Lazy loader for corrections helpers to avoid circular dependencies.
 */
export const loadCorrections = async () => import('../corrections');
