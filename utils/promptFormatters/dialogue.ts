
/**
 * @file utils/promptFormatters/dialogue.ts
 * @description Prompt formatting helpers focused on characters and dialogue.
 */

import {
  Item,
  Character,
  AdventureTheme,
  ThemeMemory,
  MapData,
  MapNode,
  ThemeHistoryState,
} from '../../types';
import { formatInventoryForPrompt } from './inventory';
import { formatKnownPlacesForPrompt, formatMapContextForPrompt } from './map';

/**
 * Formats a list of known characters for AI prompts.
 */
export const formatKnownCharactersForPrompt = (
  characters: Character[],
  detailed: boolean = false
): string => {
  if (characters.length === 0) {
    return 'None specifically known in this theme yet.';
  }
  if (detailed) {
    const formatSingleCharacterDetailed = (c: Character): string => {
      let details = `"${c.name}"`;
      if (c.aliases && c.aliases.length > 0) {
        details += ` (aliases: ${c.aliases.map(a => `"${a}"`).join(', ')})`;
      }
      details += ` (Status: ${c.presenceStatus}`;
      if (c.presenceStatus === 'companion' || c.presenceStatus === 'nearby') {
        details += `, ${c.preciseLocation || (c.presenceStatus === 'companion' ? 'with you' : 'nearby')}`;
      } else {
        details += `, Last Location: ${c.lastKnownLocation || 'Unknown'}`;
      }
      details += `) - Description: "${c.description}"`;
      return details;
    };
    return characters.map(formatSingleCharacterDetailed).join('; ') + '.';
  }
  const companions = characters.filter(c => c.presenceStatus === 'companion');
  const nearbyCharacters = characters.filter(c => c.presenceStatus === 'nearby');
  const otherKnownCharacters = characters.filter(
    c => c.presenceStatus === 'distant' || c.presenceStatus === 'unknown'
  );

  const promptParts: string[] = [];
  if (companions.length > 0) {
    const companionStrings = companions.map(c => `"${c.name}" (${c.preciseLocation || 'with player'})`);
    promptParts.push(`Companions traveling with the Player: ${companionStrings.join(', ')}.`);
  }
  if (nearbyCharacters.length > 0) {
    const nearbyStrings = nearbyCharacters.map(c => `"${c.name}" (${c.preciseLocation || 'in the vicinity'})`);
    promptParts.push(`Characters Player can interact with (nearby): ${nearbyStrings.join(', ')}.`);
  }
  if (otherKnownCharacters.length > 0) {
    const otherStrings = otherKnownCharacters.map(c => {
      let statusDetail = `Status: ${c.presenceStatus}`;
      if (c.lastKnownLocation && c.lastKnownLocation !== 'Unknown') {
        statusDetail += `, Last known location: ${c.lastKnownLocation}`;
      } else {
        statusDetail += `, Location Unknown`;
      }
      return `"${c.name}" (${statusDetail})`;
    });
    promptParts.push(`Other known characters: ${otherStrings.join(', ')}.`);
  }
  return promptParts.length > 0 ? promptParts.join('\n') : 'None specifically known in this theme yet.';
};

/**
 * Formats recent log events for inclusion in prompts.
 */
export const formatRecentEventsForPrompt = (logMessages: string[]): string => {
  if (logMessages.length === 0) {
    return '\n';
  }
  return '\n- ' + logMessages.join('\n- ') + '\n';
};

/**
 * Provides detailed context for places or characters mentioned in a string.
 */
