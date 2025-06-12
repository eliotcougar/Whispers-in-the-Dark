/**
 * @file api.ts
 * @description Wrapper functions for inventory-related AI interactions.
 */

import { GenerateContentResponse } from '@google/genai';
import { MINIMAL_MODEL_NAME, GEMINI_MODEL_NAME } from '../../constants';
import { SYSTEM_INSTRUCTION } from './systemPrompt';
import { dispatchAIRequest } from '../modelDispatcher';
import { isApiConfigured } from '../apiClient';

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
