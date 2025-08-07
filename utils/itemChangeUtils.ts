/**
 * @file itemChangeUtils.ts
 * @description Helpers for working with arrays of ItemChange objects.
 */

import { ItemChange } from '../types';

/**
 * Filters out inventory create actions when the librarian already creates
 * an item with the same name. Case-insensitive name comparison is used.
 */
export const filterDuplicateCreates = (
  inventoryChanges: Array<ItemChange>,
  librarianChanges: Array<ItemChange>,
): Array<ItemChange> => {
  const librarianNames = new Set<string>();
  for (const change of librarianChanges) {
    if (change.action === 'create' && typeof change.item.name === 'string') {
      librarianNames.add(change.item.name.toLowerCase());
    }
  }
  return inventoryChanges.filter(
    change =>
      !(
        change.action === 'create' &&
        typeof change.item.name === 'string' &&
        librarianNames.has(change.item.name.toLowerCase())
      ),
  );
};

export default filterDuplicateCreates;
