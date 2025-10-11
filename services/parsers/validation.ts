/**
 * @file validation.ts
 * @description Shared validation helpers for AI payloads.
 */
import {
  Item,
  ItemReference,
  ItemChapter,
  AddDetailsPayload,
  KnownUse,
  ItemData,
  ValidNPCUpdatePayload,
  ValidNewNPCPayload,
  DialogueSetupPayload,
} from '../../types';
import {
  VALID_ITEM_TYPES,
  VALID_PRESENCE_STATUS_VALUES,
  VALID_TAGS,
  TEXT_STYLE_TAGS,
  COMMON_TAGS,
  WRITTEN_TAGS,
  WRITTEN_ITEM_TYPES,
  SINGLE_CHAPTER_WRITTEN_ITEM_TYPES,
  CLOSE_PRESENCE_STATUSES,
  DISTANT_PRESENCE_STATUSES,
} from '../../constants';
import { normalizeItemType } from '../../utils/itemSynonyms';
import { normalizeTags } from '../../utils/tagSynonyms';

const TEXT_STYLE_TAG_SET = new Set<string>(TEXT_STYLE_TAGS);
const WRITTEN_TYPE_SET = new Set<string>(WRITTEN_ITEM_TYPES as ReadonlyArray<string>);
const SINGLE_CHAPTER_WRITTEN_TYPE_SET = new Set<string>(
  SINGLE_CHAPTER_WRITTEN_ITEM_TYPES as ReadonlyArray<string>,
);

function guessTextStyle(name: string, description: string): typeof TEXT_STYLE_TAGS[number] {
  const text = `${name} ${description}`.toLowerCase();
  if (/(handwritten|scribbled|ink|pen|quill)/.test(text)) return 'handwritten';
  if (/(typewriter|typed)/.test(text)) return 'typed';
  if (/(digital|screen|display|tablet|monitor|terminal)/.test(text)) return 'digital';
  return 'printed';
}

export function isValidKnownUse(ku: unknown): ku is KnownUse {
  if (!ku || typeof ku !== 'object') return false;
  const obj = ku as Partial<KnownUse>;
  if (typeof obj.actionName !== 'string' || obj.actionName.trim() === '') return false;
  if (typeof obj.promptEffect !== 'string' || obj.promptEffect.trim() === '') return false;
  if (obj.appliesWhenActive !== undefined && typeof obj.appliesWhenActive !== 'boolean') return false;
  if (obj.appliesWhenInactive !== undefined && typeof obj.appliesWhenInactive !== 'boolean') return false;
  if (typeof obj.description !== 'string' || obj.description.trim() === '') return false;
  return true;
}

