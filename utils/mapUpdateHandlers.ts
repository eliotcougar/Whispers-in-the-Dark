/**
 * @file mapUpdateHandlers.ts
 * @description Utilities for applying map updates received from the AI storyteller.
 */

import {
  GameStateFromAI,
  FullGameState,
  TurnChanges,
  MapNode,
  MapEdge,
  MapData,
  LoadingReason,
  ValidNewNPCPayload,
  ValidNPCUpdatePayload
} from '../types';
import { updateMapFromAIData, MapUpdateServiceResult, MapUpdateDebugInfo, suggestNodeFromLocationChange } from '../services/cartographer';
import { fetchFullPlaceDetailsForNewMapNode, assignSpecificNamesToDuplicateNodes } from '../services/corrections';
import type { NodeRenameResult } from '../services/corrections/duplicateNodeNames';
import { selectBestMatchingMapNode, attemptMatchAndSetNode } from './mapNodeMatcher';
import {
  buildNPCChangeRecords,
  applyAllNPCChanges,
  updateEntityIdsInFacts,
} from './gameLogicUtils';
import {
  existsNonRumoredPath,
  getAncestors,
  isDescendantOf,
  buildNonRumoredAdjacencyMap,
} from './mapGraphUtils';
import { buildNodeId } from './entityUtils';

interface MapDataIndexes {
  nodesById: Map<string, MapNode>;
  edgesById: Map<string, MapEdge>;
}

const buildMapDataIndexes = (mapData: MapData): MapDataIndexes => ({
  nodesById: new Map(mapData.nodes.map(node => [node.id, node] as const)),
  edgesById: new Map(mapData.edges.map(edge => [edge.id, edge] as const)),
});

const applyNodeRenameResults = (
  renameResults: Array<NodeRenameResult>,
  draftState: FullGameState,
  nodesById: Map<string, MapNode>,
): boolean => {
  if (renameResults.length === 0) return false;

  const renameMap: Record<string, string> = {};
  let didRename = false;

  for (const { nodeId, newName } of renameResults) {
    const node = nodesById.get(nodeId);
    if (!node) continue;

    const oldId = node.id;
    const newId = buildNodeId(newName);
    if (oldId === newId && node.placeName === newName) {
      continue;
    }

    renameMap[oldId] = newId;
    didRename = true;

    node.placeName = newName;
    node.id = newId;

    nodesById.delete(oldId);
    nodesById.set(newId, node);

    draftState.mapData.nodes.forEach(child => {
      if (child.data.parentNodeId === oldId) {
        child.data.parentNodeId = newId;
      }
    });

    draftState.mapData.edges.forEach(edge => {
      if (edge.sourceNodeId === oldId) edge.sourceNodeId = newId;
      if (edge.targetNodeId === oldId) edge.targetNodeId = newId;
    });

    draftState.inventory.forEach(item => {
      if (item.holderId === oldId) item.holderId = newId;
    });

    if (draftState.currentMapNodeId === oldId) draftState.currentMapNodeId = newId;
    if (draftState.destinationNodeId === oldId) draftState.destinationNodeId = newId;
  }

  if (didRename) {
    updateEntityIdsInFacts(draftState.loreFacts, renameMap);
  }

  return didRename;
};

/**
 * Handles all map-related updates from the AI response and returns the suggested node identifier.
 */
