import { describe, it, expect } from 'vitest';
import { ROOT_MAP_NODE_ID } from '../constants';
import { selectBestMatchingMapNode } from '../utils/mapNodeMatcher';
import type { MapData, MapNode } from '../types';

const nodes: Array<MapNode> = [
  {
    id: 'node-area',
    placeName: 'Coast',
    position: { x: 0, y: 0 },
    description: '', aliases: ['Sea Side'], status: 'rumored', type: 'location', parentNodeId: ROOT_MAP_NODE_ID
  },
  {
    id: 'node-feature',
    placeName: 'Utility Entrance',
    position: { x: 0, y: 0 },
    description: '', aliases: ['Utility Hatch'], status: 'rumored', type: 'feature', parentNodeId: 'node-area'
  },
  {
    id: 'node-alt-feature',
    placeName: 'Narrow Passage',
    position: { x: 0, y: 0 },
    description: '', aliases: [], status: 'rumored', type: 'feature', parentNodeId: 'node-area'
  },
  {
    id: 'node-location-same-name',
    placeName: 'Narrow Passage',
    position: { x: 0, y: 0 },
    description: '', aliases: [], status: 'rumored', type: 'location', parentNodeId: ROOT_MAP_NODE_ID
  }
];

const mapData: MapData = { nodes, edges: [] };

describe('selectBestMatchingMapNode', () => {
  it('matches exact name', () => {
    const result = selectBestMatchingMapNode('Utility Entrance', mapData, null);
    expect(result).toBe('node-feature');
  });

  it('matches alias', () => {
    const result = selectBestMatchingMapNode('Utility Hatch', mapData, null);
    expect(result).toBe('node-feature');
  });

  it('prefers feature node when names tie', () => {
    const result = selectBestMatchingMapNode('Narrow Passage', mapData, null);
    expect(result).toBe('node-alt-feature');
  });
});
