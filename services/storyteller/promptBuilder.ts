/**
 * @file promptBuilder.ts
 * @description Utilities for constructing storyteller prompts using named placeholders.
 */

import type {
  AdventureTheme,
  Item,
  NPC,
  MapData,
  MapNode,
  WorldFacts,
  HeroSheet,
  HeroBackstory,
  StoryArc,
} from '../../types';
import {
  itemsToString,
  formatKnownPlacesForPrompt,
  formatMapContextForPrompt,
  npcsToString,
  formatRecentEventsForPrompt,
  formatDetailedContextForMentionedEntities,
  formatTravelPlanLine,
  formatWorldFactsForPrompt,
  formatHeroSheetForPrompt,
  formatHeroBackstoryForPrompt,
  formatStoryArcContext,
} from '../../utils/promptFormatters';

/**
 * Build the initial prompt for starting a new game.
 */
export const buildNewGameFirstTurnPrompt = (
  theme: AdventureTheme,
  storyArc: StoryArc,
  worldFacts: WorldFacts,
  heroSheet: HeroSheet,
  heroBackstory: HeroBackstory,
): string => {
  const worldInfo = formatWorldFactsForPrompt(worldFacts);
  const heroDescription = formatHeroSheetForPrompt(heroSheet, true);
  const heroPast = formatHeroBackstoryForPrompt(heroBackstory);
  const arcContext = formatStoryArcContext(storyArc);
  const prompt = `Start a new adventure in the theme "${theme.name}". ${theme.storyGuidance}

## Narrative Arc:
${arcContext}

## World Details:
${worldInfo}

## Player Character Description:
${heroDescription}

## Player Character Backstory:
${heroPast}

Creatively generate the main quest, current objective, scene description, action options, and starting items using the world details and hero history for inspiration.
Creatively add any important quest item(s), if any, based on your generated quest and objective.

ALWAYS SET "mapUpdated": true.
ALWAYS REQUIRED: "mainQuest", "currentObjective", "localTime", "localEnvironment", and "localPlace".
`;
  return prompt;
};

/**
 * Build the prompt for a main game turn.
 */
