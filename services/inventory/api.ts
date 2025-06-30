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
  VALID_TAGS,
  VALID_TAGS_STRING,
  COMMON_TAGS,
  WRITING_TAGS,
} from '../../constants';
import { SYSTEM_INSTRUCTION } from './systemPrompt';
import { dispatchAIRequest } from '../modelDispatcher';
import { isApiConfigured } from '../apiClient';
import {
  AdventureTheme,
  ItemChange,
  NewItemSuggestion,
  Item,
  ItemTag,
} from '../../types';
import { buildInventoryPrompt } from './promptBuilder';
import { parseInventoryResponse, InventoryAIPayload } from './responseParser';
import {
  fetchCorrectedItemChangeArray_Service,
  fetchAdditionalBookChapters_Service,
  fetchCorrectedItemTag_Service,
} from '../corrections';
import { addProgressSymbol } from '../../utils/loadingProgress';
import { normalizeTag } from '../../utils/tagSynonyms';
import { retryAiCall } from '../../utils/retry';

export const INVENTORY_KNOWN_USE_SCHEMA = {
  type: 'object',
  properties: {
    actionName: { type: 'string', description: 'User-facing text for the action button.' },
    promptEffect: { type: 'string', description: 'Non-empty text sent to the game AI when chosen.' },
    description: { type: 'string', description: 'Tooltip hint for the player.' },
    appliesWhenActive: { type: 'boolean', description: 'Shown when item is active.' },
    appliesWhenInactive: { type: 'boolean', description: 'Shown when item is inactive.' },
  },
  required: ['actionName', 'promptEffect', 'description'],
  additionalProperties: false,
} as const;

export const INVENTORY_CHAPTER_SCHEMA = {
  type: 'object',
  properties: {
    heading: { type: 'string', description: 'Short title of the chapter.' },
    description: { type: 'string', description: 'Detailed abstract of the chapter.' },
    contentLength: { type: 'number', description: 'Length in words (50-500).' },
  },
  required: ['heading', 'description', 'contentLength'],
  additionalProperties: false,
} as const;

export const INVENTORY_ITEM_SCHEMA = {
  type: 'object',
  properties: {
    id: { type: 'string', description: 'Unique identifier for existing items.' },
    name: { type: 'string', description: 'Full name of the item.' },
    newName: { type: 'string', description: 'New name for transformed items.' },
    type: { enum: VALID_ITEM_TYPES, description: `Item type. One of ${VALID_ITEM_TYPES_STRING}` },
    description: { type: 'string', description: 'Short description of the item.' },
    activeDescription: { type: 'string', description: 'Description when item is active.' },
    isActive: { type: 'boolean', description: 'True if the item is active.' },
    holderId: {
      type: 'string',
      description: `ID of the holder. Use '${PLAYER_HOLDER_ID}', 'npc_*' or 'node_*'.`,
    },
    tags: { type: 'array', items: { enum: VALID_TAGS }, description: `Valid tags: ${VALID_TAGS_STRING}.` },
    chapters: {
      type: 'array',
      items: INVENTORY_CHAPTER_SCHEMA,
      description: `For 'page' use one chapter. For 'book' between ${String(MIN_BOOK_CHAPTERS)} chapters.`,
    },
    knownUses: { type: 'array', items: INVENTORY_KNOWN_USE_SCHEMA },
  },
  additionalProperties: false,
} as const;

const BASE_WRITTEN_PROPERTIES = {
  name: { type: 'string' },
  description: { type: 'string' },
  activeDescription: { type: 'string' },
  isActive: { type: 'boolean' },
  holderId: {
    type: 'string',
    description: `ID of the holder. Use '${PLAYER_HOLDER_ID}', 'npc_*' or 'node_*'.`,
  },
  tags: { type: 'array', items: { enum: [...COMMON_TAGS, ...WRITING_TAGS] } },
  chapters: { type: 'array', items: INVENTORY_CHAPTER_SCHEMA },
  knownUses: { type: 'array', items: INVENTORY_KNOWN_USE_SCHEMA },
} as const;

const INVENTORY_CREATE_WRITTEN_SCHEMA = {
  anyOf: [
    {
      type: 'object',
      properties: {
        ...BASE_WRITTEN_PROPERTIES,
        type: { const: 'book' },
        chapters: {
          type: 'array',
          items: INVENTORY_CHAPTER_SCHEMA,
          minItems: MIN_BOOK_CHAPTERS,
          maxItems: MAX_BOOK_CHAPTERS,
        },
      },
      required: ['name', 'type', 'description', 'holderId', 'tags', 'chapters'],
      additionalProperties: false,
    },
    {
      type: 'object',
      properties: {
        ...BASE_WRITTEN_PROPERTIES,
        type: { enum: ['page', 'map', 'picture'] },
        chapters: {
          type: 'array',
          items: INVENTORY_CHAPTER_SCHEMA,
          minItems: 1,
          maxItems: 1,
        },
      },
      required: ['name', 'type', 'description', 'holderId', 'tags', 'chapters'],
      additionalProperties: false,
    },
  ],
} as const;