export function isValidItem(item: unknown, context?: 'create' | 'change'): item is Item {
  if (!item || typeof item !== 'object') return false;
  const obj = item as Partial<Item> & {
    newName?: string;
    contentLength?: number;
    actualContent?: string;
    visibleContent?: string;
  };

  if (typeof obj.type === 'string') {
    const normalized = normalizeItemType(obj.type);
    if (normalized) obj.type = normalized;
  }

  // Name is always required
  if (typeof obj.name !== 'string' || obj.name.trim() === '') {
    console.warn("isValidItem: 'name' is missing or invalid.", item);
    return false;
  }

  // Fields required for 'create' or if it's not a 'change' context
  if (context === 'create' || !context) {
    if (typeof obj.type !== 'string' || !VALID_ITEM_TYPES.includes(obj.type)) {
        console.warn(`isValidItem (context: ${context ?? 'default'}): 'type' is missing or invalid.`, item);
        return false;
    }
    if (typeof obj.description !== 'string' || obj.description.trim() === '') {
        console.warn(`isValidItem (context: ${context ?? 'default'}): 'description' is missing or invalid.`, item);
        return false;
    }
    if (typeof obj.holderId !== 'string' || obj.holderId.trim() === '') {
        console.warn(`isValidItem (context: ${context ?? 'default'}): 'holderId' is missing or invalid.`, item);
        return false;
    }
  }

  // Fields required for 'change' if it's a transformation (newName is present)
  if (context === 'change' && obj.newName != null) {
    if (typeof obj.newName !== 'string' || obj.newName.trim() === '') {
        console.warn("isValidItem (context: change, with newName): 'newName' is invalid.", item);
        return false;
    }
    // 'type' and 'description' can be omitted and inherited from the existing item.
  }


  // Validate optional fields if they are present, regardless of context (unless specific context requires them)
  if (obj.type !== undefined) {
    const normalized = normalizeItemType(obj.type);
    if (!normalized) {
      console.warn("isValidItem: 'type' is present but invalid.", item);
      return false;
    }
    obj.type = normalized;
  }
  if (obj.description !== undefined && (typeof obj.description !== 'string' || obj.description.trim() === '')) {
      // Allow empty description if it's a change payload and not a transformation,
      // as it might be intentionally cleared, but an empty description for a create/new item is bad.
      if ((context === 'create' || (context === 'change' && obj.newName)) && obj.description.trim() === '') {
        console.warn(`isValidItem: 'description' is present but empty, which is invalid for a create or transformation.`, item);
        return false;
      }
  }
  if (obj.activeDescription !== undefined) {
    const isNullActiveDescription = obj.activeDescription === null;
    if (isNullActiveDescription) {
      if (context !== 'change') {
        console.warn("isValidItem: 'activeDescription' cannot be null for this context.", item);
        return false;
      }
    } else if (typeof obj.activeDescription !== 'string') {
      console.warn("isValidItem: 'activeDescription' is present but invalid.", item);
      return false;
    }
  }
  if (obj.isActive !== undefined && typeof obj.isActive !== 'boolean') {
    console.warn("isValidItem: 'isActive' is present but invalid.", item);
    return false;
  }
  if (obj.stashed !== undefined && typeof obj.stashed !== 'boolean') {
    console.warn("isValidItem: 'stashed' is present but invalid.", item);
    return false;
  }
  if (obj.tags !== undefined) {
    if (!Array.isArray(obj.tags) || !obj.tags.every(t => typeof t === 'string')) {
      console.warn("isValidItem: 'tags' is present but invalid.", item);
      return false;
    }
    const normalized = normalizeTags(obj.tags);
    if (normalized) obj.tags = normalized;
    else obj.tags = obj.tags.filter(t => (VALID_TAGS as ReadonlyArray<string>).includes(t));
    const allowed =
      obj.type === undefined
        ? VALID_TAGS
        : WRITTEN_TYPE_SET.has(obj.type)
          ? [...COMMON_TAGS, ...WRITTEN_TAGS]
          : COMMON_TAGS;
    obj.tags = obj.tags.filter(t =>
      (allowed as ReadonlyArray<string>).includes(t),
    );
  }
  if (WRITTEN_TYPE_SET.has(obj.type ?? '')) {
    obj.tags = obj.tags ?? [];
    const styleTags = obj.tags.filter(t => TEXT_STYLE_TAG_SET.has(t));
    if (styleTags.length === 0) {
      const guessed = guessTextStyle(obj.name, obj.description ?? '');
      obj.tags.unshift(guessed);
    } else if (styleTags.length > 1) {
      const [keep] = styleTags;
      obj.tags = [keep, ...obj.tags.filter(t => !TEXT_STYLE_TAG_SET.has(t))];
    }
  }
  if (obj.holderId !== undefined && (typeof obj.holderId !== 'string' || obj.holderId.trim() === '')) {
    console.warn("isValidItem: 'holderId' is present but invalid.", item);
    return false;
  }

  const chaptersValid = (chs: unknown): chs is Array<ItemChapter> =>
    Array.isArray(chs) &&
    chs.every(
      (ch) =>
        ch &&
        typeof ch === 'object' &&
        typeof (ch as ItemChapter).heading === 'string' &&
        typeof (ch as ItemChapter).description === 'string' &&
        typeof (ch as ItemChapter).contentLength === 'number' &&
        ((ch as ItemChapter).imageData === undefined ||
          typeof (ch as ItemChapter).imageData === 'string')
    );

  const type = obj.type;
  if (type && WRITTEN_TYPE_SET.has(type)) {
    if (obj.chapters !== undefined) {
      if (!chaptersValid(obj.chapters)) {
        console.warn("isValidItem: 'chapters' is present but invalid.", item);
        return false;
      }
      if (SINGLE_CHAPTER_WRITTEN_TYPE_SET.has(type) && obj.chapters.length > 1) {
        obj.chapters = [obj.chapters[0]];
      }
    } else {
      const len =
        typeof obj.contentLength === 'number' ? obj.contentLength : 30;
      obj.chapters = [
        {
          heading: obj.name,
          description: obj.description ?? '',
          contentLength: len,
          actualContent:
            typeof obj.actualContent === 'string' ? obj.actualContent : undefined,
          visibleContent:
            typeof obj.visibleContent === 'string'
              ? obj.visibleContent
              : undefined,
        },
      ];
    }
    delete obj.contentLength;
    delete obj.actualContent;
    delete obj.visibleContent;
  } else if (obj.chapters !== undefined && !chaptersValid(obj.chapters)) {
    console.warn("isValidItem: 'chapters' is present but invalid for non-book/page item.", item);
    return false;
  }


  if (obj.contentLength !== undefined && typeof obj.contentLength !== 'number') {
    console.warn("isValidItem: 'contentLength' is present but invalid.", item);
    return false;
  }
  if (obj.actualContent !== undefined && typeof obj.actualContent !== 'string') {
    console.warn("isValidItem: 'actualContent' is present but invalid.", item);
    return false;
  }
  if (obj.visibleContent !== undefined && typeof obj.visibleContent !== 'string') {
    console.warn("isValidItem: 'visibleContent' is present but invalid.", item);
    return false;
  }
  if (obj.knownUses !== undefined && !(Array.isArray(obj.knownUses) && obj.knownUses.every(isValidKnownUse))) {
    console.warn("isValidItem: 'knownUses' is present but invalid.", item);
    return false;
  }
  
  return true;
}

