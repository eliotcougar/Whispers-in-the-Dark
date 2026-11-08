/**
 * @file services/modelDispatcher.ts
 * @description Utility for dispatching AI requests with model fallback support.
 */

import { GenerateContentResponse } from '@google/genai';
import { geminiClient as ai, isApiConfigured } from './geminiClient';
import { getAIConnection, generateChatGPTText } from './aiProvider';
import {
  isServerOrClientError,
  extractStatusFromError,
  isTransientNetworkError,
  isInvalidApiKeyResponse,
  toInvalidApiKeyError,
} from '../utils/aiErrorUtils';
import { MinimalModelCallRecord } from '../types';
import {
  recordModelCall,
  getDelayUntilUnderLimit,
} from '../utils/modelUsageTracker';
import {
  MINIMAL_MODEL_NAME,
  GEMINI_MODEL_NAME,
  GEMINI_LITE_MODEL_NAME,
  TINY_MODEL_NAME,
  MINIMAL_MODEL_RPM,
  GEMINI_MODEL_RPM,
  GEMINI_LITE_MODEL_RPM,
  GEMINI_PRO_MODEL_RPM,
  TINY_MODEL_RPM,
  MAX_RETRIES,
} from '../constants';
import { jsonSchemaToPrompt, JsonSchema } from '../utils/schemaPrompt';
import { isGeminiTextModel } from '../shared/gemini';

export type ModelFeature = 'thinking' | 'system' | 'schema';

export type ModelEntry = string | [string, Array<ModelFeature>];

const DEFAULT_FEATURES: Record<string, Array<ModelFeature>> = {
  [GEMINI_MODEL_NAME]: ['thinking', 'system', 'schema'],
  [GEMINI_LITE_MODEL_NAME]: ['thinking', 'system', 'schema'],
  [MINIMAL_MODEL_NAME]: [],
  [TINY_MODEL_NAME]: [],
};

export interface ModelDispatchOptions {
  modelNames: Array<ModelEntry>;
  prompt: string;
  systemInstruction?: string;
  temperature?: number;
  responseMimeType?: string;
  thinkingBudget?: number;
  includeThoughts?: boolean;
  jsonSchema?: unknown;
  label?: string;
  debugLog?: Array<MinimalModelCallRecord>;
  maxOutputTokens?: number;
}

/**
 * Sends an AI request, trying each model in order until one succeeds. Falls
 * back to the next model only when a client or server error (typically 4xx)
 * is encountered.
 */
