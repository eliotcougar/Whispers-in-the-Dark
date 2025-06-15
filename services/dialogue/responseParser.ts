/**
 * @file responseParser.ts
 * @description Helpers for parsing dialogue-related AI responses.
 */
import { DialogueAIResponse, DialogueSummaryResponse } from '../../types';
import { extractJsonFromFence, safeParseJson } from '../../utils/jsonUtils';
import { isValidNewItemSuggestion } from '../parsers/validation';

export const parseDialogueAIResponse = (
  responseText: string,
  thoughts?: string[],
): DialogueAIResponse | null => {
  const jsonStr = extractJsonFromFence(responseText);
  const parsed = safeParseJson<Partial<DialogueAIResponse>>(jsonStr);
  try {
    if (!parsed) throw new Error('JSON parse failed');
    if (
      !parsed ||
      !Array.isArray(parsed.npcResponses) ||
      !parsed.npcResponses.every(
        r => r && typeof r.speaker === 'string' && typeof r.line === 'string',
      ) ||
      !Array.isArray(parsed.playerOptions) ||
      !parsed.playerOptions.every(o => typeof o === 'string') ||
      (parsed.dialogueEnds !== undefined && typeof parsed.dialogueEnds !== 'boolean') ||
      (parsed.updatedParticipants !== undefined && (!Array.isArray(parsed.updatedParticipants) || !parsed.updatedParticipants.every(p => typeof p === 'string')))
    ) {
      console.warn('Parsed dialogue JSON does not match DialogueAIResponse structure:', parsed);
      return null;
    }
    if (parsed.playerOptions.length === 0) {
      parsed.playerOptions = ['End Conversation.'];
    }
    const validated = parsed as DialogueAIResponse;
    if (thoughts && thoughts.length > 0) {
      validated.npcResponses.forEach((r, idx) => {
        if (thoughts[idx]) {
          r.thought = thoughts[idx];
        }
      });
    }
    return validated;
  } catch (e) {
    console.warn('Failed to parse dialogue JSON response from AI:', e);
    console.debug('Original dialogue response text:', responseText);
    return null;
  }
};

export const parseDialogueTurnResponse = (
  responseText: string,
  thoughts?: string[],
): DialogueAIResponse | null => {
  const jsonStr = extractJsonFromFence(responseText);
  const parsed = safeParseJson<Partial<DialogueAIResponse>>(jsonStr);
  try {
    if (!parsed) throw new Error('JSON parse failed');
    if (
      !parsed ||
      !Array.isArray(parsed.npcResponses) ||
      !parsed.npcResponses.every(
        r => r && typeof r.speaker === 'string' && typeof r.line === 'string',
      ) ||
      !Array.isArray(parsed.playerOptions) ||
      !parsed.playerOptions.every(o => typeof o === 'string') ||
      (parsed.dialogueEnds !== undefined && typeof parsed.dialogueEnds !== 'boolean') ||
      (parsed.updatedParticipants !== undefined && (!Array.isArray(parsed.updatedParticipants) || !parsed.updatedParticipants.every(p => typeof p === 'string')))
    ) {
      console.warn('Parsed dialogue JSON does not match DialogueAIResponse structure:', parsed);
      return null;
    }
    if (parsed.playerOptions.length === 0) {
      parsed.playerOptions = ['End Conversation.'];
    }
    const validated = parsed as DialogueAIResponse;
    if (thoughts && thoughts.length > 0) {
      validated.npcResponses.forEach((r, idx) => {
        if (thoughts[idx]) {
          r.thought = thoughts[idx];
        }
      });
    }
    return validated;
  } catch (e) {
    console.warn('Failed to parse dialogue JSON response from AI:', e);
    console.debug('Original dialogue response text:', responseText);
    return null;
  }
};

export const parseDialogueSummaryResponse = (
  responseText: string,
): DialogueSummaryResponse | null => {
  const jsonStr = extractJsonFromFence(responseText);
  const parsed = safeParseJson<Partial<DialogueSummaryResponse>>(jsonStr);
  try {
    if (!parsed) throw new Error('JSON parse failed');

    const sanitized = Object.fromEntries(
      Object.entries(parsed).map(([k, v]) => [k, v === null ? undefined : v]),
    ) as Partial<DialogueSummaryResponse>;

    const validated: DialogueSummaryResponse = {
      ...sanitized,
      itemChange: [],
    } as DialogueSummaryResponse;

    if (validated.mapHint !== undefined) {
      validated.mapHint = validated.mapHint.trim();
    }
    if (validated.playerItemsHint !== undefined) {
      validated.playerItemsHint = validated.playerItemsHint.trim();
    }
    if (validated.worldItemsHint !== undefined) {
      validated.worldItemsHint = validated.worldItemsHint.trim();
    }
    if (validated.npcItemsHint !== undefined) {
      validated.npcItemsHint = validated.npcItemsHint.trim();
    }

    if (Array.isArray(validated.newItems)) {
      validated.newItems = validated.newItems.filter(isValidNewItemSuggestion);
    }

    return validated;
  } catch (e) {
    console.warn('Failed to parse dialogue summary JSON response from AI:', e);
    console.debug('Original dialogue summary response text:', responseText);
    return null;
  }
};
