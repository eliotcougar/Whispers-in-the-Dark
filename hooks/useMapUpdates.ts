/**
 * @file useMapUpdates.ts
 * @description Hook providing map layout utilities and update handlers.
 */

import { useCallback, Dispatch, SetStateAction } from 'react';
import { GameStateStack, MapLayoutConfig } from '../types';
import {
  DEFAULT_K_REPULSION,
  DEFAULT_K_SPRING,
  DEFAULT_IDEAL_EDGE_LENGTH,
  DEFAULT_K_CENTERING,
  DEFAULT_K_UNTANGLE,
  DEFAULT_K_EDGE_NODE_REPULSION,
  DEFAULT_DAMPING_FACTOR,
  DEFAULT_MAX_DISPLACEMENT,
  DEFAULT_LAYOUT_ITERATIONS,
} from '../utils/mapLayoutUtils';

/** Returns the default configuration for the map layout force algorithm. */
export const getDefaultMapLayoutConfig = (): MapLayoutConfig => ({
  K_REPULSION: DEFAULT_K_REPULSION,
  K_SPRING: DEFAULT_K_SPRING,
  IDEAL_EDGE_LENGTH: DEFAULT_IDEAL_EDGE_LENGTH,
  K_CENTERING: DEFAULT_K_CENTERING,
  K_UNTANGLE: DEFAULT_K_UNTANGLE,
  K_EDGE_NODE_REPULSION: DEFAULT_K_EDGE_NODE_REPULSION,
  DAMPING_FACTOR: DEFAULT_DAMPING_FACTOR,
  MAX_DISPLACEMENT: DEFAULT_MAX_DISPLACEMENT,
  iterations: DEFAULT_LAYOUT_ITERATIONS,
});

export interface UseMapUpdatesProps {
  setGameStateStack: Dispatch<SetStateAction<GameStateStack>>;
}

/**
 * Provides map related update helpers used throughout the game logic.
 */
export const useMapUpdates = (props: UseMapUpdatesProps) => {
  const { setGameStateStack } = props;

  /** Updates the map layout configuration in the game state stack. */
  const handleMapLayoutConfigChange = useCallback(
    (newConfig: MapLayoutConfig) => {
      setGameStateStack((prev) => [{ ...prev[0], mapLayoutConfig: newConfig }, prev[1]]);
    },
    [setGameStateStack]
  );

  return { handleMapLayoutConfigChange };
};