export const formatDetailedContextForMentionedEntities = (
  allKnownMainMapNodes: MapNode[],
  allKnownCharacters: Character[],
  contextString: string,
  placesPrefixIfAny: string,
  charactersPrefixIfAny: string
): string => {
  const mentionedPlaces: MapNode[] = [];
  allKnownMainMapNodes.forEach(node => {
    const allNames = [node.placeName, ...(node.data.aliases || [])];
    const nameRegex = new RegExp(allNames.map(name => `\\b${name.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}\\b`).join('|'), 'i');
    if (nameRegex.test(contextString)) {
      mentionedPlaces.push(node);
    }
  });

  const mentionedCharacters: Character[] = [];
  allKnownCharacters.forEach(c => {
    const allNames = [c.name, ...(c.aliases || [])];
    const nameRegex = new RegExp(allNames.map(name => `\\b${name.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}\\b`).join('|'), 'i');
    if (nameRegex.test(contextString)) {
      mentionedCharacters.push(c);
    }
  });

  let detailedContext = '';
  const formattedMentionedPlaces = formatKnownPlacesForPrompt(mentionedPlaces, true);
  if (formattedMentionedPlaces && formattedMentionedPlaces !== 'None specifically known in this theme yet.') {
    detailedContext += `\n${placesPrefixIfAny}\n${formattedMentionedPlaces}`;
  }
  const formattedMentionedCharacters = formatKnownCharactersForPrompt(mentionedCharacters, true);
  if (
    formattedMentionedCharacters &&
    formattedMentionedCharacters !== 'None specifically known in this theme yet.'
  ) {
    detailedContext += `\n${charactersPrefixIfAny}\n${formattedMentionedCharacters}`;
  }
  return detailedContext.trimStart();
};

/**
 * Formats the initial prompt for starting a new game.
 */
export const formatNewGameFirstTurnPrompt = (
  theme: AdventureTheme,
  playerGender: string
): string => {
  const prompt = `Start a new adventure in the theme "${theme.name}".
Player's Character Gender: "${playerGender}"
Suggested Initial Scene: "${theme.initialSceneDescriptionSeed}" (Adjust to add variely)
Suggested Initial Main Quest: "${theme.initialMainQuest}" (Adjust to add variely)
Suggested Initial Current Objective: "${theme.initialCurrentObjective}" (Adjust to add variely)
Suggested Initial Inventory to be granted: "${theme.initialItems}" (Adjust the names and descriptions to add variely)

Last player's action was unremarkable, something very common, what people do in the described situation.

Creatively enerate the variation of the mainQuest and currentObjective, based on the suggested Quest and Objective, but noticeably different.
Creatively generate the initial scene description, action options, items (variation based on 'Initial Inventory to be granted') and logMessage.
Creatively add possible important quest item(s), if any, based on your generated Quest and Objective.
Set "mapUpdated": true if your generated Scene, Quest or Objective mention specific locations that should be on the map.
Of all the optional variables, your response MUST include at least the "mainQuest", "currentObjective", "localTime", "localEnvironment", and "localPlace".
Ensure the response adheres to the JSON structure specified in the SYSTEM_INSTRUCTION.`;
  return prompt;
};

/**
 * Formats the prompt for entering a completely new theme after a shift.
 */
export const formatNewThemePostShiftPrompt = (
  theme: AdventureTheme,
  inventory: Item[],
  playerGender: string
): string => {
  const inventoryPrompt = formatInventoryForPrompt(inventory);
  const prompt = `The player is entering a NEW theme "${theme.name}" after a reality shift.
Player's Character Gender: "${playerGender}"
Initial Scene: "${theme.initialSceneDescriptionSeed}" (Adapt this to an arrival scene, describing the disorienting transition).
Main Quest: "${theme.initialMainQuest}" (Adjust to add variely)
Current Objective: "${theme.initialCurrentObjective}" (Adjust to add variely)

Player's Current Inventory (brought from previous reality or last visit):\n - ${inventoryPrompt}
IMPORTANT:
- EXAMINE the player's Current Inventory for any items that are CLEARLY ANACHRONISTIC for the theme "${theme.name}".
- If anachronistic items are found, TRANSFORM them into thematically appropriate equivalents using an "itemChange" "update" action with "newName", "type", and "description". Creatively explain this transformation in the "logMessage". Refer to ITEMS_GUIDE for anachronistic item handling.
- If no items are anachronistic, no transformation is needed.

Generate the scene description for a disoriented arrival, and provide appropriate initial action options for the player to orient themselves.
The response MUST include at least the "mainQuest", "currentObjective", "localTime", "localEnvironment", and "localPlace".
Set "mapUpdated": true if your generated Scene, Quest or Objective mention specific locations that should be on a map.
Ensure the response adheres to the JSON structure specified in the SYSTEM_INSTRUCTION.`;
  return prompt;
};

/**
 * Formats the prompt for returning to a previously visited theme.
 */
