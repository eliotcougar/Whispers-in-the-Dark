
/**
 * @file utils/promptFormatters/dialogue.ts
 * @description Prompt formatting helpers focused on NPCs and dialogue.
 */

import {
  NPC,
  MapData,
  MapNode,
  WorldFacts,
  HeroSheet,
  HeroBackstory,
  StoryArc,
} from '../../types';
import { isStoryArcValid } from '../storyArcUtils';
import { formatKnownPlacesForPrompt } from './map';
import { findTravelPath, buildTravelAdjacency } from '../mapPathfinding';
import { ROOT_MAP_NODE_ID } from '../../constants';

const STRING_TEMPLATE_TOKEN = /\{([a-zA-Z0-9_]+)\}/g;

const stringifyNpcValue = (npc: NPC, key: keyof NPC): string => {
  const value = npc[key];
  if (key === 'knowsPlayerAs') {
    if (Array.isArray(value) && value.length === 0) {
      return 'ATTENTION! NPC does not know the player\'s name.';
    }
  }
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return 'None';
    }
    return value
      .map(entry => (typeof entry === 'string' ? entry : JSON.stringify(entry)))
      .join(', ');
  }
  if (value === null || value === undefined) {
    if (key === 'aliases' || key === 'dialogueSummaries') {
      return 'None';
    }
    // NPC data frequently uses null to mean "not tracked"; surface that as Unknown in prompts.
    return 'Unknown';
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return typeof value === 'string' ? value : String(value);
};

/**
 * Formats NPC information using a caller-provided template.
 * Callers control layout entirely: include separators/newlines in the template, prefix, or suffix.
 * Each template token (e.g. `{name}`) maps directly to a property on the NPC type.
 */
export const npcsToString = (
  npcs: NPC | Array<NPC>,
  template: string,
  prefix = '',
  suffix = '',
): string => {
  const npcList = Array.isArray(npcs) ? npcs : [npcs];
  if (npcList.length === 0) {
    return '';
  }

  const renderForNpc = (npc: NPC): string => {
    const rendered = template.replace(STRING_TEMPLATE_TOKEN, (_match, token) => {
      if (!Object.prototype.hasOwnProperty.call(npc, token)) {
        return '';
      }
      return stringifyNpcValue(npc, token as keyof NPC);
    });
    return rendered;
  };

  const lines = npcList
    .map(renderForNpc)
    .filter(line => line.trim().length > 0);

  if (lines.length === 0) {
    return '';
  }

  const parts: Array<string> = [];
  if (prefix) parts.push(prefix);
  parts.push(lines.join(''));
  if (suffix) parts.push(suffix);

  return parts.join('').trimEnd();
};



/**
 * Formats recent log events for inclusion in prompts.
 */
export const formatRecentEventsForPrompt = (logMessages: Array<string>): string => {
  if (logMessages.length === 0) {
    return '';
  }
  return ' - ' + logMessages.join('\n - ');
};

/**
 * Provides detailed context for places or NPCs mentioned in a string.
 */
export const formatDetailedContextForMentionedEntities = (
  allKnownMainMapNodes: Array<MapNode>,
  allknownNPCs: Array<NPC>,
  contextString: string,
  placesPrefixIfAny: string,
  npcsPrefixIfAny: string
): string => {
  const mentionedPlaces: Array<MapNode> = [];
  allKnownMainMapNodes.forEach(node => {
    const allNames = [node.placeName, ...(node.data.aliases ?? [])];
    const nameRegex = new RegExp(allNames.map(name => `\\b${name.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}\\b`).join('|'), 'i');
    if (nameRegex.test(contextString)) {
      mentionedPlaces.push(node);
    }
  });

  const mentionedNPCs: Array<NPC> = [];
  allknownNPCs.forEach(npc => {
    const allNames = [npc.name, ...(npc.aliases ?? [])];
    const nameRegex = new RegExp(allNames.map(name => `\\b${name.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}\\b`).join('|'), 'i');
    if (nameRegex.test(contextString)) {
      mentionedNPCs.push(npc);
    }
  });

  let detailedContext = '';
  const formattedMentionedPlaces = formatKnownPlacesForPrompt(mentionedPlaces, true);
  if (formattedMentionedPlaces && formattedMentionedPlaces !== 'None specifically known in this theme yet.') {
    detailedContext += `${placesPrefixIfAny}\n${formattedMentionedPlaces}\n`;
  }
  const mentionedNPCsSection = npcsToString(
    mentionedNPCs,
    '<ID: {id}> - {name} — {description} (status: {presenceStatus}, lastKnownLocation: {lastKnownLocation}, preciseLocation: {preciseLocation})\n',
    `${npcsPrefixIfAny}\n`,
  );
  if (mentionedNPCsSection) {
    detailedContext += mentionedNPCsSection;
  }
  return detailedContext.trimStart();
};

/**
 * Formats the initial prompt for starting a new game.
 */

/**
 * Creates a short travel plan line describing the next step toward the destination.
 */
