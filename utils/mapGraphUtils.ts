/**
 * @file mapGraphUtils.ts
 * @description Helper functions for querying and measuring hierarchical map node relationships.
 */

import { MapNode, MapData, MapEdgeStatus } from '../types';
import { NODE_TYPE_LEVELS } from '../constants';

/**
 * Returns the parent MapNode for the given node if one exists.
 *
 * @param node - Node whose parent should be retrieved.
 * @param nodeMap - Map of node IDs to MapNode objects.
 * @returns The parent MapNode or undefined if none found.
 */
export const getParent = (
  node: MapNode,
  nodeMap: Map<string, MapNode>
): MapNode | undefined => {
  if (!node.data.parentNodeId || node.data.parentNodeId === 'Universe') return undefined;
  return nodeMap.get(node.data.parentNodeId);
};

/**
 * Returns all child nodes of the provided parent node.
 *
 * @param node - Parent node whose children are requested.
 * @param nodeMap - Map of node IDs to MapNode objects.
 * @returns Array of child MapNodes. Empty if none exist.
 */
export const getChildren = (
  node: MapNode,
  nodeMap: Map<string, MapNode>
): Array<MapNode> => {
  const children: Array<MapNode> = [];
  nodeMap.forEach(n => {
    if (n.data.parentNodeId === node.id) children.push(n);
  });
  return children;
};

/**
 * Returns all ancestor nodes for the provided node.
 * The closest parent is first in the returned array.
 */
export const getAncestors = (
  node: MapNode,
  nodeMap: Map<string, MapNode>
): Array<MapNode> => {
  const ancestors: Array<MapNode> = [];
  let current: MapNode | undefined = nodeMap.get(node.data.parentNodeId ?? '');
  while (current) {
    ancestors.push(current);
    if (!current.data.parentNodeId || current.data.parentNodeId === 'Universe') break;
    current = nodeMap.get(current.data.parentNodeId);
  }
  return ancestors;
};

/**
 * Returns true if the `possibleDescendant` is a child (at any depth)
 * of `possibleAncestor`.
 */
export const isDescendantOf = (
  possibleDescendant: MapNode,
  possibleAncestor: MapNode,
  nodeMap: Map<string, MapNode>
): boolean => {
  let current: MapNode | undefined = possibleDescendant;
  while (current?.data.parentNodeId && current.data.parentNodeId !== 'Universe') {
    if (current.data.parentNodeId === possibleAncestor.id) return true;
    current = nodeMap.get(current.data.parentNodeId);
  }
  return false;
};

/** Convenience wrapper when only IDs and MapData are available. */
export const isDescendantIdOf = (
  mapData: MapData,
  nodeId: string,
  ancestorId: string
): boolean => {
  const nodeMap = new Map(mapData.nodes.map(n => [n.id, n]));
  const node = nodeMap.get(nodeId);
  const ancestor = nodeMap.get(ancestorId);
  if (!node || !ancestor) return false;
  return isDescendantOf(node, ancestor, nodeMap);
};

/**
 * Returns IDs of nodes directly connected to the provided node via traversable edges.
 */
export const getAdjacentNodeIds = (
  mapData: MapData,
  nodeId: string,
): Array<string> => {
  const allowed: Array<MapEdgeStatus> = ['open', 'accessible', 'active'];
  const ids = new Set<string>();
  for (const edge of mapData.edges) {
    if (!allowed.includes(edge.data.status ?? 'open')) continue;
    if (edge.sourceNodeId === nodeId) {
      ids.add(edge.targetNodeId);
    } else if (edge.targetNodeId === nodeId && edge.data.status !== 'one_way') {
      ids.add(edge.sourceNodeId);
    }
  }
  return Array.from(ids);
};

/**
 * Determines if a non-rumored path exists between two nodes.
 * Traverses the map graph ignoring edges with status 'rumored' or 'removed'.
 *
 * @param mapData - Full map data containing all edges.
 * @param startNodeId - Node ID of the starting point.
 * @param endNodeId - Node ID of the destination.
 * @param excludeEdgeId - Optional edge ID to ignore during traversal.
 * @returns True if a path exists, otherwise false.
 */
export const existsNonRumoredPath = (
  mapData: MapData,
  startNodeId: string,
  endNodeId: string,
  excludeEdgeId?: string
): boolean => {
  const visited = new Set<string>();
  const queue: Array<string> = [];
  visited.add(startNodeId);
  queue.push(startNodeId);

  const isTraversable = (status?: MapEdgeStatus) =>
    status !== 'rumored' && status !== 'removed';

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) continue;
    if (current === endNodeId) return true;
    for (const edge of mapData.edges) {
      if (edge.id === excludeEdgeId) continue;
      if (!isTraversable(edge.data.status)) continue;
      let next: string | null = null;
      if (edge.sourceNodeId === current) next = edge.targetNodeId;
      else if (edge.targetNodeId === current) next = edge.sourceNodeId;
      if (next && !visited.has(next)) {
        visited.add(next);
        queue.push(next);
      }
    }
  }
  return false;
};

/** Returns numeric hierarchy level for a node type. Lower number = higher level. */
export const getNodeTypeLevel = (
  type: MapNode['data']['nodeType'] | undefined,
): number => {
  if (!type) return -1;
  return NODE_TYPE_LEVELS[type];
};

/**
 * Climb up the hierarchy to find the closest ancestor that can parent a node
 * of the specified type. Returns the ancestor's ID or undefined for root.
 */
export const findClosestAllowedParent = (
  startingParent: MapNode | undefined,
  childType: MapNode['data']['nodeType'],
  nodeMap: Map<string, MapNode>
): string | undefined => {
  let current = startingParent;
  const childLevel = getNodeTypeLevel(childType);
  while (current && getNodeTypeLevel(current.data.nodeType) >= childLevel) {
    if (!current.data.parentNodeId) return undefined;
    current = nodeMap.get(current.data.parentNodeId);
  }
  return current ? current.id : undefined;
};
