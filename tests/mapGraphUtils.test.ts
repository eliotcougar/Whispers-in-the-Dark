import { describe, it, expect } from 'vitest';
import { buildNonRumoredAdjacencyMap, existsNonRumoredPath } from '../utils/mapGraphUtils';
import type { MapData, MapEdgeStatus } from '../types';

const makeEdge = (
  id: string,
  source: string,
  target: string,
  status: MapEdgeStatus,
): MapData['edges'][number] => ({
  id,
  sourceNodeId: source,
  targetNodeId: target,
  data: { status },
});

type Node = MapData['nodes'][number];

const makeNode = (id: string): Node => ({
  id,
  placeName: id,
  position: { x: 0, y: 0 },
  data: { description: '', status: 'discovered', nodeType: 'location', parentNodeId: 'universe' },
});

const mapData: MapData = {
  nodes: ['a', 'b', 'c', 'd'].map(makeNode),
  edges: [
    makeEdge('e1', 'a', 'b', 'open'),
    makeEdge('e2', 'b', 'c', 'open'),
    makeEdge('e3', 'c', 'd', 'rumored'),
    makeEdge('e4', 'd', 'a', 'open'),
  ],
};

const oldExistsNonRumoredPath = (
  data: MapData,
  start: string,
  end: string,
  excludeEdgeId?: string,
): boolean => {
  const visited = new Set<string>();
  const queue: Array<string> = [];
  visited.add(start);
  queue.push(start);
  const isTraversable = (status?: MapEdgeStatus) => status !== 'rumored' && status !== 'removed';
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) continue;
    if (current === end) return true;
    for (const edge of data.edges) {
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

describe('existsNonRumoredPath', () => {
  const adjacency = buildNonRumoredAdjacencyMap(mapData);

  it('matches old implementation without exclusion', () => {
    const pairs: Array<[string, string]> = [
      ['a', 'c'],
      ['a', 'd'],
      ['c', 'd'],
    ];
    for (const [s, e] of pairs) {
      const expected = oldExistsNonRumoredPath(mapData, s, e);
      const result = existsNonRumoredPath(adjacency, s, e);
      expect(result).toBe(expected);
    }
  });

  it('respects excluded edge', () => {
    const expected = oldExistsNonRumoredPath(mapData, 'b', 'd', 'e4');
    const result = existsNonRumoredPath(adjacency, 'b', 'd', 'e4');
    expect(result).toBe(expected);
  });
});

export default {};
