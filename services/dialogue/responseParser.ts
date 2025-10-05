/**
 * @file responseParser.ts
 * @description Helpers for parsing dialogue-related AI responses.
 */
import { DialogueAIResponse, DialogueSummaryResponse, DialogueNpcAttitudeUpdate, DialogueNpcKnownNameUpdate } from '../../types';
import { safeParseJson, coerceNullToUndefined } from '../../utils/jsonUtils';
import { trimDialogueHints } from '../../utils/dialogueParsing';

const parseDialogueResponse = (
  responseText: string,
  thoughts?: Array<string>,
  onParseError?: (message: string) => void,
): DialogueAIResponse | null => {
  const parsed = safeParseJson<Partial<DialogueAIResponse>>(responseText);
  try {
    if (!parsed) throw new Error('JSON parse failed');
    if (
      !Array.isArray(parsed.npcResponses) ||
      !parsed.npcResponses.every(
        r => typeof r.speaker === 'string' && typeof r.line === 'string',
      ) ||
      !Array.isArray(parsed.playerOptions) ||
      !parsed.playerOptions.every(o => typeof o === 'string') ||
      (parsed.dialogueEnds !== undefined && typeof parsed.dialogueEnds !== 'boolean') ||
      (parsed.updatedParticipants !== undefined && (!Array.isArray(parsed.updatedParticipants) || !parsed.updatedParticipants.every(p => typeof p === 'string')))
    ) {
      const message = 'Dialogue response must include npcResponses and playerOptions with valid speaker/line strings.';
      console.warn('Parsed dialogue JSON does not match DialogueAIResponse structure:', parsed);
      onParseError?.(message);
      return null;
    }
    let sanitizedAttitudeUpdates: Array<DialogueNpcAttitudeUpdate> | undefined;
    let sanitizedKnownNameUpdates: Array<DialogueNpcKnownNameUpdate> | undefined;
    if (parsed.npcAttitudeUpdates !== undefined) {
      if (!Array.isArray(parsed.npcAttitudeUpdates)) {
        const message = 'npcAttitudeUpdates must be an array of objects containing name and newAttitudeTowardPlayer strings.';
        console.warn('Parsed dialogue JSON has invalid npcAttitudeUpdates:', parsed.npcAttitudeUpdates);
        onParseError?.(message);
        return null;
      }
      sanitizedAttitudeUpdates = [];
      for (const entry of parsed.npcAttitudeUpdates as Array<unknown>) {
        if (entry === null || typeof entry !== 'object') {
          const message = 'Each npcAttitudeUpdates entry must be an object with name and newAttitudeTowardPlayer fields.';
          console.warn('npcAttitudeUpdates entry is not an object:', entry);
          onParseError?.(message);
          return null;
        }
        const nameRaw = (entry as { name?: unknown }).name;
        const attitudeRaw = (entry as { newAttitudeTowardPlayer?: unknown }).newAttitudeTowardPlayer;
        if (typeof nameRaw !== 'string' || typeof attitudeRaw !== 'string') {
          const message = 'npcAttitudeUpdates entries must provide string values for name and newAttitudeTowardPlayer.';
          console.warn('npcAttitudeUpdates entry has invalid fields:', entry);
          onParseError?.(message);
          return null;
        }
        const trimmedName = nameRaw.trim();
        if (trimmedName.length === 0) {
          const message = 'npcAttitudeUpdates entries cannot use empty strings for name.';
          console.warn('npcAttitudeUpdates entry has empty name:', entry);
          onParseError?.(message);
          return null;
        }
        const trimmedAttitude = attitudeRaw.trim();
        if (trimmedAttitude.length === 0) {
          const message = 'npcAttitudeUpdates entries cannot use empty strings for newAttitudeTowardPlayer.';
          console.warn('npcAttitudeUpdates entry has empty attitude:', entry);
          onParseError?.(message);
          return null;
        }
        sanitizedAttitudeUpdates.push({
          name: trimmedName,
          newAttitudeTowardPlayer: trimmedAttitude,
        });
      }
    }
    if (parsed.npcKnownNameUpdates !== undefined) {
      if (!Array.isArray(parsed.npcKnownNameUpdates)) {
        const message = 'npcKnownNameUpdates must be an array when provided.';
        console.warn('Parsed dialogue JSON has invalid npcKnownNameUpdates:', parsed.npcKnownNameUpdates);
        onParseError?.(message);
        return null;
      }
      sanitizedKnownNameUpdates = [];
      for (const entry of parsed.npcKnownNameUpdates as Array<unknown>) {
        if (entry === null || typeof entry !== 'object') {
          const message = 'Each npcKnownNameUpdates entry must be an object containing name and known player name updates.';
          console.warn('npcKnownNameUpdates entry is not an object:', entry);
          onParseError?.(message);
          return null;
        }
        const nameRaw = (entry as { name?: unknown }).name;
        const replaceRaw = (entry as { newKnownPlayerNames?: unknown }).newKnownPlayerNames;
        const addRaw = (entry as { addKnownPlayerName?: unknown }).addKnownPlayerName;
        if (typeof nameRaw !== 'string') {
          const message = 'npcKnownNameUpdates entries require a string "name" field.';
          console.warn('npcKnownNameUpdates entry has invalid name:', entry);
          onParseError?.(message);
          return null;
        }
        const trimmedName = nameRaw.trim();
        if (trimmedName.length === 0) {
          const message = 'npcKnownNameUpdates entries cannot use empty strings for name.';
          console.warn('npcKnownNameUpdates entry has empty name:', entry);
          onParseError?.(message);
          return null;
        }
        let newKnownPlayerNames: Array<string> | undefined;
        let addKnownPlayerName: string | undefined;
        if (replaceRaw !== undefined) {
          if (!Array.isArray(replaceRaw)) {
            const message = 'npcKnownNameUpdates.newKnownPlayerNames must be an array of strings when provided.';
            console.warn('npcKnownNameUpdates entry has invalid newKnownPlayerNames:', entry);
            onParseError?.(message);
            return null;
          }
          const trimmedList: Array<string> = [];
          for (const val of replaceRaw) {
            if (typeof val !== 'string') {
              const message = 'npcKnownNameUpdates.newKnownPlayerNames must contain only strings.';
              console.warn('npcKnownNameUpdates entry has non-string newKnownPlayerNames value:', entry);
              onParseError?.(message);
              return null;
            }
            const trimmedVal = val.trim();
            if (trimmedVal.length === 0) {
              const message = 'npcKnownNameUpdates.newKnownPlayerNames cannot include empty strings.';
              console.warn('npcKnownNameUpdates entry has empty string in newKnownPlayerNames:', entry);
              onParseError?.(message);
              return null;
            }
            trimmedList.push(trimmedVal);
          }
          newKnownPlayerNames = trimmedList;
        }
        if (addRaw !== undefined) {
          if (typeof addRaw !== 'string') {
            const message = 'npcKnownNameUpdates.addKnownPlayerName must be a string when provided.';
            console.warn('npcKnownNameUpdates entry has invalid addKnownPlayerName:', entry);
            onParseError?.(message);
            return null;
          }
          const trimmedAdd = addRaw.trim();
          if (trimmedAdd.length === 0) {
            const message = 'npcKnownNameUpdates.addKnownPlayerName cannot be an empty string.';
            console.warn('npcKnownNameUpdates entry has empty addKnownPlayerName:', entry);
            onParseError?.(message);
            return null;
          }
          addKnownPlayerName = trimmedAdd;
        }
        if (newKnownPlayerNames === undefined && addKnownPlayerName === undefined) {
          const message = 'npcKnownNameUpdates entries must provide either newKnownPlayerNames or addKnownPlayerName.';
          console.warn('npcKnownNameUpdates entry missing updates:', entry);
          onParseError?.(message);
          return null;
        }
        sanitizedKnownNameUpdates.push({
          name: trimmedName,
          ...(newKnownPlayerNames !== undefined ? { newKnownPlayerNames } : {}),
          ...(addKnownPlayerName !== undefined ? { addKnownPlayerName } : {}),
        });
      }
    }
    if (parsed.playerOptions.length === 0) {
      parsed.playerOptions = ['End Conversation.'];
    }
    const validated = parsed as DialogueAIResponse;
    if (sanitizedAttitudeUpdates !== undefined) {
      validated.npcAttitudeUpdates = sanitizedAttitudeUpdates;
    }
    if (sanitizedKnownNameUpdates !== undefined) {
      validated.npcKnownNameUpdates = sanitizedKnownNameUpdates;
    }
    if (thoughts && thoughts.length > 0) {
      validated.npcResponses.forEach((r, idx) => {
        if (thoughts[idx]) {
          r.thought = thoughts[idx];
        }
      });
    }
    return validated;
  } catch (e: unknown) {
    console.warn('Failed to parse dialogue JSON response from AI:', e);
    console.debug('Original dialogue response text:', responseText);
    onParseError?.(e instanceof Error ? e.message : 'Dialogue response failed to parse as valid JSON.');
    return null;
  }
};

