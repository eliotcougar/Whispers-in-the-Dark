
/**
 * @file utils/promptFormatters/inventory.ts
 * @description Functions for formatting player inventory for AI prompts.
 */

import { Item } from '../../types';

/**
 * Formats a list of items for use in AI prompts.
 */
export const formatInventoryForPrompt = (inventory: Item[]): string => {
  if (inventory.length === 0) return "Empty.";
  return inventory
    .map(item => {
      let itemStr = `${item.id} - "${item.name}" (Type: "${item.type}", Description: "${
        item.isActive && item.activeDescription
          ? item.activeDescription
          : item.description
      }"${item.isActive ? ', It is active' : ''})`;
      if (item.knownUses && item.knownUses.length > 0) {
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
    .join("\n - ");
};