export const formatReturnToThemePostShiftPrompt = (
  theme: AdventureTheme,
  inventory: Item[],
  playerGender: string,
  themeMemory: ThemeMemory,
  mapDataForTheme: MapData,
  allCharactersForTheme: Character[]
): string => {
  const inventoryPrompt = formatInventoryForPrompt(inventory);
  const currentThemeMainMapNodes = mapDataForTheme.nodes.filter(
    n =>
      n.themeName === theme.name &&
      n.data.nodeType !== 'feature' &&
      n.data.nodeType !== 'room'
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
- If anachronistic items are found, TRANSFORM them into thematically appropriate equivalents using an "itemChange" "update" action with "newName", "type", and "description". Creatively explain this transformation in the "logMessage". Refer to ITEMS_GUIDE for anachronistic item handling.
- CRITICALLY IMPORTANT: ALWAYS transform some items into important quest items you must have already had in this reality, based on Main Quest, Current Objective, or the Adventure Summary even if they are NOT anachronistic, using an "itemChange" "update" action with "newName", "type", "description". Creatively explain this transformation in the "logMessage".

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
 * Formats the prompt for a main game turn.
 */
export const formatMainGameTurnPrompt = (
  currentScene: string,
  playerAction: string,
  inventory: Item[],
  mainQuest: string | null,
  currentObjective: string | null,
  currentTheme: AdventureTheme,
  recentLogEntries: string[],
  currentThemeMainMapNodes: MapNode[],
  currentThemeCharacters: Character[],
  localTime: string | null,
  localEnvironment: string | null,
  localPlace: string | null,
  playerGender: string,
  themeHistory: ThemeHistoryState,
  currentMapNodeDetails: MapNode | null,
  fullMapData: MapData
): string => {
  const inventoryPrompt = formatInventoryForPrompt(inventory);
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
    currentMapNodeDetails?.id || null,
    currentTheme,
    allNodesForCurrentTheme,
    allEdgesForCurrentTheme
  );

  const detailedEntityContext = formatDetailedContextForMentionedEntities(
    currentThemeMainMapNodes,
    currentThemeCharacters,
    `${currentScene} ${playerAction}`,
    'Details on relevant map nodes (locations/features) mentioned in current scene or action:',
    'Details on relevant characters mentioned in current scene or action:'
  );

  const prompt = `** Context:
Player's Character Gender: "${playerGender}"
Previous Local Time: "${localTime || 'Unknown'}"
Previous Local Environment: "${localEnvironment || 'Undetermined'}"
Previous Local Place: "${localPlace || 'Undetermined Location'}"
Main Quest: "${mainQuest || 'Not set'}"
Current Objective: "${currentObjective || 'Not set'}"
Current Inventory:\n - ${inventoryPrompt}
Known Locations: ${placesContext}
Known Characters: ${charactersContext}

Current Map Context (including your location, possible exits, nearby paths, and other nearby locations):
${mapContext}

${detailedEntityContext}

Recent Events to keep in mind (provided ONLY for extra context, these actions have already been processed):
${recentEventsContext}
---

Current Theme: "${currentTheme.name}"
Previous Scene: "${currentScene}"
Player Action: "${playerAction}"

Based on the Previous Scene and Player Action, and taking into account the provided historical and environmental context (including map context and possible exits):
Generate the next scene description, options, item changes, log message, etc.
Compare the new Local Place of the character to the precise locations of relevant characters, and update their presence state accordingly.
For example, leaving character's location makes them "distant", entering character's location makes them 'nearby' if they are still there, or 'unknown', is they moved while the player was not there.
If a Companion leaves the Player, or the Player leaves a Companion, their presence status changes to 'nearby' or, sometimes, 'distant', depending on context.
The response MUST include "localTime", "localEnvironment", and "localPlace".
If "mainQuest" or "currentObjective" change, they MUST be provided. Otherwise, they are optional.
If "localPlace" corresponds to a location in "Locations Nearby", always set "currentMapNodeId" to the name of that location.
If the narrative implies any changes to the map (new details, locations, connections, status changes), set "mapUpdated": true.
Adhere to all rules in the SYSTEM_INSTRUCTION for character and presence management using "charactersAdded" and "charactersUpdated", and for item management using "itemChange".
Ensure the response adheres to the JSON structure specified in the SYSTEM_INSTRUCTION.`;
  return prompt;
};

