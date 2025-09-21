/**
 * @file utils/promptFormatters/inventory.ts
 * @description Functions for formatting player inventory for AI prompts.
 */

import { Item, ItemTag } from '../../types';

export const DEFAULT_ITEM_PROMPT_TEMPLATE =
  '<ID: {id}> - "{name}" (Type: "{type}"{tags}, Description: "{currentdescription}"{activehint}){availableactions};\n';

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

const STRING_TEMPLATE_TOKEN = /\{([a-zA-Z0-9_]+)\}/g;

const stringifyItemValue = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) {
    return value
      .map(entry => {
        if (typeof entry === 'string') return entry;
        if (typeof entry === 'number' || typeof entry === 'boolean') return String(entry);
        return JSON.stringify(entry);
      })
      .join(', ');
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
};

const computeTagMeaning = (tags: Array<ItemTag>, hasRecovered: boolean): string => {
  const phrases: Array<string> = [];
  for (const tag of tags) {
    const meaning = TAG_MEANINGS[tag];
    if (!meaning) continue;
    phrases.push(hasRecovered ? meaning.recovered : meaning.notRecovered);
  }
  return phrases.join(' ');
};

const formatTags = (item: Item): string => {
  const tags = Array.isArray(item.tags) ? item.tags : [];
  if (tags.length === 0) return '';
  return `, Tags: ${tags.join(', ')}`;
};

const formatTagsWithDescription = (item: Item): string => {
  const tags = Array.isArray(item.tags) ? item.tags : [];
  if (tags.length === 0) return '';
  const hasRecovered = tags.includes('recovered');
  const meaning = computeTagMeaning(tags, hasRecovered);
  return meaning ? `, ${meaning}` : '';
};

const formatAvailableActions = (item: Item): string => {
  const knownUses = Array.isArray(item.knownUses) ? item.knownUses : [];
  if (knownUses.length === 0) return '';
  const isActive = Boolean(item.isActive);
  const applicable = knownUses.filter(ku => {
    if (ku.appliesWhenActive !== undefined && ku.appliesWhenInactive !== undefined) {
      return (ku.appliesWhenActive && isActive) || (ku.appliesWhenInactive && !isActive);
    }
    if (ku.appliesWhenActive !== undefined) {
      return ku.appliesWhenActive === isActive;
    }
    if (ku.appliesWhenInactive !== undefined) {
      return ku.appliesWhenInactive === !isActive;
    }
    return true;
  });
  if (applicable.length === 0) return '';
  const list = applicable.map(use => `"${use.actionName}"`).join(', ');
  return `, Available Actions: ${list}`;
};

const currentDescription = (item: Item): string => {
  if (item.isActive && item.activeDescription) {
    return item.activeDescription;
  }
  return item.description;
};

const activeHint = (item: Item): string => (item.isActive ? ', It is active' : '');

const renderTemplateForItem = (item: Item, template: string, index: number, lastIndex: number): string => {
  const rendered = template.replace(STRING_TEMPLATE_TOKEN, (_match, token) => {
    switch (token) {
      case 'tags':
        return formatTags(item);
      case 'tagswithdescription':
        return formatTagsWithDescription(item);
      case 'availableactions':
        return formatAvailableActions(item);
      case 'currentdescription':
        return currentDescription(item);
      case 'activehint':
        return activeHint(item);
      default:
        if (Object.prototype.hasOwnProperty.call(item, token)) {
          return stringifyItemValue((item as unknown as Record<string, unknown>)[token]);
        }
        return '';
    }
  });

  if (index === lastIndex) {
    const withoutTrailingWhitespace = rendered.replace(/\s+$/u, '');
    return withoutTrailingWhitespace.replace(/[;,]$/u, '');
  }
  return rendered;
};

/**
 * Formats a list of items for use in AI prompts using string templates.
 * Callers control layout entirely via the template, mirroring the flexibility of `npcsToString`.
 */
export const itemsToString = (
  items: Item | Array<Item>,
  template: string,
  prefix = '',
  suffix = '',
): string => {
  const itemList = Array.isArray(items) ? items : [items];
  if (itemList.length === 0) {
    return '';
  }

  const lastIndex = itemList.length - 1;
  const lines = itemList
    .map((item, index) => renderTemplateForItem(item, template, index, lastIndex))
    .filter(line => line.trim().length > 0);

  if (lines.length === 0) {
    return '';
  }

  const body = lines.join('');
  const parts: Array<string> = [];
  if (prefix) parts.push(prefix);
  parts.push(body);
  if (suffix) parts.push(suffix);
  return parts.join('').trimEnd();
};
