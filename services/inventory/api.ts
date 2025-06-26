/**
 * @file api.ts
 * @description Wrapper functions for inventory-related AI interactions.
 */

import { GenerateContentResponse } from '@google/genai';
import {
  MINIMAL_MODEL_NAME,
  GEMINI_MODEL_NAME,
  LOADING_REASON_UI_MAP,
  MIN_BOOK_CHAPTERS,
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

/**
 * Executes the inventory AI call using model fallback.
 */
export const executeInventoryRequest = async (
  prompt: string,
): Promise<{ response: GenerateContentResponse; thoughts: Array<string> }> => {
  if (!isApiConfigured()) {
    console.error('API Key not configured for Inventory Service.');
    return Promise.reject(new Error('API Key not configured.'));
  }
  addProgressSymbol(LOADING_REASON_UI_MAP.inventory.icon);
  const { response } = await dispatchAIRequest({
    modelNames: [MINIMAL_MODEL_NAME, GEMINI_MODEL_NAME],
    prompt,
    systemInstruction: SYSTEM_INSTRUCTION,
    thinkingBudget: 1024,
    includeThoughts: true,
    responseMimeType: 'application/json',
    temperature: 0.7,
    label: 'Inventory',
  });
  const parts = (response.candidates?.[0]?.content?.parts ?? []) as Array<{ text?: string; thought?: boolean }>;
  const thoughtParts = parts
    .filter((p): p is { text: string; thought?: boolean } => p.thought === true && typeof p.text === 'string')
    .map(p => p.text);
  return { response, thoughts: thoughtParts };
};

export interface InventoryUpdateResult {
  itemChanges: Array<ItemChange>;
  debugInfo: {
    prompt: string;
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
      ch => (ch.action === 'gain' || ch.action === 'put') && ch.item.name === suggestion.name,
    );
    if (match && (match.action === 'gain' || match.action === 'put')) {
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
  const { response, thoughts } = await executeInventoryRequest(prompt);
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
      if ((change.action === 'gain' || change.action === 'put') && change.item.type === 'book') {
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
      prompt,
      rawResponse: response.text ?? '',
      parsedItemChanges: parsed ? parsed.itemChanges : undefined,
      observations: parsed?.observations,
      rationale: parsed?.rationale,
      thoughts: thoughts,
    },
  };
};
