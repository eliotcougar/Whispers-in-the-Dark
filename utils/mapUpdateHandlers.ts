/**
 * @file mapUpdateHandlers.ts
 * @description Utilities for applying map updates received from the AI storyteller.
 */

import {
  GameStateFromAI,
  DialogueSummaryResponse,
  AdventureTheme,
  FullGameState,
  TurnChanges,
  MapNode,
  LoadingReason,
  ValidNewCharacterPayload,
  ValidCharacterUpdatePayload
} from '../types';
import { updateMapFromAIData_Service } from '../services/mapUpdateService';
import { fetchFullPlaceDetailsForNewMapNode_Service } from '../services/corrections';
import { executeMapCorrectionAndRefinement_Service } from '../services/mapCorrectionService';
import { selectBestMatchingMapNode, attemptMatchAndSetNode } from './mapNodeMatcher';
import { buildCharacterChangeRecords, applyAllCharacterChanges } from './gameLogicUtils';
import { upgradeFeaturesWithChildren } from './mapHierarchyUpgradeUtils';
import { renameMapElements_Service, applyRenamePayload } from '../services/mapRenameService';

/**
 * Handles all map-related updates from the AI response and returns the suggested node identifier.
 */
export const handleMapUpdates = async (
  aiData: GameStateFromAI | DialogueSummaryResponse,
  draftState: FullGameState,
  baseStateSnapshot: FullGameState,
  themeContextForResponse: AdventureTheme,
  loadingReason: LoadingReason | null,
  setLoadingReason: (reason: LoadingReason | null) => void,
  turnChanges: TurnChanges
): Promise<string | undefined> => {
  let mapAISuggestedNodeIdentifier: string | undefined = undefined;

  if ('mapUpdated' in aiData && aiData.mapUpdated || (draftState.localPlace !== baseStateSnapshot.localPlace)) {
    const originalLoadingReason = loadingReason;
    setLoadingReason('map');
    const knownMainMapNodesForTheme: MapNode[] = draftState.mapData.nodes.filter(
      node => node.themeName === themeContextForResponse.name && node.data.nodeType !== 'feature'
    );
    const mapUpdateResult = await updateMapFromAIData_Service(
      aiData,
      draftState.mapData,
      themeContextForResponse,
      knownMainMapNodesForTheme,
      baseStateSnapshot.currentMapNodeId
    );
    setLoadingReason(originalLoadingReason);

    if (!mapUpdateResult) {
      throw new Error('Map Update Service returned no data.');
    }
    if (!mapUpdateResult.updatedMapData) {
      const reason =
        mapUpdateResult.debugInfo?.validationError ||
        mapUpdateResult.debugInfo?.rawResponse ||
        'Unknown error';
      throw new Error(`Map update failed: ${reason}`);
    }

    if (mapUpdateResult) {
      if (mapUpdateResult.updatedMapData && JSON.stringify(draftState.mapData) !== JSON.stringify(mapUpdateResult.updatedMapData)) {
        turnChanges.mapDataChanged = true;
        draftState.mapData = mapUpdateResult.updatedMapData;
      }
      if (mapUpdateResult.debugInfo && draftState.lastDebugPacket) {
        draftState.lastDebugPacket.mapUpdateDebugInfo = mapUpdateResult.debugInfo;
      }
      mapAISuggestedNodeIdentifier = mapUpdateResult.debugInfo?.parsedPayload?.suggestedCurrentMapNodeId;

      if (mapUpdateResult.debugInfo?.parsedPayload?.nodesToAdd) {
        for (const nodeAdd of mapUpdateResult.debugInfo.parsedPayload.nodesToAdd) {
          const isMainNode = nodeAdd.data?.nodeType !== 'feature';
          if (isMainNode) {
            const newlyAddedNodeInDraft = draftState.mapData.nodes.find(
              n =>
                n.placeName === nodeAdd.placeName &&
                n.themeName === themeContextForResponse.name &&
                n.data.nodeType !== 'feature'
            );
            if (
              newlyAddedNodeInDraft &&
              (!newlyAddedNodeInDraft.data.description ||
                newlyAddedNodeInDraft.data.description.trim() === '' ||
                newlyAddedNodeInDraft.data.description.startsWith('Description missing'))
            ) {
              const originalLoadingReasonCorrection = loadingReason;
              setLoadingReason('correction');
              const placeDetails = await fetchFullPlaceDetailsForNewMapNode_Service(
                nodeAdd.placeName,
                aiData.logMessage,
                'sceneDescription' in aiData ? aiData.sceneDescription : baseStateSnapshot.currentScene,
                themeContextForResponse
              );
              setLoadingReason(originalLoadingReasonCorrection);
              if (placeDetails) {
                const nodeIndexToUpdate = draftState.mapData.nodes.findIndex(n => n.id === newlyAddedNodeInDraft.id);
                if (nodeIndexToUpdate !== -1) {
                  draftState.mapData.nodes[nodeIndexToUpdate].data.description = placeDetails.description;
                  draftState.mapData.nodes[nodeIndexToUpdate].data.aliases = placeDetails.aliases || [];
                  if (!turnChanges.mapDataChanged) turnChanges.mapDataChanged = true;
                }
              }
            }
          }
        }
      }
    }
  }

  const originalLoadingReason = loadingReason;
  setLoadingReason('correction');
  const gameLogTail = draftState.gameLog.slice(-5);
  const correctionResult = await executeMapCorrectionAndRefinement_Service(
    draftState.mapData,
    themeContextForResponse,
    {
      sceneDescription: ('sceneDescription' in aiData ? aiData.sceneDescription : baseStateSnapshot.currentScene) || '',
      gameLogTail
    }
  );
  setLoadingReason(originalLoadingReason);

  if (correctionResult.mapDataChanged) {
    draftState.mapData = correctionResult.refinedMapData;
    turnChanges.mapDataChanged = true;
  }
  if (draftState.lastDebugPacket) {
    draftState.lastDebugPacket.mapPruningDebugInfo = correctionResult.debugInfo;
  }

  // Upgrade any feature nodes that now have children into regions or adjust hierarchy
  const upgradeResult = await upgradeFeaturesWithChildren(draftState.mapData, themeContextForResponse);
  if (upgradeResult.addedNodes.length > 0 || upgradeResult.addedEdges.length > 0) {
    draftState.mapData = upgradeResult.updatedMapData;
    turnChanges.mapDataChanged = true;
    const renamePayload = await renameMapElements_Service(
      draftState.mapData,
      upgradeResult.addedNodes,
      upgradeResult.addedEdges,
      themeContextForResponse,
      { sceneDescription: 'sceneDescription' in aiData ? aiData.sceneDescription : baseStateSnapshot.currentScene || '', gameLogTail }
    );
    if (renamePayload) {
      applyRenamePayload(draftState.mapData, renamePayload);
    }
  }

  const themeName = themeContextForResponse.name;
  const charactersAddedFromAI = ('charactersAdded' in aiData && aiData.charactersAdded ? aiData.charactersAdded : []) as ValidNewCharacterPayload[];
  const charactersUpdatedFromAI = ('charactersUpdated' in aiData && aiData.charactersUpdated ? aiData.charactersUpdated : []) as ValidCharacterUpdatePayload[];
  if (charactersAddedFromAI.length > 0 || charactersUpdatedFromAI.length > 0) {
    turnChanges.characterChanges = buildCharacterChangeRecords(charactersAddedFromAI, charactersUpdatedFromAI, themeName, draftState.allCharacters);
    draftState.allCharacters = applyAllCharacterChanges(charactersAddedFromAI, charactersUpdatedFromAI, themeName, draftState.allCharacters);
  }

  const oldMapNodeId = baseStateSnapshot.currentMapNodeId;
  let finalChosenNodeId: string | null = oldMapNodeId;
  const currentThemeNodesFromDraftState = draftState.mapData.nodes.filter(n => n.themeName === themeContextForResponse.name);

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
      ) || oldMapNodeId;
  }

  draftState.currentMapNodeId = finalChosenNodeId;
  if (draftState.currentMapNodeId !== oldMapNodeId) turnChanges.currentMapNodeIdChanged = true;

  if (draftState.currentMapNodeId) {
    const currentNodeIndex = draftState.mapData.nodes.findIndex(n => n.id === draftState.currentMapNodeId);
    if (currentNodeIndex !== -1) {
      if (!draftState.mapData.nodes[currentNodeIndex].data.visited) {
        draftState.mapData.nodes[currentNodeIndex].data.visited = true;
        if (!turnChanges.mapDataChanged) turnChanges.mapDataChanged = true;
      }
      const parentNodeIdFromData = draftState.mapData.nodes[currentNodeIndex].data.parentNodeId;
      if (parentNodeIdFromData) {
        const parentNodeIndex = draftState.mapData.nodes.findIndex(n => n.id === parentNodeIdFromData);
        if (parentNodeIndex !== -1 && !draftState.mapData.nodes[parentNodeIndex].data.visited) {
          draftState.mapData.nodes[parentNodeIndex].data.visited = true;
          if (!turnChanges.mapDataChanged) turnChanges.mapDataChanged = true;
        }
      }
    }
  }

  if (turnChanges.mapDataChanged) {
    const visitedNodeIds = new Set(draftState.mapData.nodes.filter(n => n.data.visited).map(n => n.id));
    const edgesToRemoveIndices: number[] = [];
    draftState.mapData.edges.forEach((edge, index) => {
      if (visitedNodeIds.has(edge.sourceNodeId) && visitedNodeIds.has(edge.targetNodeId)) {
        if (edge.data.status === 'rumored' || edge.data.status === 'removed') {
          edgesToRemoveIndices.push(index);
        }
      }
    });
    if (edgesToRemoveIndices.length > 0) {
      draftState.mapData.edges = draftState.mapData.edges.filter((_, index) => !edgesToRemoveIndices.includes(index));
    }
  }

  return mapAISuggestedNodeIdentifier;
};
