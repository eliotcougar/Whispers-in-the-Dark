/**
 * @file validation.ts
 * @description Shared validation helpers for AI payloads.
 */
import { Item, KnownUse, ItemType, Character, DialogueTurnResponsePart, ValidCharacterUpdatePayload, ValidNewCharacterPayload, DialogueSetupPayload } from '../../types';
import { VALID_ITEM_TYPES } from '../../constants';

export function isValidKnownUse(ku: unknown): ku is KnownUse {
  return ku &&
    typeof ku.actionName === 'string' && ku.actionName.trim() !== '' &&
    typeof ku.promptEffect === 'string' && ku.promptEffect.trim() !== '' && // Ensure non-empty
    (ku.appliesWhenActive === undefined || typeof ku.appliesWhenActive === 'boolean') &&
    (ku.appliesWhenInactive === undefined || typeof ku.appliesWhenInactive === 'boolean') &&
    (ku.description === undefined || typeof ku.description === 'string');
}

export function isValidItem(item: unknown, context?: 'gain' | 'update'): item is Item {
  if (!item || typeof item !== 'object') return false;

  // Name is always required
  if (typeof item.name !== 'string' || item.name.trim() === '') {
    console.warn("isValidItem: 'name' is missing or invalid.", item);
    return false;
  }

  // Fields required for 'gain' or if it's not an 'update' context
  if (context === 'gain' || !context) {
    if (typeof item.type !== 'string' || !(VALID_ITEM_TYPES as readonly string[]).includes(item.type)) {
        console.warn(`isValidItem (context: ${context || 'default'}): 'type' is missing or invalid.`, item);
        return false;
    }
    if (typeof item.description !== 'string' || item.description.trim() === '') {
        console.warn(`isValidItem (context: ${context || 'default'}): 'description' is missing or invalid.`, item);
        return false;
    }
  }

  // Fields required for 'update' if it's a transformation (newName is present)
  if (context === 'update' && item.newName !== undefined && item.newName !== null) {
    if (typeof item.newName !== 'string' || item.newName.trim() === '') {
        console.warn("isValidItem (context: update, with newName): 'newName' is invalid.", item);
        return false;
    }
    if (typeof item.type !== 'string' || !(VALID_ITEM_TYPES as readonly string[]).includes(item.type)) {
        console.warn("isValidItem (context: update, with newName): 'type' is missing or invalid for transformed item.", item);
        return false;
    }
    if (typeof item.description !== 'string' || item.description.trim() === '') {
        console.warn("isValidItem (context: update, with newName): 'description' is missing or invalid for transformed item.", item);
        return false;
    }
  }


  // Validate optional fields if they are present, regardless of context (unless specific context requires them)
  if (item.type !== undefined && (typeof item.type !== 'string' || !(VALID_ITEM_TYPES as readonly string[]).includes(item.type))) {
    console.warn("isValidItem: 'type' is present but invalid.", item);
    return false;
  }
  if (item.description !== undefined && (typeof item.description !== 'string' || item.description.trim() === '')) {
      // Allow empty description if it's an update payload and not a transformation,
      // as it might be intentionally cleared, but an empty description for a gain/new item is bad.
      if ((context === 'gain' || (context === 'update' && item.newName)) && item.description.trim() === '') {
        console.warn(`isValidItem: 'description' is present but empty, which is invalid for a gain or transformation.`, item);
        return false;
      }
  }
  if (item.activeDescription !== undefined && typeof item.activeDescription !== 'string') {
    console.warn("isValidItem: 'activeDescription' is present but invalid.", item);
    return false;
  }
  if (item.isActive !== undefined && typeof item.isActive !== 'boolean') {
    console.warn("isValidItem: 'isActive' is present but invalid.", item);
    return false;
  }
  if (item.isJunk !== undefined && typeof item.isJunk !== 'boolean') {
    console.warn("isValidItem: 'isJunk' is present but invalid.", item);
    return false;
  }
  if (item.knownUses !== undefined && !(Array.isArray(item.knownUses) && item.knownUses.every(isValidKnownUse))) {
    console.warn("isValidItem: 'knownUses' is present but invalid.", item);
    return false;
  }
  if (item.addKnownUse !== undefined && !isValidKnownUse(item.addKnownUse)) {
    console.warn("isValidItem: 'addKnownUse' is present but invalid.", item);
    return false;
  }
  
  return true;
}


export function isValidNameDescAliasesPair(obj: unknown): obj is { name: string; description: string; aliases?: string[] } {
    return obj && typeof obj.name === 'string' && obj.name.trim() !== '' &&
           typeof obj.description === 'string' && 
           (obj.aliases === undefined || (Array.isArray(obj.aliases) && obj.aliases.every((alias: unknown) => typeof alias === 'string')));
}