export const formatTravelPlanLine = (
  mapData: MapData,
  currentNodeId: string | null,
  destinationNodeId: string | null
): string | null => {
  if (!currentNodeId || !destinationNodeId || currentNodeId === destinationNodeId) return null;
  const adj = buildTravelAdjacency(mapData);
  const path = findTravelPath(mapData, currentNodeId, destinationNodeId, adj);
  if (!path || path.length < 3) return null;
  const destination = mapData.nodes.find(n => n.id === destinationNodeId);
  const destName = destination?.placeName ?? destinationNodeId;
  const destParentId = destination?.data.parentNodeId;
  const destParentName =
    destParentId && destParentId !== ROOT_MAP_NODE_ID
      ? mapData.nodes.find(n => n.id === destParentId)?.placeName ?? destParentId
      : null;
  const destDisplay = destParentName ? `${destName} in ${destParentName}` : destName;
  const destRumored = destination?.data.status === 'rumored';
  const firstEdge = path[1];
  const nextNodeStep = path[2];
  const furtherNodeStep = path.length > 4 ? path[4] : undefined;
  if (firstEdge.step !== 'edge' || nextNodeStep.step !== 'node') return null;
  const nextNode = mapData.nodes.find(n => n.id === nextNodeStep.id);
  const nextName = nextNode?.placeName ?? nextNodeStep.id;
  const furtherNode =
    furtherNodeStep && furtherNodeStep.step === 'node'
      ? mapData.nodes.find(n => n.id === furtherNodeStep.id)
      : null;
  const furtherName = furtherNodeStep
    ? furtherNode?.placeName ?? furtherNodeStep.id
    : '';
  const nextRumored = nextNode?.data.status === 'rumored';
  const furtherRumored = furtherNode?.data.status === 'rumored';

  let line = destRumored
    ? `Player wants to reach a rumored place - ${destDisplay}.`
    : `Player wants to travel to ${destDisplay}.`;

  if (firstEdge.id.startsWith('hierarchy:')) {
    const [from, to] = firstEdge.id.split(':')[1].split('->');
    const fromName = mapData.nodes.find(n => n.id === from)?.placeName ?? from;
    const toName = mapData.nodes.find(n => n.id === to)?.placeName ?? to;
    line += ` The journey leads towards ${toName} in the general area of ${fromName}, and then towards ${furtherRumored ? 'a rumored place - ' + furtherName : furtherName}.`;
  } else {
    const edge = mapData.edges.find(e => e.id === firstEdge.id);
    const edgeStatus = edge?.data.status ?? 'open';
    const edgeName = edge?.data.description ?? edge?.data.type ?? 'path';
    if (edgeStatus === 'rumored') {
      line += ` There is a rumor a path exists from here to ${nextRumored ? 'a rumored place - ' + nextName : nextName}.`;
    } else {
      line += ` The path leads through ${edgeName} towards ${nextRumored ? 'a rumored place - ' + nextName : nextName}.`;
    }
  }
  return line;
};



/**
 * Formats world facts into a multiline string for prompts.
 */
export const formatWorldFactsForPrompt = (worldFacts: WorldFacts): string => {
  const lines = [
    `Geography: ${worldFacts.geography}`,
    `Climate: ${worldFacts.climate}`,
    `Technology Level: ${worldFacts.technologyLevel}`,
    `Supernatural Elements: ${worldFacts.supernaturalElements}`,
    `Major Factions: ${worldFacts.majorFactions.join(', ')}`,
    `Key Resources: ${worldFacts.keyResources.join(', ')}`,
    `Cultural Notes: ${worldFacts.culturalNotes.join(', ')}`,
    `Notable Locations: ${worldFacts.notableLocations.join(', ')}`,
  ];
  return lines.join('\n');
};

/**
 * Formats a hero sheet into a short single paragraph.
 */
export const formatHeroSheetForPrompt = (
  hero: HeroSheet,
  includeStartingItems = false,
): string => {
  const lines = [
    `Player Character Name: ${hero.name} (short: ${hero.heroShortName})`,
    `Gender: ${hero.gender}.`,
    `Occupation: ${hero.occupation}.`,
    `Traits: ${hero.traits.join(', ')}.`,
  ];
  if (includeStartingItems && hero.startingItems.length > 0) {
    lines.push(`Starting items: ${hero.startingItems.join(', ')}.`);
  }
  return lines.join('\n');
};

/**
 * Formats a hero backstory as a multiline string.
 */
export const formatHeroBackstoryForPrompt = (
  backstory: HeroBackstory,
): string =>
  [
    `5 years ago: ${backstory.fiveYearsAgo}`,
    `1 year ago: ${backstory.oneYearAgo}`,
    `6 months ago: ${backstory.sixMonthsAgo}`,
    `1 month ago: ${backstory.oneMonthAgo}`,
    `1 week ago: ${backstory.oneWeekAgo}`,
    `Yesterday: ${backstory.yesterday}`,
    `Now: ${backstory.now}`,
  ].join('\n');

export const formatStoryArcContext = (arc: StoryArc): string => {
  if (!isStoryArcValid(arc)) return '';
  const act = arc.acts[arc.currentAct - 1];
  const side = act.sideObjectives.join(', ');
  return [
    `Arc Title: ${arc.title}`,
    `Overview: ${arc.overview}`,
    `Current Act ${String(act.actNumber)}: ${act.title}`,
    `Act Description: ${act.description}`,
    `Main Objective: ${act.mainObjective}`,
    `Side Objectives: ${side}`,
    `Success Condition: ${act.successCondition}`,
  ].join('\n');
};

