/**
 * @file api.ts
 * @description High level cartographer service functions.
 */
import type {
  GameStateFromAI,
  AdventureTheme,
  MapData,
  MapNode,
  Item,
  NPC,
  MinimalModelCallRecord,
  AIMapUpdatePayload,
} from '../../types';
import { CARTOGRAPHER_SYSTEM_INSTRUCTION as MAP_UPDATE_SYSTEM_INSTRUCTION, CARTOGRAPHER_SIMPLIFIED_SYSTEM_INSTRUCTION } from './systemPrompt';
import { buildMapUpdatePrompt, buildSimplifiedNavigationPrompt } from './promptBuilder';
import { fetchMapUpdatePayload, fetchNavigationOnlySuggestion } from './request';
import { applyMapUpdates } from './applyUpdates';
import type { MapUpdateServiceResult } from './types';
import { isApiConfigured } from '../geminiClient';
import { formatMapDataForAI } from '../../utils/promptFormatters/map';
import { findMapNodeByIdentifier } from '../../utils/entityUtils';

/**
 * Combines prompt creation, AI request and payload application.
 */
export const updateMapFromAIData_Service = async (
  aiData: GameStateFromAI,
  currentMapData: MapData,
  currentTheme: AdventureTheme,
  allKnownMainMapNodesForTheme: Array<MapNode>,
  previousMapNodeId: string | null,
  inventoryItems: Array<Item>,
  knownNPCs: Array<NPC>,
): Promise<MapUpdateServiceResult | null> => {
  if (!isApiConfigured()) {
    console.error('API Key not configured for Map Update Service.');
    return null;
  }

  const sceneDesc = 'sceneDescription' in aiData ? aiData.sceneDescription : '';
  const logMsg = aiData.logMessage ?? '';
  const localPlace = aiData.localPlace ?? 'Unknown';
  const mapHint = aiData.mapHint ?? '';
  const referenceMapNodeId =
    'currentMapNodeId' in aiData && aiData.currentMapNodeId
      ? aiData.currentMapNodeId
      : previousMapNodeId;

  // edges are captured by formatMapDataForAI directly

  const minimalModelCalls: Array<MinimalModelCallRecord> = [];

  const previousMapNodeContext =
    referenceMapNodeId ?? "Player's Previous Map Node: Unknown or N/A.";

  const existingMapContext = currentMapData.nodes.length > 0
    ? formatMapDataForAI(currentMapData)
    : 'No map data exists yet.';

  const allKnownMainPlacesString =
    allKnownMainMapNodesForTheme.length > 0
      ? allKnownMainMapNodesForTheme.map(p => `"${p.placeName}"`).join(', ')
      : 'No important places are known yet.';

  const itemNameSet = new Set<string>();
  inventoryItems.forEach(item => {
    if (item.type !== 'vehicle') itemNameSet.add(item.name);
  });
  if ('newItems' in aiData && aiData.newItems) {
    aiData.newItems.forEach(item => {
      if (item.type !== 'vehicle') itemNameSet.add(item.name);
    });
  }
  const itemNames = Array.from(itemNameSet);

  const npcNameSet = new Set<string>();
  knownNPCs.forEach(npc => {
    npcNameSet.add(npc.name);
    (npc.aliases ?? []).forEach(a => npcNameSet.add(a));
  });
  if ('npcsAdded' in aiData && aiData.npcsAdded) {
    aiData.npcsAdded.forEach(npc => {
      npcNameSet.add(npc.name);
      (npc.aliases ?? []).forEach(a => npcNameSet.add(a));
    });
  }
  if ('npcsUpdated' in aiData && aiData.npcsUpdated) {
    aiData.npcsUpdated.forEach(npc => {
      npcNameSet.add(npc.name);
      (npc.newAliases ?? []).forEach(a => npcNameSet.add(a));
      if (npc.addAlias) npcNameSet.add(npc.addAlias);
    });
  }
  const npcNames = Array.from(npcNameSet);

  const basePrompt = buildMapUpdatePrompt(
    sceneDesc,
    logMsg,
    localPlace,
    mapHint,
    currentTheme,
    previousMapNodeContext,
    existingMapContext,
    allKnownMainPlacesString,
    itemNames,
    npcNames,
  );

  const { payload, debugInfo } = await fetchMapUpdatePayload(
    basePrompt,
    MAP_UPDATE_SYSTEM_INSTRUCTION,
    minimalModelCalls,
    currentTheme,
  );

  if (!payload) {
    return {
      updatedMapData: null,
      newlyAddedNodes: [],
      newlyAddedEdges: [],
      debugInfo,
    };
  }

  const applyResult = await applyMapUpdates({
    payload,
    currentMapData,
    currentTheme,
    previousMapNodeId,
    inventoryItems,
    knownNPCs,
    aiData,
    minimalModelCalls,
    debugInfo,
  });

  return applyResult;
};

