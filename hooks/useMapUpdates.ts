/**
 * @file useMapUpdates.ts
 * @description Hook providing map layout utilities and update handlers.
 */

import { useCallback, Dispatch, SetStateAction } from 'react';
import { GameStateStack, MapLayoutConfig, MapNode } from '../types';
import {
  DEFAULT_IDEAL_EDGE_LENGTH,
  DEFAULT_NESTED_PADDING,
  DEFAULT_NESTED_ANGLE_PADDING,
} from '../utils/mapLayoutUtils';
import {
  DEFAULT_LABEL_MARGIN_PX,
  DEFAULT_LABEL_LINE_HEIGHT_EM,
  DEFAULT_LABEL_OVERLAP_MARGIN_PX,
  DEFAULT_ITEM_ICON_SCALE,
} from '../constants';

/** Returns the default configuration for the map layout force algorithm. */
export const getDefaultMapLayoutConfig = (): MapLayoutConfig => ({
  IDEAL_EDGE_LENGTH: DEFAULT_IDEAL_EDGE_LENGTH,
  NESTED_PADDING: DEFAULT_NESTED_PADDING,
  NESTED_ANGLE_PADDING: DEFAULT_NESTED_ANGLE_PADDING,
  LABEL_MARGIN_PX: DEFAULT_LABEL_MARGIN_PX,
  LABEL_LINE_HEIGHT_EM: DEFAULT_LABEL_LINE_HEIGHT_EM,
  LABEL_OVERLAP_MARGIN_PX: DEFAULT_LABEL_OVERLAP_MARGIN_PX,
  ITEM_ICON_SCALE: DEFAULT_ITEM_ICON_SCALE,
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
      setGameStateStack(prev => {
        const current = prev[0].mapLayoutConfig;
        if (
          current.IDEAL_EDGE_LENGTH === newConfig.IDEAL_EDGE_LENGTH &&
          current.NESTED_PADDING === newConfig.NESTED_PADDING &&
          current.NESTED_ANGLE_PADDING === newConfig.NESTED_ANGLE_PADDING &&
          current.LABEL_OVERLAP_MARGIN_PX === newConfig.LABEL_OVERLAP_MARGIN_PX &&
          current.ITEM_ICON_SCALE === newConfig.ITEM_ICON_SCALE
        ) {
          return prev;
        }
        return [{ ...prev[0], mapLayoutConfig: newConfig }, prev[1]];
      });
    },
    [setGameStateStack]
  );

  /** Stores the current map viewBox (pan/zoom) in the game state. */
  const handleMapViewBoxChange = useCallback(
    (newViewBox: string) => {
      setGameStateStack(prev => [{ ...prev[0], mapViewBox: newViewBox }, prev[1]]);
    },
    [setGameStateStack]
  );

  /** Stores node positions back into the game state's map data. */
  const handleMapNodesPositionChange = useCallback(
    (updatedNodes: MapNode[]) => {
      setGameStateStack(prev => {
        const baseState = prev[0];
        let changed = false;
        const nodeMap = new Map(baseState.mapData.nodes.map(n => [n.id, { ...n }]));
        for (const n of updatedNodes) {
          const existing = nodeMap.get(n.id);
          if (existing) {
            const posDiff =
              existing.position.x !== n.position.x ||
              existing.position.y !== n.position.y;
            const vrDiff =
              n.data.visualRadius !== undefined &&
              existing.data.visualRadius !== n.data.visualRadius;
            if (posDiff || vrDiff) {
              existing.position = { ...n.position };
              if (n.data.visualRadius !== undefined) {
                existing.data.visualRadius = n.data.visualRadius;
              }
              changed = true;
            }
          }
        }
        const newMapData = { ...baseState.mapData, nodes: Array.from(nodeMap.values()) };
        const newState = { ...baseState, mapData: newMapData };
        return changed ? [newState, prev[1]] : prev;
      });
    },
    [setGameStateStack]
  );

  /** Stores the currently selected destination node ID. */
  const handleSelectDestinationNode = useCallback(
    (nodeId: string | null) => {
      setGameStateStack(prev => [{ ...prev[0], destinationNodeId: nodeId }, prev[1]]);
    },
    [setGameStateStack]
  );

  return { handleMapLayoutConfigChange, handleMapViewBoxChange, handleMapNodesPositionChange, handleSelectDestinationNode };
};
