import { describe, it, expect } from 'vitest';
import { filterDuplicateCreates } from '../utils/itemChangeUtils';
import type { ItemChange } from '../types';

describe('filterDuplicateCreates', () => {
  it('removes inventory creates when librarian creates same item', () => {
    const inventory: Array<ItemChange> = [
      {
        action: 'create',
        item: {
          id: 'book1',
          name: 'Ancient Tome',
          type: 'book',
          description: 'old',
          holderId: 'player',
        },
      },
      {
        action: 'create',
        item: {
          id: 'lantern1',
          name: 'Lantern',
          type: 'single-use',
          description: 'light',
          holderId: 'player',
        },
      },
    ];
    const librarian: Array<ItemChange> = [
      {
        action: 'create',
        item: {
          id: 'book2',
          name: 'Ancient Tome',
          type: 'book',
          description: 'old',
          holderId: 'player',
        },
      },
    ];
    const result = filterDuplicateCreates(inventory, librarian);
    expect(result).toHaveLength(1);
    expect(result[0]?.item.name).toBe('Lantern');
  });
});
