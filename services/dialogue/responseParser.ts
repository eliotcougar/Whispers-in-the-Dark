/**
 * @file responseParser.ts
 * @description Helpers for parsing dialogue-related AI responses.
 */
import { DialogueAIResponse, DialogueSummaryResponse } from '../../types';
import { extractJsonFromFence, safeParseJson, coerceNullToUndefined } from '../../utils/jsonUtils';
import { trimDialogueHints } from '../../utils/dialogueParsing';

const parseDialogueResponse = (
  responseText: string,
  thoughts?: string[],
): DialogueAIResponse | null => {
  const jsonStr = extractJsonFromFence(responseText);
  const parsed = safeParseJson<Partial<DialogueAIResponse>>(jsonStr);
  try {
    if (!parsed) throw new Error('JSON parse failed');
    if (
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

export const parseDialogueAIResponse = (
  responseText: string,
  thoughts?: string[],
): DialogueAIResponse | null => {
  return parseDialogueResponse(responseText, thoughts);
};

export const parseDialogueTurnResponse = (
  responseText: string,
  thoughts?: string[],
): DialogueAIResponse | null => {
  return parseDialogueResponse(responseText, thoughts);
};

export const parseDialogueSummaryResponse = (
  responseText: string,
): DialogueSummaryResponse | null => {
  const jsonStr = extractJsonFromFence(responseText);
  const parsed = safeParseJson<Partial<DialogueSummaryResponse>>(jsonStr);
  try {
    if (!parsed) throw new Error('JSON parse failed');

    const sanitized: Partial<DialogueSummaryResponse> = coerceNullToUndefined(parsed);

    const validated: DialogueSummaryResponse = {
      ...sanitized,
      itemChange: [],
    } as DialogueSummaryResponse;

    trimDialogueHints(validated);

    return validated;
  } catch (e) {
    console.warn('Failed to parse dialogue summary JSON response from AI:', e);
    console.debug('Original dialogue summary response text:', responseText);
    return null;
  }
};
