import { useEffect, useState } from 'react';
import {
  onProgress,
  offProgress,
  clearProgress as clearFn,
  getProgress,
  onRetryCount,
  offRetryCount,
  getRetryCount,
} from '../utils/loadingProgress';

export const useLoadingProgress = () => {
  const [progress, setProgress] = useState<string>(getProgress());
  const [retryCountState, setRetryCountState] = useState<number>(getRetryCount());

  useEffect(() => {
    onProgress(setProgress);
    onRetryCount(setRetryCountState);
    return () => {
      offProgress(setProgress);
      offRetryCount(setRetryCountState);
    };
  }, []);

  return { progress, retryCount: retryCountState, clearProgress: clearFn };
};
