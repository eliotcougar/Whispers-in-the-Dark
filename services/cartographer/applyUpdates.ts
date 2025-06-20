/**
 * @file applyUpdates.ts
 * @description Applies a validated map update payload to the current MapData.
 */
import {
  GameStateFromAI,
  AdventureTheme,
  MapData,
  MapNode,
  MapEdge,
  AIMapUpdatePayload,
  MinimalModelCallRecord,
  Item,
  Character,
} from '../../types';
import { structuredCloneGameState } from '../../utils/cloneUtils';
import { fetchCorrectedNodeIdentifier_Service } from '../corrections/placeDetails';
import type { EdgeChainRequest } from '../corrections/edgeFixes';
import { findMapNodeByIdentifier } from '../../utils/entityUtils';
import type { MapUpdateDebugInfo } from './types';
import type { ApplyUpdatesContext } from './updateContext';
import { processNodeAdds } from './processNodeAdds';
import { processNodeUpdates } from './processNodeUpdates';
import { processEdgeUpdates } from './processEdgeUpdates';
import { refineConnectorChains } from './refineConnectorChains';

export interface ApplyMapUpdatesParams {
  payload: AIMapUpdatePayload;
  currentMapData: MapData;
  currentTheme: AdventureTheme;
  previousMapNodeId: string | null;
  inventoryItems: Array<Item>;
  knownCharacters: Array<Character>;
  aiData: GameStateFromAI;
  minimalModelCalls: Array<MinimalModelCallRecord>;
  debugInfo: MapUpdateDebugInfo;
}

export interface ApplyMapUpdatesResult {
  updatedMapData: MapData;
  newlyAddedNodes: Array<MapNode>;
  newlyAddedEdges: Array<MapEdge>;
  debugInfo: MapUpdateDebugInfo;
}

