import { useState, useCallback } from 'react';

/**
 * Generic boolean toggle hook for showing raw data sections.
 */
export const useToggle = (initial = true) => {
  const [value, setValue] = useState<boolean>(initial);
  const toggle = useCallback(() => { setValue(v => !v); }, []);
  return { value, toggle } as const;
};

/**
 * Manages toggle values keyed by index.
 */
export const useToggleMap = <K extends string | number>(initial: Record<K, boolean> = {} as Record<K, boolean>) => {
  const [map, setMap] = useState<Record<K, boolean>>(initial);
  const toggle = useCallback((key: K) => () => {
    setMap(prev => ({ ...prev, [key]: !prev[key] }));
  }, []);
  return { map, toggle } as const;
};
