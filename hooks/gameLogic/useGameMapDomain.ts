import { useMemo } from 'react';
import type { FullGameState, MapData, MapLayoutConfig, MapNode } from '../../types';

interface UseGameMapDomainParams {
  readonly fullState: FullGameState;
  readonly handleMapLayoutConfigChange: (config: MapLayoutConfig) => void;
  readonly handleMapViewBoxChange: (viewBox: string) => void;
  readonly handleMapNodesPositionChange: (nodes: Array<MapNode>) => void;
  readonly handleSelectDestinationNode: (nodeId: string | null) => void;
}

interface MapHandlers {
  readonly setLayoutConfig: UseGameMapDomainParams['handleMapLayoutConfigChange'];
  readonly setViewBox: UseGameMapDomainParams['handleMapViewBoxChange'];
  readonly setNodePositions: UseGameMapDomainParams['handleMapNodesPositionChange'];
  readonly selectDestination: UseGameMapDomainParams['handleSelectDestinationNode'];
}

interface MapItemPresence {
  hasUseful: boolean;
  hasVehicle: boolean;
}

export interface GameMapDomain {
  readonly data: MapData;
  readonly currentNodeId: string | null;
  readonly destinationNodeId: string | null;
  readonly layoutConfig: MapLayoutConfig;
  readonly viewBox: string;
  readonly itemPresenceByNode: Record<string, MapItemPresence | undefined>;
  readonly handlers: MapHandlers;
}

export const useGameMapDomain = ({
  fullState,
  handleMapLayoutConfigChange,
  handleMapViewBoxChange,
  handleMapNodesPositionChange,
  handleSelectDestinationNode,
}: UseGameMapDomainParams): GameMapDomain => {
  const itemPresenceByNode = useMemo(() => {
    const presence: Record<string, MapItemPresence | undefined> = {};
    const nodeIds = new Set(fullState.mapData.nodes.map(n => n.id));
    fullState.inventory.forEach(item => {
      if (!nodeIds.has(item.holderId)) return;
      const existing = presence[item.holderId] ?? { hasUseful: false, hasVehicle: false };
      if (!item.tags?.includes('junk')) existing.hasUseful = true;
      if (item.type === 'vehicle') existing.hasVehicle = true;
      presence[item.holderId] = existing;
    });
    return presence;
  }, [fullState.inventory, fullState.mapData.nodes]);

  return {
    data: fullState.mapData,
    currentNodeId: fullState.currentMapNodeId,
    destinationNodeId: fullState.destinationNodeId,
    layoutConfig: fullState.mapLayoutConfig,
    viewBox: fullState.mapViewBox,
    itemPresenceByNode,
    handlers: {
      setLayoutConfig: handleMapLayoutConfigChange,
      setViewBox: handleMapViewBoxChange,
      setNodePositions: handleMapNodesPositionChange,
      selectDestination: handleSelectDestinationNode,
    },
  };
};