export function isValidItemReference(obj: unknown): obj is ItemReference {
  if (!obj || typeof obj !== 'object') return false;
  const maybe = obj as Partial<ItemReference>;
  return (
    typeof maybe.id === 'string' && maybe.id.trim() !== '' &&
    typeof maybe.name === 'string' && maybe.name.trim() !== ''
  );
}

export function isValidAddDetailsPayload(obj: unknown): obj is AddDetailsPayload {
  if (!obj || typeof obj !== 'object') return false;
  const maybe = obj as Partial<AddDetailsPayload> & {
    chapters?: unknown;
    knownUses?: unknown;
    tags?: unknown;
  };
  if (
    typeof maybe.id !== 'string' ||
    maybe.id.trim() === '' ||
    typeof maybe.name !== 'string' ||
    maybe.name.trim() === '' ||
    typeof maybe.type !== 'string' ||
    !VALID_ITEM_TYPES.includes(maybe.type)
  ) {
    return false;
  }
  const isWritten = ['page', 'book', 'map', 'picture'].includes(maybe.type);

  if (
    maybe.knownUses === undefined &&
    maybe.tags === undefined &&
    maybe.chapters === undefined
  ) {
    return false;
  }

  if (
    maybe.knownUses !== undefined &&
    !(Array.isArray(maybe.knownUses) && maybe.knownUses.every(isValidKnownUse))
  ) {
    return false;
  }

  const allowedTags = isWritten ? [...COMMON_TAGS, ...WRITTEN_TAGS] : COMMON_TAGS;
  const tagsValid =
    Array.isArray(maybe.tags) &&
    maybe.tags.every(t => (allowedTags as ReadonlyArray<string>).includes(t));

  const chaptersValid =
    Array.isArray(maybe.chapters) &&
    maybe.chapters.every(ch => {
      const chapter = ch as Partial<ItemChapter>;
      return (
        typeof chapter.heading === 'string' &&
        typeof chapter.description === 'string' &&
        typeof chapter.contentLength === 'number'
      );
    });

  if (isWritten) {
    if (!tagsValid || !chaptersValid) {
      return false;
    }
  } else {
    if (maybe.tags !== undefined && !tagsValid) return false;
    if (maybe.chapters !== undefined && !chaptersValid) return false;
  }
  return true;
}

