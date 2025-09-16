/**
 * @file responseParser.ts
 * @description Helpers for parsing dialogue-related AI responses.
 */
import { DialogueAIResponse, DialogueSummaryResponse, DialogueNpcAttitudeUpdate } from '../../types';
import { safeParseJson, coerceNullToUndefined } from '../../utils/jsonUtils';
import { trimDialogueHints } from '../../utils/dialogueParsing';

const parseDialogueResponse = (
  responseText: string,
  thoughts?: Array<string>,
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
      console.warn('Parsed dialogue JSON does not match DialogueAIResponse structure:', parsed);
      return null;
    }
    let sanitizedAttitudeUpdates: Array<DialogueNpcAttitudeUpdate> | undefined;
    if (parsed.npcAttitudeUpdates !== undefined) {
      if (!Array.isArray(parsed.npcAttitudeUpdates)) {
        console.warn('Parsed dialogue JSON has invalid npcAttitudeUpdates:', parsed.npcAttitudeUpdates);
        return null;
      }
      sanitizedAttitudeUpdates = [];
      for (const entry of parsed.npcAttitudeUpdates) {
        if (!entry || typeof entry !== 'object') {
          console.warn('npcAttitudeUpdates entry is not an object:', entry);
          return null;
        }
        const nameRaw = (entry as { name?: unknown }).name;
        const attitudeRaw = (entry as { newAttitudeTowardPlayer?: unknown }).newAttitudeTowardPlayer;
        if (typeof nameRaw !== 'string' || typeof attitudeRaw !== 'string') {
          console.warn('npcAttitudeUpdates entry has invalid fields:', entry);
          return null;
        }
        const trimmedName = nameRaw.trim();
        if (trimmedName.length === 0) {
          console.warn('npcAttitudeUpdates entry has empty name:', entry);
          return null;
        }
        const trimmedAttitude = attitudeRaw.trim();
        if (trimmedAttitude.length === 0) {
          console.warn('npcAttitudeUpdates entry has empty attitude:', entry);
          return null;
        }
        sanitizedAttitudeUpdates.push({
          name: trimmedName,
          newAttitudeTowardPlayer: trimmedAttitude,
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
    return null;
  }
};

export const parseDialogueAIResponse = (
  responseText: string,
  thoughts?: Array<string>,
): DialogueAIResponse | null => {
  return parseDialogueResponse(responseText, thoughts);
};

export const parseDialogueTurnResponse = (
  responseText: string,
  thoughts?: Array<string>,
): DialogueAIResponse | null => {
  return parseDialogueResponse(responseText, thoughts);
};

export const parseDialogueSummaryResponse = (
  responseText: string,
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
    return null;
  }
};
