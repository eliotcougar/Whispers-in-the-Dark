/**
 * @file mapGraphUtils.ts
 * @description Helper functions for querying and measuring hierarchical map node relationships.
 */

import { MapNode, MapData, MapEdgeStatus } from '../types';
import { NODE_RADIUS } from './mapConstants';

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
): MapNode[] => {
  const children: MapNode[] = [];
  nodeMap.forEach(n => {
    if (n.data.parentNodeId === node.id) children.push(n);
  });
  return children;
};

/**
 * Returns all sibling nodes of the provided node.
 *
 * @param node - The node whose siblings are requested.
 * @param nodeMap - Map of node IDs to MapNode objects.
 * @returns Array of sibling MapNodes. Empty if none exist or node has no parent.
 */
export const getSiblings = (
  node: MapNode,
  nodeMap: Map<string, MapNode>
): MapNode[] => {
  const parent = getParent(node, nodeMap);
  if (!parent) return [];
  return getChildren(parent, nodeMap).filter(n => n.id !== node.id);
};

/**
 * Calculates the maximum distance between any two children of the specified node
 * and adds their respective radii. Useful for dynamically adjusting the parent's
 * circle radius.
 *
 * @param node - Parent node whose family's diameter is calculated.
 * @param nodeMap - Map of node IDs to MapNode objects.
 * @returns Maximum combined distance plus radii between children. Zero if fewer
 *          than two children are present.
 */
export const getFamilyDiameter = (
  node: MapNode,
  nodeMap: Map<string, MapNode>
): number => {
  const children = getChildren(node, nodeMap);
  if (children.length === 0) return 0;
  if (children.length === 1) {
    const r = children[0].data.visualRadius || NODE_RADIUS;
    return r * 2 + NODE_RADIUS * 0.2;
  }
  let max = 0;
  for (let i = 0; i < children.length; i++) {
    for (let j = i + 1; j < children.length; j++) {
      const c1 = children[i];
      const c2 = children[j];
      const dx = c1.position.x - c2.position.x;
      const dy = c1.position.y - c2.position.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const r1 = c1.data.visualRadius || NODE_RADIUS;
      const r2 = c2.data.visualRadius || NODE_RADIUS;
      const candidate = dist + r1 + r2;
      if (candidate > max) max = candidate;
    }
  }
  return max;
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
  const queue: string[] = [];
  visited.add(startNodeId);
  queue.push(startNodeId);

  const isTraversable = (status?: MapEdgeStatus) =>
    status !== 'rumored' && status !== 'removed';

  while (queue.length > 0) {
    const current = queue.shift()!;
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
