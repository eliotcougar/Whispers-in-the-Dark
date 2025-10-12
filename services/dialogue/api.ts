/**
 * @file api.ts
 * @description Wrapper functions for dialogue-related AI interactions.
 */
import type {
  DialogueAIResponse,
  DialogueHistoryEntry,
  DialogueSummaryContext,
  GameStateFromAI,
  Item,
  NPC,
  MapNode,
  DialogueMemorySummaryContext,
  AdventureTheme,
  StoryArc,
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
import { fetchCorrectedDialogueTurn } from '../corrections';
import { CORRECTION_TEMPERATURE } from '../../constants';
import { MINIMAL_MODEL_NAME, GEMINI_LITE_MODEL_NAME, LOADING_REASON_UI_MAP } from '../../constants';
import { addProgressSymbol } from '../../utils/loadingProgress';
import { isApiConfigured } from '../geminiClient';
import { buildDialogueTurnPrompt, buildDialogueSummaryPrompt, buildDialogueMemorySummaryPrompts } from './promptBuilder';
import {
  parseDialogueTurnResponse,
} from './responseParser';
import { parseAIResponse } from '../storyteller/responseParser';
import { getThinkingBudget } from '../thinkingConfig';

export const DIALOGUE_TURN_JSON_SCHEMA = {
  type: 'object',
  properties: {
    dialogueEnds: {
      type: 'boolean',
      description:
        'Set to true if any of the dialogue participants signal the end of the conversation, or if the conversation obviously reached its logical conclusion.',
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
        'Possible player replies, MUST ALWAYS be in the form of direct speech. The last option must contextually appropriately end the conversation.',
      items: { type: 'string' },
    },
    updatedParticipants: {
      type: 'array',
      minItems: 1,
      description:
        "Provide the new full list of participants if it changes. Don't include the player.",
      items: { type: 'string' },
    },
    npcAttitudeUpdates: {
      type: 'array',
      description: 'Describe any change in NPC\'s attitude toward the player during this turn.',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          newAttitudeTowardPlayer: { type: 'string' },
        },
        required: ['name', 'newAttitudeTowardPlayer'],
        additionalProperties: false,
      },
    },
    npcKnownNameUpdates: {
      type: 'array',
      description: 'Describe any change in the name or nickname the NPC uses for the player.',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          newKnownPlayerNames: {
            type: 'array',
            items: { type: 'string' },
          },
          addKnownPlayerName: { type: 'string' },
        },
        required: ['name'],
        additionalProperties: false,
      },
    },
  },
  required: ['dialogueEnds', 'npcResponses', 'playerOptions'],
  propertyOrdering: ['dialogueEnds', 'npcResponses', 'playerOptions', 'updatedParticipants', 'npcAttitudeUpdates', 'npcKnownNameUpdates'],
  additionalProperties: false,
} as const;


/**
 * Fetches the next dialogue turn from the AI based on the current game state.
 */
