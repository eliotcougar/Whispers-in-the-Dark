import { MapNode, MapData, NPC, Item, FullGameState } from '../types';
import { findTravelPath, buildTravelAdjacency, TravelAdjacency } from './mapPathfinding';

export const generateUniqueId = (base: string): string => {
  // Replace spaces and underscores with hyphen; remove non-alphanumeric/hyphen
  const sanitized = base.replace(/[\s_]+/g, '-').replace(/[^a-zA-Z0-9-]/g, '');
  // ensure no trailing hyphens
  const trimmed = sanitized.replace(/-+$/, '');
  const unique = Math.random().toString(36).substring(2,6);
  return `${trimmed}-${unique}`;
};

export const stripBracketText = (name: string): string =>
  name
    .replace(/\[[^\]]*\]|\([^)]*\)/g, '')
    .replace(/\s+/g, ' ')
    .trim();

/** Helper to calculate the hop distance between two nodes using pathfinding. */
const getHopDistance = (
  mapData: MapData | undefined,
  fromId: string | null | undefined,
  toId: string,
  adj?: TravelAdjacency
): number => {
  if (!mapData || !fromId) return Infinity;
  const path = findTravelPath(mapData, fromId, toId, adj);
  if (!path) return Infinity;
  return path.filter(p => p.step === 'edge').length;
};

