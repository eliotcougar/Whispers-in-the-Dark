import { MapNode, MapData, Character, Item, FullGameState } from '../types';
import { findTravelPath } from './mapPathfinding';

  id: string | undefined | null,
  name: string | undefined | null,
  getAll = false,
  if (!id && !name) return getAll ? [] : undefined;
  const idMatch = id ? nodes.find(n => n.id === id) : undefined;
  const searchName = name || id;
  const lower = searchName ? searchName.toLowerCase() : '';
  const nameMatches = lower
    ? nodes.filter(n => n.placeName.toLowerCase() === lower)
    : [];
    searchName && n.data.aliases && n.data.aliases.some(a => a.toLowerCase() === lower)
  id: string | undefined | null,
  name: string | undefined | null,
  getAll = false,
  if (!id && !name) return getAll ? [] : undefined;
  const idMatch = id ? characters.find(c => c.id === id) : undefined;
  const searchName = name || id;
  const lower = searchName ? searchName.toLowerCase() : '';
  const nameMatches = lower
    ? characters.filter(c => c.name.toLowerCase() === lower)
    : [];
    searchName && c.aliases && c.aliases.some(a => a.toLowerCase() === lower)
  id: string | undefined | null,
  name: string | undefined | null,
  if (!id && !name) return getAll ? [] : undefined;
  const idMatch = id ? items.find(i => i.id === id) : undefined;

  const searchName = name || id;
  const lower = searchName ? searchName.toLowerCase() : '';
  const nameMatches = lower ? items.filter(i => i.name.toLowerCase() === lower) : [];
  
  const prefix = id.split('_')[0];
  switch (prefix) {
    case 'node':
      return state.mapData.nodes.find(n => n.id === id);
    case 'char':
      return state.allCharacters.find(c => c.id === id);
    case 'item':
      return state.inventory.find(i => i.id === id);
    default:
      return (
        state.mapData.nodes.find(n => n.id === id) ||
        state.allCharacters.find(c => c.id === id) ||
        state.inventory.find(i => i.id === id)
      );

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

export const findItemByIdentifier = (
  identifier: string | undefined | null,
  items: Item[],
  getAll = false,
): Item | Item[] | undefined => {
  if (!identifier) return getAll ? [] : undefined;

  const idMatch = items.find(i => i.id === identifier);
  if (!getAll && idMatch) return idMatch;

  const lower = identifier.toLowerCase();
  const nameMatches = items.filter(i => i.name.toLowerCase() === lower);

  if (getAll) {
    const results: Item[] = [];
    if (idMatch) results.push(idMatch);
    results.push(...nameMatches);
    return results;
  }

  if (nameMatches.length > 0) return nameMatches[0];
  return idMatch;
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