export function isValidItemData(obj: unknown): obj is ItemData {
  if (!obj || typeof obj !== 'object') return false;
  const maybe = obj as Partial<ItemData>;
  if (typeof maybe.type === 'string') {
    const normalized = normalizeItemType(maybe.type);
    if (normalized) maybe.type = normalized;
  }
  if (maybe.activeDescription !== undefined) {
    if (maybe.activeDescription === null) return false;
    if (typeof maybe.activeDescription !== 'string') return false;
  }
  if (
    maybe.tags !== undefined &&
    (!Array.isArray(maybe.tags) ||
      !maybe.tags.every(tag => typeof tag === 'string'))
  ) {
    return false;
  }
  if (
    maybe.knownUses !== undefined &&
    !(Array.isArray(maybe.knownUses) && maybe.knownUses.every(isValidKnownUse))
  ) {
    return false;
  }
  if (
    maybe.chapters !== undefined &&
    !Array.isArray(maybe.chapters)
  ) {
    return false;
  }
  return (
    typeof maybe.name === 'string' && maybe.name.trim() !== '' &&
    typeof maybe.description === 'string' && maybe.description.trim() !== '' &&
    typeof maybe.type === 'string' && VALID_ITEM_TYPES.includes(maybe.type)
  );
}


/**
 * Checks if the provided object contains a valid name, description and optional
 * aliases array.
 */
export function isValidNameDescAliasesPair(
  obj: unknown,
): obj is { name: string; description: string; aliases?: Array<string> } {
  if (!obj || typeof obj !== 'object') return false;
  const maybe = obj as {
    name?: unknown;
    description?: unknown;
    aliases?: unknown;
  };
  return (
    typeof maybe.name === 'string' &&
    maybe.name.trim() !== '' &&
    typeof maybe.description === 'string' &&
    (maybe.aliases === undefined ||
      (Array.isArray(maybe.aliases) &&
        maybe.aliases.every((alias: unknown) => typeof alias === 'string')))
  );
}

// Specific validator for NPCUpdate payload elements from AI
export function isValidNPCUpdate(obj: unknown): obj is ValidNPCUpdatePayload {
    if (!obj || typeof obj !== 'object') return false;
    const maybe = obj as Partial<ValidNPCUpdatePayload>;
    if (typeof maybe.name !== 'string' || maybe.name.trim() === '') return false;
    if (maybe.newDescription !== undefined && typeof maybe.newDescription !== 'string') return false;
    if (maybe.newAliases !== undefined && !(Array.isArray(maybe.newAliases) && maybe.newAliases.every((alias: unknown) => typeof alias === 'string'))) return false;
    if (maybe.addAlias !== undefined && typeof maybe.addAlias !== 'string') return false;
    if (maybe.newPresenceStatus !== undefined && !VALID_PRESENCE_STATUS_VALUES.includes(maybe.newPresenceStatus)) return false;
    if (maybe.newAttitudeTowardPlayer !== undefined) {
      if (typeof maybe.newAttitudeTowardPlayer !== 'string') return false;
    }
    if (maybe.newKnownPlayerNames !== undefined) {
      if (!Array.isArray(maybe.newKnownPlayerNames) ||
        !maybe.newKnownPlayerNames.every((name: unknown) => typeof name === 'string')) return false;
    }
    if (maybe.newLastKnownLocation !== undefined && maybe.newLastKnownLocation != null && typeof maybe.newLastKnownLocation !== 'string') return false;
    if (maybe.newPreciseLocation !== undefined && maybe.newPreciseLocation != null && typeof maybe.newPreciseLocation !== 'string') return false;
    
    if (
      typeof maybe.newPresenceStatus === 'string' &&
      CLOSE_PRESENCE_STATUSES.includes(
        maybe.newPresenceStatus as (typeof CLOSE_PRESENCE_STATUSES)[number],
      ) &&
      maybe.newPreciseLocation === undefined
    ) {
      console.warn(
        "isValidNPCUpdate: 'newPreciseLocation' must be provided when 'newPresenceStatus' is nearby or companion.",
        obj,
      );
    }
    if (
      typeof maybe.newPresenceStatus === 'string' &&
      DISTANT_PRESENCE_STATUSES.includes(
        maybe.newPresenceStatus as (typeof DISTANT_PRESENCE_STATUSES)[number],
      ) &&
      maybe.newPreciseLocation != null
    ) {
      console.warn(
        "isValidNPCUpdate: 'newPreciseLocation' must be omitted when 'newPresenceStatus' is distant or unknown.",
        obj,
      );
    }
    return true;
}