// Specific validator for CharacterUpdate payload elements from AI
export function isValidCharacterUpdate(obj: unknown): obj is ValidCharacterUpdatePayload {
    if (!obj || typeof obj.name !== 'string' || obj.name.trim() === '') return false;
    if (obj.newDescription !== undefined && typeof obj.newDescription !== 'string') return false;
    if (obj.newAliases !== undefined && !(Array.isArray(obj.newAliases) && obj.newAliases.every((alias: unknown) => typeof alias === 'string'))) return false;
    if (obj.addAlias !== undefined && typeof obj.addAlias !== 'string') return false; 
    if (obj.newPresenceStatus !== undefined && !['distant', 'nearby', 'companion', 'unknown'].includes(obj.newPresenceStatus)) return false;
    if (obj.newLastKnownLocation !== undefined && obj.newLastKnownLocation !== null && typeof obj.newLastKnownLocation !== 'string') return false; 
    if (obj.newPreciseLocation !== undefined && obj.newPreciseLocation !== null && typeof obj.newPreciseLocation !== 'string') return false;
    
    if ((obj.newPresenceStatus === 'nearby' || obj.newPresenceStatus === 'companion') && obj.newPreciseLocation === undefined) {
      // This could be problematic if AI intends to set a location but omits the field.
    }
    if ((obj.newPresenceStatus === 'distant' || obj.newPresenceStatus === 'unknown') && obj.newPreciseLocation !== undefined && obj.newPreciseLocation !== null) {
      // console.warn("Character update: preciseLocation provided for a non-present character. This will be ignored or nulled by game logic.");
    }
    return true;
}

// Validator for Character object from AI charactersAdded
export function isValidNewCharacterPayload(obj: unknown): obj is ValidNewCharacterPayload {
    if (!obj || typeof obj.name !== 'string' || obj.name.trim() === '') return false;
    if (typeof obj.description !== 'string' || obj.description.trim() === '') return false; 
    if (obj.aliases !== undefined && !(Array.isArray(obj.aliases) && obj.aliases.every((alias: unknown) => typeof alias === 'string'))) return false;
    if (obj.presenceStatus !== undefined && !['distant', 'nearby', 'companion', 'unknown'].includes(obj.presenceStatus)) return false;
    if (obj.lastKnownLocation !== undefined && obj.lastKnownLocation !== null && typeof obj.lastKnownLocation !== 'string') return false; 
    if (obj.preciseLocation !== undefined && obj.preciseLocation !== null && typeof obj.preciseLocation !== 'string') return false;

    if ((obj.presenceStatus === 'nearby' || obj.presenceStatus === 'companion') && obj.preciseLocation === undefined) {
      // console.warn("New character: preciseLocation undefined for a present character.");
    }
    if ((obj.presenceStatus === 'distant' || obj.presenceStatus === 'unknown') && obj.preciseLocation !== undefined && obj.preciseLocation !== null) {
       // console.warn("New character: preciseLocation provided for a non-present character.");
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
  dialogueSetup?: unknown // Can be malformed or undefined
): dialogueSetup is DialogueSetupPayload {
  
  if (!dialogueSetup || typeof dialogueSetup !== 'object') {
    console.warn("isDialogueSetupPayloadStructurallyValid: dialogueSetup is missing or not an object.");
    return false;
  }

  // Validate dialogueSetup.participants
  if (
    !Array.isArray(dialogueSetup.participants) ||
    dialogueSetup.participants.length === 0 ||
    !dialogueSetup.participants.every((p: unknown) => typeof p === 'string' && p.trim() !== '')
  ) {
    console.warn("isDialogueSetupPayloadStructurallyValid: dialogueSetup.participants is invalid.", dialogueSetup.participants);
    return false;
  }

  // Validate dialogueSetup.initialNpcResponses
  if (
    !Array.isArray(dialogueSetup.initialNpcResponses) ||
    dialogueSetup.initialNpcResponses.length === 0 || // Must have at least one NPC response
    !dialogueSetup.initialNpcResponses.every((r: unknown) =>
      r && typeof r.speaker === 'string' && r.speaker.trim() !== '' &&
      dialogueSetup.participants.includes(r.speaker) && // Speaker must be one of the participants
      typeof r.line === 'string' && r.line.trim() !== ''
    )
  ) {
    console.warn("isDialogueSetupPayloadStructurallyValid: dialogueSetup.initialNpcResponses is invalid.", dialogueSetup.initialNpcResponses);
    return false;
  }

  // Validate dialogueSetup.initialPlayerOptions
  if (
    !Array.isArray(dialogueSetup.initialPlayerOptions) ||
    dialogueSetup.initialPlayerOptions.length < 4 || // Must have at least 4 options (e.g., 3 choices + end)
    !dialogueSetup.initialPlayerOptions.every((opt: unknown) => typeof opt === 'string' && opt.trim() !== '')
  ) {
    console.warn("isDialogueSetupPayloadStructurallyValid: dialogueSetup.initialPlayerOptions is invalid.", dialogueSetup.initialPlayerOptions);
    return false;
  }

  return true;
}
