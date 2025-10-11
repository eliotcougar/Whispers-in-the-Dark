import type {
  AdventureTheme,
  AIMapUpdatePayload,
  MapData,
  MapNode,
  MapEdge,
  Item,
  MinimalModelCallRecord,
} from '../../types';
import type { EdgeChainRequest } from '../corrections/edgeFixes';
import type { MapUpdateDebugInfo } from './types';

export interface ApplyUpdatesContext {
  payload: AIMapUpdatePayload;
  newMapData: MapData;
  theme: AdventureTheme;
  referenceMapNodeId: string | null;
  nodesFromMapData: Array<MapNode>;
  edgesFromMapData: Array<MapEdge>;
  nodeIdMap: Map<string, MapNode>;
  nodeNameMap: Map<string, MapNode>;
  nodeAliasMap: Map<string, MapNode>;
  edgesMap: Map<string, Array<MapEdge>>;
  newNodesInBatchIdNameMap: Record<string, { id: string; name: string } | undefined>;
  newlyAddedNodes: Array<MapNode>;
  newlyAddedEdges: Array<MapEdge>;
  pendingChainRequests: Array<EdgeChainRequest>;
  processedChainKeys: Set<string>;
  nodesToRemove_mut: NonNullable<AIMapUpdatePayload['nodesToRemove']>;
  edgesToAdd_mut: NonNullable<AIMapUpdatePayload['edgesToAdd']>;
  edgesToRemove_mut: NonNullable<AIMapUpdatePayload['edgesToRemove']>;
  resolveNodeReference: (identifier: string) => Promise<MapNode | undefined>;
  nameMatchesItemOrNPC: (name: string) => boolean;
  minimalModelCalls: Array<MinimalModelCallRecord>;
  sceneDesc: string;
  logMsg: string;
  localPlace: string;
  debugInfo: MapUpdateDebugInfo;
  inventoryItems: Array<Item>;
}
