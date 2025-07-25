/**
 * @file api.ts
 * @description Wrapper functions for inventory-related AI interactions.
 */

import { GenerateContentResponse } from '@google/genai';
import {
  MINIMAL_MODEL_NAME,
  GEMINI_MODEL_NAME,
  GEMINI_LITE_MODEL_NAME,
  LOADING_REASON_UI_MAP,
  MIN_BOOK_CHAPTERS,
  MAX_BOOK_CHAPTERS,
  MAX_RETRIES,
  PLAYER_HOLDER_ID,
  VALID_ITEM_TYPES,
  VALID_ITEM_TYPES_STRING,
  COMMON_TAGS,
  COMMON_TAGS_STRING,
  TEXT_STYLE_TAGS_STRING,
  WRITING_TAGS,
  TEXT_MOD_TAGS_STRING
} from '../../constants';
import { SYSTEM_INSTRUCTION } from './systemPrompt';
import { dispatchAIRequest } from '../modelDispatcher';
import { isApiConfigured } from '../apiClient';
import {
  AdventureTheme,
  ItemChange,
  NewItemSuggestion,
} from '../../types';
import { buildInventoryPrompt } from './promptBuilder';
import { parseInventoryResponse, InventoryAIPayload } from './responseParser';
import {
  fetchCorrectedItemChangeArray_Service,
  fetchCorrectedAddDetailsPayload_Service,
  fetchAdditionalBookChapters_Service,
} from '../corrections';
import { addProgressSymbol } from '../../utils/loadingProgress';
import { retryAiCall } from '../../utils/retry';

