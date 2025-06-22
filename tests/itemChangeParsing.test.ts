import { describe, it, expect } from 'vitest';
import { parseInventoryResponse } from '../services/inventory/responseParser';

const PLAYER = 'player';

describe('parseInventoryResponse', () => {
  it('filters invalid ItemChange entries', () => {
    const rawPayload = {
      itemChanges: [
        { action: 'gain', item: { name: 'Lantern', type: 'equipment', description: 'Bright', holderId: PLAYER } },
        { action: 'gain', item: { name: 'BadItem', type: 'invalid', description: 'oops', holderId: PLAYER } },
        { action: 'update', item: { name: 'Lantern', newName: 'Bright Lantern', holderId: PLAYER } },
        { action: 'update', item: { newName: 'No Name' } },
        { action: 'destroy', item: { id: 'old1', name: 'Old Lantern' } },
        { action: 'destroy', item: null },
        { action: 'give', item: { id: 'gift1', fromId: PLAYER, toId: 'npc1' } },
        { action: 'take', item: { id: 'gift2', fromId: 'npc2', toId: PLAYER } },
        { action: 'give', item: { id: 5, fromId: PLAYER } },
        { action: 123, item: { name: 'Bad', type: 'equipment', description: 'x', holderId: PLAYER } },
        { action: 'gain', item: 'not object' },
      ],
      observations: 'obs',
      rationale: 'why',
    };

    const responseText = "```json\n" + JSON.stringify(rawPayload) + "\n```";
    const maybeResult = parseInventoryResponse(responseText);
    if (!maybeResult) throw new Error('Failed to parse inventory response');
    const result = maybeResult;

    expect(result.itemChanges.length).toBe(5);
    expect(result.itemChanges).toEqual([
      rawPayload.itemChanges[0],
      rawPayload.itemChanges[2],
      rawPayload.itemChanges[4],
      rawPayload.itemChanges[6],
      rawPayload.itemChanges[7],
    ]);
    expect(result.observations).toBe('obs');
    expect(result.rationale).toBe('why');
  });

  it('handles update rename and destroy heuristics with put action', () => {
    const payload = {
      itemChanges: [
        { action: 'update', item: { id: 'i1', name: 'Old Sword', newName: 'Shiny Sword' } },
        { action: 'update', item: { id: 'i2', name: 'Old Shield' } },
        { action: 'update', item: { id: 'i3', name: 'Broken Torch', type: 'destroyed' } },
        { action: 'update', item: { id: 'i4', name: 'Lost Ring', status: 'gone' } },
        { action: 'put', item: { name: 'Lantern', type: 'Equipment', description: 'Bright', holderId: 'node1' } },
      ],
    };

    const text = '```json\n' + JSON.stringify(payload) + '\n```';
    const maybeRes = parseInventoryResponse(text);
    if (!maybeRes) throw new Error('Failed to parse inventory response');
    const res = maybeRes;

    expect(res.itemChanges).toEqual([
      payload.itemChanges[0],
      payload.itemChanges[1],
      { action: 'destroy', item: { id: 'i3', name: 'Broken Torch' } },
      { action: 'destroy', item: { id: 'i4', name: 'Lost Ring' } },
      { action: 'put', item: { name: 'Lantern', type: 'equipment', description: 'Bright', holderId: 'node1' } },
    ]);
  });

  it('adds printed tag when page item lacks style tags', () => {
    const payload = {
      itemChanges: [
        {
          action: 'gain',
          item: {
            name: 'Mysterious Note',
            type: 'page',
            description: 'An old piece of parchment',
            holderId: PLAYER,
          },
        },
      ],
    };

    const text = '```json\n' + JSON.stringify(payload) + '\n```';
    const maybeRes = parseInventoryResponse(text);
    if (!maybeRes) throw new Error('Failed to parse inventory response');
    const res = maybeRes;

    const item = res.itemChanges[0].item as { tags?: Array<string> };
    expect(item.tags).toEqual(['printed']);
  });
});
