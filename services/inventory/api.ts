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
  MAX_RETRIES,
  PLAYER_HOLDER_ID,
  REGULAR_ITEM_TYPES,
  REGULAR_ITEM_TYPES_STRING,
  COMMON_TAGS,
  COMMON_TAGS_STRING
} from '../../constants';
import { SYSTEM_INSTRUCTION } from './systemPrompt';
import { dispatchAIRequest } from '../modelDispatcher';
import { getThinkingBudget } from '../thinkingConfig';
import { isApiConfigured } from '../geminiClient';
import {
  AdventureTheme,
  Item,
  ItemChange,
  NewItemSuggestion,
  NPC,
} from '../../types';
import { buildInventoryPrompt } from './promptBuilder';
import { parseInventoryResponse, InventoryAIPayload } from './responseParser';
import {
  fetchCorrectedItemChangeArray_Service,
  fetchCorrectedAddDetailsPayload_Service,
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
      description: 'Add new knownUses, or tags to an existing item.',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'ID of the item like item-* .' },
          knownUses: {
            type: 'array',
            description: 'Additional Known Uses to be added to the item.',
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
            maxItems: 1,
            items: { enum: [COMMON_TAGS] },
            description: `Additional tags. One of ${COMMON_TAGS_STRING}`,
          },
        },
        propertyOrdering: ['id', 'knownUses', 'name', 'tags'],
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
          isActive: { type: 'boolean', description: 'True if the item becomes active, worn, wielded, etc. False otherwise.' },
          knownUses: {
            type: 'array',
            description: 'Edited set of Known Uses. For example, if an obsolete Known Use has to be removed, or an existing Known Use has to be changed. If provided, this array fully replaces the existing Known Uses.',
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
            maxItems: 1,
            items: { enum: COMMON_TAGS },
            description: `Replacement tags. One of ${COMMON_TAGS_STRING}`,
          },
          type: { enum: REGULAR_ITEM_TYPES, description: `Updated type if changed. One of ${REGULAR_ITEM_TYPES_STRING}.` },
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
          description: { type: 'string', description: 'Concise explanation of what the item is.' },
          holderId: {
            type: 'string',
            description: `ID of the location or holder. Use '${PLAYER_HOLDER_ID}', 'npc-*' or 'node-*', depending on Item Hints.`,
          },
          isActive: { type: 'boolean', description: 'True if the item is active, worn, wielded right now.' },
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
            maxItems: 1,
            items: { enum: COMMON_TAGS },
            description: `Allowed tags: ${COMMON_TAGS_STRING}.`,
          },
          type: { enum: REGULAR_ITEM_TYPES, description: `Item type. One of ${REGULAR_ITEM_TYPES_STRING}` },
        },
        propertyOrdering: [
          'activeDescription',
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
            description: `ID of the new location or holder of the Item. Use '${PLAYER_HOLDER_ID}', 'npc-*' or 'node-*'.`,
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
    if (!(process.env.VITEST || process.env.NODE_ENV === 'test')) {
      return Promise.reject(new Error('API Key not configured.'));
    }
    // In tests, continue to allow mocked dispatch to run.
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
      addProgressSymbol(LOADING_REASON_UI_MAP.inventory_updates.icon);
      const thinkingBudget = getThinkingBudget(1024);
      const {
        response,
        systemInstructionUsed,
        jsonSchemaUsed,
        promptUsed,
      } = await dispatchAIRequest({
        modelNames: [GEMINI_MODEL_NAME, GEMINI_LITE_MODEL_NAME, MINIMAL_MODEL_NAME],
        prompt,
        systemInstruction: SYSTEM_INSTRUCTION,
        jsonSchema: INVENTORY_JSON_SCHEMA,
        thinkingBudget,
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
    validationError?: string;
  } | null;
}

export const applyInventoryHints_Service = async (
  playerItemsHint: string | undefined,
  worldItemsHint: string | undefined,
  npcItemsHint: string | undefined,
  newItems: Array<NewItemSuggestion>,
  playerLastAction: string,
  inventory: Array<Item>,
  currentNodeId: string | null,
  npcs: Array<NPC>,
  sceneDescription: string | undefined,
  logMessage: string | undefined,
  theme: AdventureTheme,
  limitedMapContext: string,
): Promise<InventoryUpdateResult | null> => {
  const pHint = playerItemsHint?.trim() ?? '';
  const wHint = worldItemsHint?.trim() ?? '';
  const nHint = npcItemsHint?.trim() ?? '';
  if (!pHint && !wHint && !nHint && newItems.length === 0) {
    return { itemChanges: [], debugInfo: null };
  }

  const { prompt: basePrompt, companionsContext, nearbyNpcsContext } = buildInventoryPrompt(
    playerLastAction,
    pHint,
    wHint,
    nHint,
    newItems,
    inventory,
    currentNodeId,
    npcs,
    limitedMapContext,
  );
  let attemptPrompt = basePrompt;
  let parsed: InventoryAIPayload | null = null;
  let lastErrorMessage: string | null = null;
  let finalResponse: GenerateContentResponse | null = null;
  let finalThoughts: Array<string> = [];
  let finalSystemInstruction: string | undefined;
  let finalJsonSchema: unknown;
  let finalPromptUsed = attemptPrompt;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    const {
      response,
      thoughts,
      systemInstructionUsed,
      jsonSchemaUsed,
      promptUsed,
    } = await executeInventoryRequest(attemptPrompt);
    finalResponse = response;
    finalThoughts = thoughts;
    finalSystemInstruction = systemInstructionUsed;
    finalJsonSchema = jsonSchemaUsed;
    finalPromptUsed = promptUsed;

    let parseErrorThisAttempt: string | null = null;
    parsed = parseInventoryResponse(response.text ?? '', message => {
      parseErrorThisAttempt = message;
    });

    if (!parsed) {
      const corrected = await fetchCorrectedItemChangeArray_Service(
        response.text ?? '',
        logMessage,
        sceneDescription,
        pHint,
        wHint,
        nHint,
        currentNodeId,
        companionsContext,
        nearbyNpcsContext,
        theme,
      );
      if (corrected) {
        parsed = { itemChanges: corrected } as InventoryAIPayload;
      }
    }

    if (parsed) {
      for (const change of parsed.itemChanges) {
        if (
          change.action === 'addDetails' &&
          (change as { invalidPayload?: unknown }).invalidPayload
        ) {
          const corrected = await fetchCorrectedAddDetailsPayload_Service(
            JSON.stringify((change as { invalidPayload: unknown }).invalidPayload),
            logMessage,
            sceneDescription,
            theme,
          );
          if (corrected) {
            change.item = corrected;
            delete (change as { invalidPayload?: unknown }).invalidPayload;
          }
        }
      }
      lastErrorMessage = null;
      break;
    }

    if (typeof parseErrorThisAttempt === 'string') {
      lastErrorMessage = parseErrorThisAttempt;
    } else {
      lastErrorMessage = 'Inventory response did not match the expected JSON schema. Return only valid item change entries.';
    }

    if (attempt === MAX_RETRIES) {
      break;
    }

    attemptPrompt = `${basePrompt}\n\n[Parser Feedback]\n${lastErrorMessage}`;
  }

  const validationError = lastErrorMessage ?? undefined;

  return {
    itemChanges: parsed ? parsed.itemChanges : [],
    debugInfo: {
      prompt: finalPromptUsed,
      systemInstruction: finalSystemInstruction,
      jsonSchema: finalJsonSchema,
      rawResponse: finalResponse?.text ?? '',
      parsedItemChanges: parsed ? parsed.itemChanges : undefined,
      observations: parsed?.observations,
      rationale: parsed?.rationale,
      thoughts: finalThoughts,
      validationError,
    },
  };
};
