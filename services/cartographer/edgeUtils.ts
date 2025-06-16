import type { MapNode, MapEdge, MapEdgeData } from '../../types';
import { generateUniqueId } from '../../utils/entityUtils';

/**
 * Determines whether two feature nodes can be connected based on hierarchy rules.
 */
export function isEdgeConnectionAllowed(
  nodeA: MapNode,
  nodeB: MapNode,
  edgeType?: MapEdgeData['type'],
  nodeLookup?: Map<string, MapNode>
): boolean {
  if (nodeA.data.nodeType !== 'feature' || nodeB.data.nodeType !== 'feature') {
    return false;
  }
  if (edgeType === 'shortcut') return true;

  const lookup = nodeLookup ?? new Map<string, MapNode>();
  const parentAId = nodeA.data.parentNodeId ?? 'Universe';
  const parentBId = nodeB.data.parentNodeId ?? 'Universe';
  const parentA = parentAId === 'Universe' ? null : lookup.get(parentAId);
  const parentB = parentBId === 'Universe' ? null : lookup.get(parentBId);

  if (!parentA && parentAId !== 'Universe') return false;
  if (!parentB && parentBId !== 'Universe') return false;
  if (parentAId === parentBId) return true;

  const grandAId = parentAId === 'Universe' ? 'Universe' : lookup.get(parentAId)?.data.parentNodeId ?? 'Universe';
  const grandBId = parentBId === 'Universe' ? 'Universe' : lookup.get(parentBId)?.data.parentNodeId ?? 'Universe';

  if (grandAId && grandBId && grandAId === grandBId) return true;
  if (grandAId && parentBId === grandAId) return true;
  if (grandBId && parentAId === grandBId) return true;

  if (parentAId !== 'Universe' && parentBId !== 'Universe') {
    const parentAParent = lookup.get(parentAId)?.data.parentNodeId ?? 'Universe';
    const parentBParent = lookup.get(parentBId)?.data.parentNodeId ?? 'Universe';
    if (parentAParent === 'Universe' && parentBParent === 'Universe') return true;
  }
  if (parentAId === 'Universe' && grandBId === 'Universe') return true;
  if (parentBId === 'Universe' && grandAId === 'Universe') return true;

  return false;
}

/**
 * Adds a new edge to the map if no matching edge exists.
 */
export function addEdgeWithTracking(
  a: MapNode,
  b: MapNode,
  data: MapEdgeData,
  edges: MapEdge[],
  edgeLookup: Map<string, MapEdge[]>
): MapEdge {
  const existing = (edgeLookup.get(a.id) || []).find(
    e =>
      ((e.sourceNodeId === a.id && e.targetNodeId === b.id) || (e.sourceNodeId === b.id && e.targetNodeId === a.id)) &&
      e.data.type === data.type,
  );
  if (existing) return existing;
  const id = generateUniqueId(`edge_${a.id}_to_${b.id}_`);
  const edge: MapEdge = { id, sourceNodeId: a.id, targetNodeId: b.id, data };
  edges.push(edge);
  let arrA = edgeLookup.get(a.id);
  if (!arrA) {
    arrA = [];
    edgeLookup.set(a.id, arrA);
  }
  arrA.push(edge);
  let arrB = edgeLookup.get(b.id);
  if (!arrB) {
    arrB = [];
    edgeLookup.set(b.id, arrB);
  }
  arrB.push(edge);
  return edge;
}