export const handleMapUpdates = async (
  aiData: GameStateFromAI,
  draftState: FullGameState,
  baseStateSnapshot: FullGameState,
  loadingReason: LoadingReason | null,
  setLoadingReason: (reason: LoadingReason | null) => void,
  turnChanges: TurnChanges
): Promise<string | null | undefined> => {
  const activeTheme = draftState.theme;
  let mapAISuggestedNodeIdentifier: string | null | undefined = undefined;
  let mapUpdateResult: MapUpdateServiceResult | null = null;

  let { nodesById, edgesById } = buildMapDataIndexes(draftState.mapData);
  const rebuildIndexes = () => {
    const rebuilt = buildMapDataIndexes(draftState.mapData);
    nodesById = rebuilt.nodesById;
    edgesById = rebuilt.edgesById;
  };
  const getNodeById = (id: string | null | undefined): MapNode | undefined =>
    id ? nodesById.get(id) : undefined;

  const needsFullUpdate = aiData.mapUpdated === true;
  const locationTextChanged = draftState.localPlace !== baseStateSnapshot.localPlace;

  if (needsFullUpdate || locationTextChanged) {
    const originalLoadingReason = loadingReason;
    setLoadingReason('map_updates');
    let latestDebugInfo: MapUpdateDebugInfo | null = null;

    if (needsFullUpdate) {
      const knownMainMapNodesForTheme: Array<MapNode> = draftState.mapData.nodes.filter(
        node => node.data.nodeType !== 'feature'
      );
      mapUpdateResult = await updateMapFromAIData(
        aiData,
        draftState.mapData,
        activeTheme,
        knownMainMapNodesForTheme,
        baseStateSnapshot.currentMapNodeId,
        draftState.inventory,
        draftState.allNPCs,
      );

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
      mapAISuggestedNodeIdentifier = mapUpdateResult.debugInfo?.parsedPayload?.suggestedCurrentMapNodeId;
      latestDebugInfo = mapUpdateResult.debugInfo ?? null;
    } else {
      // Simplified navigation-only suggestion
      const prevNodeName = (() => {
        const previousNode = getNodeById(baseStateSnapshot.currentMapNodeId);
        return previousNode ? previousNode.placeName : null;
      })();
      const suggestionResult = await suggestNodeFromLocationChange(
        aiData,
        draftState.mapData,
        activeTheme,
        prevNodeName,
        baseStateSnapshot.localPlace,
        draftState.localPlace,
        {
          previousMapNodeId: baseStateSnapshot.currentMapNodeId,
          inventoryItems: draftState.inventory,
          knownNPCs: draftState.allNPCs,
        },
      );
      if (suggestionResult) {
        mapAISuggestedNodeIdentifier = suggestionResult.suggested;
        latestDebugInfo = suggestionResult.mapUpdateResult?.debugInfo ?? suggestionResult.debugInfo;
        if (suggestionResult.mapUpdateResult) {
          mapUpdateResult = suggestionResult.mapUpdateResult;
        }
      }
    }

    setLoadingReason(originalLoadingReason);

    let mapDataReplaced = false;
    if (mapUpdateResult?.updatedMapData) {
      if (mapUpdateResult.updatedMapData !== draftState.mapData) {
        draftState.mapData = mapUpdateResult.updatedMapData;
        turnChanges.mapDataChanged = true;
        mapDataReplaced = true;
      }
    }

    if (mapDataReplaced) {
      rebuildIndexes();
    }

    if (latestDebugInfo && draftState.lastDebugPacket) {
      draftState.lastDebugPacket.mapUpdateDebugInfo = latestDebugInfo;
    }

    if (mapUpdateResult && mapUpdateResult.newlyAddedNodes.length > 0) {
      for (const added of mapUpdateResult.newlyAddedNodes) {
          const isMainNode = added.data.nodeType !== 'feature';
          if (isMainNode) {
            const newlyAddedNodeInDraft = getNodeById(added.id);
            if (
              newlyAddedNodeInDraft &&
              (!newlyAddedNodeInDraft.data.description ||
                newlyAddedNodeInDraft.data.description.trim() === '' ||
                newlyAddedNodeInDraft.data.description.startsWith('Description missing'))
            ) {
              const originalLoadingReasonCorrection = loadingReason;
              setLoadingReason('corrections');
              const placeDetails = await fetchFullPlaceDetailsForNewMapNode(
                added.placeName,
                aiData.logMessage,
                'sceneDescription' in aiData ? aiData.sceneDescription : baseStateSnapshot.currentScene,
                activeTheme
              );
              setLoadingReason(originalLoadingReasonCorrection);
              if (placeDetails) {
                newlyAddedNodeInDraft.data.description = placeDetails.description;
                newlyAddedNodeInDraft.data.aliases = placeDetails.aliases ?? [];
                turnChanges.mapDataChanged = true;
              }
            }
          }
        }
      }
    }

      const renameResults = await assignSpecificNamesToDuplicateNodes(
        draftState.mapData.nodes,
        activeTheme,
        mapUpdateResult?.debugInfo?.minimalModelCalls,
      );
      if (applyNodeRenameResults(renameResults, draftState, nodesById)) {
        turnChanges.mapDataChanged = true;
        rebuildIndexes();
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
  const nodesFromDraftState = draftState.mapData.nodes;

  if (mapAISuggestedNodeIdentifier) {
    const matchResult = attemptMatchAndSetNode(mapAISuggestedNodeIdentifier, 'mapAI', oldMapNodeId, activeTheme.name, nodesFromDraftState);
    if (matchResult.matched) finalChosenNodeId = matchResult.nodeId;
  }
  if (!mapAISuggestedNodeIdentifier && 'currentMapNodeId' in aiData && aiData.currentMapNodeId) {
    const matchResult = attemptMatchAndSetNode(aiData.currentMapNodeId, 'mainAI', oldMapNodeId, activeTheme.name, nodesFromDraftState);
    if (matchResult.matched) finalChosenNodeId = matchResult.nodeId;
  }
  if (!mapAISuggestedNodeIdentifier && !('currentMapNodeId' in aiData && aiData.currentMapNodeId) && draftState.localPlace) {
    finalChosenNodeId =
      selectBestMatchingMapNode(
        draftState.localPlace,
        draftState.mapData,
        oldMapNodeId
      ) ?? oldMapNodeId;
  }

  draftState.currentMapNodeId = finalChosenNodeId;
  if (draftState.currentMapNodeId !== oldMapNodeId) turnChanges.currentMapNodeIdChanged = true;
  if (draftState.currentMapNodeId && draftState.destinationNodeId) {
    const currentNode = nodesById.get(draftState.currentMapNodeId);
    const destNode = nodesById.get(draftState.destinationNodeId);
    if (
      currentNode &&
      destNode &&
      (currentNode.id === destNode.id || isDescendantOf(currentNode, destNode, nodesById))
    ) {
      draftState.destinationNodeId = null;
    }
  }

  if (draftState.currentMapNodeId) {
    const currentNode = getNodeById(draftState.currentMapNodeId);
    if (currentNode) {
      if (!currentNode.data.visited) {
        currentNode.data.visited = true;
        if (
          currentNode.data.status === 'rumored' ||
          currentNode.data.status === 'undiscovered'
        ) {
          currentNode.data.status = 'discovered';
        }
        turnChanges.mapDataChanged = true;
      }
      const ancestors = getAncestors(currentNode, nodesById);
      for (const ancestor of ancestors) {
        if (!ancestor.data.visited) {
          ancestor.data.visited = true;
          if (
            ancestor.data.status === 'rumored' ||
            ancestor.data.status === 'undiscovered'
          ) {
            ancestor.data.status = 'discovered';
          }
          turnChanges.mapDataChanged = true;
        }
      }
    }
  }

  if (turnChanges.mapDataChanged) {
    const visitedNodeIds = new Set(draftState.mapData.nodes.filter(n => n.data.visited).map(n => n.id));
    const edgesToRemoveIds = new Set<string>();
    const adjacency = buildNonRumoredAdjacencyMap(draftState.mapData);
    edgesById.forEach(edge => {
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
            edgesToRemoveIds.add(edge.id);
          } else {
            edge.data.status = 'open';
            turnChanges.mapDataChanged = true;
          }
        }
      }
    });
    if (edgesToRemoveIds.size > 0) {
      draftState.mapData.edges = draftState.mapData.edges.filter(edge => !edgesToRemoveIds.has(edge.id));
      rebuildIndexes();
    }
  }

  return mapAISuggestedNodeIdentifier;
};
