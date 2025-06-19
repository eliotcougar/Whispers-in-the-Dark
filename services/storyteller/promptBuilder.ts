/**
 * @file promptBuilder.ts
 * @description Utilities for constructing storyteller prompts using named placeholders.
 */

import {
  AdventureTheme,
  Item,
  Character,
  MapData,
  MapNode,
  ThemeMemory,
  ThemeHistoryState,
} from '../../types';
import {
  itemsToString,
  formatKnownPlacesForPrompt,
  formatMapContextForPrompt,
  formatKnownCharactersForPrompt,
  formatRecentEventsForPrompt,
  formatDetailedContextForMentionedEntities,
  formatTravelPlanLine,
} from '../../utils/promptFormatters';

/**
 * Build the initial prompt for starting a new game.
 */
export const buildNewGameFirstTurnPrompt = (

  theme: AdventureTheme,
  playerGender: string
): string => {
  const prompt = `Start a new adventure in the theme "${theme.name}".
Player's Character Gender: "${playerGender}"
Suggested Initial Scene: "${theme.initialSceneDescriptionSeed}" (adjust for variety)
Suggested Initial Main Quest: "${theme.initialMainQuest}" (adjust for variety)
Suggested Initial Current Objective: "${theme.initialCurrentObjective}" (adjust for variety)
Suggested Initial Inventory to be granted: "${theme.initialItems}" (adjust names and descriptions for variety)

The player's last action was unremarkable—something common anyone would do in this situation.

Creatively generate variations of the main quest and current objective based on the suggestions, but make them noticeably different.
Creatively generate the initial scene description, action options, and items (variations based on 'Initial Inventory to be granted'), along with a logMessage.
Creatively add any important quest item(s), if any, based on your generated quest and objective.
ALWAYS SET "mapUpdated": true.
Of all the optional variables, your response MUST include at least the "mainQuest", "currentObjective", "localTime", "localEnvironment", and "localPlace".
Ensure the response adheres to the JSON structure specified in the SYSTEM_INSTRUCTION.`;
  return prompt;
};

/**
 * Build the prompt for entering a completely new theme after a reality shift.
 */
export const buildNewThemePostShiftPrompt = (

  theme: AdventureTheme,
  inventory: Array<Item>,
  playerGender: string
): string => {
  const inventoryPrompt = itemsToString(inventory, ' - ');
  const prompt = `The player is entering a NEW theme "${theme.name}" after a reality shift.
Player's Character Gender: "${playerGender}"
Initial Scene: "${theme.initialSceneDescriptionSeed}" (adapt to an arrival scene describing the disorienting transition).
Main Quest: "${theme.initialMainQuest}" (adjust for variety)
Current Objective: "${theme.initialCurrentObjective}" (adjust for variety)

Player's Current Inventory (brought from previous reality or last visit):\n - ${inventoryPrompt}
IMPORTANT:
  - EXAMINE the player's Current Inventory for any items that are CLEARLY ANACHRONISTIC for the theme "${theme.name}".
  - If anachronistic items are found, TRANSFORM them into thematically appropriate equivalents using an "itemChange" "update" action with "newName" and optionally updated "type" and "description". Creatively explain this transformation in the "logMessage". Refer to ITEMS_GUIDE for anachronistic item handling.
- If no items are anachronistic, no transformation is needed.

Generate the scene description for a disoriented arrival, and provide appropriate initial action options for the player to orient themselves.
The response MUST include at least the "mainQuest", "currentObjective", "localTime", "localEnvironment", and "localPlace".
Set "mapUpdated": true if your generated Scene, Quest or Objective mention specific locations that should be on a map.
Ensure the response adheres to the JSON structure specified in the SYSTEM_INSTRUCTION.`;
  return prompt;
};

/**
 * Build the prompt for returning to a previously visited theme after a shift.
 */
