import { describe, it, expect } from 'vitest';
import { applyItemChangeAction, buildItemChangeRecords, applyAllItemChanges } from '../utils/inventoryUtils';
import { PLAYER_HOLDER_ID } from '../constants';
import type { ItemChange, Item } from '../types';

describe('inventoryUtils', () => {
  it('applyItemChangeAction adds acquired item', () => {
    const change: ItemChange = {
      action: 'create',
      item: { id: 'it1', name: 'Torch', type: 'equipment', description: 'Bright', holderId: PLAYER_HOLDER_ID },
    };
    const result = applyItemChangeAction([], change);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Torch');
  });

  it('acquire page item preserves contentLength', () => {
    const change: ItemChange = {
      action: 'create',
      item: {
        id: 'pg1',
        name: 'Torn Note',
        type: 'page',
        description: 'A scrap of paper',
        holderId: PLAYER_HOLDER_ID,
        chapters: [
          {
            heading: 'Torn Note',
            description: 'A scrap of paper',
            contentLength: 25,
          },
        ],
      },
    };
    const result = applyItemChangeAction([], change);
    expect(result[0].chapters?.[0].contentLength).toBe(25);
  });

  it('buildItemChangeRecords returns acquire record', () => {
    const change: ItemChange = {
      action: 'create',
      item: { id: 'it1', name: 'Torch', type: 'equipment', description: 'Bright', holderId: PLAYER_HOLDER_ID },
    };
    const records = buildItemChangeRecords([change], []);
    expect(records).toEqual([
      {
        type: 'acquire',
        acquiredItem: {
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
        action: 'create',
        item: { id: 'it1', name: 'Torch', type: 'equipment', description: 'Bright', holderId: PLAYER_HOLDER_ID },
      },
      {
        action: 'change',
        item: { id: 'it1', name: 'Torch', isActive: true, holderId: PLAYER_HOLDER_ID },
      },
    ];
    const result = applyAllItemChanges(changes, []);
    expect(result[0].isActive).toBe(true);
  });

  it('addDetails action appends chapter and resets inspect turn', () => {
    const initial: Array<Item> = [
      {
        id: 'book1',
        name: 'Mysteries',
        type: 'book',
        description: 'Old book',
        holderId: PLAYER_HOLDER_ID,
        chapters: [
          { heading: 'Intro', description: 'start', contentLength: 50 },
        ],
        lastInspectTurn: 3,
      },
    ];
    const change: ItemChange = {
      action: 'addDetails',
      item: {
        id: 'book1',
        name: 'Mysteries',
        type: 'book',
        chapters: [{ heading: 'New', description: 'More', contentLength: 60 }],
      },
    };
    const result = applyItemChangeAction(initial, change);
    expect(result[0].chapters?.length).toBe(2);
    expect(result[0].lastInspectTurn).toBeUndefined();
  });

  it('change action with activeDescription null clears the stored active text', () => {
    const initial: Array<Item> = [
      {
        id: 'lantern1',
        name: 'Old Lantern',
        type: 'equipment',
        description: 'A dusty lantern.',
        holderId: PLAYER_HOLDER_ID,
        activeDescription: 'The lantern is lit and casts a warm glow.',
        isActive: true,
      },
    ];
    const change: ItemChange = {
      action: 'change',
      item: {
        id: 'lantern1',
        name: 'Old Lantern',
        activeDescription: null,
      },
    };
    const result = applyItemChangeAction(initial, change);
    expect(result[0].activeDescription).toBeUndefined();
    expect(result[0].isActive).toBe(false);
  });
});
