/**
 * @file api.ts
 * @description High level functions for Loremaster AI.
 */
import { GEMINI_LITE_MODEL_NAME, GEMINI_MODEL_NAME, MINIMAL_MODEL_NAME, LOADING_REASON_UI_MAP } from '../../constants';
import { dispatchAIRequest } from '../modelDispatcher';
import { retryAiCall } from '../../utils/retry';
import { isApiConfigured } from '../apiClient';
import { addProgressSymbol } from '../../utils/loadingProgress';
import {
  buildExtractFactsPrompt,
  buildIntegrateFactsPrompt,
  buildCollectRelevantFactsPrompt,
  buildDistillFactsPrompt,
  FactForSelection,
} from './promptBuilder';
import {
  parseExtractFactsResponse,
  parseIntegrationResponse,
  parseCollectFactsResponse,
} from './responseParser';
import { ThemeFact, LoreRefinementResult, LoremasterRefineDebugInfo } from '../../types';
import {
  EXTRACT_SYSTEM_INSTRUCTION,
  INTEGRATE_ADD_ONLY_SYSTEM_INSTRUCTION,
  COLLECT_SYSTEM_INSTRUCTION,
  DISTILL_SYSTEM_INSTRUCTION,
} from './systemPrompt';

export interface RefineLoreParams {
  themeName: string;
  turnContext: string;
  existingFacts: Array<ThemeFact>;
  onFactsExtracted?: (facts: Array<string>) => Promise<{ proceed: boolean }>;
}

export interface RefineLoreServiceResult {
  refinementResult: LoreRefinementResult | null;
  debugInfo: LoremasterRefineDebugInfo | null;
}

export const refineLore_Service = async (
  params: RefineLoreParams,
): Promise<RefineLoreServiceResult | null> => {
  if (!isApiConfigured()) {
    console.error('refineLore_Service: API not configured');
    return null;
  }
  const { themeName, turnContext, existingFacts, onFactsExtracted } = params;

  const extractPrompt = buildExtractFactsPrompt(themeName, turnContext);
  const newFacts = await retryAiCall<{ parsed: Array<string> | null; raw: string; thoughts: Array<string> } | null>(async () => {
    addProgressSymbol(LOADING_REASON_UI_MAP.loremaster_extract.icon);
    const { response } = await dispatchAIRequest({
      modelNames: [GEMINI_LITE_MODEL_NAME, GEMINI_MODEL_NAME],
      prompt: extractPrompt,
      systemInstruction: EXTRACT_SYSTEM_INSTRUCTION,
      thinkingBudget: 512,
      includeThoughts: true,
      responseMimeType: 'application/json',
      temperature: 0.7,
      label: 'LoremasterExtract',
    });
    const parts = (response.candidates?.[0]?.content?.parts ?? []) as Array<{ text?: string; thought?: boolean }>;
    const thoughtParts = parts
      .filter((p): p is { text: string; thought?: boolean } => p.thought === true && typeof p.text === 'string')
      .map(p => p.text);
    return { result: { parsed: parseExtractFactsResponse(response.text ?? ''), raw: response.text ?? '', thoughts: thoughtParts } };
  });
  if (!newFacts) return null;

  if (onFactsExtracted) {
    const { proceed } = await onFactsExtracted(newFacts.parsed ?? []);
    if (!proceed) {
      return {
        refinementResult: null,
        debugInfo: {
          extract: {
            prompt: extractPrompt,
            rawResponse: newFacts.raw,
            parsedPayload: newFacts.parsed ?? undefined,
            thoughts: newFacts.thoughts,
          },
          integrate: null,
        },
      };
    }
  }

  const integratePrompt = buildIntegrateFactsPrompt(themeName, existingFacts, newFacts.parsed ?? []);
  const integration = await retryAiCall<{ parsed: LoreRefinementResult; raw: string; thoughts: Array<string> } | null>(async () => {
    addProgressSymbol(LOADING_REASON_UI_MAP.loremaster_write.icon);
    const { response } = await dispatchAIRequest({
      modelNames: [GEMINI_LITE_MODEL_NAME, GEMINI_MODEL_NAME],
      prompt: integratePrompt,
      systemInstruction: INTEGRATE_ADD_ONLY_SYSTEM_INSTRUCTION,
      thinkingBudget: 2048,
      includeThoughts: true,
      responseMimeType: 'application/json',
      temperature: 0.7,
      label: 'LoremasterIntegrate',
    });
    const parts = (response.candidates?.[0]?.content?.parts ?? []) as Array<{ text?: string; thought?: boolean }>;
    const thoughtParts = parts
      .filter((p): p is { text: string; thought?: boolean } => p.thought === true && typeof p.text === 'string')
      .map(p => p.text);
    const parsed = parseIntegrationResponse(response.text ?? '', existingFacts);
    return { result: parsed ? { parsed, raw: response.text ?? '', thoughts: thoughtParts } : null };
  });
  return {
    refinementResult: integration?.parsed ?? null,
    debugInfo: {
      extract: {
        prompt: extractPrompt,
        rawResponse: newFacts.raw,
        parsedPayload: newFacts.parsed ?? undefined,
        thoughts: newFacts.thoughts,
      },
      integrate: {
        prompt: integratePrompt,
        rawResponse: integration?.raw,
        parsedPayload: integration?.parsed,
        observations: integration?.parsed.observations,
        rationale: integration?.parsed.rationale,
        thoughts: integration?.thoughts,
      },
    },
  };
};

