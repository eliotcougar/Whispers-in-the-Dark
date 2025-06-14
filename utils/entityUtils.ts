import { MapNode, MapData, Character, Item, FullGameState } from '../types';
import { findTravelPath } from './mapPathfinding';

export const generateUniqueId = (base: string): string => {
  const sanitized = base.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
  // ensure we never have more than one underscore before the random suffix
  const trimmed = sanitized.replace(/_+$/, '');
  const unique = `${Math.random().toString(36).substring(2,6)}`;
  return `${trimmed}_${unique}`;
};

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

  const sanitize = (s: string) =>
    s
      .toLowerCase()
      .replace(/[.,!?;:"(){}[\]'’]/g, '')
      .trim();

  const normalized = sanitize(identifier);
  const nameMatches = nodes.filter(n => sanitize(n.placeName) === normalized);
  const aliasMatches = nodes
    .filter(
      n =>
        n.data.aliases &&
        n.data.aliases.some(a => sanitize(a) === normalized)
    )
    .filter(n => !nameMatches.includes(n));

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

  const lowerId = identifier.toLowerCase();
  let partialMatch = nodes.find(n => n.id.toLowerCase().includes(lowerId));

  const idPattern = /^(.*)_([a-zA-Z0-9]{4})$/;
  let base: string | null = null;
  if (!partialMatch) {
    const m = identifier.match(idPattern);
    if (m) {
      const baseStr = m[1];
      base = baseStr;
      partialMatch = nodes.find(n => n.id.toLowerCase().includes(baseStr.toLowerCase()));
    }
  }

  if (partialMatch) return partialMatch;

  const normalizedBase = sanitize((base ?? identifier).replace(/_/g, ' '));
  const byName = nodes.find(n => sanitize(n.placeName) === normalizedBase);
  if (byName) return byName;
  const byAlias = nodes.find(
    n => n.data.aliases && n.data.aliases.some(a => sanitize(a) === normalizedBase),
  );
  if (byAlias) return byAlias;

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

export const findItemByIdentifier = (
  identifiers: (string | null | undefined)[],
  items: Item[],
  getAll = false,
  ignoreCase = false,
): Item | Item[] | null => {
  if (!Array.isArray(identifiers) || identifiers.length === 0) {
    return getAll ? [] : null;
  }

  const [id, name] = identifiers;
  const results: Item[] = [];
  const nameToCheck = typeof name === 'string' ? name : undefined;
  const cmp = (a: string, b: string) =>
    ignoreCase ? a.toLowerCase() === b.toLowerCase() : a === b;

  if (id) {
    const idMatch = items.find(i => i.id === id);
    if (idMatch) {
      if (nameToCheck && !cmp(idMatch.name, nameToCheck)) {
        console.warn(
          `findItemByIdentifier: Provided name "${nameToCheck}" does not match item name "${idMatch.name}" for id "${id}".`,
        );
      }
      if (!getAll) return idMatch;
      results.push(idMatch);
    }
  }

  if (!id || getAll) {
    if (nameToCheck) {
      const nameMatches = items.filter(i => cmp(i.name, nameToCheck) && (!id || i.id !== id));
      if (getAll) {
        results.push(...nameMatches);
      } else if (nameMatches.length > 0) {
        return nameMatches[0];
      }
    }
  }

  if (!getAll && ignoreCase && nameToCheck) {
    const normalized = nameToCheck.toLowerCase().replace(/\s+/g, ' ').trim();
    const stripped = normalized.replace(/\([^)]*\)/g, '').trim();
    const fuzzy = items.find(i => {
      const n = i.name.toLowerCase().replace(/\s+/g, ' ').trim();
      const ns = n.replace(/\([^)]*\)/g, '').trim();
      return n === normalized || ns === stripped;
    });
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
): MapNode | Character | Item | undefined => {
  if (!id) return undefined;

  if (id.startsWith('node_')) {
    return state.mapData.nodes.find(n => n.id === id);
  }
  if (id.startsWith('char_')) {
    return state.allCharacters.find(c => c.id === id);
  }
  if (id.startsWith('item_')) {
    return state.inventory.find(i => i.id === id);
  }

  return (
    state.mapData.nodes.find(n => n.id === id) ||
    state.allCharacters.find(c => c.id === id) ||
    state.inventory.find(i => i.id === id)
  );
};

export const extractRandomSuffix = (id: string): string | null => {
  const match = id.match(/([a-z0-9]{4})$/i);
  return match ? match[1] : null;
};

export const buildNodeId = (placeName: string): string => {
  return generateUniqueId(`node_${placeName}`);
};

export const buildEdgeId = (
  sourceNodeId: string,
  targetNodeId: string,
): string => {
  return generateUniqueId(`${sourceNodeId}_to_${targetNodeId}`);
};

export const buildCharacterId = (charName: string): string => {
  return generateUniqueId(`char_${charName}`);
};

export const buildItemId = (itemName: string): string => {
  return generateUniqueId(`item_${itemName}`);
};

