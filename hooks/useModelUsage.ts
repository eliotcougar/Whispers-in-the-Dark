import { useEffect, useState } from 'react';
import {
  GEMINI_MODEL_NAME,
  AUXILIARY_MODEL_NAME,
  MINIMAL_MODEL_NAME,
  GEMINI_RATE_LIMIT_PER_MINUTE,
  AUXILIARY_RATE_LIMIT_PER_MINUTE,
  MINIMAL_RATE_LIMIT_PER_MINUTE,
} from '../constants';
import {
  getModelUsageCount,
  subscribeToModelUsage,
} from '../utils/modelUsageTracker';

export interface ModelUsageInfo {
  model: string;
  count: number;
  limit: number;
}

export const useModelUsage = () => {
  const [usage, setUsage] = useState<Record<string, ModelUsageInfo>>(() => ({
    [GEMINI_MODEL_NAME]: {
      model: GEMINI_MODEL_NAME,
      count: getModelUsageCount(GEMINI_MODEL_NAME),
      limit: GEMINI_RATE_LIMIT_PER_MINUTE,
    },
    [AUXILIARY_MODEL_NAME]: {
      model: AUXILIARY_MODEL_NAME,
      count: getModelUsageCount(AUXILIARY_MODEL_NAME),
      limit: AUXILIARY_RATE_LIMIT_PER_MINUTE,
    },
    [MINIMAL_MODEL_NAME]: {
      model: MINIMAL_MODEL_NAME,
      count: getModelUsageCount(MINIMAL_MODEL_NAME),
      limit: MINIMAL_RATE_LIMIT_PER_MINUTE,
    },
  }));

  useEffect(() => {
    const update = () =>
      setUsage({
        [GEMINI_MODEL_NAME]: {
          model: GEMINI_MODEL_NAME,
          count: getModelUsageCount(GEMINI_MODEL_NAME),
          limit: GEMINI_RATE_LIMIT_PER_MINUTE,
        },
        [AUXILIARY_MODEL_NAME]: {
          model: AUXILIARY_MODEL_NAME,
          count: getModelUsageCount(AUXILIARY_MODEL_NAME),
          limit: AUXILIARY_RATE_LIMIT_PER_MINUTE,
        },
        [MINIMAL_MODEL_NAME]: {
          model: MINIMAL_MODEL_NAME,
          count: getModelUsageCount(MINIMAL_MODEL_NAME),
          limit: MINIMAL_RATE_LIMIT_PER_MINUTE,
        },
      });

    const unsub = subscribeToModelUsage(update);
    const intervalId = setInterval(update, 1000);
    return () => {
      unsub();
      clearInterval(intervalId);
    };
  }, []);

  return usage;
};
