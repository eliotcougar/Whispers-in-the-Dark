/**
 * @file api.ts
 * @description Wrapper functions for dialogue-related AI interactions.
 */
import {
  DialogueAIResponse,
  DialogueHistoryEntry,
  DialogueSummaryContext,
  GameStateFromAI,
  Item,
  NPC,
  MapNode,
  DialogueMemorySummaryContext,
  AdventureTheme,
  HeroSheet,
} from '../../types';
import {
  GEMINI_MODEL_NAME,
  MAX_RETRIES,
  MIN_DIALOGUE_TURN_OPTIONS,
  MAX_DIALOGUE_TURN_OPTIONS,
} from '../../constants';
import { DIALOGUE_SYSTEM_INSTRUCTION } from './systemPrompt';
import { SYSTEM_INSTRUCTION } from '../storyteller/systemPrompt';
import { STORYTELLER_JSON_SCHEMA } from '../storyteller/api';
import { dispatchAIRequest } from '../modelDispatcher';
import { retryAiCall } from '../../utils/retry';
import { isServerOrClientError } from '../../utils/aiErrorUtils';
import { fetchCorrectedDialogueTurn_Service } from '../corrections';
import { CORRECTION_TEMPERATURE } from '../../constants';
import { MINIMAL_MODEL_NAME, GEMINI_LITE_MODEL_NAME, LOADING_REASON_UI_MAP } from '../../constants';
import { addProgressSymbol } from '../../utils/loadingProgress';
import { isApiConfigured } from '../apiClient';
import { buildDialogueTurnPrompt, buildDialogueSummaryPrompt, buildDialogueMemorySummaryPrompts } from './promptBuilder';
import {
  parseDialogueTurnResponse,
} from './responseParser';
import { parseAIResponse } from '../storyteller/responseParser';

export const DIALOGUE_TURN_JSON_SCHEMA = {
  type: 'object',
  properties: {
    dialogueEnds: {
      type: 'boolean',
      description:
        'Set true when the NPCs indicate the conversation is over or naturally concludes.',
    },
    npcResponses: {
      type: 'array',
      minItems: 1,
      description:
        'NPC lines for this turn. Each speaker must be an active participant and lines must be non-empty.',
      items: {
        type: 'object',
        properties: {
          line: { type: 'string' },
          speaker: { type: 'string' },
        },
        propertyOrdering: ['line', 'speaker'],
        required: ['line', 'speaker'],
        additionalProperties: false,
      },
    },
    playerOptions: {
      type: 'array',
      minItems: MIN_DIALOGUE_TURN_OPTIONS,
      maxItems: MAX_DIALOGUE_TURN_OPTIONS,
      description:
        'Possible player replies. The last option must politely or firmly end the conversation.',
      items: { type: 'string' },
    },
    updatedParticipants: {
      type: 'array',
      minItems: 1,
      description:
        "Provide the new full list of participants if it changes. Don't include the player.",
      items: { type: 'string' },
    },
  },
  required: ['npcResponses', 'playerOptions'],
  propertyOrdering: ['dialogueEnds', 'npcResponses', 'playerOptions', 'updatedParticipants'],
  additionalProperties: false,
} as const;


/**
 * Fetches the next dialogue turn from the AI based on the current game state.
 */
