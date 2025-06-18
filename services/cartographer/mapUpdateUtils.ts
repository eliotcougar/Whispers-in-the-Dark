import type { AIMapUpdatePayload, MapNodeData } from '../../types';
import { VALID_NODE_TYPE_VALUES } from '../../constants';
import { NODE_TYPE_SYNONYMS } from '../../utils/mapSynonyms';
import { applyNodeDataFix, applyEdgeDataFix } from './normalizers';

/**
 * Converts node/edge update operations that merely set a status suggesting removal
 * into explicit remove operations.
 */
export function normalizeRemovalUpdates(payload: AIMapUpdatePayload): void {
  const nodeRemovalSynonyms = new Set([
    'removed',
    'deleted',
    'destroyed',
    'eliminated',
    'erased',
    'gone',
    'lost',
    'obliterated',
    'terminated',
    'discarded',
  ]);
  const edgeRemovalSynonyms = new Set([
    'removed',
    'deleted',
    'destroyed',
    'eliminated',
    'erased',
    'gone',
    'lost',
    'severed',
    'cut',
    'broken',
    'disconnected',
    'obliterated',
    'terminated',
    'dismantled',
  ]);

  const updatedNodesToUpdate: typeof payload.nodesToUpdate = [];
  const updatedNodesToRemove: typeof payload.nodesToRemove = payload.nodesToRemove ? [...payload.nodesToRemove] : [];
  (payload.nodesToUpdate || []).forEach(nodeUpd => {
    const statusVal = nodeUpd.newData.status?.toLowerCase();
    if (statusVal && nodeRemovalSynonyms.has(statusVal)) {
      updatedNodesToRemove.push({ nodeId: nodeUpd.placeName, nodeName: nodeUpd.placeName });
    } else {
      updatedNodesToUpdate.push(nodeUpd);
    }
  });
  payload.nodesToUpdate = updatedNodesToUpdate.length > 0 ? updatedNodesToUpdate : undefined;
  payload.nodesToRemove = updatedNodesToRemove.length > 0 ? updatedNodesToRemove : undefined;

  const updatedEdgesToUpdate: typeof payload.edgesToUpdate = [];
  const updatedEdgesToRemove: typeof payload.edgesToRemove = payload.edgesToRemove ? [...payload.edgesToRemove] : [];
  (payload.edgesToUpdate || []).forEach(edgeUpd => {
    const statusVal = edgeUpd.newData.status?.toLowerCase();
    if (statusVal && edgeRemovalSynonyms.has(statusVal)) {
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
    const t = (type || 'any').toLowerCase();
    return a < b ? `${a}|${b}|${t}` : `${b}|${a}|${t}`;
  };

  const dedupeNamed = <T extends { sourcePlaceName: string; targetPlaceName: string }>(
    arr: T[] | undefined,
    typeGetter: (e: T) => string | undefined,
  ): T[] | undefined => {
    if (!arr) return arr;
    const seen = new Set<string>();
    const result: T[] = [];
    for (const e of arr) {
      const key = normalizeKey(e.sourcePlaceName, e.targetPlaceName, typeGetter(e));
      if (!seen.has(key)) {
        seen.add(key);
        result.push(e);
      }
    }
    return result;
  };

  payload.edgesToAdd = dedupeNamed(payload.edgesToAdd || undefined, e => e.data.type);
  payload.edgesToUpdate = dedupeNamed(payload.edgesToUpdate || undefined, e => e.newData.type);

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
export function normalizeStatusAndTypeSynonyms(payload: AIMapUpdatePayload): string[] {
  const errors: string[] = [];

  (payload.nodesToAdd || []).forEach((n, idx) => applyNodeDataFix(n.data, errors, `nodesToAdd[${idx}]`));
  (payload.nodesToUpdate || []).forEach((n, idx) => applyNodeDataFix(n.newData, errors, `nodesToUpdate[${idx}].newData`));
  (payload.edgesToAdd || []).forEach((e, idx) => applyEdgeDataFix(e.data, errors, `edgesToAdd[${idx}]`));
  (payload.edgesToUpdate || []).forEach((e, idx) => applyEdgeDataFix(e.newData, errors, `edgesToUpdate[${idx}].newData`));

  if (payload.splitFamily && payload.splitFamily.newNodeType) {
    const mapped = NODE_TYPE_SYNONYMS[payload.splitFamily.newNodeType.toLowerCase()];
    if (mapped) payload.splitFamily.newNodeType = mapped as MapNodeData['nodeType'];
    if (!VALID_NODE_TYPE_VALUES.includes(payload.splitFamily.newNodeType)) {
      errors.push(`splitFamily.newNodeType invalid "${payload.splitFamily.newNodeType}"`);
    }
  }

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

  for (const nodeDel of payload.nodesToRemove || []) {
    if (/^edge_/i.test(nodeDel.nodeId)) {
      correctedEdges.push({ edgeId: nodeDel.nodeId });
    } else {
      correctedNodes.push(nodeDel);
    }
  }

  for (const edgeDel of payload.edgesToRemove || []) {
    if (/^node_/i.test(edgeDel.edgeId)) {
      correctedNodes.push({ nodeId: edgeDel.edgeId, nodeName: edgeDel.edgeId });
    } else {
      correctedEdges.push(edgeDel);
    }
  }

  payload.nodesToRemove = correctedNodes.length > 0 ? correctedNodes : undefined;
  payload.edgesToRemove = correctedEdges.length > 0 ? correctedEdges : undefined;
}