export const buildMainGameTurnPrompt = (
  currentScene: string,
  playerAction: string,
  inventory: Array<Item>,
  locationItems: Array<Item>,
  mainQuest: string | null,
  currentObjective: string | null,
  currentTheme: AdventureTheme,
  recentLogEntries: Array<string>,
  currentThemeMainMapNodes: Array<MapNode>,
  currentThemeNPCs: Array<NPC>,
  relevantFacts: Array<string>,
  localTime: string | null,
  localEnvironment: string | null,
  localPlace: string | null,
  worldFacts: WorldFacts,
  heroSheet: HeroSheet,
  currentMapNodeDetails: MapNode | null,
  fullMapData: MapData,
  destinationNodeId: string | null,
  storyArc?: StoryArc | null
): string => {
  const inventoryStrings =
    inventory.length > 0
      ? itemsToString(inventory, ' - ', true, true, false, false, true)
      : `There are no items in player's inventory.`;
  const locationItemsStrings =
    locationItems.length > 0
      ? `There are items at this location: \n${itemsToString(
          locationItems,
          ' - ',
          true,
          true,
          false,
          false,
          true,
        )}`
      : `There are no visible items at this location.`;
  const placesContext = formatKnownPlacesForPrompt(currentThemeMainMapNodes, true);
  // Filter NPCs that are companions, as they are traveling with the player
  const companions = currentThemeNPCs.filter(npc => npc.presenceStatus === 'companion');
  const companionStrings =
    companions.length > 0 ? npcsToString(companions, ' - ', false, false, false, true) : 'None';
  // Filter NPCs that are nearby, as they are currently present and can be interacted with
  const nearbyNPCs = currentThemeNPCs.filter(npc => npc.presenceStatus === 'nearby');
  const nearbyStrings =
    nearbyNPCs.length > 0 ? npcsToString(nearbyNPCs, ' - ', false, false, false, true) : 'None';
  // Filter NPCs that are distant or unknown, as they are not currently present but may be relevant
  const knownNPCs = currentThemeNPCs.filter(npc => npc.presenceStatus === 'distant' || npc.presenceStatus === 'unknown');
  const NPCsStrings =
    knownNPCs.length > 0 ? npcsToString(knownNPCs, ' - ', false, false, false, true) : 'None specifically known yet.';

  const relevantFactsSection =
    relevantFacts.length > 0 ? relevantFacts.map(f => `- ${f}`).join('\n') : 'None';

  const recentEventsContext = formatRecentEventsForPrompt(recentLogEntries);
  const arcContext = storyArc ? formatStoryArcContext(storyArc) : '';

  const mapData = fullMapData as Partial<MapData>;
  const allNodesForCurrentTheme = Array.isArray(mapData.nodes) ? mapData.nodes : [];
  const rawEdges = Array.isArray(mapData.edges) ? mapData.edges : [];
  const allEdgesForCurrentTheme = rawEdges.filter(edge => {
    const sourceNode = allNodesForCurrentTheme.find(n => n.id === edge.sourceNodeId);
    const targetNode = allNodesForCurrentTheme.find(n => n.id === edge.targetNodeId);
    return sourceNode && targetNode;
  });
  const mapContext = formatMapContextForPrompt(
    fullMapData,
    currentMapNodeDetails?.id ?? null,
    currentTheme,
    allNodesForCurrentTheme,
    allEdgesForCurrentTheme
  );

  const travelPlanLine = formatTravelPlanLine(
    fullMapData,
    currentMapNodeDetails?.id ?? null,
    destinationNodeId
  );

  let travelPlanOrUnknown = '';
  if (travelPlanLine) {
    travelPlanOrUnknown = travelPlanLine;
  } else if (destinationNodeId) {
    const destNode = fullMapData.nodes.find(n => n.id === destinationNodeId);
    const placeName = destNode?.placeName ?? destinationNodeId;
    const destParentId = destNode?.data.parentNodeId;
    const destParent =
      destParentId && destParentId !== 'Universe'
        ? fullMapData.nodes.find(n => n.id === destParentId)?.placeName ?? destParentId
        : null;
    const displayName = destParent ? `${placeName} in ${destParent}` : placeName;
    travelPlanOrUnknown = `Player wants to reach ${displayName}, but does not know how to get there.`;
  }

  const detailedEntityContext = formatDetailedContextForMentionedEntities(
    currentThemeMainMapNodes,
    currentThemeNPCs,
    `${currentScene} ${playerAction}`,
    '### Details on relevant locations mentioned in current scene or action:',
    '### Details on relevant NPCs mentioned in current scene or action:'
  );

  const worldInfo = formatWorldFactsForPrompt(worldFacts);
  const heroDescription = formatHeroSheetForPrompt(heroSheet, false);

  const prompt = `Based on the Previous Scene and Player Action, and taking into account the provided narrative arc guidance and context, generate the next scene description, options, item changes, log message, etc.

## Narrative Arc:
${arcContext}

## Context that may or may not be relevant for this specific turn:
Previous Local Time: "${localTime ?? 'Unknown'}"
Previous Local Environment: "${localEnvironment ?? 'Undetermined'}"
Previous Local Place: "${localPlace ?? 'Undetermined Location'}"
Main Quest: "${mainQuest ?? 'Not set'}"
Current Objective: "${currentObjective ?? 'Not set'}"

### World Details:
${worldInfo}

### Player Character Description:
${heroDescription}

### Player's Inventory:
${inventoryStrings}

### Items at Current Location:
${locationItemsStrings}

### Known Locations:
${placesContext}

### Known NPCs:
${NPCsStrings}

### Companions traveling with the Player:
${companionStrings}

### NPCs Player can interact with (nearby):
${nearbyStrings}

### Current Map Context (including your location, possible exits, nearby paths, and other nearby locations):
${mapContext}

${detailedEntityContext}

### Relevant Facts at present moment:
${relevantFactsSection}

### Recent Events to keep in mind (for context and continuity):
${recentEventsContext}
 - A bit later you look around and consider your next move.
IMPORTANT: Recent events are provided only for additional context. These actions have already been processed by the game and should NEVER trigger item actions again, to avoid double counting.

---

## Previous Scene:
${currentScene}

## Player Actions:
${playerAction}
${travelPlanOrUnknown}`;

  return prompt;
};
