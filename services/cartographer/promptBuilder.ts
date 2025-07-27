/**
 * @file promptBuilder.ts
 * @description Utilities for constructing prompts for the cartographer AI.
 */
import type { AdventureTheme, MapData, StoryArc } from '../../types';

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
  storyArc?: StoryArc | null,
): string => `## Narrative Context for Map Update:
  - Current Theme: "${currentTheme.name}";
  - Theme Guidance: "${currentTheme.storyGuidance}";
${storyArc ? `  - Current Arc: "${storyArc.title}" (Act ${String(storyArc.currentAct)}: ${storyArc.acts[storyArc.currentAct - 1].title});\n` : ''}
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
