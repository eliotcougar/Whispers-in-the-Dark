import { ThinkingEffort } from '../types';

const BASE_BUDGETS = [512, 1024, 2048, 4096] as const;

let currentThinkingEffort: ThinkingEffort = 'Medium';
const budgetMap = new Map<number, number>();

const computeBudget = (base: number): number => {
  let adjusted = Math.floor(base);
  switch (currentThinkingEffort) {
    case 'Low':
      adjusted = Math.floor(adjusted / 2);
      break;
    case 'High':
      adjusted = Math.floor(adjusted * 2);
      break;
    default:
      break;
  }
  return Math.min(8192, Math.max(512, adjusted));
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

