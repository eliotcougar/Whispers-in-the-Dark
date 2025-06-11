/**
 * @file promptBuilder.ts
 * @description Utilities for constructing prompts for the cartographer AI.
 */
import { AdventureTheme, MapData } from '../../types';

/**
 * Builds a simple map update prompt using the provided context.
 */
export const buildCartographerPrompt = (
  theme: AdventureTheme,
  mapData: MapData,
  narrativeContext: string,
): string => {
  const mapNodes = mapData.nodes
    .filter(n => n.themeName === theme.name)
    .map(n => `- "${n.placeName}" (${n.data.nodeType})`)
    .join('\n');

  return `Narrative Context:\n${narrativeContext}\n\nKnown Map Nodes for theme "${theme.name}":\n${mapNodes}\n\nProvide JSON updates as per the SYSTEM_INSTRUCTION.`;
};
