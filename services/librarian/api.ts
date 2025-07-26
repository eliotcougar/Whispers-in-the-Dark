import { GenerateContentResponse } from '@google/genai';
import {
  GEMINI_LITE_MODEL_NAME,
  GEMINI_MODEL_NAME,
  MINIMAL_MODEL_NAME,
  LOADING_REASON_UI_MAP,
  WRITING_ITEM_TYPES,
  WRITING_ITEM_TYPES_STRING,
  WRITING_TAGS,
  MIN_BOOK_CHAPTERS,
  MAX_BOOK_CHAPTERS,
  PLAYER_HOLDER_ID,
  WRITING_TAGS_STRING,
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
    observations: {
      type: 'string',
      minLength: 500,
      description: 'Contextually relevant observations about the items.',
    },
    rationale: {
      type: 'string',
      minLength: 500,
      description: 'Reasoning behind the inventory changes.',
    },
    addDetails: {
      type: 'array',
      description: 'Add new knownUses, chapters, or tags to an existing item.',
      items: {
        type: 'object',
        properties: {
          chapters: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                contentLength: { type: 'number', minimum: 50, maximum: 500 },
                description: { type: 'string' },
                heading: { type: 'string' },
              },
              propertyOrdering: ['contentLength', 'description', 'heading'],
              required: ['contentLength', 'description', 'heading'],
              additionalProperties: false,
            },
          },
          id: { type: 'string', description: 'ID of the item like item_* .' },
          knownUses: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                actionName: { type: 'string' },
                description: { type: 'string' },
                promptEffect: { type: 'string' },
              },
              propertyOrdering: ['actionName', 'description', 'promptEffect'],
              required: ['actionName', 'description', 'promptEffect'],
              additionalProperties: false,
            },
          },
          name: { type: 'string', description: 'Name of the item.' },
          tags: {
            type: 'array',
            description: `Set 'recovered' tag if the item has been translated, decoded, or restored.`,
            maxItems: 1,
            items: { enum: ['recovered'] },
          },
        },
        propertyOrdering: ['chapters', 'id', 'knownUses', 'name', 'tags'],
        required: ['id', 'name'],
        additionalProperties: false,
      },
    },
    change: {
      type: 'array',
      description: 'Update existing items.',
      items: {
        type: 'object',
        properties: {
          description: { type: 'string', description: 'Updated description if changed.' },
          id: { type: 'string', description: 'ID of the item to change.' },
          knownUses: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                actionName: { type: 'string' },
                description: { type: 'string' },
                promptEffect: { type: 'string' },
              },
              propertyOrdering: ['actionName', 'description', 'promptEffect'],
              required: ['actionName', 'description', 'promptEffect'],
              additionalProperties: false,
            },
          },
          name: { type: 'string', description: 'Current item name.' },
          newName: { type: 'string', description: 'Updated name if changed.' },
          tags: {
            type: 'array',
            maxItems: 5,
            items: { enum: WRITING_TAGS },
            description: 'Updated tags.',
          },
          type: { enum: WRITING_ITEM_TYPES, description: `Updated type if changed. One of ${WRITING_ITEM_TYPES_STRING}.` },
        },
        propertyOrdering: [
          'description',
          'id',
          'knownUses',
          'name',
          'newName',
          'tags',
          'type',
        ],
        required: ['id', 'name'],
        additionalProperties: false,
      },
    },
    create: {
      type: 'array',
      description: `New items to create, taken exactly from the provided New Items JSON`,
      items: {
        type: 'object',
        properties: {
          chapters: {
            type: 'array',
            description: `For type page, map, or picture - exactly one chapter. For type book - between ${String(MIN_BOOK_CHAPTERS)} and ${String(MAX_BOOK_CHAPTERS)} chapters.`,
            items: {
              type: 'object',
              properties: {
                contentLength: { type: 'number', minimum: 50, maximum: 500, description: 'Approximate length in words.' },
                description: { type: 'string', description: 'Detailed abstract of the chapter contents.' },
                heading: { type: 'string', description: 'Short heading for the chapter.' },
              },
              propertyOrdering: ['contentLength', 'description', 'heading'],
              required: ['contentLength', 'description', 'heading'],
              additionalProperties: false,
            },
          },
          description: { type: 'string', description: 'Concise explanation of what the item is.' },
          holderId: {
            type: 'string',
            description: `ID of the location or holder. Use '${PLAYER_HOLDER_ID}', 'npc_*' or 'node_*', depending on Librarian Hints.`,
          },
          knownUses: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                description: { type: 'string', description: 'Tooltip hint for this use.' },
                promptEffect: { type: 'string', description: 'Short effect description for the AI.' },
              },
              propertyOrdering: ['actionName', 'description', 'promptEffect'],
              required: ['actionName', 'description', 'promptEffect'],
              additionalProperties: false,
            },
          },
          name: { type: 'string', description: 'Item name as it will appear to the player.' },
          tags: {
            type: 'array',
            maxItems: 5,
            items: { enum: WRITING_TAGS },
            description: `Allowed tags: ${WRITING_TAGS_STRING}.`,
          },
          type: { enum: WRITING_ITEM_TYPES, description: `Item type. One of ${WRITING_ITEM_TYPES_STRING}` },
        },
        propertyOrdering: [
          'chapters',
          'description',
          'holderId',
          'knownUses',
          'name',
          'tags',
          'type',
        ],
        required: ['chapters', 'description', 'holderId', 'name', 'tags', 'type'],
        additionalProperties: false,
      },
    },
    destroy: {
      type: 'array',
      items: {
        type: 'object',
        description: 'Remove items from the world.',
        properties: { id: { type: 'string' }, name: { type: 'string' } },
        propertyOrdering: ['id', 'name'],
        required: ['id', 'name'],
        additionalProperties: false,
      },
    },
    move: {
      type: 'array',
      items: {
        type: 'object',
        description: 'Move an existing item to a new holder.',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          newHolderId: {
            type: 'string',
            description: `ID of the new location or holder of the Item. Use '${PLAYER_HOLDER_ID}', 'npc_*' or 'node_*'.`,
          },
        },
        propertyOrdering: ['id', 'name', 'newHolderId'],
        required: ['id', 'name', 'newHolderId'],
        additionalProperties: false,
      },
    },
  },
  required: ['observations', 'rationale'],
  propertyOrdering: [
    'observations',
    'rationale',
    'addDetails',
    'change',
    'create',
    'destroy',
    'move',
  ],
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
