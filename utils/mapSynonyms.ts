import { MapNodeData, MapEdgeData } from '../types';
import nodeSynonymsRaw from '../resources/mapNodeSynonyms';
import edgeSynonymsRaw from '../resources/mapEdgeSynonyms';

const nodeSynonyms = nodeSynonymsRaw as {
  status: Record<string, MapNodeData['status']>;
  type: Record<string, NonNullable<MapNodeData['nodeType']>>;
  remove: Array<string>;
};

const edgeSynonyms = edgeSynonymsRaw as {
  type: Record<string, NonNullable<MapEdgeData['type']>>;
  status: Record<string, NonNullable<MapEdgeData['status']>>;
  remove: Array<string>;
};

export const NODE_STATUS_SYNONYMS: Record<string, MapNodeData['status']> =
  nodeSynonyms.status;

export const NODE_TYPE_SYNONYMS: Record<string, NonNullable<MapNodeData['nodeType']>> =
  nodeSynonyms.type;

export const EDGE_TYPE_SYNONYMS: Record<string, NonNullable<MapEdgeData['type']>> =
  edgeSynonyms.type;

export const EDGE_STATUS_SYNONYMS: Record<string, NonNullable<MapEdgeData['status']>> =
  edgeSynonyms.status;

export const NODE_REMOVAL_SYNONYMS: ReadonlyArray<string> = nodeSynonyms.remove;
export const EDGE_REMOVAL_SYNONYMS: ReadonlyArray<string> = edgeSynonyms.remove;

function escapeForRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Builds a list of heuristic regular expressions mapping possible phrases to a
 * canonical value. Used for quick type inference before invoking the AI.
 */
export function createHeuristicRegexes<T extends string>(
  synonymMap: Record<string, T>,
  canonicalValues: ReadonlyArray<T>
): Array<[RegExp, T]> {
  const phrasesByValue: Partial<Record<string, Array<string>>> = {};
  for (const val of canonicalValues) {
    phrasesByValue[val] = [escapeForRegExp(val)];
  }
  for (const [phrase, canonical] of Object.entries(synonymMap)) {
    let list = phrasesByValue[canonical];
    if (!list) {
      list = [escapeForRegExp(canonical)];
      phrasesByValue[canonical] = list;
    }
    list.push(escapeForRegExp(phrase));
  }
  const heuristics: Array<[RegExp, T]> = [];
  for (const [canonical, phrases] of Object.entries(phrasesByValue)) {
    if (!phrases) continue;
    const pattern = phrases.map(p => p.replace(/\s+/g, '\\s+')).join('|');
    heuristics.push([new RegExp(pattern, 'i'), canonical as T]);
  }
  return heuristics;
}
