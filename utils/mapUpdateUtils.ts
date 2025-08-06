import type { AIMapUpdatePayload, MapNodeData, MapEdgeData } from '../types';
import {
  NODE_REMOVAL_SYNONYMS,
  EDGE_REMOVAL_SYNONYMS,
} from './mapSynonyms';
import { applyNodeDataFix, applyEdgeDataFix } from './mapUpdateNormalizers';

// Synonym lists for interpreting node and edge removal operations
export const NODE_REMOVAL_SYNONYM_SET = new Set<string>(NODE_REMOVAL_SYNONYMS);
export const EDGE_REMOVAL_SYNONYM_SET = new Set<string>(EDGE_REMOVAL_SYNONYMS);

/**
 * Converts node/edge update operations that merely set a status suggesting removal
 * into explicit remove operations.
 */
export function normalizeRemovalUpdates(payload: AIMapUpdatePayload): void {

  const updatedNodesToUpdate: typeof payload.nodesToUpdate = [];
  const updatedNodesToRemove: typeof payload.nodesToRemove = payload.nodesToRemove ? [...payload.nodesToRemove] : [];
  (payload.nodesToUpdate ?? []).forEach(nodeUpd => {
    const statusVal = nodeUpd.status?.toLowerCase();
    if (statusVal && NODE_REMOVAL_SYNONYM_SET.has(statusVal)) {
      updatedNodesToRemove.push({ nodeId: nodeUpd.placeName, nodeName: nodeUpd.placeName });
    } else {
      updatedNodesToUpdate.push(nodeUpd);
    }
  });
  payload.nodesToUpdate = updatedNodesToUpdate.length > 0 ? updatedNodesToUpdate : undefined;
  payload.nodesToRemove = updatedNodesToRemove.length > 0 ? updatedNodesToRemove : undefined;

  const updatedEdgesToUpdate: typeof payload.edgesToUpdate = [];
  const updatedEdgesToRemove: typeof payload.edgesToRemove = payload.edgesToRemove ? [...payload.edgesToRemove] : [];
  (payload.edgesToUpdate ?? []).forEach(edgeUpd => {
    const statusVal = edgeUpd.status?.toLowerCase();
    if (statusVal && EDGE_REMOVAL_SYNONYM_SET.has(statusVal)) {
      updatedEdgesToRemove.push({ edgeId: '', sourceId: edgeUpd.sourcePlaceName, targetId: edgeUpd.targetPlaceName });
    } else {
      updatedEdgesToUpdate.push(edgeUpd);
    }
  });
  payload.edgesToUpdate = updatedEdgesToUpdate.length > 0 ? updatedEdgesToUpdate : undefined;
  payload.edgesToRemove = updatedEdgesToRemove.length > 0 ? updatedEdgesToRemove : undefined;
}

/**
 * Filters duplicate edge operations within an AIMapUpdatePayload.
 */
export function dedupeEdgeOps(payload: AIMapUpdatePayload): void {
    const normalizeKey = (source: string, target: string, type: string | undefined): string => {
      const a = source.toLowerCase();
      const b = target.toLowerCase();
      const t = (type ?? 'any').toLowerCase();
      return a < b ? `${a}|${b}|${t}` : `${b}|${a}|${t}`;
    };

  const dedupeNamed = <T extends { sourcePlaceName: string; targetPlaceName: string }>(
    arr: Array<T> | undefined,
    typeGetter: (e: T) => string | undefined,
  ): Array<T> | undefined => {
    if (!arr) return arr;
    const seen = new Set<string>();
    const result: Array<T> = [];
    for (const e of arr) {
      const key = normalizeKey(e.sourcePlaceName, e.targetPlaceName, typeGetter(e));
      if (!seen.has(key)) {
        seen.add(key);
        result.push(e);
      }
    }
    return result;
  };

  payload.edgesToAdd = dedupeNamed(payload.edgesToAdd ?? undefined, e => e.type);
  payload.edgesToUpdate = dedupeNamed(payload.edgesToUpdate ?? undefined, e => e.type);

  if (payload.edgesToRemove) {
    const seen = new Set<string>();
    const result: typeof payload.edgesToRemove = [];
    for (const e of payload.edgesToRemove) {
      const key = e.edgeId.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        result.push(e);
      }
    }
    payload.edgesToRemove = result;
  }
}

/**
 * Normalizes status and type fields within the payload to their canonical values.
 * Returns an array of error strings for values that remain invalid.
 */
export function normalizeStatusAndTypeSynonyms(payload: AIMapUpdatePayload): Array<string> {
  const errors: Array<string> = [];

  (payload.nodesToAdd ?? []).forEach((n, idx) => {
    applyNodeDataFix(n as unknown as Partial<MapNodeData>, errors, `nodesToAdd[${String(idx)}]`);
  });
  (payload.nodesToUpdate ?? []).forEach((n, idx) => {
    applyNodeDataFix(n as unknown as Partial<MapNodeData>, errors, `nodesToUpdate[${String(idx)}]`);
  });
  (payload.edgesToAdd ?? []).forEach((e, idx) => {
    applyEdgeDataFix(e as unknown as Partial<MapEdgeData>, errors, `edgesToAdd[${String(idx)}]`);
  });
  (payload.edgesToUpdate ?? []).forEach((e, idx) => {
    applyEdgeDataFix(e as unknown as Partial<MapEdgeData>, errors, `edgesToUpdate[${String(idx)}]`);
  });


  return errors;
}

/**
 * Heuristic fix for mis-specified delete operations.
 * If a nodesToRemove entry has an ID beginning with "edge_" it is moved to
 * edgesToRemove. Likewise, any edgesToRemove entry with an ID beginning with
 * "node_" is converted into a node removal.
 */
export function fixDeleteIdMixups(payload: AIMapUpdatePayload): void {
  const correctedNodes: NonNullable<AIMapUpdatePayload['nodesToRemove']> = [];
  const correctedEdges: NonNullable<AIMapUpdatePayload['edgesToRemove']> = [];

  for (const nodeDel of payload.nodesToRemove ?? []) {
    if (/^edge_/i.test(nodeDel.nodeId)) {
      correctedEdges.push({ edgeId: nodeDel.nodeId });
    } else {
      correctedNodes.push(nodeDel);
    }
  }

    for (const edgeDel of payload.edgesToRemove ?? []) {
    if (/^node_/i.test(edgeDel.edgeId)) {
      correctedNodes.push({ nodeId: edgeDel.edgeId, nodeName: edgeDel.edgeId });
    } else {
      correctedEdges.push(edgeDel);
    }
  }

  payload.nodesToRemove = correctedNodes.length > 0 ? correctedNodes : undefined;
  payload.edgesToRemove = correctedEdges.length > 0 ? correctedEdges : undefined;
}
