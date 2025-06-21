/**
 * @file mapPathfinding.ts
 * @description Utilities for finding paths on the map graph.
 */

import { MapData, MapEdgeStatus } from '../types';
import { createMinHeap } from './priorityQueue';

/** Travel costs for edges by status. */
export const EDGE_STATUS_TRAVEL_COSTS: Record<MapEdgeStatus, number> = {
  open: 1,
  accessible: 1,
  active: 1,
  one_way: 1,
  rumored: 5,
  closed: Infinity,
  locked: Infinity,
  blocked: Infinity,
  hidden: Infinity,
  collapsed: Infinity,
  removed: Infinity,
  inactive: Infinity,
};

/** Cost for moving along hierarchy parent/child pseudo edges. */
export const HIERARCHY_EDGE_TRAVEL_COST = 20;

export interface TravelStep {
  step: 'node' | 'edge';
  id: string;
}

export interface TravelAdjacency {
  adjacency: Map<string, Array<{ edgeId: string; to: string; cost: number }>>;
  nodeMap: Map<string, MapData['nodes'][number]>;
  childrenByParent: Map<string, Array<string>>;
}

/** Builds adjacency data for travel pathfinding. */
export const buildTravelAdjacency = (mapData: MapData): TravelAdjacency => {
  const adjacency = new Map<string, Array<{ edgeId: string; to: string; cost: number }>>();
  const nodeMap = new Map(mapData.nodes.map(n => [n.id, n]));
  const isTraversable = (id: string | undefined): boolean => {
    const node = id ? nodeMap.get(id) : undefined;
    return !!node && node.data.status !== 'blocked';
  };

  const childrenByParent = new Map<string, Array<string>>();
  for (const node of mapData.nodes) {
    const p = node.data.parentNodeId;
    if (!p) continue;
    if (!childrenByParent.has(p)) childrenByParent.set(p, []);
    const arr = childrenByParent.get(p);
    if (arr) arr.push(node.id);
  }

  const addAdj = (from: string, to: string, id: string, cost: number) => {
    if (!adjacency.has(from)) adjacency.set(from, []);
    const arr = adjacency.get(from);
    if (arr) arr.push({ edgeId: id, to, cost });
  };

  for (const edge of mapData.edges) {
    if (!isTraversable(edge.sourceNodeId) || !isTraversable(edge.targetNodeId)) continue;
    const status = edge.data.status ?? 'open';
    const cost = EDGE_STATUS_TRAVEL_COSTS[status];
    if (cost === Infinity) continue;
    addAdj(edge.sourceNodeId, edge.targetNodeId, edge.id, cost);
    if (status !== 'one_way') {
      addAdj(edge.targetNodeId, edge.sourceNodeId, edge.id, cost);
    }
  }

  for (const node of mapData.nodes) {
    const parentId = node.data.parentNodeId;
    if (!parentId || parentId === 'Universe') continue;
    if (!isTraversable(node.id) || !isTraversable(parentId)) continue;
    const siblings = childrenByParent.get(parentId) ?? [];
    const hasOtherChild = siblings.some(id => id !== node.id && isTraversable(id));
    if (!hasOtherChild) continue;
    const idUp = `hierarchy:${node.id}->${parentId}`;
    const idDown = `hierarchy:${parentId}->${node.id}`;
    addAdj(node.id, parentId, idUp, HIERARCHY_EDGE_TRAVEL_COST);
    addAdj(parentId, node.id, idDown, HIERARCHY_EDGE_TRAVEL_COST);
  }

  const siblingsMap = new Map<string, MapData['nodes']>();
  for (const node of mapData.nodes) {
    const p = node.data.parentNodeId;
    if (!p) continue;
    if (!siblingsMap.has(p)) siblingsMap.set(p, []);
    const arr2 = siblingsMap.get(p);
    if (arr2) arr2.push(node);
  }

  for (const siblings of siblingsMap.values()) {
    const isFeatureNode = (n: (typeof siblings)[number]): boolean =>
      n.data.nodeType === 'feature' || n.data.isFeature === true;
    const features = siblings.filter(isFeatureNode);
    const others = siblings.filter(n => !isFeatureNode(n));
    for (const f of features) {
      for (const o of others) {
        if (!isTraversable(f.id) || !isTraversable(o.id)) continue;
        const id1 = `hierarchy:${f.id}->${o.id}`;
        const id2 = `hierarchy:${o.id}->${f.id}`;
        addAdj(f.id, o.id, id1, HIERARCHY_EDGE_TRAVEL_COST);
        addAdj(o.id, f.id, id2, HIERARCHY_EDGE_TRAVEL_COST);
      }
    }
  }

  return { adjacency, nodeMap, childrenByParent };
};

interface QueueItem {
  nodeId: string;
  cost: number;
}

/**
 * Calculates the cheapest travel path between two nodes.
 * Returns an array of node/edge IDs representing the journey or null if unreachable.
 */
export const findTravelPath = (
  mapData: MapData,
  startNodeId: string,
  endNodeId: string,
  prebuilt?: TravelAdjacency
): Array<TravelStep> | null => {
  const { adjacency, nodeMap, childrenByParent } = prebuilt ?? buildTravelAdjacency(mapData);
  const isTraversable = (id: string | undefined): boolean => {
    const node = id ? nodeMap.get(id) : undefined;
    return !!node && node.data.status !== 'blocked';
  };

  const allowHierarchyEdge = (from: string, to: string): boolean => {
    const parentList = childrenByParent.get(from);
    if (parentList?.includes(to)) {
      return parentList.some(id => id !== to && id !== startNodeId && isTraversable(id));
    }
    const childList = childrenByParent.get(to);
    if (childList?.includes(from)) {
      return childList.some(id => id !== from && id !== startNodeId && isTraversable(id));
    }
    return true;
  };

  const distances = new Map<string, number>();
  const prev = new Map<string, { from: string; edgeId: string }>();
  const queue = createMinHeap<QueueItem>();
  queue.push({ nodeId: startNodeId, cost: 0 }, 0);
  distances.set(startNodeId, 0);

  while (queue.size() > 0) {
    const current = queue.pop();
    if (!current) break;
    if (current.cost !== (distances.get(current.nodeId) ?? Infinity)) {
      continue;
    }
    if (current.nodeId === endNodeId) break;
    const neighbors = adjacency.get(current.nodeId) ?? [];
    for (const n of neighbors) {
      if (
        n.edgeId.startsWith('hierarchy:') &&
        !allowHierarchyEdge(current.nodeId, n.to)
      ) {
        continue;
      }
      const newCost = current.cost + n.cost;
      if (newCost < (distances.get(n.to) ?? Infinity)) {
        distances.set(n.to, newCost);
        prev.set(n.to, { from: current.nodeId, edgeId: n.edgeId });
        queue.push({ nodeId: n.to, cost: newCost }, newCost);
      }
    }
  }

  if (!distances.has(endNodeId)) return null;

  const steps: Array<TravelStep> = [];
  let current = endNodeId;
  steps.unshift({ step: 'node', id: current });
  while (current !== startNodeId) {
    const info = prev.get(current);
    if (!info) break;
    steps.unshift({ step: 'edge', id: info.edgeId });
    current = info.from;
    steps.unshift({ step: 'node', id: current });
  }
  return steps;
};

