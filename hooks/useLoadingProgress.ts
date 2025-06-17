import { useEffect, useState, useCallback } from 'react';
import { onProgress, offProgress, clearProgress as clearFn, getProgress } from '../utils/loadingProgress';

export const useLoadingProgress = () => {
  const [progress, setProgress] = useState<string>(getProgress());

  useEffect(() => {
    onProgress(setProgress);
    return () => offProgress(setProgress);
  }, []);

  const clearProgress = useCallback(() => {
    clearFn();
  }, []);

  return { progress, clearProgress };
};
