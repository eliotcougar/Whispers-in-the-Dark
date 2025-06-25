
/**
 * @file utils/promptFormatters/inventory.ts
 * @description Functions for formatting player inventory for AI prompts.
 */

import { Item, ItemTag } from '../../types';

const TAG_MEANINGS: Partial<Record<ItemTag, { notRecovered: string; recovered: string }>> = {
  foreign: {
    notRecovered: 'The text appears to be in an unfamiliar language and might be translated',
    recovered: 'The foreign text has been translated',
  },
  runic: {
    notRecovered: 'The text is written in strange runes and might be translated',
    recovered: 'The runic text has been translated',
  },
  glitching: {
    notRecovered: 'The text is glitching or corrupted and might be restored',
    recovered: 'The previously corrupted text has been restored',
  },
  encrypted: {
    notRecovered: 'The text is encoded and might be decoded',
    recovered: 'The text has been decoded',
  },
} as const;

/**
 * Formats a list of items for use in AI prompts.
 */
export const itemsToString = (
  items: Item | Array<Item>,
  prefix = '',
  addDescription = true,
  addKnownUses = true,
  singleLine = false,
  includeTags = false,
  includeTagMeaning = false,
): string => {
  const itemList = Array.isArray(items) ? items : [items];
  if (itemList.length === 0) return 'Empty.';
  const delimiter = singleLine ? '; ' : ';\n';

  return itemList
    .map(item => {
      let itemStr = `${prefix}${item.id} - "${item.name}"`;
      const detailParts: Array<string> = [];
      if (addDescription) {
        detailParts.push(`Type: "${item.type}"`);
        if (includeTags && item.tags && item.tags.length > 0) {
          detailParts.push(`Tags: ${item.tags.join(', ')}`);
        }
        if (includeTagMeaning && item.tags && item.tags.length > 0) {
          const hasRecovered = item.tags.includes('recovered');
            const meanings = item.tags
            .map(tag => {
              const entry = TAG_MEANINGS[tag];
              if (!entry) return null;
              return hasRecovered ? entry.recovered : entry.notRecovered;
            })
            .filter((v): v is string => !!v);
          if (meanings.length > 0) detailParts.push(meanings.join(' '));
        }
        detailParts.push(
          `Description: "${
            item.isActive && item.activeDescription
              ? item.activeDescription
              : item.description
          }"${item.isActive ? ', It is active' : ''}`,
        );
        itemStr += ` (${detailParts.join(', ')})`;
      } else {
        const extras: Array<string> = [];
        if (includeTags && item.tags && item.tags.length > 0) {
          extras.push(`Tags: ${item.tags.join(', ')}`);
        }
        if (includeTagMeaning && item.tags && item.tags.length > 0) {
          const hasRecovered = item.tags.includes('recovered');
            const meanings = item.tags
            .map(tag => {
              const entry = TAG_MEANINGS[tag];
              if (!entry) return null;
              return hasRecovered ? entry.recovered : entry.notRecovered;
            })
            .filter((v): v is string => !!v);
          if (meanings.length > 0) extras.push(meanings.join(' '));
        }
        if (extras.length > 0) itemStr += ` (${extras.join(', ')})`;
      }

      if (addKnownUses && item.knownUses && item.knownUses.length > 0) {
        const applicableUses = item.knownUses.filter(ku => {
          const isActive = !!item.isActive;
          if (
            ku.appliesWhenActive !== undefined &&
            ku.appliesWhenInactive !== undefined
          ) {
            return (
              (ku.appliesWhenActive && isActive) ||
              (ku.appliesWhenInactive && !isActive)
            );
          }
          if (ku.appliesWhenActive !== undefined)
            return ku.appliesWhenActive === isActive;
          if (ku.appliesWhenInactive !== undefined)
            return ku.appliesWhenInactive === !isActive;
          return true;
        });
        if (applicableUses.length > 0) {
          itemStr += `, Available Actions: ${applicableUses
            .map(ku => `"${ku.actionName}"`)
            .join(', ')}`;
        }
      }

      return itemStr;
    })
    .join(delimiter);
};

