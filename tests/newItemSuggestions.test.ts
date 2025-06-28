import { describe, it, expect } from 'vitest';
import { trimDialogueHints, type DialogueHints } from '../utils/dialogueParsing';
import type { NewItemSuggestion } from '../types';

describe('trimDialogueHints', () => {
  it('filters out invalid newItems and trims hints', () => {
    const obj = {
      mapHint: '  the map  ',
      playerItemsHint: '  gained  ',
      npcItemsHint: '  npc hint ',
      newItems: [
        { name: 'Torch', type: 'equipment', description: 'A trusty torch' },
        { name: '', type: 'equipment', description: 'Bad' }, // invalid name
        { name: 'Rope', description: 'Missing type' }, // missing type
        { name: 'Hammer', type: 'tool', description: 'Wrong type' }, // invalid type
        null as unknown as object, // null entry
        { name: 'Rug', type: 'equipment', description: '' }, // empty description
      ],
    } as unknown as DialogueHints;

    const result = trimDialogueHints(obj);

    expect(result.mapHint).toBe('the map');
    expect(result.playerItemsHint).toBe('gained');
    expect(result.npcItemsHint).toBe('npc hint');
    expect(result.newItems).toEqual([
      { name: 'Torch', type: 'equipment', description: 'A trusty torch' },
      { name: 'Hammer', type: 'equipment', description: 'Wrong type' },
    ]);
  });

  it('normalizes item type synonyms and removes invalid ones', () => {
    const obj: DialogueHints = {
      newItems: [
        { name: 'Potion', type: 'single use', description: 'Heal' } as unknown as NewItemSuggestion,
        { name: 'Bow', type: 'Weapon', description: 'Range' } as unknown as NewItemSuggestion,
        { name: 'Rock', type: 'rubbish', description: 'Junk' } as unknown as NewItemSuggestion,
        { name: 'Toolkit', type: 'tool', description: 'fix' } as unknown as NewItemSuggestion,
        { name: 'Portrait', type: 'photograph', description: 'Old' } as unknown as NewItemSuggestion,
        { name: 'Treasure Map', type: 'chart', description: 'X marks' } as unknown as NewItemSuggestion,
      ],
    };

    const result = trimDialogueHints(obj);
    expect(result.newItems).toEqual([
      { name: 'Potion', type: 'single-use', description: 'Heal' },
      { name: 'Bow', type: 'weapon', description: 'Range' },
      { name: 'Toolkit', type: 'equipment', description: 'fix' },
      { name: 'Portrait', type: 'picture', description: 'Old' },
      { name: 'Treasure Map', type: 'map', description: 'X marks' },
    ]);
  });
});
