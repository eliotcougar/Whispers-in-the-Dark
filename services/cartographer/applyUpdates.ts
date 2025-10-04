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
  NPC,
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
import { resolveHierarchyConflicts } from './hierarchyResolver';
import { pruneInvalidEdges } from './edgeUtils';

export interface ApplyMapUpdatesParams {
  payload: AIMapUpdatePayload;
  currentMapData: MapData;
  theme: AdventureTheme;
  previousMapNodeId: string | null;
  inventoryItems: Array<Item>;
  knownNPCs: Array<NPC>;
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
  theme,
  previousMapNodeId,
  inventoryItems,
  knownNPCs,
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

  const nodesFromMapData = currentMapData.nodes;
  const nodeIdsSet = new Set(nodesFromMapData.map(n => n.id));
  const edgesFromMapData = currentMapData.edges.filter(e =>
    nodeIdsSet.has(e.sourceNodeId) &&
    nodeIdsSet.has(e.targetNodeId),
  );
  const nodeIdMap = new Map<string, MapNode>();
  const nodeNameMap = new Map<string, MapNode>();
  const nodeAliasMap = new Map<string, MapNode>();
  const edgesMap = new Map<string, Array<MapEdge>>();
  nodesFromMapData.forEach(n => {
    nodeIdMap.set(n.id, n);
    nodeNameMap.set(n.placeName, n);
    if (n.data.aliases) {
      n.data.aliases.forEach(a => nodeAliasMap.set(a.toLowerCase(), n));
    }
  });
  edgesFromMapData.forEach(e => {
    if (!edgesMap.has(e.sourceNodeId)) edgesMap.set(e.sourceNodeId, []);
    if (!edgesMap.has(e.targetNodeId)) edgesMap.set(e.targetNodeId, []);
    const arr1 = edgesMap.get(e.sourceNodeId);
    if (arr1) arr1.push(e);
    const arr2 = edgesMap.get(e.targetNodeId);
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
      const idPattern = /^(.*)_([a-zA-Z0-9]{4})$/;
      const m = idPattern.exec(identifier);
      if (m) {
        const rawBase = m[1].toLowerCase();
        const baseHyphen = rawBase.replace(/_/g, '-');
        const candidates = Object.values(newNodesInBatchIdNameMap).filter(entry =>
          entry.id.toLowerCase().startsWith(`${baseHyphen}-`)
        );
        if (candidates.length === 1) {
          node = newMapData.nodes.find(n => n.id === candidates[0].id);
          if (!node) return undefined;
        }
      }
    }
    if (!node) {
      const corrected = await fetchCorrectedNodeIdentifier_Service(
        identifier,
        {
          mapNodes: newMapData.nodes,
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
  const npcNameTokens: Array<{ norm: string; tokens: Array<string> }> = [];
    knownNPCs.forEach(npc => {
      npcNameTokens.push({ norm: normalizeName(npc.name), tokens: tokenize(npc.name) });
      (npc.aliases ?? []).forEach(a => {
        npcNameTokens.push({ norm: normalizeName(a), tokens: tokenize(a) });
      });
    });

  const nameMatchesItemOrNPC = (name: string): boolean => {
    const norm = normalizeName(name);
    const tokens = tokenize(name);
    const checkTokens = (candidate: { norm: string; tokens: Array<string> }): boolean => {
      if (candidate.norm === norm) return true;
      const intersection = tokens.filter(t => candidate.tokens.includes(t));
      const ratioA = intersection.length / tokens.length;
      const ratioB = intersection.length / candidate.tokens.length;
      return intersection.length > 0 && ratioA >= 0.6 && ratioB >= 0.6;
    };
    return itemNameTokens.some(checkTokens) || npcNameTokens.some(checkTokens);
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
  nodeIdMap.clear();
  nodeNameMap.clear();
  nodeAliasMap.clear();
  edgesMap.clear();
  newMapData.nodes.forEach(n => {
      nodeIdMap.set(n.id, n);
      nodeNameMap.set(n.placeName, n);
      if (n.data.aliases) n.data.aliases.forEach(a => nodeAliasMap.set(a.toLowerCase(), n));
    });
  newMapData.edges.forEach(e => {
    if (nodeIdMap.has(e.sourceNodeId) && nodeIdMap.has(e.targetNodeId)) {
      if (!edgesMap.has(e.sourceNodeId)) edgesMap.set(e.sourceNodeId, []);
      if (!edgesMap.has(e.targetNodeId)) edgesMap.set(e.targetNodeId, []);
      const arr1 = edgesMap.get(e.sourceNodeId);
      if (arr1) arr1.push(e);
      const arr2 = edgesMap.get(e.targetNodeId);
      if (arr2) arr2.push(e);
    }
  });


  const ctx: ApplyUpdatesContext = {
    payload,
    newMapData,
    theme,
    referenceMapNodeId,
    nodesFromMapData,
    edgesFromMapData,
    nodeIdMap,
    nodeNameMap,
    nodeAliasMap,
    edgesMap,
    newNodesInBatchIdNameMap,
    newlyAddedNodes,
    newlyAddedEdges,
    pendingChainRequests,
    processedChainKeys,
    nodesToRemove_mut,
    edgesToAdd_mut,
    edgesToRemove_mut,
    resolveNodeReference,
    nameMatchesItemOrNPC,
    minimalModelCalls,
    sceneDesc,
    logMsg,
    localPlace,
    debugInfo,
    inventoryItems,
  };

  await processNodeAdds(ctx);

  await processNodeUpdates(ctx);

  await resolveHierarchyConflicts(ctx);

  await processEdgeUpdates(ctx);

  ctx.newMapData.edges = pruneInvalidEdges(ctx.newMapData.edges, ctx.nodeIdMap);
  ctx.edgesMap.clear();
  ctx.newMapData.edges.forEach(e => {
    if (!ctx.edgesMap.has(e.sourceNodeId)) ctx.edgesMap.set(e.sourceNodeId, []);
    if (!ctx.edgesMap.has(e.targetNodeId)) ctx.edgesMap.set(e.targetNodeId, []);
    const arr1 = ctx.edgesMap.get(e.sourceNodeId);
    if (arr1) arr1.push(e);
    const arr2 = ctx.edgesMap.get(e.targetNodeId);
    if (arr2) arr2.push(e);
  });

  await refineConnectorChains(ctx);

  const nodeHasNonJunkItems = (nodeId: string): boolean =>
    inventoryItems.some(
      item => item.holderId === nodeId && !item.tags?.includes('junk'),
    );

  const removeNode = (node: MapNode): void => {
    if (nodeHasNonJunkItems(node.id)) {
      console.warn(
        `Sanity check: skipping removal of "${node.placeName}" because it contains non-junk items.`,
      );
      return;
    }
    const removedId = node.id;
    const idx = ctx.newMapData.nodes.findIndex(n => n.id === removedId);
    if (idx !== -1) ctx.newMapData.nodes.splice(idx, 1);
    ctx.nodeNameMap.delete(node.placeName);
    ctx.nodeIdMap.delete(removedId);
    ctx.newMapData.edges = ctx.newMapData.edges.filter(
      e => e.sourceNodeId !== removedId && e.targetNodeId !== removedId,
    );
    ctx.edgesMap.forEach((arr, nid) => {
      ctx.edgesMap.set(
        nid,
        arr.filter(e => e.sourceNodeId !== removedId && e.targetNodeId !== removedId),
      );
    });
    ctx.edgesMap.delete(removedId);
    for (const [k, v] of Array.from(ctx.nodeAliasMap.entries())) {
      if (v.id === removedId) ctx.nodeAliasMap.delete(k);
    }
    const batchKey = Object.keys(ctx.newNodesInBatchIdNameMap).find(
      k => ctx.newNodesInBatchIdNameMap[k].id === removedId || k === node.placeName,
    );
    if (batchKey) Reflect.deleteProperty(ctx.newNodesInBatchIdNameMap, batchKey);
  };

  const itemNameSet = new Map<string, Item>();
  inventoryItems.forEach(item => {
    if (item.type !== 'vehicle') itemNameSet.set(normalizeName(item.name), item);
  });

  const npcNameSet = new Set<string>();
  knownNPCs.forEach(npc => {
    npcNameSet.add(normalizeName(npc.name));
    (npc.aliases ?? []).forEach(a => npcNameSet.add(normalizeName(a)));
  });

  ctx.newMapData.nodes.forEach(node => {
      const norm = normalizeName(node.placeName);
      if (itemNameSet.has(norm) || npcNameSet.has(norm)) {
        removeNode(node);
      }
    });

  const companionNames = new Set<string>();
  knownNPCs
    .filter(npc => npc.presenceStatus === 'companion')
    .forEach(npc => {
      companionNames.add(normalizeName(npc.name));
      (npc.aliases ?? []).forEach(a => companionNames.add(normalizeName(a)));
    });

  const filteredInventory = inventoryItems.filter(item => {
    const norm = normalizeName(item.name);
    if (item.type !== 'vehicle' && companionNames.has(norm)) {
      return false;
    }
    return true;
  });
  inventoryItems.splice(0, inventoryItems.length, ...filteredInventory);

  ctx.newMapData.edges = pruneInvalidEdges(ctx.newMapData.edges, ctx.nodeIdMap);
  ctx.edgesMap.clear();
  ctx.newMapData.edges.forEach(e => {
    if (!ctx.edgesMap.has(e.sourceNodeId)) ctx.edgesMap.set(e.sourceNodeId, []);
    if (!ctx.edgesMap.has(e.targetNodeId)) ctx.edgesMap.set(e.targetNodeId, []);
    const arr1 = ctx.edgesMap.get(e.sourceNodeId);
    if (arr1) arr1.push(e);
    const arr2 = ctx.edgesMap.get(e.targetNodeId);
    if (arr2) arr2.push(e);
  });


  return {
    updatedMapData: newMapData,
    newlyAddedNodes,
    newlyAddedEdges,
    debugInfo,
  };
};
