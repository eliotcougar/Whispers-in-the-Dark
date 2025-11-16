import { describe, it, expect } from 'vitest';
import { trimDialogueHints, type DialogueHints } from '../utils/dialogueParsing';
import type { ItemDirective } from '../types';

describe('trimDialogueHints', () => {
  it('trims mapHint and filters invalid directives', () => {
    const obj: DialogueHints = {
      mapHint: '  the map  ',
      itemDirectives: [
        {
          directiveId: '  note-1 ',
          instruction: '  do thing ',
          itemIds: ['item-1', ''],
          provisionalNames: ['New Relic', ''],
          suggestedHandler: 'inventory',
          metadata: { urgency: 'high' },
        },
        { directiveId: '', instruction: 'missing id' } as unknown as ItemDirective,
        { directiveId: 'note-bad', instruction: '' } as unknown as ItemDirective,
        null as unknown as ItemDirective,
        {
          directiveId: 'note-2',
          instruction: 'Second',
          itemIds: 'item-2',
          suggestedHandler: 'either',
        },
      ],
    };

    const result = trimDialogueHints(obj);

    expect(result.mapHint).toBe('the map');
    expect(result.itemDirectives).toEqual([
      {
        directiveId: 'note-1',
        instruction: 'do thing',
        itemIds: ['item-1'],
        provisionalNames: ['New Relic'],
        suggestedHandler: 'inventory',
        metadata: { urgency: 'high' },
      },
      {
        directiveId: 'note-2',
        instruction: 'Second',
        itemIds: ['item-2'],
        suggestedHandler: 'either',
      },
    ]);
  });

  it('returns empty directives when undefined or invalid', () => {
    const obj = {
      mapHint: undefined,
      itemDirectives: 'n/a',
    } as unknown as DialogueHints;

    const result = trimDialogueHints(obj);
    expect(result.itemDirectives).toEqual([]);
  });
});
