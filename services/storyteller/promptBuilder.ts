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
  ThemeMemory,
  ThemeHistoryState,
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
  storyArc: StoryArc | null,
  playerGender: string,
  worldFacts: WorldFacts,
  heroSheet: HeroSheet,
  heroBackstory: HeroBackstory,
): string => {
  const worldInfo = formatWorldFactsForPrompt(worldFacts);
  const heroDescription = formatHeroSheetForPrompt(heroSheet, true);
  const heroPast = formatHeroBackstoryForPrompt(heroBackstory);
  const arcContext = storyArc ? formatStoryArcContext(storyArc) : '';
  const prompt = `Start a new adventure in the theme "${theme.name}". ${theme.themeGuidance}
${arcContext ? `\n\n### Narrative Arc:\n${arcContext}` : ''}

## World Details:
${worldInfo}

## Player Character Description:
Gender: ${playerGender}.
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
 * Build the prompt for entering a completely new theme after a reality shift.
 */
export const buildNewThemePostShiftPrompt = (

  theme: AdventureTheme,
  storyArc: StoryArc | null,
  inventory: Array<Item>,
  playerGender: string
): string => {
  const inventoryStrings = itemsToString(inventory, ' - ', true, true, false, false, true);
  const arcContext = storyArc ? formatStoryArcContext(storyArc) : '';
  const prompt = `The player is entering a NEW theme "${theme.name}" after a reality shift. ${theme.themeGuidance}
${arcContext ? `\n\n### Narrative Arc:\n${arcContext}` : ''}
Player's Character Gender: "${playerGender}"

Player's Current Inventory (brought from previous reality or last visit):
${inventoryStrings}

Creatively generate the main quest, current objective, scene description, action options, and starting items in the style of this theme. Describe the disorienting transition.

List anachronistic Player's Items in playerItemsHint.

ALWAYS SET "mapUpdated": true.
ALWAYS REQUIRED: "mainQuest", "currentObjective", "localTime", "localEnvironment", and "localPlace".
`;
  return prompt;
};

/**
 * Build the prompt for returning to a previously visited theme after a shift.
 */
export const buildReturnToThemePostShiftPrompt = (

  theme: AdventureTheme,
  storyArc: StoryArc | null,
  inventory: Array<Item>,
  playerGender: string,
  themeMemory: ThemeMemory,
  mapDataForTheme: MapData,
  currentThemeNPCs: Array<NPC>
): string => {
  const inventoryPrompt = itemsToString(
    inventory,
    ' - ',
    true,
    true,
    false,
    false,
    true,
  );
  const currentThemeMainMapNodes = mapDataForTheme.nodes.filter(
    node => node.themeName === theme.name && node.data.nodeType !== 'feature' && node.data.nodeType !== 'room'
  );
  const placesContext = formatKnownPlacesForPrompt(currentThemeMainMapNodes, false);

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
  const npcsStrings =
    knownNPCs.length > 0 ? npcsToString(knownNPCs, ' - ', false, false, false, true) : 'None specifically known in this theme yet.';

  const arcContext = storyArc ? formatStoryArcContext(storyArc) : '';
  const prompt = `The player is CONTINUING their adventure by re-entering the theme "${theme.name}" after a reality shift.
${arcContext ? `\n\n### Narrative Arc:\n${arcContext}` : ''}
Player's Character Gender: "${playerGender}"
The Adventure Summary: "${themeMemory.summary}"
Main Quest: "${themeMemory.mainQuest}"
Current Objective: "${themeMemory.currentObjective}"

## Player's Current Inventory (brought from previous reality or last visit):
${inventoryPrompt}

List anachronistic Player's Items in playerItemsHint.

## Known Locations:
${placesContext}

## Known NPCs (including presence):
${npcsStrings}

## Companions traveling with the Player:
${companionStrings}

## NPCs Player can interact with (nearby):
${nearbyStrings}

Describe the scene as they re-enter, potentially in a state of confusion from the shift, making it feel like a continuation or a new starting point consistent with the Adventure Summary and current quest/objective.
Provide appropriate action options for the player to orient themselves.

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
  playerGender: string,
  worldFacts: WorldFacts | null,
  heroSheet: HeroSheet | null,
  themeHistory: ThemeHistoryState,
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
    knownNPCs.length > 0 ? npcsToString(knownNPCs, ' - ', false, false, false, true) : 'None specifically known in this theme yet.';

  const relevantFactsSection =
    relevantFacts.length > 0 ? relevantFacts.map(f => `- ${f}`).join('\n') : 'None';

  const recentEventsContext = formatRecentEventsForPrompt(recentLogEntries);
  const arcContext = storyArc ? formatStoryArcContext(storyArc) : '';

  const allNodesForCurrentTheme = fullMapData.nodes.filter(node => node.themeName === currentTheme.name);
  const allEdgesForCurrentTheme = fullMapData.edges.filter(edge => {
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

  const worldInfo =
    worldFacts !== null ? formatWorldFactsForPrompt(worldFacts) : 'Unknown';
  const heroDescription =
    heroSheet !== null
      ? formatHeroSheetForPrompt(heroSheet, false)
      : 'The player character remains undescribed.';

  const prompt = `Based on the Previous Scene and Player Action, and taking into account the provided context (including map context), generate the next scene description, options, item changes, log message, etc.

${arcContext ? `### Narrative Arc:\n${arcContext}\n` : ''}

## Context that may or may not be relevant for this specific turn:
Previous Local Time: "${localTime ?? 'Unknown'}"
Previous Local Environment: "${localEnvironment ?? 'Undetermined'}"
Previous Local Place: "${localPlace ?? 'Undetermined Location'}"
Main Quest: "${mainQuest ?? 'Not set'}"
Current Objective: "${currentObjective ?? 'Not set'}"

### World Details:
${worldInfo}

### Player Character Description:
Gender: ${playerGender}.
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

### Relevant Facts about the world:
${relevantFactsSection}

### Recent Events to keep in mind (for context and continuity):
${recentEventsContext}
 - A bit later you look around and consider your next move.
IMPORTANT: Recent events are provided only for additional context. These actions have already been processed by the game and should NEVER trigger item actions again, to avoid double counting.

---
${storyArc ? `Current Arc: "${storyArc.title}" (Act ${String(storyArc.currentAct)}: ${storyArc.acts[storyArc.currentAct - 1].title})` : `Current Theme: "${currentTheme.name}"`}
Previous Scene: "${currentScene}"
Player Action: "${playerAction}"
${travelPlanOrUnknown}`;

  return prompt;
};