export const INVENTORY_JSON_SCHEMA = {
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
                appliesWhenActive: { type: 'boolean' },
                appliesWhenInactive: { type: 'boolean' },
                description: { type: 'string' },
                promptEffect: { type: 'string' },
              },
              propertyOrdering: [
                'actionName',
                'appliesWhenActive',
                'appliesWhenInactive',
                'description',
                'promptEffect',
              ],
              required: ['actionName', 'description', 'promptEffect'],
              additionalProperties: false,
            },
          },
          name: { type: 'string', description: 'Name of the item.' },
          tags: {
            type: 'array',
            maxItems: 5,
            items: { enum: [...COMMON_TAGS, 'restored'] },
            description:
              `Updated tags. Written items can receive 'recovered' tag if translated, decoded, or restored.`,
          },
        },
        propertyOrdering: ['chapters', 'id', 'knownUses', 'name', 'tags'],
        required: ['id', 'name'],
        additionalProperties: false,
      },
    },
    change: {
      type: 'array',
      description: 'Updates to existing items.',
      items: {
        type: 'object',
        properties: {
          activeDescription: { type: 'string', description: 'Updated active description.' },
          description: { type: 'string', description: 'Updated description if changed.' },
          id: { type: 'string', description: 'Identifier of the item to change.' },
          isActive: { type: 'boolean', description: 'Updated active state.' },
          knownUses: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                actionName: { type: 'string' },
                appliesWhenActive: { type: 'boolean' },
                appliesWhenInactive: { type: 'boolean' },
                description: { type: 'string' },
                promptEffect: { type: 'string' },
              },
              propertyOrdering: [
                'actionName',
                'appliesWhenActive',
                'appliesWhenInactive',
                'description',
                'promptEffect',
              ],
              required: ['actionName', 'description', 'promptEffect'],
              additionalProperties: false,
            },
          },
          name: { type: 'string', description: 'Current item name.' },
          newName: { type: 'string', description: 'Updated name if changed.' },
          tags: {
            type: 'array',
            maxItems: 5,
            items: { enum: COMMON_TAGS },
            description: `Updated tags.`,
          },
          type: { enum: VALID_ITEM_TYPES, description: `Updated type if changed. One of ${VALID_ITEM_TYPES_STRING}.` },
        },
        propertyOrdering: [
          'activeDescription',
          'description',
          'id',
          'isActive',
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
          activeDescription: { type: 'string', description: 'Description when item is active.' },
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
            description: `ID of the location or holder. Use '${PLAYER_HOLDER_ID}', 'npc_*' or 'node_*', depending on Item Hints.`,
          },
          isActive: { type: 'boolean', description: 'True if the item is active.' },
          knownUses: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                actionName: { type: 'string', description: 'Name of the use action.' },
                appliesWhenActive: { type: 'boolean', description: 'Use is available when item is active.' },
                appliesWhenInactive: { type: 'boolean', description: 'Use is available when item is inactive.' },
                description: { type: 'string', description: 'Tooltip hint for this use.' },
                promptEffect: { type: 'string', description: 'Short effect description for the AI.' },
              },
              propertyOrdering: [
                'actionName',
                'appliesWhenActive',
                'appliesWhenInactive',
                'description',
                'promptEffect',
              ],
              required: ['actionName', 'description', 'promptEffect'],
              additionalProperties: false,
            },
          },
          name: { type: 'string', description: 'Item name as it will appear to the player.' },
          tags: {
            type: 'array',
            maxItems: 5,
            items: { enum: [...COMMON_TAGS,...WRITING_TAGS] },
            description: `Example tags: ${COMMON_TAGS_STRING}, 'book', 'page', 'map', and 'picture' type items require one of ${TEXT_STYLE_TAGS_STRING} and optionally ${TEXT_MOD_TAGS_STRING}.`,
          },
          type: { enum: VALID_ITEM_TYPES, description: `Item type. One of ${VALID_ITEM_TYPES_STRING}` },
        },
        propertyOrdering: [
          'activeDescription',
          'chapters',
          'description',
          'holderId',
          'isActive',
          'knownUses',
          'name',
          'tags',
          'type',
        ],
        required: ['description', 'holderId', 'name', 'tags', 'type'],
        additionalProperties: false,
      },
    },
    destroy: {
      type: 'array',
      description: 'Remove items from the world.',
      items: {
        type: 'object',
        properties: { id: { type: 'string' }, name: { type: 'string' } },
        propertyOrdering: ['id', 'name'],
        required: ['id', 'name'],
        additionalProperties: false,
      },
    },
    move: {
      type: 'array',
      description: 'Move an existing item to a new holder.',
      items: {
        type: 'object',
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

/**
 * Executes the inventory AI call using model fallback.
 */
export const executeInventoryRequest = async (
  prompt: string,
): Promise<{
  response: GenerateContentResponse;
  thoughts: Array<string>;
  systemInstructionUsed: string;
  jsonSchemaUsed?: unknown;
  promptUsed: string;
}> => {
  if (!isApiConfigured()) {
    console.error('API Key not configured for Inventory Service.');
    return Promise.reject(new Error('API Key not configured.'));
  }
  const result = await retryAiCall<{
    response: GenerateContentResponse;
    thoughts: Array<string>;
    systemInstructionUsed: string;
    jsonSchemaUsed?: unknown;
    promptUsed: string;
  }>(async (attempt: number) => {
    try {
      console.log(
        `Executing inventory request (Attempt ${String(attempt + 1)}/${String(MAX_RETRIES + 1)})`,
      );
      addProgressSymbol(LOADING_REASON_UI_MAP.inventory.icon);
      const {
        response,
        systemInstructionUsed,
        jsonSchemaUsed,
        promptUsed,
      } = await dispatchAIRequest({
        modelNames: [GEMINI_LITE_MODEL_NAME, MINIMAL_MODEL_NAME, GEMINI_MODEL_NAME],
        prompt,
        systemInstruction: SYSTEM_INSTRUCTION,
        jsonSchema: INVENTORY_JSON_SCHEMA,
        thinkingBudget: 1024,
        includeThoughts: true,
        responseMimeType: 'application/json',
        temperature: 0.7,
        label: 'Inventory',
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
    } catch (err: unknown) {
      console.error(
        `Error executing inventory request (Attempt ${String(attempt + 1)}/${String(MAX_RETRIES + 1)}):`,
        err,
      );
      throw err;
    }
  });
  if (!result) {
    throw new Error('Failed to execute inventory request.');
  }
  return result;
};

export interface InventoryUpdateResult {
  itemChanges: Array<ItemChange>;
  debugInfo: {
    prompt: string;
    systemInstruction?: string;
    jsonSchema?: unknown;
    rawResponse?: string;
    parsedItemChanges?: Array<ItemChange>;
    observations?: string;
    rationale?: string;
    thoughts?: Array<string>;
  } | null;
}

const mergeBookChaptersFromSuggestions = (
  itemChanges: Array<ItemChange>,
  suggestions: Array<NewItemSuggestion>,
): void => {
  for (const suggestion of suggestions) {
    const suggChapters = suggestion.chapters;
    if (!suggChapters || suggChapters.length === 0) continue;
    const match = itemChanges.find(
      ch => ch.action === 'create' && ch.item.name === suggestion.name,
    );
    if (match && match.action === 'create') {
      const item = match.item;
      if (!item.chapters || item.chapters.length !== suggChapters.length) {
        item.chapters = suggChapters;
      }
    }
  }
};


export const applyInventoryHints_Service = async (
  playerItemsHint: string | undefined,
  worldItemsHint: string | undefined,
  npcItemsHint: string | undefined,
  newItems: Array<NewItemSuggestion>,
  playerLastAction: string,
  playerInventory: string,
  locationInventory: string,
  currentNodeId: string | null,
  companionsInventory: string,
  nearbyNpcsInventory: string,
  sceneDescription: string | undefined,
  logMessage: string | undefined,
  currentTheme: AdventureTheme,
  limitedMapContext: string,
): Promise<InventoryUpdateResult | null> => {
  const pHint = playerItemsHint?.trim() ?? '';
  const wHint = worldItemsHint?.trim() ?? '';
  const nHint = npcItemsHint?.trim() ?? '';
  if (!pHint && !wHint && !nHint && newItems.length === 0) {
    return { itemChanges: [], debugInfo: null };
  }

  const prompt = buildInventoryPrompt(
    playerLastAction,
    pHint,
    wHint,
    nHint,
    newItems,
    playerInventory,
    locationInventory,
    currentNodeId,
    companionsInventory,
    nearbyNpcsInventory,
    limitedMapContext,
  );
  const {
    response,
    thoughts,
    systemInstructionUsed,
    jsonSchemaUsed,
    promptUsed,
  } = await executeInventoryRequest(prompt);
  let parsed = parseInventoryResponse(response.text ?? '');
  if (!parsed ||
      (parsed.itemChanges.length === 0 && (response.text?.trim() ?? '') !== '[]')) {
    const corrected = await fetchCorrectedItemChangeArray_Service(
      response.text ?? '',
      logMessage,
      sceneDescription,
      pHint,
      wHint,
      nHint,
      currentNodeId,
      companionsInventory,
      nearbyNpcsInventory,
      currentTheme,
    );
    if (corrected)
      parsed = { itemChanges: corrected } as InventoryAIPayload;
  }
  if (parsed) {
    mergeBookChaptersFromSuggestions(parsed.itemChanges, newItems);
    for (const change of parsed.itemChanges) {
      if (
        change.action === 'addDetails' &&
        (change as { invalidPayload?: unknown }).invalidPayload
      ) {
        const corrected = await fetchCorrectedAddDetailsPayload_Service(
          JSON.stringify((change as { invalidPayload: unknown }).invalidPayload),
          logMessage,
          sceneDescription,
          currentTheme,
        );
        if (corrected) {
          change.item = corrected;
          delete (change as { invalidPayload?: unknown }).invalidPayload;
        }
      }
      if (change.action === 'create' && change.item.type === 'book') {
        const chapters = change.item.chapters ?? [];
        if (chapters.length < MIN_BOOK_CHAPTERS) {
          const additional = await fetchAdditionalBookChapters_Service(
            change.item.name,
            change.item.description,
            chapters.map(ch => ch.heading),
            MIN_BOOK_CHAPTERS - chapters.length,
          );
          if (additional && additional.length > 0) {
            change.item.chapters = chapters.concat(additional).slice(0, MIN_BOOK_CHAPTERS);
          }
        }
      }
    }
  }
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
      thoughts: thoughts,
    },
  };
};