const INVENTORY_CREATE_REGULAR_SCHEMA = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    type: { enum: VALID_ITEM_TYPES.filter(t => !['page', 'book', 'map', 'picture'].includes(t)) },
    description: { type: 'string' },
    activeDescription: { type: 'string' },
    isActive: { type: 'boolean' },
    holderId: {
      type: 'string',
      description: `ID of the holder. Use '${PLAYER_HOLDER_ID}', 'npc_*' or 'node_*'.`,
    },
    tags: { type: 'array', items: { enum: COMMON_TAGS } },
    knownUses: { type: 'array', items: INVENTORY_KNOWN_USE_SCHEMA },
  },
  required: ['name', 'type', 'description', 'holderId'],
  additionalProperties: false,
} as const;

const INVENTORY_CHANGE_WRITTEN_SCHEMA = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    name: { type: 'string' },
    newName: { type: 'string' },
    type: { enum: ['page', 'book', 'map', 'picture'] },
    description: { type: 'string' },
    activeDescription: { type: 'string' },
    isActive: { type: 'boolean' },
    tags: { type: 'array', items: { enum: [...COMMON_TAGS, ...WRITING_TAGS] } },
    knownUses: { type: 'array', items: INVENTORY_KNOWN_USE_SCHEMA },
    chapters: { type: 'array', items: INVENTORY_CHAPTER_SCHEMA },
  },
  required: ['id', 'name', 'type'],
  additionalProperties: false,
} as const;

const INVENTORY_CHANGE_REGULAR_SCHEMA = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    name: { type: 'string' },
    newName: { type: 'string' },
    type: {
      enum: VALID_ITEM_TYPES.filter(t => !['page', 'book', 'map', 'picture'].includes(t)),
    },
    description: { type: 'string' },
    activeDescription: { type: 'string' },
    isActive: { type: 'boolean' },
    tags: { type: 'array', items: { enum: COMMON_TAGS } },
    knownUses: { type: 'array', items: INVENTORY_KNOWN_USE_SCHEMA },
  },
  required: ['id', 'name'],
  additionalProperties: false,
} as const;

const INVENTORY_MOVE_SCHEMA = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    name: { type: 'string' },
    newHolderId: { type: 'string' },
  },
  required: ['id', 'name', 'newHolderId'],
  additionalProperties: false,
} as const;

const INVENTORY_DESTROY_SCHEMA = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    name: { type: 'string' },
  },
  required: ['id', 'name'],
  additionalProperties: false,
} as const;

const INVENTORY_ADD_DETAILS_WRITTEN_SCHEMA = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    name: { type: 'string' },
    type: { enum: ['page', 'book', 'map', 'picture'] },
    knownUses: { type: 'array', items: INVENTORY_KNOWN_USE_SCHEMA },
    tags: { type: 'array', items: { enum: [...COMMON_TAGS, ...WRITING_TAGS] } },
    chapters: { type: 'array', items: INVENTORY_CHAPTER_SCHEMA },
  },
  required: ['id', 'name', 'type', 'tags', 'chapters'],
  additionalProperties: false,
} as const;

const INVENTORY_ADD_DETAILS_REGULAR_SCHEMA = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    name: { type: 'string' },
    type: { enum: VALID_ITEM_TYPES.filter(t => !['page', 'book', 'map', 'picture'].includes(t)) },
    knownUses: { type: 'array', items: INVENTORY_KNOWN_USE_SCHEMA },
    tags: { type: 'array', items: { enum: COMMON_TAGS } },
  },
  required: ['id', 'name', 'type'],
  additionalProperties: false,
} as const;

export const INVENTORY_JSON_SCHEMA = {
  type: 'object',
  properties: {
    observations: {
      type: 'string',
      minLength: 500,
      description: 'Contextually relevant observations about the items.',
    },
    rationale: { type: 'string', description: 'Reasoning behind the inventory changes.' },
    create: {
      type: 'array',
      items: { anyOf: [INVENTORY_CREATE_REGULAR_SCHEMA, INVENTORY_CREATE_WRITTEN_SCHEMA] },
    },
    change: {
      type: 'array',
      items: { anyOf: [INVENTORY_CHANGE_REGULAR_SCHEMA, INVENTORY_CHANGE_WRITTEN_SCHEMA] },
    },
    move: { type: 'array', items: INVENTORY_MOVE_SCHEMA },
    destroy: { type: 'array', items: INVENTORY_DESTROY_SCHEMA },
    addDetails: {
      type: 'array',
      items: { anyOf: [INVENTORY_ADD_DETAILS_REGULAR_SCHEMA, INVENTORY_ADD_DETAILS_WRITTEN_SCHEMA] },
    },
  },
  required: ['observations', 'rationale'],
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

const resolveItemTags = async (
  item: Item,
  currentTheme: AdventureTheme,
): Promise<void> => {
  if (!item.tags || item.tags.length === 0) return;
  const final: Array<ItemTag> = [];
  for (const raw of item.tags) {
    const direct = normalizeTag(raw);
    if (direct) {
      if (!final.includes(direct)) final.push(direct);
      continue;
    }
    const corrected = await fetchCorrectedItemTag_Service(
      raw,
      item.name,
      item.description,
      currentTheme,
    );
    if (corrected && !final.includes(corrected)) {
      final.push(corrected);
    }
  }
  item.tags = final;
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
      await resolveItemTags(change.item as Item, currentTheme);
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
