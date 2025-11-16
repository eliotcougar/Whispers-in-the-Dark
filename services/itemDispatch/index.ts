import {
  ItemDispatchRequest,
  ItemDispatchResponse,
  ItemDirective,
} from '../../types';

const WRITTEN_KEYWORDS = [
  'book',
  'page',
  'map',
  'scroll',
  'tome',
  'chapter',
  'inscription',
  'script',
  'ritual',
  'journal',
  'tablet',
  'etched',
  'written',
  'letter',
  'note',
  'poem',
  'verse',
];

const hasWrittenCue = (
  directive: ItemDirective,
  knownWrittenItemIds: Set<string>,
): boolean => {
  const itemIds = Array.isArray(directive.itemIds)
    ? directive.itemIds
    : directive.itemIds
      ? [directive.itemIds]
      : [];
  if (itemIds.some(id => knownWrittenItemIds.has(id))) return true;
  const instruction = directive.instruction.toLowerCase();
  return WRITTEN_KEYWORDS.some(keyword => instruction.includes(keyword));
};

export const dispatchItemDirectives = (
  request: ItemDispatchRequest,
): ItemDispatchResponse => {
  const inventoryDirectives: Array<ItemDirective> = [];
  const librarianDirectives: Array<ItemDirective> = [];
  const sharedDirectives: Array<ItemDirective> = [];
  const unresolvedDirectives: Array<ItemDirective> = [];

  const knownWrittenIds = new Set<string>(request.knownWrittenItemIds);
  const knownInventoryIds = new Set<string>(request.knownInventoryItemIds);

  const chooseTarget = (directive: ItemDirective): 'inventory' | 'librarian' | 'shared' | 'unresolved' => {
    if (directive.suggestedHandler === 'inventory') return 'inventory';
    if (directive.suggestedHandler === 'librarian') return 'librarian';
    if (directive.suggestedHandler === 'either') return 'unresolved';
    const itemIds = Array.isArray(directive.itemIds)
      ? directive.itemIds
      : directive.itemIds
        ? [directive.itemIds]
        : [];

    const referencesKnownInventory = itemIds.some(id => knownInventoryIds.has(id));
    const referencesKnownWritten = itemIds.some(id => knownWrittenIds.has(id));

    if (referencesKnownWritten || hasWrittenCue(directive, knownWrittenIds)) return 'librarian';
    if (referencesKnownInventory) return 'inventory';
    if (directive.suggestedHandler === 'unknown') return 'unresolved';

    return 'inventory';
  };

  const applyFallbackRouting = (directive: ItemDirective): 'inventory' | 'librarian' | 'unresolved' => {
    const lower = directive.instruction.toLowerCase();
    const writtenHint = hasWrittenCue(directive, knownWrittenIds);
    if (writtenHint) return 'librarian';
    if (/(write|scribble|ink|page|journal|map|picture|scroll|book|inscription|chapter|stanza|verse)/.test(lower)) {
      return 'librarian';
    }
    return 'inventory';
  };

  request.directives.forEach(directive => {
    let target = chooseTarget(directive);
    if (target === 'unresolved' || directive.suggestedHandler === 'either') {
      target = applyFallbackRouting(directive);
    }
    if (target === 'inventory') {
      inventoryDirectives.push(directive);
    } else if (target === 'librarian') {
      librarianDirectives.push(directive);
    } else if (target === 'shared') {
      sharedDirectives.push(directive);
    } else {
      unresolvedDirectives.push(directive);
    }
  });

  const rationale = [
    `inventory=${String(inventoryDirectives.length)}`,
    `librarian=${String(librarianDirectives.length)}`,
    `shared=${String(sharedDirectives.length)}`,
    `unresolved=${String(unresolvedDirectives.length)}`,
  ].join(', ');

  return {
    inventoryDirectives,
    librarianDirectives,
    sharedDirectives,
    unresolvedDirectives,
    rationale,
  };
};
