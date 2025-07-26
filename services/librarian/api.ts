import { GenerateContentResponse } from '@google/genai';
import {
  GEMINI_LITE_MODEL_NAME,
  GEMINI_MODEL_NAME,
  MINIMAL_MODEL_NAME,
  LOADING_REASON_UI_MAP,
} from '../../constants';
import { SYSTEM_INSTRUCTION } from './systemPrompt';
import { dispatchAIRequest } from '../modelDispatcher';
import { isApiConfigured } from '../apiClient';
import { ItemChange, NewItemSuggestion } from '../../types';
import { buildLibrarianPrompt } from './promptBuilder';
import { parseLibrarianResponse } from './responseParser';
import { addProgressSymbol } from '../../utils/loadingProgress';
import { retryAiCall } from '../../utils/retry';

export const LIBRARIAN_JSON_SCHEMA = {
  type: 'object',
  properties: {
    observations: { type: 'string', minLength: 200 },
    rationale: { type: 'string', minLength: 200 },
    itemChanges: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          action: { enum: ['create', 'change', 'move', 'destroy', 'addDetails'] },
          item: { type: 'object' },
        },
        required: ['action', 'item'],
        additionalProperties: false,
      },
    },
  },
  required: ['observations', 'rationale'],
  additionalProperties: false,
} as const;

export const executeLibrarianRequest = async (
  prompt: string,
): Promise<{
  response: GenerateContentResponse;
  thoughts: Array<string>;
  systemInstructionUsed: string;
  jsonSchemaUsed?: unknown;
  promptUsed: string;
} | null> => {
  if (!isApiConfigured()) {
    return Promise.reject(new Error('API key not configured.'));
  }
  const result = await retryAiCall<{
    response: GenerateContentResponse;
    thoughts: Array<string>;
    systemInstructionUsed: string;
    jsonSchemaUsed?: unknown;
    promptUsed: string;
  }>(async () => {
    addProgressSymbol(LOADING_REASON_UI_MAP.librarian.icon);
    const { response, systemInstructionUsed, jsonSchemaUsed, promptUsed } =
      await dispatchAIRequest({
        modelNames: [GEMINI_LITE_MODEL_NAME, MINIMAL_MODEL_NAME, GEMINI_MODEL_NAME],
        prompt,
        systemInstruction: SYSTEM_INSTRUCTION,
        jsonSchema: LIBRARIAN_JSON_SCHEMA,
        thinkingBudget: 1024,
        includeThoughts: true,
        responseMimeType: 'application/json',
        temperature: 0.7,
        label: 'Librarian',
      });
    const parts = (response.candidates?.[0]?.content?.parts ?? []) as Array<{
      text?: string;
      thought?: boolean;
    }>;
    const thoughtParts = parts
      .filter((p): p is { text: string; thought?: boolean } => p.thought === true && typeof p.text === 'string')
      .map(p => p.text);
    return {
      result: { response, thoughts: thoughtParts, systemInstructionUsed, jsonSchemaUsed, promptUsed },
    };
  });
  return result;
};

export interface LibrarianUpdateResult {
  itemChanges: Array<ItemChange>;
  debugInfo: {
    prompt: string;
    systemInstruction: string;
    jsonSchema?: unknown;
    rawResponse?: string;
    parsedItemChanges?: Array<ItemChange>;
    observations?: string;
    rationale?: string;
    thoughts?: Array<string>;
  } | null;
}

export const applyLibrarianHints_Service = async (
  librarianHint: string | undefined,
  newItems: Array<NewItemSuggestion>,
  playerLastAction: string,
  playerInventory: string,
  locationInventory: string,
  currentNodeId: string | null,
  companionsInventory: string,
  nearbyNpcsInventory: string,
  limitedMapContext: string,
): Promise<LibrarianUpdateResult | null> => {
  const hint = librarianHint?.trim() ?? '';
  if (!hint && newItems.length === 0) {
    return { itemChanges: [], debugInfo: null };
  }
  const prompt = buildLibrarianPrompt(
    playerLastAction,
    hint,
    newItems,
    playerInventory,
    locationInventory,
    currentNodeId,
    companionsInventory,
    nearbyNpcsInventory,
    limitedMapContext,
  );
  const result = await executeLibrarianRequest(prompt);
  if (!result) {
    return { itemChanges: [], debugInfo: null };
  }
  const { response, thoughts, systemInstructionUsed, jsonSchemaUsed, promptUsed } = result;
  const parsed = parseLibrarianResponse(response.text ?? '');
  return {
    itemChanges: parsed ? parsed.itemChanges : [],
    debugInfo: {
      prompt: promptUsed,
      systemInstruction: systemInstructionUsed,
      jsonSchema: jsonSchemaUsed,
      rawResponse: response.text ?? '',
      parsedItemChanges: parsed ? parsed.itemChanges : undefined,
      observations: parsed?.observations,
      rationale: parsed?.rationale,
      thoughts,
    },
  };
};
