/**
 * @file api.ts
 * @description High level cartographer service functions.
 */
import {
  GameStateFromAI,
  AdventureTheme,
  MapData,
  MapNode,
  Item,
  Character,
  MinimalModelCallRecord,
} from '../../types';
import { SYSTEM_INSTRUCTION as MAP_UPDATE_SYSTEM_INSTRUCTION } from './systemPrompt';
import { buildMapUpdatePrompt } from './promptBuilder';
import { fetchMapUpdatePayload } from './request';
import { applyMapUpdates } from './applyUpdates';
import type { MapUpdateServiceResult } from './types';
import { isApiConfigured } from '../apiClient';

/**
 * Combines prompt creation, AI request and payload application.
 */
export const updateMapFromAIData_Service = async (
  aiData: GameStateFromAI,
  currentMapData: MapData,
  currentTheme: AdventureTheme,
  allKnownMainMapNodesForTheme: MapNode[],
  previousMapNodeId: string | null,
  inventoryItems: Item[],
  knownCharacters: Character[],
): Promise<MapUpdateServiceResult | null> => {
  if (!isApiConfigured()) {
    console.error('API Key not configured for Map Update Service.');
    return null;
  }

  const sceneDesc = 'sceneDescription' in aiData ? aiData.sceneDescription : '';
  const logMsg = aiData.logMessage || '';
  const localPlace = aiData.localPlace || 'Unknown';
  const mapHint = aiData.mapHint || '';
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

  const minimalModelCalls: MinimalModelCallRecord[] = [];

  const previousMapNodeContext = referenceMapNodeId
    ? `${referenceMapNodeId}`
    : "Player's Previous Map Node: Unknown or N/A.";

  const existingMapContext = `Current Map Nodes (for your reference):\n${
    currentThemeNodesFromMapData.length > 0
      ? currentThemeNodesFromMapData
          .map(n => `- "${n.placeName}" (${n.data.nodeType})`)
          .join('\n')
      : 'None exist yet.'
  }\n\nCurrent Map Edges (for your reference):\n${
    currentThemeEdgesFromMapData.length > 0
      ? currentThemeEdgesFromMapData
          .map(e => `- ${e.id} from ${e.sourceNodeId} to ${e.targetNodeId}`)
          .join('\n')
      : 'None exist yet.'
  }`;

  const allKnownMainPlacesString =
    allKnownMainMapNodesForTheme.length > 0
      ? allKnownMainMapNodesForTheme.map(p => `"${p.placeName}"`).join(', ')
      : 'No important places are known yet.';

  const basePrompt = buildMapUpdatePrompt(
    sceneDesc,
    logMsg,
    localPlace,
    mapHint,
    currentTheme,
    previousMapNodeContext,
    existingMapContext,
    allKnownMainPlacesString,
  );

  const { payload, debugInfo } = await fetchMapUpdatePayload(
    basePrompt,
    MAP_UPDATE_SYSTEM_INSTRUCTION,
    minimalModelCalls,
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
    knownCharacters,
    aiData,
    minimalModelCalls,
    debugInfo,
  });

  return applyResult;
};
