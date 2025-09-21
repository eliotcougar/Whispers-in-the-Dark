/**
 * @file promptBuilder.ts
 * @description Utilities for constructing prompts for the cartographer AI.
 */
import type { AdventureTheme, MapData, MapNodeStatus } from '../../types';

const ACCESSIBLE_NODE_STATUSES: Array<MapNodeStatus> = ['discovered', 'quest_target'];

/**
 * Builds a simple map update prompt using the provided context.
 */
export const buildCartographerPrompt = (
  theme: AdventureTheme,
  mapData: MapData,
  narrativeContext: string,
): string => {
  const mapNodes = mapData.nodes
    .map(n => `- "${n.placeName}" (${n.data.nodeType})`)
    .join('\n');

  return `Narrative Context:\n${narrativeContext}\n\nKnown Map Nodes for theme "${theme.name}":\n${mapNodes}\n\nProvide JSON updates as per the SYSTEM_INSTRUCTION.`;
};

/**
 * Builds the complex map update prompt used by the map update service.
 */
export const buildMapUpdatePrompt = (
  sceneDesc: string,
  logMsg: string,
  localPlace: string,
  mapHint: string,
  currentTheme: AdventureTheme,
  previousMapNodeContext: string,
  existingMapContext: string,
  allKnownMainPlaces: string,
  itemNames: Array<string>,
  npcNames: Array<string>,
): string => `## Narrative Context for Map Update:
  - Current Theme: "${currentTheme.name}";
  - Theme Guidance: "${currentTheme.storyGuidance}";
  - Scene Description: "${sceneDesc}";
  - Log Message (outcome of last action): "${logMsg}";
  - Player's Current Location Description (localPlace): "${localPlace}".

## Map Context:
  - All Known Main Locations: ${allKnownMainPlaces};
  - Player's Previous Location was: ${previousMapNodeContext};
  - Map Hint from Storyteller: "${mapHint}".
  - Item Names to avoid as nodes: ${
    itemNames.length > 0 ? itemNames.map(n => `"${n}"`).join(', ') : 'None'
  };
  - NPC Names to avoid as nodes: ${
    npcNames.length > 0 ? npcNames.map(n => `"${n}"`).join(', ') : 'None'
  }.

${existingMapContext}
---
Based on the Narrative Context and existing map context, provide a JSON response strongly adhering to the System Instructions.

`;

/**
 * Builds a minimal prompt for quick navigation suggestion (no map edits).
 */
export const buildSimplifiedNavigationPrompt = (
  currentTheme: AdventureTheme,
  mapData: MapData,
  context: {
    logMessage?: string;
    currentScene: string;
    previousLocalPlace: string | null;
    currentLocalPlace: string | null;
    previousMapNodeName: string | null;
  },
): string => {
  const accessibleNodes = mapData.nodes.filter(n => ACCESSIBLE_NODE_STATUSES.includes(n.data.status));
  const nodesList = accessibleNodes.length > 0
    ? accessibleNodes
        .map(n => `- id: ${n.id}; name: "${n.placeName}"; type: ${n.data.nodeType}`)
        .join('\n')
    : 'None (no accessible nodes discovered yet).';

  const logMsg = (context.logMessage ?? '').trim() || 'None';
  const scene = context.currentScene.trim() || 'Unknown';
  const prevLP = context.previousLocalPlace ?? 'Unknown';
  const currLP = context.currentLocalPlace ?? 'Unknown';
  const prevNode = context.previousMapNodeName ?? 'Unknown or N/A';

  return `## Goal
Pick the single best accessible node that matches the Player's current position. If none fits, define one new node to add.

## Theme
- Name: "${currentTheme.name}"

## Player Context
- Log Message: ${logMsg}
- Current Scene: "${scene}"
- Previous Map Node: ${prevNode}
- localPlace change: "${prevLP}" → "${currLP}"

## Accessible Nodes (existing map only)
${nodesList}

Respond ONLY with JSON.
- When an existing node works: { "suggestedCurrentMapNodeId": "<existing id>" }
- When a new node is required: { "suggestedCurrentMapNodeId": "<new placeName>", "nodesToAdd": [ { "placeName": "...", "description": "...", "aliases": ["..."], "status": "discovered" (or "quest_target" if the story demands), "nodeType": "<type>", "parentNodeId": "<existing id or name>" } ] }`;
};
