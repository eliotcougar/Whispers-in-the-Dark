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
  NPC,
  MinimalModelCallRecord,
} from '../../types';
import { CARTOGRAPHER_SYSTEM_INSTRUCTION as MAP_UPDATE_SYSTEM_INSTRUCTION } from './systemPrompt';
import { buildMapUpdatePrompt } from './promptBuilder';
import { fetchMapUpdatePayload } from './request';
import { applyMapUpdates } from './applyUpdates';
import type { MapUpdateServiceResult } from './types';
import { isApiConfigured } from '../apiClient';
import {
  formatNodesAsTree,
  formatEdgeLine,
} from '../../utils/promptFormatters/map';

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

  const minimalModelCalls: Array<MinimalModelCallRecord> = [];

  const previousMapNodeContext =
    referenceMapNodeId ?? "Player's Previous Map Node: Unknown or N/A.";

  const existingMapContext = `Current Map Nodes (for your reference):\n${
    currentThemeNodesFromMapData.length > 0
      ? formatNodesAsTree(currentThemeNodesFromMapData)
      : 'None exist yet.'
  }\n\nCurrent Map Edges (for your reference):\n${
    currentThemeEdgesFromMapData.length > 0
      ? currentThemeEdgesFromMapData.map(e => formatEdgeLine(e)).join('\n')
      : 'None exist yet.'
  }`;

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
