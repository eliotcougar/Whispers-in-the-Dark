import { MapNodeData, MapEdgeData } from '../types';

export const NODE_STATUS_SYNONYMS: Record<string, MapNodeData['status']> = {
  unknown: 'undiscovered',
  unexplored: 'undiscovered',
  found: 'discovered',
  revealed: 'discovered',
  rumoured: 'rumored',
  speculation: 'rumored',
  whispered: 'rumored',
  goal: 'quest_target',
  objective: 'quest_target'
};

export const NODE_TYPE_SYNONYMS: Record<string, NonNullable<MapNodeData['nodeType']>> = {
  area: 'location',
  zone: 'location',
  province: 'region',
  territory: 'region',
  town: 'settlement',
  village: 'settlement',
  settlement: 'settlement',
  district: 'district',
  neighborhood: 'district',
  quarter: 'district',
  ward: 'district',
  street: 'district',
  avenue: 'district',
  structure: 'exterior',
  edifice: 'exterior',
  building: 'exterior',
  tower: 'exterior',
  house: 'exterior',
  fort: 'exterior',
  castle: 'exterior',
  spaceship: 'exterior',
  starship: 'exterior',
  spacecraft: 'exterior',
  hull: 'exterior',
  hangar: 'exterior',
  interior: 'interior',
  inside: 'interior',
  deck: 'interior',
  module: 'interior',
  outside: 'exterior',
  courtyard: 'exterior',
  chamber: 'room',
  hall: 'room',
  bridge: 'room',
  cockpit: 'room',
  cabin: 'room',
  compartment: 'room',
  landmark: 'feature',
  spot: 'feature',
  forest: 'region',
  woods: 'region',
  jungle: 'region',
  grove: 'region',
  mountain: 'region',
  mountains: 'region',
  range: 'region',
  peak: 'region',
  valley: 'region',
  desert: 'region',
  swamp: 'region',
  marsh: 'region',
  marshland: 'region',
  bog: 'region',
  fen: 'region',
  sea: 'region',
  ocean: 'region',
  'open sea': 'region',
  'open ocean': 'region',
  coast: 'region',
  coastline: 'region',
  shore: 'region',
  island: 'region',
  archipelago: 'region',
  peninsula: 'region',
  plateau: 'region',
  hill: 'region',
  hills: 'region',
  plains: 'region',
  lake: 'region',
  bay: 'region',
  lagoon: 'region',
  fjord: 'region',
  river: 'feature',
  stream: 'feature',
  creek: 'feature',
  waterfall: 'feature',
  beach: 'feature',
  cliff: 'feature',
  canyon: 'feature',
  gorge: 'feature',
  ravine: 'feature',
  reef: 'feature',
  cave: 'feature',
  cavern: 'feature',
  grotto: 'feature',
  console: 'feature',
  terminal: 'feature',
  airlock: 'feature',
  hatch: 'feature'
};

export const EDGE_TYPE_SYNONYMS: Record<string, NonNullable<MapEdgeData['type']>> = {
  trail: 'path',
  track: 'path',
  walkway: 'path',
  footpath: 'path',
  street: 'road',
  roadway: 'road',
  highway: 'road',
  lane: 'road',
  avenue: 'road',
  boulevard: 'road',
  seaway: 'sea route',
  'sea path': 'sea route',
  'ocean route': 'sea route',
  'space lane': 'sea route',
  'space route': 'sea route',
  'flight path': 'road',
  portal: 'teleporter',
  warp: 'teleporter',
  'warp gate': 'teleporter',
  'jump gate': 'teleporter',
  stargate: 'teleporter',
  gate: 'door',
  gateway: 'door',
  airlock: 'door',
  hatch: 'door',
  bulkhead: 'door',
  'secret passageway': 'secret_passage',
  hidden_passage: 'secret_passage',
  'maintenance tunnel': 'secret_passage',
  tunnel: 'secret_passage',
  ford: 'river_crossing',
  ferry: 'river_crossing',
  bridge: 'temporary_bridge',
  'makeshift_bridge': 'temporary_bridge',
  'temporary crossing': 'temporary_bridge',
  'docking tube': 'temporary_bridge',
  'boarding tube': 'temporary_bridge',
  maglev: 'road',
  tram: 'road',
  grapple: 'boarding_hook',
  'grappling_hook': 'boarding_hook',
  shortcut: 'shortcut',
  bypass: 'shortcut',
  "secret tunnel": 'shortcut'
};

export const EDGE_STATUS_SYNONYMS: Record<string, NonNullable<MapEdgeData['status']>> = {
  opened: 'open',
  active: 'open',
  functional: 'open',
  discovered: 'accessible',
  usable: 'accessible',
  available: 'accessible',
  undiscovered: 'accessible',
  shut: 'closed',
  sealed: 'locked',
  barred: 'locked',
  obstructed: 'blocked',
  barricaded: 'blocked',
  concealed: 'hidden',
  secret: 'hidden',
  rumoured: 'rumored',
  legendary: 'rumored',
  'one way': 'one_way',
  'one-way': 'one_way',
  single_direction: 'one_way',
  fallen: 'collapsed',
  deactivated: 'inactive'
};

function escapeForRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Builds a list of heuristic regular expressions mapping possible phrases to a
 * canonical value. Used for quick type inference before invoking the AI.
 */
export function createHeuristicRegexes<T extends string>(
  synonymMap: Record<string, T>,
  canonicalValues: readonly T[]
): [RegExp, T][] {
  const phrasesByValue: Record<string, string[]> = {};
  for (const val of canonicalValues) {
    phrasesByValue[val] = [escapeForRegExp(val)];
  }
  for (const [phrase, canonical] of Object.entries(synonymMap)) {
    if (!phrasesByValue[canonical]) {
      phrasesByValue[canonical] = [escapeForRegExp(canonical)];
    }
    phrasesByValue[canonical].push(escapeForRegExp(phrase));
  }
  const heuristics: [RegExp, T][] = [];
  for (const [canonical, phrases] of Object.entries(phrasesByValue)) {
    const pattern = phrases.map(p => p.replace(/\s+/g, '\\s+')).join('|');
    heuristics.push([new RegExp(pattern, 'i'), canonical as T]);
  }
  return heuristics;
}