export const executeDialogueTurn = async (
  currentTheme: AdventureTheme,
  currentQuest: string | null,
  currentObjective: string | null,
  currentScene: string,
  localTime: string | null,
  localEnvironment: string | null,
  localPlace: string | null,
  knownMainMapNodesInTheme: Array<MapNode>,
  knownNPCsInTheme: Array<NPC>,
  inventory: Array<Item>,
  playerGender: string,
  heroSheet: HeroSheet | null,
  dialogueHistory: Array<DialogueHistoryEntry>,
  playerLastUtterance: string,
  dialogueParticipants: Array<string>,
  relevantFacts: Array<string>,
): Promise<{ parsed: DialogueAIResponse | null; prompt: string; rawResponse: string; thoughts: Array<string> }> => {
  if (!isApiConfigured()) {
    console.error('API Key not configured for Dialogue Service.');
    return Promise.reject(new Error('API Key not configured.'));
  }

  const prompt = buildDialogueTurnPrompt({
    currentTheme,
    currentQuest,
    currentObjective,
    currentScene,
    localTime,
    localEnvironment,
    localPlace,
    knownMainMapNodesInTheme,
    knownNPCsInTheme: knownNPCsInTheme,
    inventory,
    playerGender,
    heroSheet,
    dialogueHistory,
    playerLastUtterance,
    dialogueParticipants,
    relevantFacts,
  });

  const result = await retryAiCall<{
    parsed: DialogueAIResponse;
    rawResponse: string;
    thoughts: Array<string>;
  }>(async attempt => {
    try {
      console.log(
        `Fetching dialogue turn (Participants: ${dialogueParticipants.join(', ')}, Attempt ${String(
          attempt + 1,
        )}/${String(MAX_RETRIES + 1)})`,
      );
      addProgressSymbol(LOADING_REASON_UI_MAP.dialogue_turn.icon);
      const { response } = await dispatchAIRequest({
        modelNames: [GEMINI_LITE_MODEL_NAME, GEMINI_MODEL_NAME],
        prompt,
        systemInstruction: DIALOGUE_SYSTEM_INSTRUCTION,
        temperature: 0.8,
        responseMimeType: 'application/json',
        thinkingBudget: 512,
        includeThoughts: true,
        jsonSchema: DIALOGUE_TURN_JSON_SCHEMA,
        label: 'Dialogue',
      });
      const parts = (response.candidates?.[0]?.content?.parts ?? []) as Array<{
        text?: string;
        thought?: boolean;
      }>;
      const thoughtParts = parts
        .filter((p): p is { text: string; thought?: boolean } => p.thought === true && typeof p.text === 'string')
        .map(p => p.text);
      let parsed = parseDialogueTurnResponse(response.text ?? '', thoughtParts);
      parsed ??= await fetchCorrectedDialogueTurn_Service(
        response.text ?? '',
        dialogueParticipants,
        currentTheme,
        thoughtParts,
      );
      if (parsed) {
        return { result: { parsed, rawResponse: response.text ?? '', thoughts: thoughtParts } };
      }
      console.warn(
        `executeDialogueTurn (Attempt ${String(attempt + 1)}/${String(MAX_RETRIES + 1)}): invalid response even after correction`,
      );
    } catch (error: unknown) {
      console.error(
        `Error fetching dialogue turn (Attempt ${String(attempt + 1)}/${String(MAX_RETRIES + 1)}):`,
        error,
      );
      throw error;
    }
    return { result: null };
  });

  if (result) {
    return { parsed: result.parsed, prompt, rawResponse: result.rawResponse, thoughts: result.thoughts };
  }

  throw new Error('Failed to fetch dialogue turn after maximum retries.');
};

/**
 * Summarizes a completed dialogue to derive game state updates.
 */
