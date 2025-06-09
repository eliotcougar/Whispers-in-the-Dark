/**
 * @file mapPathfinding.ts
 * @description Utilities for finding paths on the map graph.
 */

import { MapData, MapEdgeStatus } from '../types';

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
  endNodeId: string
): TravelStep[] | null => {
  const adjacency = new Map<string, Array<{ edgeId: string; to: string; cost: number }>>();

  const addAdj = (from: string, to: string, id: string, cost: number) => {
    if (!adjacency.has(from)) adjacency.set(from, []);
    adjacency.get(from)!.push({ edgeId: id, to, cost });
  };

  for (const edge of mapData.edges) {
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
    if (parentId && parentId !== 'Universe') {
      const idUp = `hierarchy:${node.id}->${parentId}`;
      const idDown = `hierarchy:${parentId}->${node.id}`;
      addAdj(node.id, parentId, idUp, HIERARCHY_EDGE_TRAVEL_COST);
      addAdj(parentId, node.id, idDown, HIERARCHY_EDGE_TRAVEL_COST);
    }
  }

  const distances = new Map<string, number>();
  const prev = new Map<string, { from: string; edgeId: string }>();
  const queue: QueueItem[] = [{ nodeId: startNodeId, cost: 0 }];
  distances.set(startNodeId, 0);

  while (queue.length > 0) {
    queue.sort((a, b) => a.cost - b.cost);
    const current = queue.shift()!;
    if (current.nodeId === endNodeId) break;
    const neighbors = adjacency.get(current.nodeId) || [];
    for (const n of neighbors) {
      const newCost = current.cost + n.cost;
      if (newCost < (distances.get(n.to) ?? Infinity)) {
        distances.set(n.to, newCost);
        prev.set(n.to, { from: current.nodeId, edgeId: n.edgeId });
        const existing = queue.find(q => q.nodeId === n.to);
        if (existing) existing.cost = newCost;
        else queue.push({ nodeId: n.to, cost: newCost });
      }
    }
  }

  if (!distances.has(endNodeId)) return null;

  const steps: TravelStep[] = [];
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