export const buildReturnToThemePostShiftPrompt = (

  theme: AdventureTheme,
  inventory: Array<Item>,
  playerGender: string,
  themeMemory: ThemeMemory,
  mapDataForTheme: MapData,
  allCharactersForTheme: Array<Character>
): string => {
  const inventoryPrompt = itemsToString(inventory, ' - ');
  const currentThemeMainMapNodes = mapDataForTheme.nodes.filter(
    n => n.themeName === theme.name && n.data.nodeType !== 'feature' && n.data.nodeType !== 'room'
  );
  const placesContext = formatKnownPlacesForPrompt(currentThemeMainMapNodes, false);
  const charactersContext = formatKnownCharactersForPrompt(allCharactersForTheme, false);
  const prompt = `The player is CONTINUING their adventure by re-entering the theme "${theme.name}" after a reality shift.
Player's Character Gender: "${playerGender}"
The Adventure Summary: "${themeMemory.summary}"
Main Quest: "${themeMemory.mainQuest}"
Current Objective: "${themeMemory.currentObjective}"

Player's Current Inventory (brought from previous reality or last visit):\n - ${inventoryPrompt}
IMPORTANT:
- EXAMINE the player's Current Inventory for any items that are CLEARLY ANACHRONISTIC for the theme "${theme.name}".
  - If anachronistic items are found, TRANSFORM them into thematically appropriate equivalents using an "itemChange" "update" action with "newName" and optionally updated "type" and "description". Creatively explain this transformation in the "logMessage". Refer to ITEMS_GUIDE for anachronistic item handling.
  - CRITICALLY IMPORTANT: ALWAYS transform some items into important quest items you must have already had in this reality, based on Main Quest, Current Objective, or the Adventure Summary even if they are NOT anachronistic, using an "itemChange" "update" action with "newName" and optional "type" and "description". Creatively explain this transformation in the "logMessage".

Known Locations: ${placesContext}
Known Characters (including presence): ${charactersContext}

Describe the scene as they re-enter, potentially in a state of confusion from the shift, making it feel like a continuation or a new starting point consistent with the Adventure Summary and current quest/objective.
Provide appropriate action options for the player to orient themselves.
The response MUST include at least the "mainQuest", "currentObjective", "localTime", "localEnvironment", and "localPlace".
Set "mapUpdated": true if your generated Scene, Quest or Objective mention specific locations that should be on a map or if existing map information needs updating based on the re-entry context.
Ensure the response adheres to the JSON structure specified in the SYSTEM_INSTRUCTION.`;
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
  currentThemeCharacters: Array<Character>,
  localTime: string | null,
  localEnvironment: string | null,
  localPlace: string | null,
  playerGender: string,
  themeHistory: ThemeHistoryState,
  currentMapNodeDetails: MapNode | null,
  fullMapData: MapData,
  destinationNodeId: string | null
): string => {
  const inventoryPrompt = itemsToString(inventory, ' - ');
  const locationItemsPrompt =
    locationItems.length > 0 ? itemsToString(locationItems, ' - ') : '';
  const inventorySection = `${inventoryPrompt}${locationItemsPrompt ? `\nThere are items at this location:\n${locationItemsPrompt}` : ''}`;
  const placesContext = formatKnownPlacesForPrompt(currentThemeMainMapNodes, true);
  const charactersContext = formatKnownCharactersForPrompt(currentThemeCharacters, true);
  const recentEventsContext = formatRecentEventsForPrompt(recentLogEntries);

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
    currentThemeCharacters,
    `${currentScene} ${playerAction}`,
    '### Details on relevant locations mentioned in current scene or action:',
    '### Details on relevant characters mentioned in current scene or action:'
  );

  const prompt = `Based on the Previous Scene and Player Action, and taking into account the provided context (including map context), generate the next scene description, options, item changes, log message, etc.

## Context:
Player's Character Gender: "${playerGender}"
Previous Local Time: "${localTime ?? 'Unknown'}"
Previous Local Environment: "${localEnvironment ?? 'Undetermined'}"
Previous Local Place: "${localPlace ?? 'Undetermined Location'}"
Main Quest: "${mainQuest ?? 'Not set'}"
Current Objective: "${currentObjective ?? 'Not set'}"

### Current Inventory:
${inventorySection}

### Known Locations:
${placesContext}

### Known Characters:
${charactersContext}

### Current Map Context (including your location, possible exits, nearby paths, and other nearby locations):
${mapContext}

${detailedEntityContext}

### Recent Events to keep in mind (for context and continuity):
${recentEventsContext}
 - A bit later you look around and consider your next move.
IMPORTANT: Recent events are provided only for additional context. These actions have already been processed by the game and should NEVER trigger item actions again, to avoid double counting.

---

Current Theme: "${currentTheme.name}"
Previous Scene: "${currentScene}"
Player Action: "${playerAction}"
${travelPlanOrUnknown}`;

  return prompt;
};
