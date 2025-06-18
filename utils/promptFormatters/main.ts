
/**
 * @file utils/promptFormatters/dialogue.ts
 * @description Prompt formatting helpers focused on characters and dialogue.
 */

import {
  Character,
  MapData,
  MapNode,
} from '../../types';
import { formatKnownPlacesForPrompt } from './map';
import { findTravelPath } from '../mapPathfinding';

/**
 * Formats a list of known characters for AI prompts.
 */
export const formatKnownCharactersForPrompt = (
  characters: Array<Character>,
  detailed = false
): string => {
  if (characters.length === 0) {
    return 'None specifically known in this theme yet.';
  }
  if (detailed) {
    const formatSingleCharacterDetailed = (c: Character): string => {
      let details = ` - ${c.id} - "${c.name}"`;
      if (c.aliases && c.aliases.length > 0) {
        details += ` (aka ${c.aliases.map(a => `"${a}"`).join(', ')})`;
      }
      details += ` (${c.presenceStatus}`;
      if (c.presenceStatus === 'companion' || c.presenceStatus === 'nearby') {
        details += `, ${c.preciseLocation ?? (c.presenceStatus === 'companion' ? 'with you' : 'nearby')}`;
      } else {
        details += `, Last Location: ${c.lastKnownLocation ?? 'Unknown'}`;
      }
      details += `), "${c.description}"`;
      return details;
    };
    return characters.map(formatSingleCharacterDetailed).join(';\n') + '.';
  }
  const companions = characters.filter(c => c.presenceStatus === 'companion');
  const nearbyCharacters = characters.filter(c => c.presenceStatus === 'nearby');
  const otherKnownCharacters = characters.filter(
    c => c.presenceStatus === 'distant' || c.presenceStatus === 'unknown'
  );

  const promptParts: Array<string> = [];
  if (companions.length > 0) {
    const companionStrings = companions.map(c => `${c.id} - "${c.name}"`);
    promptParts.push(`Companions traveling with the Player: ${companionStrings.join(', ')}.`);
  }
  if (nearbyCharacters.length > 0) {
    const nearbyStrings = nearbyCharacters.map(c => `${c.id} - "${c.name}"`);
    promptParts.push(`Characters Player can interact with (nearby): ${nearbyStrings.join(', ')}.`);
  }
  if (otherKnownCharacters.length > 0) {
    const otherStrings = otherKnownCharacters.map(c => `${c.id} - "${c.name}"`);
    promptParts.push(`Other known characters: ${otherStrings.join(', ')}.`);
  }
  return promptParts.length > 0 ? promptParts.join('\n') : 'None specifically known in this theme yet.';
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
 * Provides detailed context for places or characters mentioned in a string.
 */
export const formatDetailedContextForMentionedEntities = (
  allKnownMainMapNodes: Array<MapNode>,
  allKnownCharacters: Array<Character>,
  contextString: string,
  placesPrefixIfAny: string,
  charactersPrefixIfAny: string
): string => {
  const mentionedPlaces: Array<MapNode> = [];
  allKnownMainMapNodes.forEach(node => {
    const allNames = [node.placeName, ...(node.data.aliases ?? [])];
    const nameRegex = new RegExp(allNames.map(name => `\\b${name.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}\\b`).join('|'), 'i');
    if (nameRegex.test(contextString)) {
      mentionedPlaces.push(node);
    }
  });

  const mentionedCharacters: Array<Character> = [];
  allKnownCharacters.forEach(c => {
    const allNames = [c.name, ...(c.aliases ?? [])];
    const nameRegex = new RegExp(allNames.map(name => `\\b${name.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}\\b`).join('|'), 'i');
    if (nameRegex.test(contextString)) {
      mentionedCharacters.push(c);
    }
  });

  let detailedContext = '';
  const formattedMentionedPlaces = formatKnownPlacesForPrompt(mentionedPlaces, true);
  if (formattedMentionedPlaces && formattedMentionedPlaces !== 'None specifically known in this theme yet.') {
    detailedContext += `${placesPrefixIfAny}\n${formattedMentionedPlaces}\n`;
  }
  const formattedMentionedCharacters = formatKnownCharactersForPrompt(mentionedCharacters, true);
  if (
    formattedMentionedCharacters &&
    formattedMentionedCharacters !== 'None specifically known in this theme yet.'
  ) {
    detailedContext += `${charactersPrefixIfAny}\n${formattedMentionedCharacters}`;
  }
  return detailedContext.trimStart();
};

/**
 * Formats the initial prompt for starting a new game.
 */

/**
 * Formats the prompt for entering a completely new theme after a shift.
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
  const path = findTravelPath(mapData, currentNodeId, destinationNodeId);
  if (!path || path.length < 3) return null;
  const destination = mapData.nodes.find(n => n.id === destinationNodeId);
  const destName = destination?.placeName ?? destinationNodeId;
  const destParentId = destination?.data.parentNodeId;
  const destParentName =
    destParentId && destParentId !== 'Universe'
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