export const executeDialogueTurn = async (
  theme: AdventureTheme,
  storyArc: StoryArc | null,
  currentQuest: string | null,
  currentObjective: string | null,
  currentScene: string,
  localTime: string | null,
  localEnvironment: string | null,
  localPlace: string | null,
  knownMainMapNodes: Array<MapNode>,
  knownNPCs: Array<NPC>,
  inventory: Array<Item>,
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

  const basePrompt = buildDialogueTurnPrompt({
    theme,
    currentQuest,
    currentObjective,
    currentScene,
    localTime,
    localEnvironment,
    localPlace,
    knownMainMapNodes,
    knownNPCs,
    inventory,
    heroSheet,
    storyArc,
    dialogueHistory,
    playerLastUtterance,
    dialogueParticipants,
    relevantFacts,
  });

  let lastErrorMessage: string | null = null;

  const result = await retryAiCall<{
    parsed: DialogueAIResponse;
    rawResponse: string;
    thoughts: Array<string>;
    promptUsed: string;
  }>(async attempt => {
    try {
      const currentPrompt = attempt > 0 && lastErrorMessage
        ? `${basePrompt}\n\n[Parser Feedback]\n${lastErrorMessage}`
        : basePrompt;
      console.log(
        `Fetching dialogue turn (Participants: ${dialogueParticipants.join(', ')}, Attempt ${String(
          attempt + 1,
        )}/${String(MAX_RETRIES + 1)})`,
      );
      addProgressSymbol(LOADING_REASON_UI_MAP.dialogue_turn.icon);
      const thinkingBudget = getThinkingBudget(512);
      const { response } = await dispatchAIRequest({
        modelNames: [GEMINI_LITE_MODEL_NAME, GEMINI_MODEL_NAME],
        prompt: currentPrompt,
        systemInstruction: DIALOGUE_SYSTEM_INSTRUCTION,
        temperature: 0.8,
        responseMimeType: 'application/json',
        thinkingBudget,
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
      let lastParseError: string | null = null;
      let parsed = parseDialogueTurnResponse(response.text ?? '', thoughtParts, message => {
        lastParseError = message;
      });
      parsed ??= await fetchCorrectedDialogueTurn(
        response.text ?? '',
        dialogueParticipants,
        theme,
        thoughtParts,
      );
      if (parsed) {
        lastErrorMessage = null;
        return { result: { parsed, rawResponse: response.text ?? '', thoughts: thoughtParts, promptUsed: currentPrompt } };
      }
      console.warn(
        `executeDialogueTurn (Attempt ${String(attempt + 1)}/${String(MAX_RETRIES + 1)}): invalid response even after correction`,
      );
      if (typeof lastParseError === 'string') {
        lastErrorMessage = lastParseError;
      } else {
        lastErrorMessage = 'The previous dialogue response did not follow the required JSON schema for npcResponses/playerOptions. Return valid structured JSON only.';
      }
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
    return {
      parsed: result.parsed,
      prompt: result.promptUsed,
      rawResponse: result.rawResponse,
      thoughts: result.thoughts,
    };
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

  if (!summaryContext.theme) {
    console.error('DialogueSummaryContext missing theme. Cannot summarize dialogue.');
    return Promise.reject(new Error('DialogueSummaryContext missing theme.'));
  }

  const { theme } = summaryContext;

  const basePrompt = buildDialogueSummaryPrompt(summaryContext);

  let lastErrorMessage: string | null = null;

  const summaryResult = await retryAiCall<{
    parsed: GameStateFromAI;
    rawResponse: string;
    thoughts: Array<string>;
    promptUsed: string;
  }>(async attempt => {
    try {
      const currentPrompt = attempt > 0 && lastErrorMessage
        ? `${basePrompt}\n\n[Parser Feedback]\n${lastErrorMessage}`
        : basePrompt;
      console.log(
        `Summarizing dialogue with ${summaryContext.dialogueParticipants.join(', ')}, Attempt ${String(
          attempt + 1,
        )}/${String(MAX_RETRIES + 1)})`,
      );
      addProgressSymbol(LOADING_REASON_UI_MAP.dialogue_summary.icon);
      const thinkingBudget = getThinkingBudget(4096);
      const { response } = await dispatchAIRequest({
        modelNames: [GEMINI_MODEL_NAME],
        prompt: currentPrompt,
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 1.0,
        responseMimeType: 'application/json',
        thinkingBudget,
        includeThoughts: true,
        jsonSchema: STORYTELLER_JSON_SCHEMA,
        label: 'Storyteller',
      });
      const parts = (response.candidates?.[0]?.content?.parts ?? []) as Array<{ text?: string; thought?: boolean }>;
      const thoughtParts = parts
        .filter((p): p is { text: string; thought?: boolean } => p.thought === true && typeof p.text === 'string')
        .map(p => p.text);
      const parseResult = await parseAIResponse(
        response.text ?? '',
        theme,
        summaryContext.heroSheet ?? null,
        undefined,
        undefined,
        undefined,
        summaryContext.knownNPCs,
        summaryContext.mapDataSnapshot,
        summaryContext.inventory,
      );
      if (parseResult.data) {
        lastErrorMessage = null;
        return {
          result: {
            parsed: parseResult.data,
            rawResponse: response.text ?? '',
            thoughts: thoughtParts,
            promptUsed: currentPrompt,
          },
        };
      }
      if (parseResult.error) {
        console.warn(
          `executeDialogueSummary (Attempt ${String(attempt + 1)}/${String(MAX_RETRIES + 1)}): ${parseResult.error}`,
        );
      }
      console.warn(
        `executeDialogueSummary (Attempt ${String(attempt + 1)}/${String(MAX_RETRIES + 1)}): invalid JSON, retrying`,
      );
      lastErrorMessage = typeof parseResult.error === 'string'
        ? parseResult.error
        : 'The previous dialogue summary did not match the expected storyteller schema. Return valid JSON only.';
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
    return {
      parsed: summaryResult.parsed,
      prompt: summaryResult.promptUsed,
      rawResponse: summaryResult.rawResponse,
      thoughts: summaryResult.thoughts,
    };
  }

  return { parsed: null, prompt: basePrompt, rawResponse: '', thoughts: [] };
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
  if (!context.theme) {
    console.error('DialogueMemorySummaryContext missing theme. Cannot summarize memory.');
    return null;
  }

  const { systemInstructionPart, userPromptPart } = buildDialogueMemorySummaryPrompts(context);

  let lastErrorMessage: string | null = null;

  const memoryResult = await retryAiCall<string>(async attempt => {
    try {
      const currentPrompt = attempt > 0 && lastErrorMessage
        ? `${userPromptPart}\n\n[Parser Feedback]\n${lastErrorMessage}`
        : userPromptPart;
      console.log(
        `Generating memory summary for dialogue with ${context.dialogueParticipants.join(', ')}, Attempt ${String(
          attempt + 1,
        )}/${String(MAX_RETRIES + 1)})`,
      );
      addProgressSymbol(LOADING_REASON_UI_MAP.dialogue_memory.icon);
      const { response } = await dispatchAIRequest({
        modelNames: [MINIMAL_MODEL_NAME, GEMINI_LITE_MODEL_NAME],
        prompt: currentPrompt,
        systemInstruction: systemInstructionPart,
        temperature: CORRECTION_TEMPERATURE,
        label: 'Corrections',
      });
      const memoryText = response.text?.trim() ?? null;
      if (memoryText && memoryText.length > 0) {
        console.log(
          `summarizeDialogueForMemory: ${context.dialogueParticipants.join(', ')} will remember ${memoryText}`,
        );
        lastErrorMessage = null;
        return { result: memoryText };
      }
      console.warn(
        `executeMemorySummary (Attempt ${String(attempt + 1)}/${String(MAX_RETRIES + 1)}): empty memory text`,
      );
      lastErrorMessage = 'The previous attempt returned an empty memory summary. Respond with a concise sentence describing the memory.';
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
