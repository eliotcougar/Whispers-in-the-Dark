export const generateUniqueId = (
  prefix = 'id_',
  suffix?: string,
): string => {
  const unique =
    suffix || `${Date.now() % 10000}_${Math.random().toString(36).substring(2,6)}`;
  return `${prefix}${unique}`;
};

import { MapNode, MapData, Character } from '../types';
import { findTravelPath } from './mapPathfinding';

/** Helper to calculate the hop distance between two nodes using pathfinding. */
const getHopDistance = (
  mapData: MapData | undefined,
  fromId: string | null | undefined,
  toId: string
): number => {
  if (!mapData || !fromId) return Infinity;
  const path = findTravelPath(mapData, fromId, toId);
  if (!path) return Infinity;
  return path.filter(p => p.step === 'edge').length;
};

export const findMapNodeByIdentifier = (
  identifier: string | undefined | null,
  nodes: MapNode[],
  mapData?: MapData,
  currentNodeId?: string | null,
  getAll = false
): MapNode | MapNode[] | undefined => {
  if (!identifier) return getAll ? [] : undefined;

  const idMatch = nodes.find(n => n.id === identifier);
  if (!getAll && idMatch) return idMatch;

  const lower = identifier.toLowerCase();
  const nameMatches = nodes.filter(n => n.placeName.toLowerCase() === lower);
  const aliasMatches = nodes.filter(n =>
    n.data.aliases && n.data.aliases.some(a => a.toLowerCase() === lower)
  ).filter(n => !nameMatches.includes(n));

  const sortByDistance = (arr: MapNode[]) => {
    if (!mapData || !currentNodeId) return arr;
    return [...arr].sort(
      (a, b) => getHopDistance(mapData, currentNodeId, a.id) - getHopDistance(mapData, currentNodeId, b.id)
    );
  };

  const sortedNames = sortByDistance(nameMatches);
  const sortedAliases = sortByDistance(aliasMatches);

  if (getAll) {
    const results: MapNode[] = [];
    if (idMatch) results.push(idMatch);
    results.push(...sortedNames);
    results.push(...sortedAliases);
    return results;
  }

  if (sortedNames.length > 0) return sortedNames[0];
  if (sortedAliases.length > 0) return sortedAliases[0];
  return idMatch; // might be undefined
};

export const findCharacterByIdentifier = (
  identifier: string | undefined | null,
  characters: Character[],
  getAll = false
): Character | Character[] | undefined => {
  if (!identifier) return getAll ? [] : undefined;

  const idMatch = characters.find(c => c.id === identifier);
  if (!getAll && idMatch) return idMatch;

  const lower = identifier.toLowerCase();
  const nameMatches = characters.filter(c => c.name.toLowerCase() === lower);
  const aliasMatches = characters.filter(c =>
    c.aliases && c.aliases.some(a => a.toLowerCase() === lower)
  ).filter(c => !nameMatches.includes(c));

  if (getAll) {
    const results: Character[] = [];
    if (idMatch) results.push(idMatch);
    results.push(...nameMatches);
    results.push(...aliasMatches);
    return results;
  }

  if (nameMatches.length > 0) return nameMatches[0];
  if (aliasMatches.length > 0) return aliasMatches[0];
  return idMatch;
};

export const getEntityById = (
  id: string,
  mapData: MapData,
  characters: Character[]
): MapNode | Character | undefined => {
  const node = mapData.nodes.find(n => n.id === id);
  if (node) return node;
  return characters.find(c => c.id === id);
};

export const extractRandomSuffix = (id: string): string | null => {
  const match = id.match(/_(\d+_[a-z0-9]{4})$/i);
  return match ? match[1] : null;
};

export const buildNodeId = (
  placeName: string,
  suffix?: string,
): string => {
  const base = placeName.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
  return generateUniqueId(`node_${base}_`, suffix);
};

export const buildEdgeId = (
  sourceNodeId: string,
  targetNodeId: string,
  suffix?: string,
): string => {
  return generateUniqueId(`${sourceNodeId}_to_${targetNodeId}_`, suffix);
};

export const buildCharacterId = (
  charName: string,
  suffix?: string,
): string => {
  const base = charName.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
  return generateUniqueId(`char_${base}_`, suffix);
};

export const buildItemId = (
  itemName: string,
  suffix?: string,
): string => {
  const base = itemName.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
  return generateUniqueId(`item_${base}_`, suffix);
};