export const applyMapUpdates = async ({
  payload,
  currentMapData,
  currentTheme,
  previousMapNodeId,
  inventoryItems,
  knownCharacters,
  aiData,
  minimalModelCalls,
  debugInfo,
}: ApplyMapUpdatesParams): Promise<ApplyMapUpdatesResult> => {
  const sceneDesc =
    'sceneDescription' in aiData ? aiData.sceneDescription : '';
  const logMsg = aiData.logMessage ?? '';
  const localPlace = aiData.localPlace ?? 'Unknown';
  const referenceMapNodeId =
    'currentMapNodeId' in aiData && aiData.currentMapNodeId
      ? aiData.currentMapNodeId
      : previousMapNodeId;

  const currentThemeNodesFromMapData = currentMapData.nodes.filter(
    n => n.themeName === currentTheme.name,
  );
  const currentThemeNodeIdsSet = new Set(
    currentThemeNodesFromMapData.map(n => n.id),
  );
  const currentThemeEdgesFromMapData = currentMapData.edges.filter(e =>
    currentThemeNodeIdsSet.has(e.sourceNodeId) &&
    currentThemeNodeIdsSet.has(e.targetNodeId),
  );
  const themeNodeIdMap = new Map<string, MapNode>();
  const themeNodeNameMap = new Map<string, MapNode>();
  const themeNodeAliasMap = new Map<string, MapNode>();
  const themeEdgesMap = new Map<string, Array<MapEdge>>();
  currentThemeNodesFromMapData.forEach(n => {
    themeNodeIdMap.set(n.id, n);
    themeNodeNameMap.set(n.placeName, n);
    if (n.data.aliases) {
      n.data.aliases.forEach(a => themeNodeAliasMap.set(a.toLowerCase(), n));
    }
  });
  currentThemeEdgesFromMapData.forEach(e => {
    if (!themeEdgesMap.has(e.sourceNodeId)) themeEdgesMap.set(e.sourceNodeId, []);
    if (!themeEdgesMap.has(e.targetNodeId)) themeEdgesMap.set(e.targetNodeId, []);
    const arr1 = themeEdgesMap.get(e.sourceNodeId);
    if (arr1) arr1.push(e);
    const arr2 = themeEdgesMap.get(e.targetNodeId);
    if (arr2) arr2.push(e);
  });

  const resolveNodeReference = async (
    identifier: string,
  ): Promise<MapNode | undefined> => {
    let node = findMapNodeByIdentifier(
      identifier,
      newMapData.nodes,
      newMapData,
      referenceMapNodeId,
    ) as MapNode | undefined;
    if (!node) {
      const corrected = await fetchCorrectedNodeIdentifier_Service(
        identifier,
        {
          themeNodes: newMapData.nodes.filter(
            n => n.themeName === currentTheme.name,
          ),
          currentLocationId: referenceMapNodeId,
        },
        minimalModelCalls,
      );
      if (corrected) {
        node = findMapNodeByIdentifier(
          corrected,
          newMapData.nodes,
          newMapData,
          referenceMapNodeId,
        ) as MapNode | undefined;
      }
    }
    return node;
  };

  const normalizeName = (text: string): string =>
    text
      .toLowerCase()
      .replace(/[{}().,!?;:"[\]]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

  const tokenize = (text: string): Array<string> =>
    normalizeName(text)
      .split(' ')
      .filter(t => t.length > 0);

  const itemNameTokens = inventoryItems.map(i => ({
    norm: normalizeName(i.name),
    tokens: tokenize(i.name),
  }));
  const charNameTokens: Array<{ norm: string; tokens: Array<string> }> = [];
    knownCharacters.forEach(c => {
      charNameTokens.push({ norm: normalizeName(c.name), tokens: tokenize(c.name) });
      (c.aliases ?? []).forEach(a => {
        charNameTokens.push({ norm: normalizeName(a), tokens: tokenize(a) });
      });
    });

  const nameMatchesItemOrChar = (name: string): boolean => {
    const norm = normalizeName(name);
    const tokens = tokenize(name);
    const checkTokens = (candidate: { norm: string; tokens: Array<string> }): boolean => {
      if (candidate.norm === norm) return true;
      const intersection = tokens.filter(t => candidate.tokens.includes(t));
      const ratioA = intersection.length / tokens.length;
      const ratioB = intersection.length / candidate.tokens.length;
      return intersection.length > 0 && ratioA >= 0.6 && ratioB >= 0.6;
    };
    return itemNameTokens.some(checkTokens) || charNameTokens.some(checkTokens);
  };

  // Proceed with map data processing using payload
  const newMapData: MapData = structuredCloneGameState(currentMapData);
  const newNodesInBatchIdNameMap: Record<string, { id: string; name: string }> = {};
  const newlyAddedNodes: Array<MapNode> = [];
  const newlyAddedEdges: Array<MapEdge> = [];
  const pendingChainRequests: Array<EdgeChainRequest> = [];
  const processedChainKeys = new Set<string>();
  const nodesToRemove_mut: NonNullable<AIMapUpdatePayload['nodesToRemove']> = [];
  const edgesToAdd_mut: NonNullable<AIMapUpdatePayload['edgesToAdd']> = [];
  const edgesToRemove_mut: NonNullable<AIMapUpdatePayload['edgesToRemove']> = [];

  // Refresh lookup maps for the cloned map data
  themeNodeIdMap.clear();
  themeNodeNameMap.clear();
  themeNodeAliasMap.clear();
  themeEdgesMap.clear();
  newMapData.nodes
    .filter(n => n.themeName === currentTheme.name)
    .forEach(n => {
      themeNodeIdMap.set(n.id, n);
      themeNodeNameMap.set(n.placeName, n);
      if (n.data.aliases) n.data.aliases.forEach(a => themeNodeAliasMap.set(a.toLowerCase(), n));
    });
  newMapData.edges.forEach(e => {
    if (themeNodeIdMap.has(e.sourceNodeId) && themeNodeIdMap.has(e.targetNodeId)) {
      if (!themeEdgesMap.has(e.sourceNodeId)) themeEdgesMap.set(e.sourceNodeId, []);
      if (!themeEdgesMap.has(e.targetNodeId)) themeEdgesMap.set(e.targetNodeId, []);
      const arr1 = themeEdgesMap.get(e.sourceNodeId);
      if (arr1) arr1.push(e);
      const arr2 = themeEdgesMap.get(e.targetNodeId);
      if (arr2) arr2.push(e);
    }
  });


  const ctx: ApplyUpdatesContext = {
    payload,
    newMapData,
    currentTheme,
    referenceMapNodeId,
    currentThemeNodesFromMapData,
    currentThemeEdgesFromMapData,
    themeNodeIdMap,
    themeNodeNameMap,
    themeNodeAliasMap,
    themeEdgesMap,
    newNodesInBatchIdNameMap,
    newlyAddedNodes,
    newlyAddedEdges,
    pendingChainRequests,
    processedChainKeys,
    nodesToRemove_mut,
    edgesToAdd_mut,
    edgesToRemove_mut,
    resolveNodeReference,
    nameMatchesItemOrChar,
    minimalModelCalls,
    sceneDesc,
    logMsg,
    localPlace,
    debugInfo,
  };

  await processNodeAdds(ctx);

  await processNodeUpdates(ctx);

  await processEdgeUpdates(ctx);

  await refineConnectorChains(ctx);


  return {
    updatedMapData: newMapData,
    newlyAddedNodes,
    newlyAddedEdges,
    debugInfo,
  };
};
