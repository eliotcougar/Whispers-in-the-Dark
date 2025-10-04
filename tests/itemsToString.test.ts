import { describe, it, expect } from 'vitest';

import { itemsToString } from '../utils/promptFormatters/inventory';
import type { Item } from '../types';

const TEMPLATE_WITH_TAGS = '<ID: {id}> - "{name}" (Type: "{type}"{tags}, Description: "{currentdescription}"{activehint}){availableactions}{unavailableactions};\n';
const TEMPLATE_WITH_TAG_MEANING = '<ID: {id}> - "{name}" (Type: "{type}"{tagswithdescription}, Description: "{currentdescription}"{activehint}){availableactions}{unavailableactions};\n';

const buildItem = (overrides: Partial<Item>): Item => ({
  id: 'item-generic-0000',
  name: 'Generic Item',
  type: 'single-use',
  description: 'Default description.',
  holderId: 'player',
  knownUses: [],
  ...overrides,
});

describe('itemsToString templating', () => {
  it('matches previous formatting when including tags', () => {
    const torches: Array<Item> = [
      buildItem({
        id: 'item-torch-1a2b',
        name: 'Torch',
        tags: ['foreign', 'recovered'],
        knownUses: [
          {
            actionName: 'Light Torch',
            promptEffect: 'Player lights the torch',
            description: 'Ignite the torch',
            appliesWhenInactive: true,
          },
        ],
      }),
    ];

    const formatted = itemsToString(torches, TEMPLATE_WITH_TAGS);

    expect(formatted).toBe(
      '<ID: item-torch-1a2b> - "Torch" (Type: "single-use", Tags: foreign, recovered, Description: "Default description."), Available Actions: "Light Torch"',
    );
  });

  it('includes tag meaning and active note when requested', () => {
    const arcanePage = buildItem({
      id: 'item-page-5c6d',
      name: 'Ancient Page',
      type: 'page',
      description: 'Unreadable scribbles.',
      activeDescription: 'Glowing script reveals itself.',
      isActive: true,
      tags: ['foreign'],
      knownUses: [
        {
          actionName: 'Study Page',
          promptEffect: 'Player studies the page',
          description: 'Examine the script',
          appliesWhenActive: true,
        },
        {
          actionName: 'Translate Page',
          promptEffect: 'Player translates the page',
          description: 'Attempt a translation',
          appliesWhenInactive: true,
        },
      ],
    });

    const formatted = itemsToString([arcanePage], TEMPLATE_WITH_TAG_MEANING);

    expect(formatted).toBe(
      '<ID: item-page-5c6d> - "Ancient Page" (Type: "page", The text appears to be in an unfamiliar language and might be translated, Description: "Glowing script reveals itself.", It is active), Available Actions: "Study Page", Unavailable Actions: "Translate Page"',
    );
  });

  it('joins multiple items with the provided delimiter pattern', () => {
    const items: Array<Item> = [
      buildItem({ id: 'item-one-1111', name: 'First Relic' }),
      buildItem({ id: 'item-two-2222', name: 'Second Relic' }),
    ];

    const formatted = itemsToString(items, TEMPLATE_WITH_TAGS);

    expect(formatted).toBe(
      '<ID: item-one-1111> - "First Relic" (Type: "single-use", Description: "Default description.");\n<ID: item-two-2222> - "Second Relic" (Type: "single-use", Description: "Default description.")',
    );
  });

  it('lists item names separated by commas without a trailing comma', () => {
    const items: Array<Item> = [
      buildItem({ id: 'item-one-1111', name: 'First Relic' }),
      buildItem({ id: 'item-two-2222', name: 'Second Relic' }),
    ];

    const formatted = itemsToString(items, '{name}, ');

    expect(formatted).toBe('First Relic, Second Relic');
  });

  it('returns an empty string when no items are present', () => {
    expect(itemsToString([], TEMPLATE_WITH_TAGS)).toBe('');
  });
});
