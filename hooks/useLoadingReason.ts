import { useEffect, useState } from 'react';
import { LoadingReason } from '../types';
import { onLoadingReason, offLoadingReason, getLoadingReason } from '../utils/loadingState';

export const useLoadingReason = (): LoadingReason | null => {
  const [reason, setReason] = useState<LoadingReason | null>(getLoadingReason());

  useEffect(() => {
    onLoadingReason(setReason);
    return () => {
      offLoadingReason(setReason);
    };
  }, []);

  return reason;
};
