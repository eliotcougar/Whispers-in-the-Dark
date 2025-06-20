/**
 * @file api.ts
 * @description Wrapper functions for inventory-related AI interactions.
 */

import { GenerateContentResponse } from '@google/genai';
import { MINIMAL_MODEL_NAME, GEMINI_MODEL_NAME, LOADING_REASON_UI_MAP } from '../../constants';
import { SYSTEM_INSTRUCTION } from './systemPrompt';
import { dispatchAIRequest } from '../modelDispatcher';
import { isApiConfigured } from '../apiClient';
import { AdventureTheme, ItemChange, NewItemSuggestion } from '../../types';
import { buildInventoryPrompt } from './promptBuilder';
import { parseInventoryResponse, InventoryAIPayload } from './responseParser';
import { fetchCorrectedItemChangeArray_Service } from '../corrections';
import { addProgressSymbol } from '../../utils/loadingProgress';

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
  addProgressSymbol(LOADING_REASON_UI_MAP.inventory.icon);
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
  itemChanges: Array<ItemChange>;
  debugInfo: {
    prompt: string;
    rawResponse?: string;
    parsedItemChanges?: Array<ItemChange>;
    observations?: string;
    rationale?: string;
  } | null;
}

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
  const response = await executeInventoryRequest(prompt);
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
  return {
    itemChanges: parsed ? parsed.itemChanges : [],
    debugInfo: {
      prompt,
      rawResponse: response.text ?? '',
      parsedItemChanges: parsed ? parsed.itemChanges : undefined,
      observations: parsed?.observations,
      rationale: parsed?.rationale,
    },
  };
};