export const findMapNodeByIdentifier = (
  identifier: string | undefined | null,
  nodes: Array<MapNode>,
  mapData?: MapData,
  currentNodeId?: string | null,
  getAll = false
): MapNode | Array<MapNode> | undefined => {
  if (!identifier) return getAll ? [] : undefined;

  const idMatch = nodes.find(node => node.id === identifier);
  if (!getAll && idMatch) return idMatch;

  const sanitize = (s: string) =>
    s
      .toLowerCase()
      .replace(/[.,!?;:"(){}[\]'’]/g, '')
      .trim();

  const normalized = sanitize(identifier);
  const nameMatches = nodes.filter(node => sanitize(node.placeName) === normalized);
  const aliasMatches = nodes
    .filter(
      n =>
        n.data.aliases?.some(a => sanitize(a) === normalized)
    )
    .filter(node => !nameMatches.includes(node));

  const adjacency: TravelAdjacency | undefined = mapData ? buildTravelAdjacency(mapData) : undefined;
  const sortByDistance = (arr: Array<MapNode>) => {
    if (!mapData || !currentNodeId) return arr;
    return [...arr].sort(
      (a, b) =>
        getHopDistance(mapData, currentNodeId, a.id, adjacency) -
        getHopDistance(mapData, currentNodeId, b.id, adjacency)
    );
  };

  const sortedNames = sortByDistance(nameMatches);
  const sortedAliases = sortByDistance(aliasMatches);

  if (getAll) {
    const results: Array<MapNode> = [];
    if (idMatch) results.push(idMatch);
    results.push(...sortedNames);
    results.push(...sortedAliases);
    return results;
  }

  if (sortedNames.length > 0) return sortedNames[0];
  if (sortedAliases.length > 0) return sortedAliases[0];

  const lowerId = identifier.toLowerCase();
  let partialMatch = nodes.find(node => node.id.toLowerCase().includes(lowerId));

  const idPattern = /^(.*)-([a-zA-Z0-9]{4})$/;
  let base: string | null = null;
  if (!partialMatch) {
    const m = idPattern.exec(identifier);
    if (m) {
      const baseStr = m[1];
      base = baseStr;
      const baseCandidates = nodes.filter(n =>
        n.id.toLowerCase().startsWith(`${baseStr.toLowerCase()}-`)
      );
      if (baseCandidates.length === 1) {
        partialMatch = baseCandidates[0];
      }
    }
  }

  if (partialMatch) return partialMatch;

  const normalizedBase = sanitize((base ?? identifier).replace(/-/g, ' '));
  const byName = nodes.find(node => sanitize(node.placeName) === normalizedBase);
  if (byName) return byName;
  const byAlias = nodes.find(
    n => n.data.aliases?.some(a => sanitize(a) === normalizedBase),
  );
  if (byAlias) return byAlias;

  return idMatch; // might be undefined
};

export const findNPCByIdentifier = (
  identifier: string | undefined | null,
  npcs: Array<NPC>,
  getAll = false
): NPC | Array<NPC> | undefined => {
  if (!identifier) return getAll ? [] : undefined;

  const idMatch = npcs.find(npc => npc.id === identifier);
  if (!getAll && idMatch) return idMatch;

  const lower = identifier.toLowerCase();
  const nameMatches = npcs.filter(npc => npc.name.toLowerCase() === lower);
  const aliasMatches = npcs.filter(npc =>
    npc.aliases?.some(a => a.toLowerCase() === lower)
  ).filter(npc => !nameMatches.includes(npc));

  if (getAll) {
    const results: Array<NPC> = [];
    if (idMatch) results.push(idMatch);
    results.push(...nameMatches);
    results.push(...aliasMatches);
    return results;
  }

  if (nameMatches.length > 0) return nameMatches[0];
  if (aliasMatches.length > 0) return aliasMatches[0];
  return idMatch;
};

export const findItemByIdentifier = (
  identifiers: Array<string | null | undefined>,
  items: Array<Item>,
  getAll = false,
  ignoreCase = false,
): Item | Array<Item> | null => {
  if (!Array.isArray(identifiers) || identifiers.length === 0) {
    return getAll ? [] : null;
  }

  const [id, name] = identifiers;
  const results: Array<Item> = [];
  const nameToCheck = typeof name === 'string' ? name : undefined;
  const cmp = (a: string, b: string) => {
    const aCore = stripBracketText(a);
    const bCore = stripBracketText(b);
    return ignoreCase
      ? aCore.toLowerCase() === bCore.toLowerCase()
      : aCore === bCore;
  };

  if (id) {
    const idMatch = items.find(item => item.id === id);
    if (idMatch) {
      if (nameToCheck && !cmp(idMatch.name, nameToCheck)) {
        console.warn(
          `findItemByIdentifier: Provided name "${nameToCheck}" does not match item name "${idMatch.name}" for <ID: ${id}>.`,
        );
      }
      if (!getAll) return idMatch;
      results.push(idMatch);
    }
  }

  if (!id || getAll) {
    if (nameToCheck) {
      const nameMatches = items.filter(item => cmp(item.name, nameToCheck) && (!id || item.id !== id));
      if (getAll) {
        results.push(...nameMatches);
      } else if (nameMatches.length > 0) {
        return nameMatches[0];
      }
    }
  }

  if (!getAll && ignoreCase && nameToCheck) {
    const normalized = stripBracketText(nameToCheck).toLowerCase();
    const fuzzy = items.find(i =>
      stripBracketText(i.name).toLowerCase() === normalized
    );
    if (fuzzy) return fuzzy;
  }

  // Aliases placeholder - none exist currently
  if (getAll) {
    return results;
  }
  return null;
};

export const getEntityById = (
  id: string,
  state: FullGameState,
): MapNode | NPC | Item | undefined => {
  if (!id) return undefined;

  if (id.startsWith('node-')) {
    return state.mapData.nodes.find(node => node.id === id);
  }
  if (id.startsWith('npc-')) {
    return state.allNPCs.find(npc => npc.id === id);
  }
  if (id.startsWith('item-')) {
    return state.inventory.find(item => item.id === id);
  }

  return (
    state.mapData.nodes.find(node => node.id === id) ??
    state.allNPCs.find(npc => npc.id === id) ??
    state.inventory.find(item => item.id === id)
  );
};

export const extractRandomSuffix = (id: string): string | null => {
  const match = /([a-z0-9]{4})$/i.exec(id);
  return match ? match[1] : null;
};

export const buildNodeId = (placeName: string): string => {
  return generateUniqueId(`node-${placeName}`);
};

export const buildEdgeId = (
  sourceNodeId: string,
  targetNodeId: string,
): string => {
  return generateUniqueId(`${sourceNodeId}-to-${targetNodeId}`);
};

export const buildNPCId = (npcName: string): string => {
  return generateUniqueId(`npc-${npcName}`);
};

export const buildItemId = (itemName: string): string => {
  const core = stripBracketText(itemName);
  return generateUniqueId(`item-${core}`);
};

