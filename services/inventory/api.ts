/**
 * @file api.ts
 * @description Wrapper functions for inventory-related AI interactions.
 */

import { GenerateContentResponse } from '@google/genai';
import { MINIMAL_MODEL_NAME, GEMINI_MODEL_NAME } from '../../constants';
import { SYSTEM_INSTRUCTION } from './systemPrompt';
import { dispatchAIRequest } from '../modelDispatcher';
import { isApiConfigured } from '../apiClient';
import { ItemChange, NewItemSuggestion } from '../../types';
import { buildInventoryPrompt } from './promptBuilder';
import { parseInventoryResponse } from './responseParser';

/**
 * Executes the inventory AI call using model fallback.
 */
export const executeInventoryRequest = async (
  prompt: string,
): Promise<GenerateContentResponse> => {
  if (!isApiConfigured()) {
    console.error('API Key not configured for Inventory Service.');
    return Promise.reject(new Error('API Key not configured.'));
  }
  const { response } = await dispatchAIRequest({
    modelNames: [MINIMAL_MODEL_NAME, GEMINI_MODEL_NAME],
    prompt,
    systemInstruction: SYSTEM_INSTRUCTION,
    responseMimeType: 'application/json',
    temperature: 0.7,
    label: 'Inventory',
  });
  return response;
};

export interface InventoryUpdateResult {
  itemChanges: ItemChange[];
  debugInfo: { prompt: string; rawResponse?: string } | null;
}

export const applyInventoryHints_Service = async (
  playerItemsHint: string | undefined,
  worldItemsHint: string | undefined,
  npcItemsHint: string | undefined,
  newItems: NewItemSuggestion[],
  playerLastAction: string,
  playerInventory: string,
  locationInventory: string,
  companionsInventory: string,
  nearbyNpcsInventory: string,
): Promise<InventoryUpdateResult | null> => {
  const pHint = playerItemsHint?.trim() || '';
  const wHint = worldItemsHint?.trim() || '';
  const nHint = npcItemsHint?.trim() || '';
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
    companionsInventory,
    nearbyNpcsInventory,
  );
  const response = await executeInventoryRequest(prompt);
  const parsed = parseInventoryResponse(response.text ?? '') || [];
  return { itemChanges: parsed, debugInfo: { prompt, rawResponse: response.text ?? '' } };
};
