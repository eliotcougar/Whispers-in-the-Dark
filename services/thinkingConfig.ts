import { ThinkingEffort } from '../types';

const BASE_BUDGETS = [512, 1024, 2048, 4096] as const;

let currentThinkingEffort: ThinkingEffort = 'Medium';
const budgetMap = new Map<number, number>();

const computeBudget = (base: number): number => {
  const baseInt = Math.floor(base);
  switch (currentThinkingEffort) {
    case 'Low':
      return Math.min(512, Math.floor(baseInt / 2));
    case 'High':
      return Math.min(8192, Math.floor(baseInt * 2));
    default:
      return baseInt;
  }
};

const recalcBudgets = (): void => {
  BASE_BUDGETS.forEach(base => {
    budgetMap.set(base, computeBudget(base));
  });
};

recalcBudgets();

export const setThinkingEffortLevel = (level: ThinkingEffort): void => {
  currentThinkingEffort = level;
  recalcBudgets();
};

export const getThinkingBudget = (base: number): number =>
  budgetMap.get(base) ?? computeBudget(base);

export const getMaxOutputTokens = (base: number): number =>
  Math.floor(6500 + getThinkingBudget(base));