/**
 * Lightweight suggestion-only flow used when only the player's location text changes.
 */
export const suggestNodeFromLocationChange_Service = async (
  aiData: GameStateFromAI,
  currentMapData: MapData,
  currentTheme: AdventureTheme,
  previousMapNodeName: string | null,
  previousLocalPlace: string | null,
  currentLocalPlace: string | null,
  extras: {
    previousMapNodeId: string | null;
    inventoryItems: Array<Item>;
    knownNPCs: Array<NPC>;
  },
): Promise<{
  suggested: string | null;
  debugInfo: import('./types').MapUpdateDebugInfo;
  mapUpdateResult: MapUpdateServiceResult | null;
} | null> => {
  if (!isApiConfigured()) {
    console.error('API Key not configured for Map Update Service.');
    return null;
  }

  const sceneDesc = 'sceneDescription' in aiData ? aiData.sceneDescription : '';
  const logMsg = aiData.logMessage ?? '';

  const { previousMapNodeId, inventoryItems, knownNPCs } = extras;

  const basePrompt = buildSimplifiedNavigationPrompt(
    currentTheme,
    currentMapData,
    {
      logMessage: logMsg,
      currentScene: sceneDesc,
      previousLocalPlace,
      currentLocalPlace,
      previousMapNodeName,
    },
  );

  const { suggestedCurrentMapNodeId, nodesToAdd, debugInfo } = await fetchNavigationOnlySuggestion(
    basePrompt,
    CARTOGRAPHER_SIMPLIFIED_SYSTEM_INSTRUCTION,
    currentTheme,
  );
  let finalSuggested = suggestedCurrentMapNodeId;
  let mapUpdateResult: MapUpdateServiceResult | null = null;

  if (nodesToAdd.length > 0) {
    const existingNode = finalSuggested
      ? (findMapNodeByIdentifier(
          finalSuggested,
          currentMapData.nodes,
          currentMapData,
          previousMapNodeId,
        ) as MapNode | undefined)
      : undefined;

    if (!existingNode) {
      const incrementalPayload: AIMapUpdatePayload = {
        nodesToAdd,
      };
      if (finalSuggested) {
        incrementalPayload.suggestedCurrentMapNodeId = finalSuggested;
      }

      const applyResult = await applyMapUpdates({
        payload: incrementalPayload,
        currentMapData,
        currentTheme,
        previousMapNodeId,
        inventoryItems,
        knownNPCs,
        aiData,
        minimalModelCalls: [],
        debugInfo,
      });

      mapUpdateResult = {
        updatedMapData: applyResult.updatedMapData,
        newlyAddedNodes: applyResult.newlyAddedNodes,
        newlyAddedEdges: applyResult.newlyAddedEdges,
        debugInfo: applyResult.debugInfo,
      };

      if (applyResult.newlyAddedNodes.length > 0) {
        const targetToMatch = finalSuggested?.toLowerCase();
        const matchedNewNode = targetToMatch
          ? applyResult.newlyAddedNodes.find(newNode => {
              const normalizedTargets = [
                newNode.id.toLowerCase(),
                newNode.placeName.toLowerCase(),
                ...(newNode.data.aliases ?? []).map(a => a.toLowerCase()),
              ];
              return normalizedTargets.includes(targetToMatch);
            })
          : applyResult.newlyAddedNodes[0];
        if (matchedNewNode) {
          finalSuggested = matchedNewNode.id;
        }
      }
    }
  }

  return { suggested: finalSuggested, debugInfo, mapUpdateResult };
};
