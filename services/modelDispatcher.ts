/**
 * @file services/modelDispatcher.ts
 * @description Utility for dispatching AI requests with model fallback support.
 */

import { GenerateContentResponse } from '@google/genai';
import { ai } from './geminiClient';
import { isApiConfigured } from './apiClient';
import { isServerOrClientError, extractStatusFromError } from '../utils/aiErrorUtils';

/** Determines if a model supports separate system instructions. */
const supportsSystemInstruction = (model: string): boolean => !model.startsWith('gemma-');

/**
 * Sends an AI request, trying each model in order until one succeeds.
 * Falls back to the next model only when a client or server error is returned.
 *
 * @param modelNames - Array of model names to try in order.
 * @param prompt - The user prompt to send.
 * @param systemInstruction - Optional system instruction to include.
 * @param config - Additional generateContent configuration.
 * @returns The GenerateContentResponse from the first successful model.
 */
export const dispatchAIRequest = async (
  modelNames: string[],
  prompt: string,
  systemInstruction?: string,
  config: Record<string, unknown> = {}
): Promise<GenerateContentResponse> => {
  if (!isApiConfigured() || !ai) {
    return Promise.reject(new Error('API Key not configured.'));
  }

  let lastError: unknown = null;
  for (const model of modelNames) {
    try {
      const modelSupportsSystem = supportsSystemInstruction(model);
      const contents = modelSupportsSystem
        ? prompt
        : `${systemInstruction ? systemInstruction + '\n\n' : ''}${prompt}`;
      const cfg = { ...config };
      if (modelSupportsSystem && systemInstruction) {
        cfg.systemInstruction = systemInstruction;
      }

      const response = await ai.models.generateContent({
        model,
        contents,
        config: cfg,
      });
      return response;
    } catch (err) {
      lastError = err;
      if (!isServerOrClientError(err)) {
        throw err;
      }
      console.warn(
        `dispatchAIRequest: Model ${model} failed with status ${extractStatusFromError(err)}. Trying next model if available.`
      );
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
};