// Validator for NPC object from AI npcsAdded
export function isValidNewNPCPayload(obj: unknown): obj is ValidNewNPCPayload {
    if (!obj || typeof obj !== 'object') return false;
    const maybe = obj as Partial<ValidNewNPCPayload>;
    if (typeof maybe.name !== 'string' || maybe.name.trim() === '') return false;
    if (typeof maybe.description !== 'string' || maybe.description.trim() === '') return false;
    if (maybe.aliases !== undefined && !(Array.isArray(maybe.aliases) && maybe.aliases.every((alias: unknown) => typeof alias === 'string'))) return false;
    if (maybe.presenceStatus !== undefined && !VALID_PRESENCE_STATUS_VALUES.includes(maybe.presenceStatus)) return false;
    if (typeof maybe.attitudeTowardPlayer !== 'string') return false;
    if (maybe.knowsPlayerAs !== undefined) {
      if (!Array.isArray(maybe.knowsPlayerAs) || maybe.knowsPlayerAs.some((name: unknown) => typeof name !== 'string')) return false;
    }
    if (maybe.lastKnownLocation !== undefined && maybe.lastKnownLocation != null && typeof maybe.lastKnownLocation !== 'string') return false;
    if (maybe.preciseLocation !== undefined && maybe.preciseLocation != null && typeof maybe.preciseLocation !== 'string') return false;

    if (
      typeof maybe.presenceStatus === 'string' &&
      CLOSE_PRESENCE_STATUSES.includes(
        maybe.presenceStatus as (typeof CLOSE_PRESENCE_STATUSES)[number],
      ) &&
      maybe.preciseLocation === undefined
    ) {
      console.warn(
        "isValidNewNPCPayload: 'preciseLocation' must be provided when 'presenceStatus' is nearby or companion.",
        obj,
      );
    }
    if (
      typeof maybe.presenceStatus === 'string' &&
      DISTANT_PRESENCE_STATUSES.includes(
        maybe.presenceStatus as (typeof DISTANT_PRESENCE_STATUSES)[number],
      ) &&
      maybe.preciseLocation != null
    ) {
      console.warn(
        "isValidNewNPCPayload: 'preciseLocation' must be omitted when 'presenceStatus' is distant or unknown.",
        obj,
      );
    }
    return true;
}

/**
 * Validates the structural integrity of a dialogueSetup payload.
 *
 * @param dialogueSetup - The `dialogueSetup` object payload from the AI.
 * @returns {boolean} True if `dialogueSetup` has a valid structure, false otherwise.
 */
export function isDialogueSetupPayloadStructurallyValid(
  dialogueSetup?: unknown, // Can be malformed or undefined
): dialogueSetup is DialogueSetupPayload {
  if (!dialogueSetup || typeof dialogueSetup !== 'object') {
    console.warn(
      'isDialogueSetupPayloadStructurallyValid: dialogueSetup is missing or not an object.',
    );
    return false;
  }

  const obj = dialogueSetup as Partial<DialogueSetupPayload>;

  if (
    !Array.isArray(obj.participants) ||
    obj.participants.length === 0 ||
    !obj.participants.every(
      (p: unknown) => typeof p === 'string' && p.trim() !== '',
    )
  ) {
    console.warn(
      'isDialogueSetupPayloadStructurallyValid: dialogueSetup.participants is invalid.',
      obj.participants,
    );
    return false;
  }

  const participants = obj.participants;

  if (
    !Array.isArray(obj.initialNpcResponses) ||
    obj.initialNpcResponses.length === 0 ||
    !obj.initialNpcResponses.every(
      (r: unknown) =>
        r &&
        typeof (r as { speaker?: unknown }).speaker === 'string' &&
        (r as { speaker: string }).speaker.trim() !== '' &&
        participants.includes((r as { speaker: string }).speaker) &&
        typeof (r as { line?: unknown }).line === 'string' &&
        (r as { line: string }).line.trim() !== '',
    )
  ) {
    console.warn(
      'isDialogueSetupPayloadStructurallyValid: dialogueSetup.initialNpcResponses is invalid.',
      obj.initialNpcResponses,
    );
    return false;
  }

  if (
    !Array.isArray(obj.initialPlayerOptions) ||
    obj.initialPlayerOptions.length < 4 ||
    !obj.initialPlayerOptions.every(
      (opt: unknown) => typeof opt === 'string' && opt.trim() !== '',
    )
  ) {
    console.warn(
      'isDialogueSetupPayloadStructurallyValid: dialogueSetup.initialPlayerOptions is invalid.',
      obj.initialPlayerOptions,
    );
    return false;
  }

  return true;
}
