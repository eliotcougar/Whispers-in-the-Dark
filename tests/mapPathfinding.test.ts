import { describe, it, expect } from 'vitest';
import { buildTravelAdjacency, findTravelPath } from '../utils/mapPathfinding';
import type { MapData, MapEdgeStatus } from '../types';

const makeNode = (id: string, parentId = 'universe'): MapData['nodes'][number] => ({
  id,
  placeName: id,
  position: { x: 0, y: 0 },
  data: { description: '', status: 'discovered', nodeType: 'location', parentNodeId: parentId }
});

const makeEdge = (
  id: string,
  source: string,
  target: string,
  status: MapEdgeStatus
): MapData['edges'][number] => ({
  id,
  sourceNodeId: source,
  targetNodeId: target,
  data: { status }
});

describe('findTravelPath', () => {
  const mapData: MapData = {
    nodes: ['a', 'b', 'c', 'd'].map(id => makeNode(id)),
    edges: [
      makeEdge('e1', 'a', 'b', 'open'),
      makeEdge('e2', 'b', 'c', 'open'),
      makeEdge('e3', 'c', 'd', 'rumored'),
      makeEdge('e4', 'd', 'a', 'open')
    ]
  };

  it('produces same path with or without prebuilt adjacency', () => {
    const pathDirect = findTravelPath(mapData, 'a', 'c');
    const adj = buildTravelAdjacency(mapData);
    const pathPrebuilt = findTravelPath(mapData, 'a', 'c', adj);
    expect(pathPrebuilt).toEqual(pathDirect);
  });

  it('handles hierarchy edges consistently', () => {
    const map2: MapData = {
      nodes: [
        makeNode('parent'),
        makeNode('x', 'parent'),
        makeNode('y', 'parent')
      ],
      edges: []
    };
    const expected = findTravelPath(map2, 'x', 'y');
    const adj2 = buildTravelAdjacency(map2);
    const result = findTravelPath(map2, 'x', 'y', adj2);
    expect(result).toEqual(expected);
  });
});
