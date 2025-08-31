import { describe, it, expect } from 'vitest';
import { selectBestMatchingMapNode } from '../utils/mapNodeMatcher';
import type { AdventureTheme, MapData, MapNode } from '../types';

const theme: AdventureTheme = { name: 'TestTheme' } as AdventureTheme;

const nodes: Array<MapNode> = [
  {
    id: 'node-area',
    placeName: 'Coast',
    position: { x: 0, y: 0 },
    data: { description: '', aliases: ['Sea Side'], status: 'rumored', nodeType: 'location', parentNodeId: 'universe' }
  },
  {
    id: 'node-feature',
    placeName: 'Utility Entrance',
    position: { x: 0, y: 0 },
    data: { description: '', aliases: ['Utility Hatch'], status: 'rumored', nodeType: 'feature', parentNodeId: 'node-area' }
  },
  {
    id: 'node-alt-feature',
    placeName: 'Narrow Passage',
    position: { x: 0, y: 0 },
    data: { description: '', aliases: [], status: 'rumored', nodeType: 'feature', parentNodeId: 'node-area' }
  },
  {
    id: 'node-location-same-name',
    placeName: 'Narrow Passage',
    position: { x: 0, y: 0 },
    data: { description: '', aliases: [], status: 'rumored', nodeType: 'location', parentNodeId: 'universe' }
  }
];

const mapData: MapData = { nodes, edges: [] };

const themeNodes = nodes;

describe('selectBestMatchingMapNode', () => {
  it('matches exact name', () => {
    const result = selectBestMatchingMapNode('Utility Entrance', theme, mapData, themeNodes, null);
    expect(result).toBe('node-feature');
  });

  it('matches alias', () => {
    const result = selectBestMatchingMapNode('Utility Hatch', theme, mapData, themeNodes, null);
    expect(result).toBe('node-feature');
  });

  it('prefers feature node when names tie', () => {
    const result = selectBestMatchingMapNode('Narrow Passage', theme, mapData, themeNodes, null);
    expect(result).toBe('node-alt-feature');
  });
});
