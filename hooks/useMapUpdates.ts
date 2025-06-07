/**
 * @file useMapUpdates.ts
 * @description Hook providing map layout utilities and update handlers.
 */

import { useCallback, Dispatch, SetStateAction } from 'react';
import { GameStateStack, MapLayoutConfig } from '../types';
import {
  DEFAULT_IDEAL_EDGE_LENGTH,
  DEFAULT_NESTED_PADDING,
  DEFAULT_NESTED_ANGLE_PADDING,
} from '../utils/mapLayoutUtils';
import {
  DEFAULT_LABEL_MARGIN_PX,
  DEFAULT_LABEL_LINE_HEIGHT_EM,
  DEFAULT_LABEL_OVERLAP_MARGIN_PX,
} from '../utils/mapConstants';

/** Returns the default configuration for the map layout force algorithm. */
export const getDefaultMapLayoutConfig = (): MapLayoutConfig => ({
  IDEAL_EDGE_LENGTH: DEFAULT_IDEAL_EDGE_LENGTH,
  NESTED_PADDING: DEFAULT_NESTED_PADDING,
  NESTED_ANGLE_PADDING: DEFAULT_NESTED_ANGLE_PADDING,
  LABEL_MARGIN_PX: DEFAULT_LABEL_MARGIN_PX,
  LABEL_LINE_HEIGHT_EM: DEFAULT_LABEL_LINE_HEIGHT_EM,
  LABEL_OVERLAP_MARGIN_PX: DEFAULT_LABEL_OVERLAP_MARGIN_PX,
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
