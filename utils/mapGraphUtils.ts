/**
 * @file mapGraphUtils.ts
 * @description Helper functions for querying and measuring hierarchical map node relationships.
 */

import { MapNode, MapData, MapEdgeStatus } from '../types';
import { NODE_TYPE_LEVELS, ROOT_MAP_NODE_ID } from '../constants';
import { buildTravelAdjacency } from './mapPathfinding';

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
  if (!node.parentNodeId || node.parentNodeId === ROOT_MAP_NODE_ID) return undefined;
  return nodeMap.get(node.parentNodeId);
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
    if (n.parentNodeId === node.id) children.push(n);
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
  let current: MapNode | undefined = nodeMap.get(node.parentNodeId ?? '');
  while (current) {
    ancestors.push(current);
    if (!current.parentNodeId || current.parentNodeId === ROOT_MAP_NODE_ID) break;
    current = nodeMap.get(current.parentNodeId);
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
  while (current?.parentNodeId && current.parentNodeId !== ROOT_MAP_NODE_ID) {
    if (current.parentNodeId === possibleAncestor.id) return true;
    current = nodeMap.get(current.parentNodeId);
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
  const { adjacency } = buildTravelAdjacency(mapData);
  const edgeMap = new Map(mapData.edges.map(e => [e.id, e]));
  const allowed: Array<MapEdgeStatus> = ['open', 'accessible', 'active'];
  return (adjacency.get(nodeId) ?? [])
    .filter(a => {
      const edge = edgeMap.get(a.edgeId);
      if (!edge) return true;
      return allowed.includes(edge.status);
    })
    .map(a => a.to);
};

/** Structure describing adjacency for each node. */
export type NonRumoredAdjacencyMap = Map<string, Array<{ nodeId: string; edgeId: string }>>;

/**
 * Builds a map of node connections ignoring edges marked as 'rumored' or 'removed'.
 */
export const buildNonRumoredAdjacencyMap = (mapData: MapData): NonRumoredAdjacencyMap => {
  const adjacency: NonRumoredAdjacencyMap = new Map();
  const isTraversable = (status: MapEdgeStatus) => status !== 'rumored' && status !== 'removed';
  for (const edge of mapData.edges) {
    if (!isTraversable(edge.status)) continue;
    if (!adjacency.has(edge.sourceNodeId)) adjacency.set(edge.sourceNodeId, []);
    const fromList = adjacency.get(edge.sourceNodeId) ?? [];
    fromList.push({ nodeId: edge.targetNodeId, edgeId: edge.id });
    adjacency.set(edge.sourceNodeId, fromList);

    if (!adjacency.has(edge.targetNodeId)) adjacency.set(edge.targetNodeId, []);
    const toList = adjacency.get(edge.targetNodeId) ?? [];
    toList.push({ nodeId: edge.sourceNodeId, edgeId: edge.id });
    adjacency.set(edge.targetNodeId, toList);
  }
  return adjacency;
};

/**
 * Determines if a non-rumored path exists between two nodes.
 * Traverses the map graph ignoring edges with status 'rumored' or 'removed'.
 *
 * @param adjacency - Pre-built adjacency structure of traversable edges.
 * @param startNodeId - Node ID of the starting point.
 * @param endNodeId - Node ID of the destination.
 * @param excludeEdgeId - Optional edge ID to ignore during traversal.
 * @returns True if a path exists, otherwise false.
 */
export const existsNonRumoredPath = (
  adjacency: NonRumoredAdjacencyMap,
  startNodeId: string,
  endNodeId: string,
  excludeEdgeId?: string
): boolean => {
  const visited = new Set<string>();
  const queue: Array<string> = [];
  visited.add(startNodeId);
  queue.push(startNodeId);

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) continue;
    if (current === endNodeId) return true;
    const neighbors = adjacency.get(current) ?? [];
    for (const { nodeId, edgeId } of neighbors) {
      if (edgeId === excludeEdgeId) continue;
      if (!visited.has(nodeId)) {
        visited.add(nodeId);
        queue.push(nodeId);
      }
    }
  }
  return false;
};

/** Returns numeric hierarchy level for a node type. Lower number = higher level. */
export const getNodeTypeLevel = (
  type: MapNode['type'] | undefined,
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
  childType: MapNode['type'],
  nodeMap: Map<string, MapNode>
): string | undefined => {
  let current = startingParent;
  const childLevel = getNodeTypeLevel(childType);
  while (current && getNodeTypeLevel(current.type) >= childLevel) {
    if (!current.parentNodeId) return undefined;
    current = nodeMap.get(current.parentNodeId);
  }
  return current ? current.id : undefined;
};