export const parseDialogueAIResponse = (
  responseText: string,
  thoughts?: Array<string>,
  onParseError?: (message: string) => void,
): DialogueAIResponse | null => {
  return parseDialogueResponse(responseText, thoughts, onParseError);
};

export const parseDialogueTurnResponse = (
  responseText: string,
  thoughts?: Array<string>,
  onParseError?: (message: string) => void,
): DialogueAIResponse | null => {
  return parseDialogueResponse(responseText, thoughts, onParseError);
};

export const parseDialogueSummaryResponse = (
  responseText: string,
  onParseError?: (message: string) => void,
): DialogueSummaryResponse | null => {
  const parsed = safeParseJson<Partial<DialogueSummaryResponse>>(responseText);
  try {
    if (!parsed) throw new Error('JSON parse failed');

    const sanitized: Partial<DialogueSummaryResponse> = coerceNullToUndefined(parsed);

    const validated: DialogueSummaryResponse = {
      ...sanitized,
      itemChange: [],
    } as DialogueSummaryResponse;

    trimDialogueHints(validated);

    return validated;
  } catch (e: unknown) {
    console.warn('Failed to parse dialogue summary JSON response from AI:', e);
    console.debug('Original dialogue summary response text:', responseText);
    onParseError?.(e instanceof Error ? e.message : 'Dialogue summary response failed to parse as valid JSON.');
    return null;
  }
};
