import type { MapNode, MapEdge, MapEdgeData } from '../../types';
import { ROOT_MAP_NODE_ID } from '../../constants';
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
  if (nodeA.type !== 'feature' || nodeB.type !== 'feature') {
    return false;
  }
  if (edgeType === 'shortcut') return true;

  const lookup = nodeLookup ?? new Map<string, MapNode>();
  const parentAId = nodeA.parentNodeId ?? ROOT_MAP_NODE_ID;
  const parentBId = nodeB.parentNodeId ?? ROOT_MAP_NODE_ID;
  const parentA = parentAId === ROOT_MAP_NODE_ID ? null : lookup.get(parentAId);
  const parentB = parentBId === ROOT_MAP_NODE_ID ? null : lookup.get(parentBId);

  if (!parentA && parentAId !== ROOT_MAP_NODE_ID) return false;
  if (!parentB && parentBId !== ROOT_MAP_NODE_ID) return false;
  if (parentAId === parentBId) return true;

  const grandAId = parentAId === ROOT_MAP_NODE_ID ? ROOT_MAP_NODE_ID : lookup.get(parentAId)?.parentNodeId ?? ROOT_MAP_NODE_ID;
  const grandBId = parentBId === ROOT_MAP_NODE_ID ? ROOT_MAP_NODE_ID : lookup.get(parentBId)?.parentNodeId ?? ROOT_MAP_NODE_ID;

  if (grandAId && grandBId && grandAId === grandBId) return true;
  if (grandAId && parentBId === grandAId) return true;
  if (grandBId && parentAId === grandBId) return true;

  if (parentAId !== ROOT_MAP_NODE_ID && parentBId !== ROOT_MAP_NODE_ID) {
    const parentAParent = lookup.get(parentAId)?.parentNodeId ?? ROOT_MAP_NODE_ID;
    const parentBParent = lookup.get(parentBId)?.parentNodeId ?? ROOT_MAP_NODE_ID;
    if (parentAParent === ROOT_MAP_NODE_ID && parentBParent === ROOT_MAP_NODE_ID) return true;
  }
  if (parentAId === ROOT_MAP_NODE_ID && grandBId === ROOT_MAP_NODE_ID) return true;
  if (parentBId === ROOT_MAP_NODE_ID && grandAId === ROOT_MAP_NODE_ID) return true;

  return false;
}

/**
 * Adds a new edge to the map if no matching edge exists.
 */
export function addEdgeWithTracking(
  a: MapNode,
  b: MapNode,
  data: MapEdgeData,
  edges: Array<MapEdge>,
  edgeLookup: Map<string, Array<MapEdge>>
): MapEdge {
  const existing = (edgeLookup.get(a.id) ?? []).find(
    e =>
      ((e.sourceNodeId === a.id && e.targetNodeId === b.id) || (e.sourceNodeId === b.id && e.targetNodeId === a.id)) &&
      e.type === data.type,
  );
  if (existing) return existing;
  const id = generateUniqueId(`edge-${a.id}-to-${b.id}-`);
  const edge: MapEdge = {
    id,
    sourceNodeId: a.id,
    targetNodeId: b.id,
    description: data.description,
    type: data.type,
    status: data.status,
    travelTime: data.travelTime,
  };
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    if (!['description', 'type', 'status', 'travelTime'].includes(key)) {
      (edge as Record<string, unknown>)[key] = value;
    }
  }
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

export function pruneInvalidEdges(
  edges: Array<MapEdge>,
  nodeLookup: Map<string, MapNode>,
): Array<MapEdge> {
  return edges.filter(e => {
    const src = nodeLookup.get(e.sourceNodeId);
    const tgt = nodeLookup.get(e.targetNodeId);
    if (!src || !tgt) return false;
    return isEdgeConnectionAllowed(src, tgt, e.type, nodeLookup);
  });
}