export interface CollectFactsParams {
  themeName: string;
  facts: Array<FactForSelection>;
  lastScene: string;
  playerAction: string;
  recentLogEntries: Array<string>;
  detailedContext: string;
}

export interface CollectFactsServiceResult {
  facts: Array<string>;
  debugInfo: {
    prompt: string;
    rawResponse?: string;
    parsedPayload?: Array<string>;
    thoughts?: Array<string>;
  } | null;
}

export const collectRelevantFacts_Service = async (
  params: CollectFactsParams,
): Promise<CollectFactsServiceResult | null> => {
  if (!isApiConfigured()) {
    console.error('collectRelevantFacts_Service: API not configured');
    return null;
  }
  const {
    themeName,
    facts,
    lastScene,
    playerAction,
    recentLogEntries,
    detailedContext,
  } = params;

  const prompt = buildCollectRelevantFactsPrompt(
    themeName,
    facts,
    lastScene,
    playerAction,
    recentLogEntries,
    detailedContext,
  );

  const result = await retryAiCall<{ parsed: Array<string> | null; raw: string; thoughts: Array<string> } | null>(async () => {
    addProgressSymbol(LOADING_REASON_UI_MAP.loremaster_collect.icon);
    const { response } = await dispatchAIRequest({
      modelNames: [MINIMAL_MODEL_NAME, GEMINI_LITE_MODEL_NAME, GEMINI_MODEL_NAME],
      prompt,
      systemInstruction: COLLECT_SYSTEM_INSTRUCTION,
      thinkingBudget: 1024,
      includeThoughts: true,
      responseMimeType: 'application/json',
      temperature: 0.7,
      label: 'LoremasterCollect',
    });
    const parts = (response.candidates?.[0]?.content?.parts ?? []) as Array<{ text?: string; thought?: boolean }>;
    const thoughtParts = parts
      .filter((p): p is { text: string; thought?: boolean } => p.thought === true && typeof p.text === 'string')
      .map(p => p.text);
    return { result: { parsed: parseCollectFactsResponse(response.text ?? ''), raw: response.text ?? '', thoughts: thoughtParts } };
  });
  return {
    facts: result?.parsed ?? [],
    debugInfo: {
      prompt,
      rawResponse: result?.raw,
      parsedPayload: result?.parsed ?? undefined,
      thoughts: result?.thoughts,
    },
  };
};

export interface DistillFactsParams {
  themeName: string;
  facts: Array<ThemeFact>;
  currentQuest: string | null;
  currentObjective: string | null;
  inventoryItemNames: Array<string>;
  mapNodeNames: Array<string>;
}

export interface DistillFactsServiceResult {
  refinementResult: LoreRefinementResult | null;
  debugInfo: {
    prompt: string;
    rawResponse?: string;
    parsedPayload?: LoreRefinementResult;
    observations?: string;
    rationale?: string;
    thoughts?: Array<string>;
  } | null;
}

export const distillFacts_Service = async (
  params: DistillFactsParams,
): Promise<DistillFactsServiceResult | null> => {
  if (!isApiConfigured()) {
    console.error('distillFacts_Service: API not configured');
    return null;
  }
  const {
    themeName,
    facts,
    currentQuest,
    currentObjective,
    inventoryItemNames,
    mapNodeNames,
  } = params;

  const prompt = buildDistillFactsPrompt(
    themeName,
    facts,
    currentQuest,
    currentObjective,
    inventoryItemNames,
    mapNodeNames,
  );

  const result = await retryAiCall<{ parsed: LoreRefinementResult; raw: string; thoughts: Array<string> } | null>(async () => {
    addProgressSymbol(LOADING_REASON_UI_MAP.loremaster_refine.icon);
    const { response } = await dispatchAIRequest({
      modelNames: [GEMINI_MODEL_NAME, GEMINI_LITE_MODEL_NAME],
      prompt,
      systemInstruction: DISTILL_SYSTEM_INSTRUCTION,
      thinkingBudget: 4096,
      includeThoughts: true,
      responseMimeType: 'application/json',
      temperature: 0.7,
      label: 'LoremasterDistill',
    });
    const parts = (response.candidates?.[0]?.content?.parts ?? []) as Array<{ text?: string; thought?: boolean }>;
    const thoughtParts = parts
      .filter((p): p is { text: string; thought?: boolean } => p.thought === true && typeof p.text === 'string')
      .map(p => p.text);
    const parsed = parseIntegrationResponse(response.text ?? '', facts);
    return { result: parsed ? { parsed, raw: response.text ?? '', thoughts: thoughtParts } : null };
  });

  return {
    refinementResult: result?.parsed ?? null,
    debugInfo: {
      prompt,
      rawResponse: result?.raw,
      parsedPayload: result?.parsed,
      observations: result?.parsed.observations,
      rationale: result?.parsed.rationale,
      thoughts: result?.thoughts,
    },
  };
};
