import { useEffect, useState } from 'react';
import {
  GEMINI_MODEL_NAME,
  GEMINI_LITE_MODEL_NAME,
  MINIMAL_MODEL_NAME,
  GEMINI_MODEL_RPM,
  GEMINI_LITE_MODEL_RPM,
  MINIMAL_MODEL_RPM,
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

const buildUsageMap = (): Record<string, ModelUsageInfo> => ({
  [GEMINI_MODEL_NAME]: {
    model: GEMINI_MODEL_NAME,
    count: getModelUsageCount(GEMINI_MODEL_NAME),
    limit: GEMINI_MODEL_RPM,
  },
  [GEMINI_LITE_MODEL_NAME]: {
    model: GEMINI_LITE_MODEL_NAME,
    count: getModelUsageCount(GEMINI_LITE_MODEL_NAME),
    limit: GEMINI_LITE_MODEL_RPM,
  },
  [MINIMAL_MODEL_NAME]: {
    model: MINIMAL_MODEL_NAME,
    count: getModelUsageCount(MINIMAL_MODEL_NAME),
    limit: MINIMAL_MODEL_RPM,
  },
});

export const useModelUsage = () => {
  const [usage, setUsage] = useState<Record<string, ModelUsageInfo>>(() =>
    buildUsageMap(),
  );

  useEffect(() => {
    const update = () => { setUsage(buildUsageMap()); };

    const unsub = subscribeToModelUsage(update);
    const intervalId = setInterval(update, 1000);
    return () => {
      unsub();
      clearInterval(intervalId);
    };
  }, []);

  return usage;
};
