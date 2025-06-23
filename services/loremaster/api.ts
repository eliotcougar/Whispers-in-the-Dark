/**
 * @file api.ts
 * @description High level functions for Loremaster AI.
 */
import { AUXILIARY_MODEL_NAME, GEMINI_MODEL_NAME, LOADING_REASON_UI_MAP } from '../../constants';
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
import { ThemeFact, LoreRefinementResult } from '../../types';
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
}

export interface RefineLoreServiceResult {
  refinementResult: LoreRefinementResult | null;
  debugInfo: {
    prompt: string;
    rawResponse?: string;
    parsedPayload?: LoreRefinementResult;
    observations?: string;
    rationale?: string;
  } | null;
}

export const refineLore_Service = async (
  params: RefineLoreParams,
): Promise<RefineLoreServiceResult | null> => {
  if (!isApiConfigured()) {
    console.error('refineLore_Service: API not configured');
    return null;
  }
  const { themeName, turnContext, existingFacts } = params;

  const extractPrompt = buildExtractFactsPrompt(themeName, turnContext);
  const newFacts = await retryAiCall<{ parsed: Array<string> | null; raw: string } | null>(async () => {
    addProgressSymbol(LOADING_REASON_UI_MAP.loremaster.icon);
    const { response } = await dispatchAIRequest({
      modelNames: [AUXILIARY_MODEL_NAME, GEMINI_MODEL_NAME],
      prompt: extractPrompt,
      systemInstruction: EXTRACT_SYSTEM_INSTRUCTION,
      responseMimeType: 'application/json',
      temperature: 0.7,
      label: 'LoremasterExtract',
    });
    return { result: { parsed: parseExtractFactsResponse(response.text ?? ''), raw: response.text ?? '' } };
  });
  if (!newFacts) return null;

  const integratePrompt = buildIntegrateFactsPrompt(themeName, existingFacts, newFacts.parsed ?? []);
  const integration = await retryAiCall<{ parsed: LoreRefinementResult | null; raw: string } | null>(async () => {
    addProgressSymbol(LOADING_REASON_UI_MAP.loremaster.icon);
    const { response } = await dispatchAIRequest({
      modelNames: [AUXILIARY_MODEL_NAME, GEMINI_MODEL_NAME],
      prompt: integratePrompt,
      systemInstruction: INTEGRATE_ADD_ONLY_SYSTEM_INSTRUCTION,
      responseMimeType: 'application/json',
      temperature: 0.7,
      label: 'LoremasterIntegrate',
    });
    return { result: { parsed: parseIntegrationResponse(response.text ?? ''), raw: response.text ?? '' } };
  });
  return {
    refinementResult: integration?.parsed ?? null,
    debugInfo: {
      prompt: integratePrompt,
      rawResponse: integration?.raw,
      parsedPayload: integration?.parsed ?? undefined,
      observations: integration?.parsed?.observations,
      rationale: integration?.parsed?.rationale,
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

  const result = await retryAiCall<{ parsed: Array<string> | null; raw: string } | null>(async () => {
    addProgressSymbol(LOADING_REASON_UI_MAP.loremaster.icon);
    const { response } = await dispatchAIRequest({
      modelNames: [AUXILIARY_MODEL_NAME, GEMINI_MODEL_NAME],
      prompt,
      systemInstruction: COLLECT_SYSTEM_INSTRUCTION,
      responseMimeType: 'application/json',
      temperature: 0.7,
      label: 'LoremasterCollect',
    });
    return { result: { parsed: parseCollectFactsResponse(response.text ?? ''), raw: response.text ?? '' } };
  });
  return {
    facts: result?.parsed ?? [],
    debugInfo: {
      prompt,
      rawResponse: result?.raw,
      parsedPayload: result?.parsed ?? undefined,
    },
  };
};

export interface DistillFactsParams {
  themeName: string;
  facts: Array<ThemeFact>;
}

export interface DistillFactsServiceResult {
  refinementResult: LoreRefinementResult | null;
  debugInfo: {
    prompt: string;
    rawResponse?: string;
    parsedPayload?: LoreRefinementResult;
    observations?: string;
    rationale?: string;
  } | null;
}

export const distillFacts_Service = async (
  params: DistillFactsParams,
): Promise<DistillFactsServiceResult | null> => {
  if (!isApiConfigured()) {
    console.error('distillFacts_Service: API not configured');
    return null;
  }
  const { themeName, facts } = params;

  const prompt = buildDistillFactsPrompt(themeName, facts);

  const result = await retryAiCall<{ parsed: LoreRefinementResult | null; raw: string } | null>(async () => {
    addProgressSymbol(LOADING_REASON_UI_MAP.loremaster.icon);
    const { response } = await dispatchAIRequest({
      modelNames: [AUXILIARY_MODEL_NAME, GEMINI_MODEL_NAME],
      prompt,
      systemInstruction: DISTILL_SYSTEM_INSTRUCTION,
      responseMimeType: 'application/json',
      temperature: 0.7,
      label: 'LoremasterDistill',
    });
    return { result: { parsed: parseIntegrationResponse(response.text ?? ''), raw: response.text ?? '' } };
  });

  return {
    refinementResult: result?.parsed ?? null,
    debugInfo: {
      prompt,
      rawResponse: result?.raw,
      parsedPayload: result?.parsed ?? undefined,
      observations: result?.parsed?.observations,
      rationale: result?.parsed?.rationale,
    },
  };
};
