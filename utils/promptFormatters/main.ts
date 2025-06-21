
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
import { findTravelPath, buildTravelAdjacency } from '../mapPathfinding';

/**
 * Formats a list of known characters for AI prompts.
 */
export const charactersToString = (
  characters: Character | Array<Character>,
  prefix = '',
  addAliases = true,
  addStatus = true,
  addDescription = true,
  singleLine = false,
): string => {
  const charList = Array.isArray(characters) ? characters : [characters];
  if (charList.length === 0) {
    return '';
  }
  const delimiter = singleLine ? '; ' : ';\n';

  const result = charList
    .map(c => {
      let str = `${prefix}${c.id} - "${c.name}"`;
      if (addAliases && c.aliases && c.aliases.length > 0) {
        str += ` (aka ${c.aliases.map(a => `"${a}"`).join(', ')})`;
      }
      if (addStatus) {
        str += ` (${c.presenceStatus}`;
        if (c.presenceStatus === 'companion' || c.presenceStatus === 'nearby') {
          str += `, ${c.preciseLocation ?? (c.presenceStatus === 'companion' ? 'with you' : 'nearby')}`;
        } else {
          str += `, Last Location: ${c.lastKnownLocation ?? 'Unknown'}`;
        }
        str += ')';
      }
      if (addDescription) {
        str += `, "${c.description}"`;
      }
      return str;
    })
    .join(delimiter);

  return result + '.';
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
  const mentionedCharactersString = charactersToString(mentionedCharacters, ' - ');
  if (mentionedCharactersString) {
    detailedContext += `${charactersPrefixIfAny}\n${mentionedCharactersString}`;
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
  const adj = buildTravelAdjacency(mapData);
  const path = findTravelPath(mapData, currentNodeId, destinationNodeId, adj);
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

