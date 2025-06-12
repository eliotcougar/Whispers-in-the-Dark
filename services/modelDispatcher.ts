/**
 * @file services/modelDispatcher.ts
 * @description Utility for dispatching AI requests with model fallback support.
 */

import { GenerateContentResponse } from '@google/genai';
import { ai } from './geminiClient';
import { isApiConfigured } from './apiClient';
import {
  isServerOrClientError,
  extractStatusFromError,
} from '../utils/aiErrorUtils';
import { MinimalModelCallRecord } from '../types';
import { recordModelCall } from '../utils/modelUsageTracker';
import { MINIMAL_MODEL_NAME } from '../constants';

/** Determines if a model supports separate system instructions. */
const supportsSystemInstruction = (model: string): boolean => !model.startsWith('gemma-');

export interface ModelDispatchOptions {
  modelNames: string[];
  prompt: string;
  systemInstruction?: string;
  temperature?: number;
  responseMimeType?: string;
  thinkingBudget?: number;
  responseSchema?: object;
  label?: string;
  debugLog?: MinimalModelCallRecord[];
}

/**
 * Sends an AI request, trying each model in order until one succeeds. Falls
 * back to the next model only when a client or server error (typically 4xx)
 * is encountered.
 */
export const dispatchAIRequest = async (
  options: ModelDispatchOptions
): Promise<{ response: GenerateContentResponse; modelUsed: string }> => {
  if (!isApiConfigured() || !ai) {
    return Promise.reject(new Error('API Key not configured.'));
  }

  let lastError: unknown = null;
  for (const model of options.modelNames) {
    try {
      const modelSupportsSystem = supportsSystemInstruction(model);
      const contents = modelSupportsSystem
        ? options.prompt
        : `${options.systemInstruction ? options.systemInstruction + '\n\n' : ''}${options.prompt}`;

      const cfg: Record<string, unknown> = {};
      if (options.temperature !== undefined) cfg.temperature = options.temperature;
      if (options.responseMimeType) cfg.responseMimeType = options.responseMimeType;
      if (options.thinkingBudget !== undefined) {
        cfg.thinkingConfig = { thinkingBudget: options.thinkingBudget };
      }
      if (modelSupportsSystem && options.systemInstruction) {
        cfg.systemInstruction = options.systemInstruction;
      }
      if (options.responseSchema && model !== MINIMAL_MODEL_NAME) {
        cfg.responseSchema = options.responseSchema;
      }

      recordModelCall(model);
      const response = await ai.models.generateContent({
        model,
        contents,
        config: cfg,
      });

      if (options.label) {
        console.log(
          `[${options.label}] tokens: total ${response.usageMetadata?.totalTokenCount ?? 'N/A'}, prompt ${response.usageMetadata?.promptTokenCount ?? 'N/A'}, thoughts ${response.usageMetadata?.thoughtsTokenCount ?? 'N/A'}`
        );
      }

      if (options.debugLog) {
        options.debugLog.push({
          prompt: options.prompt,
          systemInstruction: options.systemInstruction || '',
          modelUsed: model,
          responseText: response.text ?? '',
        });
      }

      return { response, modelUsed: model };
    } catch (err) {
      if (options.debugLog) {
        options.debugLog.push({
          prompt: options.prompt,
          systemInstruction: options.systemInstruction || '',
          modelUsed: model,
          responseText: `ERROR: ${err instanceof Error ? err.message : String(err)}`,
        });
      }

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

