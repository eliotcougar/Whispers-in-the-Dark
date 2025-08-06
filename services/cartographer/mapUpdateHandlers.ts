/**
 * @file mapUpdateHandlers.ts
 * @description Utilities for applying map updates received from the AI storyteller.
 */

import {
  GameStateFromAI,
  AdventureTheme,
  FullGameState,
  TurnChanges,
  MapNode,
  LoadingReason,
  ValidNewNPCPayload,
  ValidNPCUpdatePayload
} from '../../types';
import { updateMapFromAIData_Service } from './api';
import type { MapUpdateServiceResult } from './types';
import { loadCorrections } from './loadCorrections';
import { selectBestMatchingMapNode, attemptMatchAndSetNode } from '../../utils/mapNodeMatcher';
import {
  buildNPCChangeRecords,
  applyAllNPCChanges,
  updateEntityIdsInFacts,
} from '../../utils/gameLogicUtils';
import {
  existsNonRumoredPath,
  getAncestors,
  isDescendantOf,
  buildNonRumoredAdjacencyMap,
} from '../../utils/mapGraphUtils';
import { buildNodeId } from '../../utils/entityUtils';

/**
 * Handles all map-related updates from the AI response and returns the suggested node identifier.
 */
export const handleMapUpdates = async (
  aiData: GameStateFromAI,
  draftState: FullGameState,
  baseStateSnapshot: FullGameState,
  themeContextForResponse: AdventureTheme,
  loadingReason: LoadingReason | null,
  setLoadingReason: (reason: LoadingReason | null) => void,
  turnChanges: TurnChanges
): Promise<string | null | undefined> => {
  let mapAISuggestedNodeIdentifier: string | null | undefined = undefined;
  let mapUpdateResult: MapUpdateServiceResult | null = null;

  if ('mapUpdated' in aiData && aiData.mapUpdated || (draftState.localPlace !== baseStateSnapshot.localPlace)) {
    const originalLoadingReason = loadingReason;
    setLoadingReason('map');
    const knownMainMapNodesForTheme: Array<MapNode> = draftState.mapData.nodes.filter(
      node => node.data.nodeType !== 'feature'
    );
    mapUpdateResult = await updateMapFromAIData_Service(
      aiData,
      draftState.mapData,
      themeContextForResponse,
      knownMainMapNodesForTheme,
      baseStateSnapshot.currentMapNodeId,
      draftState.inventory,
      draftState.allNPCs,
      draftState.storyArc
    );
    setLoadingReason(originalLoadingReason);

    if (!mapUpdateResult) {
      throw new Error('Map Update Service returned no data.');
    }
    if (!mapUpdateResult.updatedMapData) {
      const reason =
        mapUpdateResult.debugInfo?.validationError ??
        mapUpdateResult.debugInfo?.rawResponse ??
        'Unknown error';
      throw new Error(`Map update failed: ${reason}`);
    }

    if (JSON.stringify(draftState.mapData) !== JSON.stringify(mapUpdateResult.updatedMapData)) {
      turnChanges.mapDataChanged = true;
      draftState.mapData = mapUpdateResult.updatedMapData;
    }
    if (mapUpdateResult.debugInfo && draftState.lastDebugPacket) {
      draftState.lastDebugPacket.mapUpdateDebugInfo = mapUpdateResult.debugInfo;
    }
    mapAISuggestedNodeIdentifier = mapUpdateResult.debugInfo?.parsedPayload?.suggestedCurrentMapNodeId;

      if (mapUpdateResult.newlyAddedNodes.length > 0) {
        for (const added of mapUpdateResult.newlyAddedNodes) {
          const isMainNode = added.data.nodeType !== 'feature';
          if (isMainNode) {
            const newlyAddedNodeInDraft = draftState.mapData.nodes.find(
              n => n.id === added.id
            );
            if (
              newlyAddedNodeInDraft &&
              (!newlyAddedNodeInDraft.data.description ||
                newlyAddedNodeInDraft.data.description.trim() === '' ||
                newlyAddedNodeInDraft.data.description.startsWith('Description missing'))
            ) {
              const originalLoadingReasonCorrection = loadingReason;
              setLoadingReason('correction');
              const { fetchFullPlaceDetailsForNewMapNode_Service } = await loadCorrections();
              const placeDetails = await fetchFullPlaceDetailsForNewMapNode_Service(
                added.placeName,
                aiData.logMessage,
                'sceneDescription' in aiData ? aiData.sceneDescription : baseStateSnapshot.currentScene,
                themeContextForResponse
              );
              setLoadingReason(originalLoadingReasonCorrection);
              if (placeDetails) {
                const nodeIndexToUpdate = draftState.mapData.nodes.findIndex(n => n.id === newlyAddedNodeInDraft.id);
                if (nodeIndexToUpdate !== -1) {
                  draftState.mapData.nodes[nodeIndexToUpdate].data.description = placeDetails.description;
                  draftState.mapData.nodes[nodeIndexToUpdate].data.aliases = placeDetails.aliases ?? [];
                  turnChanges.mapDataChanged = true;
                }
              }
            }
          }
        }
      }
    }

      const { assignSpecificNamesToDuplicateNodes_Service } = await loadCorrections();
      const renameResults = await assignSpecificNamesToDuplicateNodes_Service(
        draftState.mapData.nodes,
        themeContextForResponse,
        mapUpdateResult?.debugInfo?.minimalModelCalls,
      );
      if (renameResults.length > 0) {
        const renameMap: Record<string, string> = {};
        for (const r of renameResults) {
          const idx = draftState.mapData.nodes.findIndex(n => n.id === r.nodeId);
          if (idx === -1) continue;
          const node = draftState.mapData.nodes[idx];
          const oldId = node.id;
          const newId = buildNodeId(r.newName);
          renameMap[oldId] = newId;
          node.placeName = r.newName;
          node.id = newId;
          draftState.mapData.nodes.forEach(n => {
            if (n.data.parentNodeId === oldId) n.data.parentNodeId = newId;
          });
          draftState.mapData.edges.forEach(e => {
            if (e.sourceNodeId === oldId) e.sourceNodeId = newId;
            if (e.targetNodeId === oldId) e.targetNodeId = newId;
          });
          draftState.inventory.forEach(item => {
            if (item.holderId === oldId) item.holderId = newId;
          });
          if (draftState.currentMapNodeId === oldId) draftState.currentMapNodeId = newId;
          if (draftState.destinationNodeId === oldId) draftState.destinationNodeId = newId;
        }
        if (Object.keys(renameMap).length > 0) {
          updateEntityIdsInFacts(draftState.themeFacts, renameMap);
        }
        turnChanges.mapDataChanged = true;
      }


  const newlyAddedEdgeIds = new Set(
    (mapUpdateResult?.newlyAddedEdges ?? []).map(e => e.id)
  );

  const npcsAddedFromAI = ('npcsAdded' in aiData && aiData.npcsAdded ? aiData.npcsAdded : []) as Array<ValidNewNPCPayload>;
  const npcsUpdatedFromAI = ('npcsUpdated' in aiData && aiData.npcsUpdated ? aiData.npcsUpdated : []) as Array<ValidNPCUpdatePayload>;
  if (npcsAddedFromAI.length > 0 || npcsUpdatedFromAI.length > 0) {
    turnChanges.npcChanges = buildNPCChangeRecords(npcsAddedFromAI, npcsUpdatedFromAI, draftState.allNPCs);
    draftState.allNPCs = applyAllNPCChanges(npcsAddedFromAI, npcsUpdatedFromAI, draftState.allNPCs);
  }

  const oldMapNodeId = baseStateSnapshot.currentMapNodeId;
  let finalChosenNodeId: string | null = oldMapNodeId;
  const currentThemeNodesFromDraftState = draftState.mapData.nodes;

  if (mapAISuggestedNodeIdentifier) {
    const matchResult = attemptMatchAndSetNode(mapAISuggestedNodeIdentifier, 'mapAI', oldMapNodeId, themeContextForResponse.name, currentThemeNodesFromDraftState);
    if (matchResult.matched) finalChosenNodeId = matchResult.nodeId;
  }
  if (!mapAISuggestedNodeIdentifier && 'currentMapNodeId' in aiData && aiData.currentMapNodeId) {
    const matchResult = attemptMatchAndSetNode(aiData.currentMapNodeId, 'mainAI', oldMapNodeId, themeContextForResponse.name, currentThemeNodesFromDraftState);
    if (matchResult.matched) finalChosenNodeId = matchResult.nodeId;
  }
  if (!mapAISuggestedNodeIdentifier && !('currentMapNodeId' in aiData && aiData.currentMapNodeId) && draftState.localPlace) {
    finalChosenNodeId =
      selectBestMatchingMapNode(
        draftState.localPlace,
        themeContextForResponse,
        draftState.mapData,
        currentThemeNodesFromDraftState,
        oldMapNodeId
      ) ?? oldMapNodeId;
  }

  draftState.currentMapNodeId = finalChosenNodeId;
  if (draftState.currentMapNodeId !== oldMapNodeId) turnChanges.currentMapNodeIdChanged = true;
  if (draftState.currentMapNodeId && draftState.destinationNodeId) {
    const nodeMap = new Map(draftState.mapData.nodes.map(n => [n.id, n]));
    const currentNode = nodeMap.get(draftState.currentMapNodeId);
    const destNode = nodeMap.get(draftState.destinationNodeId);
    if (
      currentNode &&
      destNode &&
      (currentNode.id === destNode.id || isDescendantOf(currentNode, destNode, nodeMap))
    ) {
      draftState.destinationNodeId = null;
    }
  }

  if (draftState.currentMapNodeId) {
    const currentNodeIndex = draftState.mapData.nodes.findIndex(n => n.id === draftState.currentMapNodeId);
    if (currentNodeIndex !== -1) {
      if (!draftState.mapData.nodes[currentNodeIndex].data.visited) {
        draftState.mapData.nodes[currentNodeIndex].data.visited = true;
        if (
          draftState.mapData.nodes[currentNodeIndex].data.status === 'rumored' ||
          draftState.mapData.nodes[currentNodeIndex].data.status === 'undiscovered'
        ) {
          draftState.mapData.nodes[currentNodeIndex].data.status = 'discovered';
        }
        turnChanges.mapDataChanged = true;
      }
      const nodeMap = new Map(draftState.mapData.nodes.map(n => [n.id, n]));
      const currentNode = draftState.mapData.nodes[currentNodeIndex];
      const ancestors = getAncestors(currentNode, nodeMap);
      for (const ancestor of ancestors) {
        const idx = draftState.mapData.nodes.findIndex(n => n.id === ancestor.id);
        if (idx !== -1 && !draftState.mapData.nodes[idx].data.visited) {
          draftState.mapData.nodes[idx].data.visited = true;
          if (
            draftState.mapData.nodes[idx].data.status === 'rumored' ||
            draftState.mapData.nodes[idx].data.status === 'undiscovered'
          ) {
            draftState.mapData.nodes[idx].data.status = 'discovered';
          }
          turnChanges.mapDataChanged = true;
        }
      }
    }
  }

  if (turnChanges.mapDataChanged) {
    const visitedNodeIds = new Set(draftState.mapData.nodes.filter(n => n.data.visited).map(n => n.id));
    const edgesToRemoveIndices: Array<number> = [];
    const adjacency = buildNonRumoredAdjacencyMap(draftState.mapData);
    draftState.mapData.edges.forEach((edge, index) => {
      if (newlyAddedEdgeIds.has(edge.id)) return;
      if (visitedNodeIds.has(edge.sourceNodeId) && visitedNodeIds.has(edge.targetNodeId)) {
        if (edge.data.status === 'rumored' || edge.data.status === 'removed') {
          const altExists = existsNonRumoredPath(
            adjacency,
            edge.sourceNodeId,
            edge.targetNodeId,
            edge.id
          );
          if (altExists) {
            edgesToRemoveIndices.push(index);
          }
          else {
            edge.data.status = 'open';
            turnChanges.mapDataChanged = true;
          }
        }
      }
    });
    if (edgesToRemoveIndices.length > 0) {
      draftState.mapData.edges = draftState.mapData.edges.filter((_, index) => !edgesToRemoveIndices.includes(index));
    }
  }

  return mapAISuggestedNodeIdentifier;
};
