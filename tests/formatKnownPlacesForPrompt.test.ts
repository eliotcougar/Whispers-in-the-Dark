import { describe, it, expect } from 'vitest';
import { formatKnownPlacesForPrompt } from '../utils/promptFormatters/map';
import type { MapNode } from '../types';

const baseNodes: Array<MapNode> = [
  {
    id: 'loc1',
    placeName: 'Town',
    position: { x: 0, y: 0 },
    description: 'Desc', status: 'discovered', type: 'location',
  },
  {
    id: 'loc2',
    placeName: 'Forest',
    position: { x: 0, y: 0 },
    description: 'Trees', status: 'discovered', type: 'location',
  },
];

describe('formatKnownPlacesForPrompt', () => {
  it('includes IDs by default', () => {
    const result = formatKnownPlacesForPrompt(baseNodes, false);
    expect(result).toBe('loc1 - "Town", loc2 - "Forest".');
  });

  it('omits IDs when includeIds is false', () => {
    const result = formatKnownPlacesForPrompt(baseNodes, false, false);
    expect(result).toBe('"Town", "Forest".');
  });
});
