import type {
  AdventureTheme,
  AIMapUpdatePayload,
  MapData,
  MapNode,
  MapEdge,
  MinimalModelCallRecord,
} from '../../types';
import type { EdgeChainRequest } from '../corrections/edgeFixes';
import type { MapUpdateDebugInfo } from './types';

export interface ApplyUpdatesContext {
  payload: AIMapUpdatePayload;
  newMapData: MapData;
  currentTheme: AdventureTheme;
  referenceMapNodeId: string | null;
  currentThemeNodesFromMapData: Array<MapNode>;
  currentThemeEdgesFromMapData: Array<MapEdge>;
  themeNodeIdMap: Map<string, MapNode>;
  themeNodeNameMap: Map<string, MapNode>;
  themeNodeAliasMap: Map<string, MapNode>;
  themeEdgesMap: Map<string, Array<MapEdge>>;
  newNodesInBatchIdNameMap: Record<string, { id: string; name: string }>;
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
}
