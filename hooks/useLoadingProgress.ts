import { useEffect, useState, useCallback } from 'react';
import { subscribeToProgress, clearProgress as clearFn, getProgress } from '../utils/loadingProgress';

export const useLoadingProgress = () => {
  const [progress, setProgress] = useState<string>(getProgress());

  useEffect(() => {
    const unsub = subscribeToProgress(setProgress);
    return unsub;
  }, []);

  const clearProgress = useCallback(() => {
    clearFn();
  }, []);

  return { progress, clearProgress };
};
