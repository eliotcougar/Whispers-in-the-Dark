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
import {
  recordModelCall,
  getDelayUntilUnderLimit,
} from '../utils/modelUsageTracker';
import {
  MINIMAL_MODEL_NAME,
  GEMINI_MODEL_NAME,
  AUXILIARY_MODEL_NAME,
  MINIMAL_RATE_LIMIT_PER_MINUTE,
  GEMINI_RATE_LIMIT_PER_MINUTE,
  AUXILIARY_RATE_LIMIT_PER_MINUTE,
  MAX_RETRIES,
} from '../constants';

/** Determines if a model supports separate system instructions. */
const supportsSystemInstruction = (model: string): boolean => !model.startsWith('gemma-');

export interface ModelDispatchOptions {
  modelNames: Array<string>;
  prompt: string;
  systemInstruction?: string;
  temperature?: number;
  responseMimeType?: string;
  thinkingBudget?: number;
  includeThoughts?: boolean;
  responseSchema?: object;
  label?: string;
  debugLog?: Array<MinimalModelCallRecord>;
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

  const rateLimits: Record<string, number> = {
    [GEMINI_MODEL_NAME]: GEMINI_RATE_LIMIT_PER_MINUTE,
    [AUXILIARY_MODEL_NAME]: AUXILIARY_RATE_LIMIT_PER_MINUTE,
    [MINIMAL_MODEL_NAME]: MINIMAL_RATE_LIMIT_PER_MINUTE,
  };

  let lastError: unknown = null;
  for (const model of options.modelNames) {
    const modelSupportsSystem = supportsSystemInstruction(model);
    const contents = modelSupportsSystem
      ? options.prompt
      : `${options.systemInstruction ? options.systemInstruction + '\n\n' : ''}${options.prompt}`;

    const cfg: Record<string, unknown> = {};
    if (options.temperature !== undefined) cfg.temperature = options.temperature;
    if (options.responseMimeType && model !== MINIMAL_MODEL_NAME) cfg.responseMimeType = options.responseMimeType;
    if (
      model !== MINIMAL_MODEL_NAME &&
      (options.thinkingBudget !== undefined || options.includeThoughts)
    ) {
      const thinkingCfg: { thinkingBudget?: number; includeThoughts?: boolean } = {};
      if (options.thinkingBudget !== undefined) {
        thinkingCfg.thinkingBudget = options.thinkingBudget;
      }
      if (options.includeThoughts) {
        thinkingCfg.includeThoughts = true;
      }
      cfg.thinkingConfig = thinkingCfg;
    }
    if (modelSupportsSystem && options.systemInstruction) {
      cfg.systemInstruction = options.systemInstruction;
    }
    if (options.responseSchema && model !== MINIMAL_MODEL_NAME) {
      cfg.responseSchema = options.responseSchema;
    }

    for (let attempt = 1; attempt <= MAX_RETRIES; ) {
      const extraDelay = getDelayUntilUnderLimit(model, rateLimits[model] ?? 1);
      if (extraDelay > 0 || attempt > 1) {
        const delay = 5000 + extraDelay;
        await new Promise(res => setTimeout(res, delay));
      }
      try {
        const response = await ai.models.generateContent({
          model,
          contents,
          config: cfg,
        });
        recordModelCall(model);

        if (options.label) {
          console.log(
            `[${options.label}] ${model} tokens: total ${String(response.usageMetadata?.totalTokenCount ?? 'N/A')}, prompt ${String(response.usageMetadata?.promptTokenCount ?? 'N/A')}, thoughts ${String(response.usageMetadata?.thoughtsTokenCount ?? 'N/A')}`
          );
        }

        if (options.debugLog) {
          options.debugLog.push({
            prompt: options.prompt,
            systemInstruction: options.systemInstruction ?? '',
            modelUsed: model,
            responseText: response.text ?? '',
          });
        }

        return { response, modelUsed: model };
      } catch (err) {
        if (options.debugLog) {
          options.debugLog.push({
            prompt: options.prompt,
            systemInstruction: options.systemInstruction ?? '',
            modelUsed: model,
            responseText: `ERROR: ${err instanceof Error ? err.message : String(err)}`,
          });
        }

        lastError = err;
        if (!isServerOrClientError(err)) {
          throw err;
        }

        console.warn(
          `dispatchAIRequest: Model ${model} failed with status ${String(extractStatusFromError(err))}. Retry ${String(attempt)}/${String(MAX_RETRIES)}`
        );
        attempt += 1;
      }
    }

    console.warn(
      `dispatchAIRequest: Model ${model} exhausted retries. Falling back if another model is available.`
    );
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
};

