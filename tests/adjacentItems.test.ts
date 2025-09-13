import { createElement } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { getAdjacentNodeIds } from '../utils/mapGraphUtils';
import LocationItemsDisplay from '../components/inventory/LocationItemsDisplay';
import { ACTION_POINTS_PER_TURN, ROOT_MAP_NODE_ID } from '../constants';
import type { MapData, Item, MapEdgeStatus, MapNodeStatus } from '../types';

const makeNode = (
  id: string,
  status: MapNodeStatus = 'discovered',
  parent = ROOT_MAP_NODE_ID,
): MapData['nodes'][number] => ({
  id,
  placeName: id,
  position: { x: 0, y: 0 },
  data: { description: '', status, nodeType: 'location', parentNodeId: parent },
});

const makeEdge = (
  id: string,
  source: string,
  target: string,
  status: MapEdgeStatus = 'open',
): MapData['edges'][number] => ({
  id,
  sourceNodeId: source,
  targetNodeId: target,
  data: { status },
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

  it('displays reachable items with Take button', () => {
    const adj = getAdjacentNodeIds(mapData, 'current');
    const displayItems = inventory.filter(i => i.holderId === 'current' || adj.includes(i.holderId));
    const html = renderToStaticMarkup(
      createElement(LocationItemsDisplay, {
        currentNodeId: 'current',
        disabled: false,
        items: displayItems,
        mapNodes: mapData.nodes.map(n => ({ id: n.id, placeName: n.placeName })),
        onItemInteract: vi.fn(),
        queuedActionIds: new Set<string>(),
        remainingActionPoints: ACTION_POINTS_PER_TURN,
      })
    );
    expect(html).toContain('Take');
    expect(html).toContain('Reachable at');
    expect(html).toContain('Log');
    expect(html).not.toContain('Tablet');
    expect(html).not.toContain('Stone');
  });
});

export default {};
