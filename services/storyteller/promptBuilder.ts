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
import { ROOT_MAP_NODE_ID } from '../../constants';

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

  const prompt = `# Storyteller: New Adventure Setup

Start a new adventure in the theme "${theme.name}". ${theme.storyGuidance}

## Narrative Arc:
${arcContext}

## World Details:
${worldInfo}

## Player Character Description:
${heroDescription}

## Player Character Backstory:
${heroPast}

### NPC Seeding Requirements:
- Carefully examine the narrative arc, world details, and backstory. Identify **every** named individual other than the protagonist.
- For each named NPC, add a detailed entry to "npcsAdded" with attitudeTowardPlayer, presenceStatus, lastKnownLocation, preciseLocation (if nearby), and the name(s) they know protagonist by.
- Do not omit or rename any referenced character. If a figure is clearly named or title-referenced, include them. If only referenced by title or occupation - creatively invent their name.

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
  storyArc: StoryArc,
  debugToolDirective?: string,
): string => {
  const inventoryContent =
    inventory.length > 0
      ? itemsToString(inventory, ' - ', true, true, false, false, true)
      : `There are no items in player's inventory.`;
  const locationItemsContent =
    locationItems.length > 0
      ? itemsToString(locationItems, ' - ', true, true, false, false, true)
      : '';
  const placesContext = formatKnownPlacesForPrompt(currentThemeMainMapNodes, true);

  // Categorize NPCs in a single pass for efficiency
  const companions: Array<NPC> = [];
  const nearbyNPCs: Array<NPC> = [];
  const knownNPCs: Array<NPC> = [];
  for (const npc of currentThemeNPCs) {
    switch (npc.presenceStatus) {
      case 'companion':
        companions.push(npc);
        break;
      case 'nearby':
        nearbyNPCs.push(npc);
        break;
      case 'distant':
      case 'unknown':
        knownNPCs.push(npc);
        break;
      default:
        break;
    }
  }

  const companionsSection = npcsToString(
    companions,
    '- <ID: {id}> - {name} — {description} (preciseLocation: {preciseLocation}, attitude: {attitudeTowardPlayer}, knows Player as {knownPlayerNames})\n',
    '### Companions traveling with the Player:\n',
  );
  const nearbySection = npcsToString(
    nearbyNPCs,
    '- <ID: {id}> - {name} — {description} (preciseLocation: {preciseLocation}, attitude: {attitudeTowardPlayer}, knows Player as {knownPlayerNames})\n',
    '### NPCs Player can interact with (nearby):\n',
  );
  const knownNpcSection = npcsToString(
    knownNPCs,
    '- <ID: {id}> - {name} — {description} (lastKnownLocation: {lastKnownLocation})\n',
    '### Other Known NPCs:\n',
  );

  const relevantFactsContent =
    relevantFacts.length > 0 ? relevantFacts.map(f => `- ${f}`).join('\n') : '';

  const recentEventsContext = formatRecentEventsForPrompt(recentLogEntries);
  const arcContext = formatStoryArcContext(storyArc);

  const mapData = fullMapData as Partial<MapData>;
  const allNodesForCurrentTheme = Array.isArray(mapData.nodes) ? mapData.nodes : [];
  const rawEdges = Array.isArray(mapData.edges) ? mapData.edges : [];
  // Precompute node id set for O(1) membership checks
  const nodeIdsForTheme = new Set(allNodesForCurrentTheme.map(n => n.id));
  const allEdgesForCurrentTheme = rawEdges.filter(
    edge => nodeIdsForTheme.has(edge.sourceNodeId) && nodeIdsForTheme.has(edge.targetNodeId)
  );
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

  const travelPlanOrUnknown = (() => {
    if (travelPlanLine) {
      return travelPlanLine;
    }
    if (!destinationNodeId) {
      return '';
    }
    const nodeById = new Map(fullMapData.nodes.map(n => [n.id, n]));
    const destNode = nodeById.get(destinationNodeId);
    const placeName = destNode?.placeName ?? destinationNodeId;
    const destParentId = destNode?.data.parentNodeId;
    const destParent =
      destParentId && destParentId !== ROOT_MAP_NODE_ID
        ? nodeById.get(destParentId)?.placeName ?? destParentId
        : null;
    const displayName = destParent ? `${placeName} in ${destParent}` : placeName;
    return `Player wants to reach ${displayName}, but does not know how to get there.`;
  })();

  const detailedEntityContext = formatDetailedContextForMentionedEntities(
    currentThemeMainMapNodes,
    currentThemeNPCs,
    `${currentScene} ${playerAction}`,
    '### Details on relevant locations mentioned in current scene or action:',
    '### Details on relevant NPCs mentioned in current scene or action:'
  );

  const worldInfo = formatWorldFactsForPrompt(worldFacts);
  const heroDescription = formatHeroSheetForPrompt(heroSheet, false);

  const debugDirectiveSection = debugToolDirective
    ? `### DEBUG TOOL DIRECTIVE (Developer Override):\n${debugToolDirective}`
    : '';
  const narrativeArcSection = `## Narrative Arc:\n${arcContext}`;
  const mapContextSection = mapContext
    ? `### Current Map Context (including your location, possible exits, nearby paths, and other nearby locations):\n${mapContext}`
    : '';
  const detailedEntitySection = detailedEntityContext ? detailedEntityContext : '';
  const relevantFactsSection = relevantFactsContent
    ? `### Relevant Facts at present moment:\n${relevantFactsContent}`
    : '';
  const recentEventsSection = recentEventsContext
    ? `### Recent Events to keep in mind (for context and continuity):\n${recentEventsContext}\n - A bit later you look around and consider your next move.\nIMPORTANT: Recent events are provided only for additional context. These actions have already been processed by the game and should NEVER trigger item actions again, to avoid double counting.`
    : '';

  const descriptiveSections =
    [
      `### World Details:\n${worldInfo}`,
      `### Player Character Description:\n${heroDescription}`,
      `### Player's Inventory:\n${inventoryContent}`,
      locationItemsContent ? `### Items at Current Location:\n${locationItemsContent}` : null,
      `### Known Locations:\n${placesContext}`,
      knownNpcSection || null,
      companionsSection || null,
      nearbySection || null,
      mapContextSection || null,
      detailedEntitySection || null,
      relevantFactsSection || null,
      recentEventsSection || null,
    ].filter((section): section is string => Boolean(section));

  const descriptiveBlock = descriptiveSections.join('\n\n');

  const contextLines = [
    `Previous Local Time: ${localTime ?? 'Unknown'}`,
    `Previous Local Environment: ${localEnvironment ?? 'Undetermined'}`,
    `Previous Local Place: ${localPlace ?? 'Undetermined Location'}`,
    `Main Quest: ${mainQuest ?? 'Not set'}`,
  ];
  const normalizedCurrentObjective = currentObjective?.trim() ?? '';
  if (normalizedCurrentObjective.length > 0) {
    contextLines.push(`Current Objective: ${normalizedCurrentObjective}`);
  }
  const contextSection = contextLines.join('\n');

  const topMatterSegments = debugDirectiveSection
    ? [debugDirectiveSection, narrativeArcSection]
    : [narrativeArcSection];
  const topMatter = topMatterSegments.join('\n\n');

  const travelPlanSection = travelPlanOrUnknown ? `\n${travelPlanOrUnknown}` : '';

  const prompt = `# Storyteller: Main Game Turn

Based on the Previous Scene and Player Action, and taking into account the provided narrative arc guidance and context, generate the next scene description, options, item changes, log message, etc.
${topMatter ? `${topMatter}\n\n` : ''}## Context that may or may not be relevant for this specific turn:
${contextSection}

${descriptiveBlock}

---

## Previous Scene:
${currentScene}

## Player Actions:
${playerAction}${travelPlanSection}`;

  return prompt;
};
