import { describe, it, expect } from 'vitest';
import { applyItemChangeAction, buildItemChangeRecords, applyAllItemChanges } from '../utils/inventoryUtils';
import { PLAYER_HOLDER_ID } from '../constants';
import type { ItemChange } from '../types';

describe('inventoryUtils', () => {
  it('applyItemChangeAction adds gained item', () => {
    const change: ItemChange = {
      action: 'gain',
      item: { id: 'it1', name: 'Torch', type: 'equipment', description: 'Bright', holderId: PLAYER_HOLDER_ID },
    };
    const result = applyItemChangeAction([], change);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Torch');
  });

  it('gain page item preserves contentLength', () => {
    const change: ItemChange = {
      action: 'gain',
      item: {
        id: 'pg1',
        name: 'Torn Note',
        type: 'page',
        description: 'A scrap of paper',
        holderId: PLAYER_HOLDER_ID,
        contentLength: 25,
      },
    };
    const result = applyItemChangeAction([], change);
    expect(result[0].contentLength).toBe(25);
  });

  it('buildItemChangeRecords returns gain record', () => {
    const change: ItemChange = {
      action: 'gain',
      item: { id: 'it1', name: 'Torch', type: 'equipment', description: 'Bright', holderId: PLAYER_HOLDER_ID },
    };
    const records = buildItemChangeRecords([change], []);
    expect(records).toEqual([
      {
        type: 'gain',
        gainedItem: {
          id: 'it1',
          name: 'Torch',
          type: 'equipment',
          description: 'Bright',
          activeDescription: undefined,
          isActive: false,
          tags: [],
          knownUses: [],
          holderId: PLAYER_HOLDER_ID,
        },
      },
    ]);
  });

  it('applyAllItemChanges applies multiple changes', () => {
    const changes: Array<ItemChange> = [
      {
        action: 'gain',
        item: { id: 'it1', name: 'Torch', type: 'equipment', description: 'Bright', holderId: PLAYER_HOLDER_ID },
      },
      {
        action: 'update',
        item: { id: 'it1', name: 'Torch', isActive: true, holderId: PLAYER_HOLDER_ID },
      },
    ];
    const result = applyAllItemChanges(changes, []);
    expect(result[0].isActive).toBe(true);
  });
});
