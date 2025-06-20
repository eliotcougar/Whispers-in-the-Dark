
/**
 * @file utils/promptFormatters/inventory.ts
 * @description Functions for formatting player inventory for AI prompts.
 */

import { Item } from '../../types';

/**
 * Formats a list of items for use in AI prompts.
 */
export const itemsToString = (
  items: Item | Array<Item>,
  prefix = '',
  addDescription = true,
  addKnownUses = true,
  singleLine = false,
): string => {
  const itemList = Array.isArray(items) ? items : [items];
  if (itemList.length === 0) return 'Empty.';
  const delimiter = singleLine ? '; ' : ';\n';

  return itemList
    .map(item => {
      let itemStr = `${prefix}${item.id} - "${item.name}"`;
      if (addDescription) {
        itemStr += ` (Type: "${item.type}", Description: "${
          item.isActive && item.activeDescription
            ? item.activeDescription
            : item.description
        }"${item.isActive ? ', It is active' : ''})`;
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