export const executeDialogueSummary = async (
  summaryContext: DialogueSummaryContext,
): Promise<{ parsed: GameStateFromAI | null; prompt: string; rawResponse: string; thoughts: Array<string> }> => {
  if (!isApiConfigured()) {
    console.error('API Key not configured for Dialogue Summary Service.');
    return Promise.reject(new Error('API Key not configured.'));
  }

  if (!summaryContext.currentThemeObject) {
    console.error('DialogueSummaryContext missing currentThemeObject. Cannot summarize dialogue.');
    return Promise.reject(new Error('DialogueSummaryContext missing currentThemeObject.'));
  }

  const themeObject = summaryContext.currentThemeObject;

  const prompt = buildDialogueSummaryPrompt(summaryContext);

  const summaryResult = await retryAiCall<{
    parsed: GameStateFromAI;
    rawResponse: string;
    thoughts: Array<string>;
  }>(async attempt => {
    try {
      console.log(
        `Summarizing dialogue with ${summaryContext.dialogueParticipants.join(', ')}, Attempt ${String(
          attempt + 1,
        )}/${String(MAX_RETRIES + 1)})`,
      );
      addProgressSymbol(LOADING_REASON_UI_MAP.dialogue_summary.icon);
      const { response } = await dispatchAIRequest({
        modelNames: [GEMINI_MODEL_NAME],
        prompt,
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 1.0,
        responseMimeType: 'application/json',
        thinkingBudget: 4096,
        includeThoughts: true,
        jsonSchema: STORYTELLER_JSON_SCHEMA,
        label: 'Storyteller',
      });
      const parts = (response.candidates?.[0]?.content?.parts ?? []) as Array<{ text?: string; thought?: boolean }>;
      const thoughtParts = parts
        .filter((p): p is { text: string; thought?: boolean } => p.thought === true && typeof p.text === 'string')
        .map(p => p.text);
      const parsed = await parseAIResponse(
        response.text ?? '',
        summaryContext.playerGender,
        themeObject,
        undefined,
        undefined,
        undefined,
        summaryContext.knownNPCsInTheme,
        summaryContext.mapDataForTheme,
        summaryContext.inventory,
      );
      if (parsed) {
        return { result: { parsed, rawResponse: response.text ?? '', thoughts: thoughtParts } };
      }
      console.warn(
        `executeDialogueSummary (Attempt ${String(attempt + 1)}/${String(MAX_RETRIES + 1)}): invalid JSON, retrying`,
      );
    } catch (error: unknown) {
      console.error(
        `Error summarizing dialogue (Attempt ${String(attempt + 1)}/${String(MAX_RETRIES + 1)}):`,
        error,
      );
      throw error;
    }
    return { result: null };
  });

  if (summaryResult) {
    return { parsed: summaryResult.parsed, prompt, rawResponse: summaryResult.rawResponse, thoughts: summaryResult.thoughts };
  }

  return { parsed: null, prompt, rawResponse: '', thoughts: [] };
};

/**
 * Generates a detailed narrative summary of a dialogue for NPC memory.
 */
export const executeMemorySummary = async (
  context: DialogueMemorySummaryContext,
): Promise<string | null> => {
  if (!isApiConfigured()) {
    console.error('API Key not configured for Dialogue Memory Summary Service.');
    return null;
  }
  if (!context.currentThemeObject) {
    console.error('DialogueMemorySummaryContext missing currentThemeObject. Cannot summarize memory.');
    return null;
  }

  const { systemInstructionPart, userPromptPart } = buildDialogueMemorySummaryPrompts(context);

  const memoryResult = await retryAiCall<string>(async attempt => {
    try {
      console.log(
        `Generating memory summary for dialogue with ${context.dialogueParticipants.join(', ')}, Attempt ${String(
          attempt + 1,
        )}/${String(MAX_RETRIES + 1)})`,
      );
      addProgressSymbol(LOADING_REASON_UI_MAP.dialogue_memory_creation.icon);
      const { response } = await dispatchAIRequest({
        modelNames: [MINIMAL_MODEL_NAME, GEMINI_LITE_MODEL_NAME],
        prompt: userPromptPart,
        systemInstruction: systemInstructionPart,
        temperature: CORRECTION_TEMPERATURE,
        label: 'Corrections',
      });
      const memoryText = response.text?.trim() ?? null;
      if (memoryText && memoryText.length > 0) {
        console.log(
          `summarizeDialogueForMemory: ${context.dialogueParticipants.join(', ')} will remember ${memoryText}`,
        );
        return { result: memoryText };
      }
      console.warn(
        `executeMemorySummary (Attempt ${String(attempt + 1)}/${String(MAX_RETRIES + 1)}): empty memory text`,
      );
    } catch (error: unknown) {
      console.error(
        `Error generating memory summary (Attempt ${String(attempt + 1)}/${String(MAX_RETRIES + 1)}):`,
        error,
      );
      if (!isServerOrClientError(error)) {
        return { result: null, retry: false };
      }
      throw error;
    }
    return { result: null };
  });

  return memoryResult ?? null;
};