export const dispatchAIRequest = async (
  options: ModelDispatchOptions,
): Promise<{
  response: GenerateContentResponse;
  modelUsed: string;
  systemInstructionUsed: string;
  jsonSchemaUsed?: unknown;
  promptUsed: string;
}> => {
  const connection = getAIConnection();
  if (connection.provider === 'chatgpt') {
    if (!isApiConfigured()) throw new Error('Open AI connection and connect ChatGPT with an available model.');
    const { model } = connection;
    const schemaInstruction = options.jsonSchema
      ? '\nReturn only valid JSON matching this schema. Optional properties may be omitted.\n' + JSON.stringify(options.jsonSchema)
      : options.responseMimeType === 'application/json' ? '\nReturn only valid JSON.' : '';
    const instructions = (options.systemInstruction ?? '') + schemaInstruction;
    const result = await generateChatGPTText({ model, prompt: options.prompt, instructions });
    const response = new GenerateContentResponse();
    response.candidates = [{ content: { role: 'model', parts: [{ text: result.text }] } }];
    response.usageMetadata = { promptTokenCount: result.inputTokens, candidatesTokenCount: result.outputTokens, totalTokenCount: result.inputTokens + result.outputTokens };
    options.debugLog?.push({ prompt: options.prompt, systemInstruction: instructions, jsonSchema: options.jsonSchema, modelUsed: result.model || model, responseText: result.text, promptUsed: options.prompt });
    return { response, modelUsed: result.model || model, systemInstructionUsed: instructions, jsonSchemaUsed: options.jsonSchema, promptUsed: options.prompt };
  }

  if (!isApiConfigured() || !ai) {
    return Promise.reject(new Error('API Key not configured.'));
  }

  const rateLimits: Record<string, number> = {
    [GEMINI_MODEL_NAME]: GEMINI_MODEL_RPM,
    [GEMINI_LITE_MODEL_NAME]: GEMINI_LITE_MODEL_RPM,
    [MINIMAL_MODEL_NAME]: MINIMAL_MODEL_RPM,
    [TINY_MODEL_NAME]: TINY_MODEL_RPM,
    'gemini-pro-latest': GEMINI_PRO_MODEL_RPM,
  };

  const selectedModel = isGeminiTextModel(connection.geminiModel) && connection.geminiModel !== 'auto'
    ? connection.geminiModel : null;
  const modelNames: Array<ModelEntry> = selectedModel
    ? [[selectedModel, ['thinking', 'system', 'schema']]]
    : options.modelNames;

  let lastError: unknown = null;
  for (const [modelIndex, entry] of modelNames.entries()) {
    const [model, features] = Array.isArray(entry)
      ? entry
      : [entry, DEFAULT_FEATURES[entry] ?? []];
    const supportsSystem = features.includes('system');
    const supportsThinking = features.includes('thinking');
    const supportsSchema = features.includes('schema');

    let systemInstruction = options.systemInstruction ?? '';
    if (!supportsSchema && options.jsonSchema) {
      const schemaPrompt = jsonSchemaToPrompt(options.jsonSchema as JsonSchema);
      systemInstruction = systemInstruction
        ? `${systemInstruction}\n\n${schemaPrompt}`
        : schemaPrompt;
    }

    const contents = supportsSystem
      ? options.prompt
      : `${systemInstruction ? systemInstruction + '\n\n' : ''}${options.prompt}`;

    const cfg: Record<string, unknown> = {};
    if (options.temperature !== undefined) cfg.temperature = options.temperature;
    if (options.responseMimeType && supportsSchema) cfg.responseMimeType = options.responseMimeType;
    if (options.maxOutputTokens !== undefined) cfg.maxOutputTokens = options.maxOutputTokens;
    if (supportsThinking && (options.thinkingBudget !== undefined || options.includeThoughts)) {
      const thinkingCfg: { thinkingBudget?: number; includeThoughts?: boolean } = {};
      if (options.thinkingBudget !== undefined) {
        thinkingCfg.thinkingBudget = options.thinkingBudget;
      }
      if (options.includeThoughts) {
        thinkingCfg.includeThoughts = true;
      }
      cfg.thinkingConfig = thinkingCfg;
    }
    if (supportsSystem && systemInstruction) {
      cfg.systemInstruction = systemInstruction;
    }
    if (supportsSchema && options.jsonSchema) {
      cfg.responseJsonSchema = options.jsonSchema;
    }

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      const extraDelay = getDelayUntilUnderLimit(model, rateLimits[model] ?? 1);
      if (extraDelay > 0 || attempt > 1) {
        const delay = 5000 + extraDelay;
        await new Promise(res => setTimeout(res, delay));
      }
      const controller = new AbortController();
      const timeout = setTimeout(() => { controller.abort(); }, 120_000);
      try {
        // Failed requests also contribute to the provider's request limits.
        recordModelCall(model);
        const response = await ai.models.generateContent({
          model,
          contents,
          config: { ...cfg, abortSignal: controller.signal },
        });

        if (options.label) {
          console.log(
            `[${options.label}] ${model} tokens: total ${String(response.usageMetadata?.totalTokenCount ?? 'N/A')}, prompt ${String(response.usageMetadata?.promptTokenCount ?? 'N/A')}, thoughts ${String(response.usageMetadata?.thoughtsTokenCount ?? 'N/A')}`
          );
        }

        if (options.debugLog) {
          options.debugLog.push({
            prompt: options.prompt,
            systemInstruction: systemInstruction,
            jsonSchema: options.jsonSchema,
            modelUsed: model,
            responseText: response.text ?? '',
            promptUsed: contents,
          });
        }

        return {
          response,
          modelUsed: model,
          systemInstructionUsed: systemInstruction,
          jsonSchemaUsed: supportsSchema ? options.jsonSchema : undefined,
          promptUsed: contents,
        };
      } catch (cause: unknown) {
        const err: unknown = controller.signal.aborted
          ? Object.assign(new Error('The Gemini request timed out. Please try again.'), { status: 504 })
          : cause;
        if (options.debugLog) {
          options.debugLog.push({
            prompt: options.prompt,
            systemInstruction: systemInstruction,
            jsonSchema: options.jsonSchema,
            modelUsed: model,
            responseText: `ERROR: ${err instanceof Error ? err.message : String(err)}`,
            promptUsed: contents,
          });
        }

        if (isInvalidApiKeyResponse(err)) {
          throw toInvalidApiKeyError(err);
        }

        lastError = err;
        if (!isServerOrClientError(err) && !isTransientNetworkError(err)) {
          throw err;
        }

        const status = extractStatusFromError(err);
        if (status !== null && (status === 429 || status === 503 || status === 504) && modelIndex + 1 < modelNames.length) {
          console.warn(`dispatchAIRequest: Model ${model} failed with ${String(status)}. Trying the next model.`);
          break;
        }
        const errorMsg = err instanceof Error ? err.message : String(err);
        const statusInfo = status !== null ? String(status) : errorMsg;
        console.warn(
          `dispatchAIRequest: Model ${model} failed with ${statusInfo}. Retry ${String(attempt)}/${String(MAX_RETRIES)}`
        );
      } finally {
        clearTimeout(timeout);
      }
    }

    console.warn(
      `dispatchAIRequest: Model ${model} failed. Falling back if another model is available.`
    );
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
};

