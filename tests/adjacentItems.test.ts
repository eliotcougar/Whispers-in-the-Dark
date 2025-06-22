import { describe, it, expect } from 'vitest';
import { getAdjacentNodeIds } from '../utils/mapGraphUtils';
import type { MapData, Item } from '../types';

const makeNode = (id: string, status: string = 'discovered', parent?: string) => ({
  id,
  themeName: 'theme',
  placeName: id,
  position: { x: 0, y: 0 },
  data: { description: '', status, nodeType: 'location', parentNodeId: parent ?? 'universe' }
});

const makeEdge = (id: string, source: string, target: string, status: string = 'open') => ({
  id,
  sourceNodeId: source,
  targetNodeId: target,
  data: { status }
});

describe('getAdjacentNodeIds for item reachability', () => {
  const mapData: MapData = {
    nodes: [
      makeNode('current'),
      makeNode('reachable'),
      makeNode('blocked', 'blocked'),
      makeNode('distant')
    ],
    edges: [
      makeEdge('e1', 'current', 'reachable'),
      makeEdge('e2', 'current', 'blocked'),
      // distant has no edge
    ]
  };

  const inventory: Array<Item> = [
    { id: 'i1', name: 'Log', type: 'page', description: '', holderId: 'reachable' },
    { id: 'i2', name: 'Tablet', type: 'page', description: '', holderId: 'blocked' },
    { id: 'i3', name: 'Stone', type: 'page', description: '', holderId: 'distant' }
  ];

  it('returns items in adjacent unblocked nodes', () => {
    const adj = getAdjacentNodeIds(mapData, 'current');
    const reachableItems = inventory.filter(i => i.holderId === 'current' || adj.includes(i.holderId));
    expect(reachableItems.map(i => i.name)).toContain('Log');
    expect(reachableItems.map(i => i.name)).not.toContain('Tablet');
    expect(reachableItems.map(i => i.name)).not.toContain('Stone');
  });
});

export default {};
