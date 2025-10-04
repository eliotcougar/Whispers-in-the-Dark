/**
 * @file utils/promptFormatters/inventory.ts
 * @description Functions for formatting player inventory for AI prompts.
 */

import { Item, ItemTag, KnownUse } from '../../types';

export const DEFAULT_ITEM_PROMPT_TEMPLATE =
  '<ID: {id}> - "{name}" (Type: "{type}"{tags}, Description: "{currentdescription}"{activehint}){availableactions}{unavailableactions};\n';

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
        if (typeof entry === 'number' || typeof entry === 'boolean' || typeof entry === 'bigint') {
          return String(entry);
        }
        if (typeof entry === 'symbol') {
          return entry.description ?? entry.toString();
        }
        if (typeof entry === 'function') {
          return '[function]';
        }
        return JSON.stringify(entry);
      })
      .join(', ');
  }
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value);
  }
  if (typeof value === 'symbol') {
    return value.description ?? value.toString();
  }
  if (typeof value === 'function') {
    return '[function]';
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return '';
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

const isUseAvailable = (knownUse: KnownUse, isActive: boolean): boolean => {
  const { appliesWhenActive, appliesWhenInactive } = knownUse;

  if (appliesWhenActive !== undefined && appliesWhenInactive !== undefined) {
    return (appliesWhenActive && isActive) || (appliesWhenInactive && !isActive);
  }
  if (appliesWhenActive !== undefined) {
    return appliesWhenActive === isActive;
  }
  if (appliesWhenInactive !== undefined) {
    return appliesWhenInactive === !isActive;
  }
  return true;
};

interface KnownUseAvailability {
  available: Array<KnownUse>;
  unavailable: Array<KnownUse>;
}

const computeKnownUseAvailability = (item: Item): KnownUseAvailability => {
  const knownUses = Array.isArray(item.knownUses) ? item.knownUses : [];
  const availability: KnownUseAvailability = { available: [], unavailable: [] };
  if (knownUses.length === 0) {
    return availability;
  }

  const isActive = Boolean(item.isActive);
  for (const use of knownUses) {
    if (isUseAvailable(use, isActive)) {
      availability.available.push(use);
    } else {
      availability.unavailable.push(use);
    }
  }

  return availability;
};

const stringifyActionList = (actions: Array<KnownUse>): string =>
  actions.map(action => `"${action.actionName}"`).join(', ');

const formatAvailableActions = (availability: KnownUseAvailability): string => {
  if (availability.available.length === 0) {
    return '';
  }

  return `, Available Actions: ${stringifyActionList(availability.available)}`;
};

const formatUnavailableActions = (availability: KnownUseAvailability): string => {
  if (availability.unavailable.length === 0) {
    return '';
  }

  return `, Unavailable Actions: ${stringifyActionList(availability.unavailable)}`;
};

const currentDescription = (item: Item): string => {
  if (item.isActive && item.activeDescription) {
    return item.activeDescription;
  }
  return item.description;
};

const activeHint = (item: Item): string => (item.isActive ? ', It is active' : '');

const renderTemplateForItem = (item: Item, template: string, index: number, lastIndex: number): string => {
  const knownUseAvailability = computeKnownUseAvailability(item);
  const rendered = template.replace(STRING_TEMPLATE_TOKEN, (_match, token) => {
    switch (token) {
      case 'tags':
        return formatTags(item);
      case 'tagswithdescription':
        return formatTagsWithDescription(item);
      case 'availableactions':
        return formatAvailableActions(knownUseAvailability);
      case 'unavailableactions':
        return formatUnavailableActions(knownUseAvailability);
      case 'currentdescription':
        return currentDescription(item);
      case 'activehint':
        return activeHint(item);
      default: {
        if (!Object.prototype.hasOwnProperty.call(item, token)) {
          return '';
        }
        const record = item as Partial<Record<keyof Item, unknown>>;
        const candidate = record[token as keyof Item];
        return stringifyItemValue(candidate);
      }
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
