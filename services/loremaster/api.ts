/**
 * @file api.ts
 * @description High level functions for Loremaster AI.
 */
import { GEMINI_LITE_MODEL_NAME, GEMINI_MODEL_NAME, GEMINI_PRO_MODEL_NAME, MINIMAL_MODEL_NAME, LOADING_REASON_UI_MAP } from '../../constants';
import { dispatchAIRequest } from '../modelDispatcher';
import { retryAiCall } from '../../utils/retry';
import { isApiConfigured } from '../geminiClient';
import { addProgressSymbol } from '../../utils/loadingProgress';
import { getThinkingBudget, getMaxOutputTokens } from '../thinkingConfig';
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
import {
  ThemeFact,
  FactWithEntities,
  LoreRefinementResult,
  LoremasterRefineDebugInfo,
  LoadingReason,
  WorldFacts,
  HeroSheet,
  HeroBackstory,
} from '../../types';
import {
  EXTRACT_SYSTEM_INSTRUCTION,
  INTEGRATE_SYSTEM_INSTRUCTION,
  COLLECT_SYSTEM_INSTRUCTION,
  DISTILL_SYSTEM_INSTRUCTION,
} from './systemPrompt';

export const EXTRACT_FACTS_JSON_SCHEMA = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      text: { type: 'string' },
      entities: { type: 'array', minItems: 1, items: { type: 'string' } },
    },
    propertyOrdering: ['entities', 'text'],
    required: ['entities', 'text'],
    additionalProperties: false,
    description:
      'A fact extracted from the context that satisfies the requirement for the *good* quality fact and does not show signs of a *bad* quality fact. Entities array must include at least one relevant node-*, npc-*, or item-* ID from the supplied list of IDs, or the IDs "player" or "universe".',
  },
} as const;

export const COLLECT_FACTS_JSON_SCHEMA = {
  type: 'array',
  minItems: 10,
  maxItems: 10,
  description: 'From the provided facts list select 10 most important facts for the upcoming story turn.',
  items: { type: 'string' },
} as const;


export const INTEGRATE_FACTS_JSON_SCHEMA = {
  type: 'object',
  properties: {
    observations: {
      type: 'string',
      minLength: 500,
      description:
        'Minimum 300 words. Observations about the lore state and the proposed new facts, e.g. There are 3 facts that can be merged. Some of the facts may be too vague or obsolete to be included...'
    },
    rationale: {
      type: 'string',
      minLength: 500,
      description:
        'Minimum 300 words. Rationale for and against including the proposed facts into the lore, e.g. Most facts are good enough to be included in the lore. However, the facts about the old tavern are no longer relevant. The fact about *a path* leading to the church is too vague - a more concrete named path should have been mentioned instead. I will omit these facts.'
    },
    factsChange: {
      type: 'array',
      items: {
        oneOf: [
          {
            type: 'object',
            properties: {
              action: { enum: ['add'] },
              entities: { type: 'array', items: { type: 'string' } },
              text: {
                type: 'string',
                description: 'Must be one of the accepted *New Candidate Facts*.',
              },
            },
            propertyOrdering: ['action', 'entities', 'text'],
            required: ['action', 'entities', 'text'],
            additionalProperties: false,
          },
          {
            type: 'object',
            description: 'Change or delete the lore facts that are no longer relevant according to Recent Events',
            properties: {
              action: { enum: ['delete', 'change'] },
              entities: { type: 'array', items: { type: 'string' } },
              id: { type: 'integer', description: 'ID of the fact to change or remove.' },
              text: { type: 'string', description: 'Updated fact text for the change action.' },
            },
            propertyOrdering: ['action', 'entities', 'id', 'text'],
            required: ['action', 'id'],
            additionalProperties: false,
          },
        ],
      },
    },
  },
  required: ['observations', 'rationale', 'factsChange'],
  propertyOrdering: ['observations', 'rationale', 'factsChange'],
  additionalProperties: false,
} as const;

export const DISTILL_FACTS_JSON_SCHEMA = {
  type: 'object',
  properties: {
    observations: {
      type: 'string',
      minLength: 500,
      description: 'Minimum 300 words. Observations about the lore state, close duplicates, too vague facts, and facts made obsolete by recent events.',
    },
    rationale: {
      type: 'string',
      minLength: 500,
      description: 'Minimum 300 words. Rationale for the proposed mergers, splits, and deletions.',
    },
    factsChange: {
      type: 'array',
      items: {
        type: 'object',
        description: 'REQUIRED for the *add* and *change* actions. Omitted for the *delete* action.',
        properties: {
          action: { enum: ['add', 'change', 'delete'] },
          entities: { type: 'array', items: { type: 'string' } },
          id: { type: 'integer', description: "Required for *change* and *delete* actions." },
          text: {
            type: 'string',
            maxLength: 2000,
            description: 'REQUIRED for the *add* and *change* actions. MUST be under 200 words.',
          },
          tier: {
            type: 'integer',
            description:
              'Omit tier for *add* action. Increase tier by one for *change* action, when any number of other facts are merged into this one.',
            default: 1,
          },
        },
        propertyOrdering: ['action', 'entities', 'id', 'text', 'tier'],
        required: ['action'],
        additionalProperties: false,
      }
    }
  },
  required: ['observations', 'rationale', 'factsChange'],
  propertyOrdering: ['observations', 'rationale', 'factsChange'],
  additionalProperties: false,
} as const;

export interface RefineLoreParams {
  themeName: string;
  turnContext: string;
  existingFacts: Array<ThemeFact>;
  logMessage: string;
  currentScene: string;
  worldFacts?: WorldFacts;
  heroSheet?: HeroSheet;
  heroBackstory?: HeroBackstory;
  onFactsExtracted?: (facts: Array<FactWithEntities>) => Promise<{ proceed: boolean }>;
  onSetLoadingReason?: (reason: LoadingReason) => void;
}

export interface RefineLoreServiceResult {
  refinementResult: LoreRefinementResult | null;
  debugInfo: LoremasterRefineDebugInfo | null;
}

export interface ExtractInitialFactsParams {
  themeName: string;
  worldFacts: WorldFacts;
  heroSheet?: HeroSheet;
  heroBackstory?: HeroBackstory;
  onSetLoadingReason?: (reason: LoadingReason) => void;
}

export interface ExtractInitialFactsServiceResult {
  facts: Array<FactWithEntities>;
  debugInfo: LoremasterRefineDebugInfo;
}

export const extractInitialFacts_Service = async (
  params: ExtractInitialFactsParams,
): Promise<ExtractInitialFactsServiceResult | null> => {
  if (!isApiConfigured()) {
    console.error('extractInitialFacts_Service: API not configured');
    return null;
  }
  const { themeName, worldFacts, heroSheet, heroBackstory } = params;

  const extractPrompt = buildExtractFactsPrompt(
    themeName,
    '',
    worldFacts,
    heroSheet,
    heroBackstory,
  );

  const newFacts = await retryAiCall<{
    parsed: Array<FactWithEntities> | null;
    raw: string;
    thoughts: Array<string>;
    systemInstructionUsed: string;
    jsonSchemaUsed?: unknown;
    promptUsed: string;
  } | null>(async () => {
    params.onSetLoadingReason?.('loremaster_extract');
    addProgressSymbol(LOADING_REASON_UI_MAP.loremaster_extract.icon);
      const thinkingBudget = getThinkingBudget(512);
      const maxOutputTokens = getMaxOutputTokens(512);
      const {
        response,
        systemInstructionUsed,
        jsonSchemaUsed,
        promptUsed,
      } = await dispatchAIRequest({
        modelNames: [GEMINI_LITE_MODEL_NAME, GEMINI_MODEL_NAME],
        prompt: extractPrompt,
        systemInstruction: EXTRACT_SYSTEM_INSTRUCTION,
        thinkingBudget,
        includeThoughts: true,
        responseMimeType: 'application/json',
        jsonSchema: EXTRACT_FACTS_JSON_SCHEMA,
        temperature: 0.7,
        label: 'LoremasterExtractInitial',
        maxOutputTokens,
      });
    const parts = (response.candidates?.[0]?.content?.parts ?? []) as Array<{
      text?: string;
      thought?: boolean;
    }>;
    const thoughtParts = parts
      .filter((p): p is { text: string; thought?: boolean } => p.thought === true && typeof p.text === 'string')
      .map(p => p.text);
    return {
      result: {
        parsed: parseExtractFactsResponse(response.text ?? ''),
        raw: response.text ?? '',
        thoughts: thoughtParts,
        systemInstructionUsed,
        jsonSchemaUsed,
        promptUsed,
      },
    };
  });
  if (!newFacts) return null;

  return {
    facts: newFacts.parsed ?? [],
    debugInfo: {
      extract: {
        prompt: newFacts.promptUsed,
        systemInstruction: newFacts.systemInstructionUsed,
        jsonSchema: newFacts.jsonSchemaUsed,
        rawResponse: newFacts.raw,
        parsedPayload: newFacts.parsed ?? undefined,
        thoughts: newFacts.thoughts,
      },
      integrate: null,
    },
  };
};

export const refineLore_Service = async (
  params: RefineLoreParams,
): Promise<RefineLoreServiceResult | null> => {
  if (!isApiConfigured()) {
    console.error('refineLore_Service: API not configured');
    return null;
  }
  const {
    themeName,
    turnContext,
    existingFacts,
    logMessage,
    currentScene,
    worldFacts,
    heroSheet,
    heroBackstory,
    onFactsExtracted,
  } = params;

  const extractPrompt = buildExtractFactsPrompt(
    themeName,
    turnContext,
    worldFacts,
    heroSheet,
    heroBackstory,
  );
  const newFacts = await retryAiCall<{
    parsed: Array<FactWithEntities> | null;
    raw: string;
    thoughts: Array<string>;
    systemInstructionUsed: string;
    jsonSchemaUsed?: unknown;
    promptUsed: string;
  } | null>(async () => {
    params.onSetLoadingReason?.('loremaster_extract');
    addProgressSymbol(LOADING_REASON_UI_MAP.loremaster_extract.icon);
    const thinkingBudget = getThinkingBudget(512);
    const {
      response,
      systemInstructionUsed,
      jsonSchemaUsed,
      promptUsed,
    } = await dispatchAIRequest({
      modelNames: [GEMINI_LITE_MODEL_NAME, GEMINI_MODEL_NAME],
      prompt: extractPrompt,
      systemInstruction: EXTRACT_SYSTEM_INSTRUCTION,
      thinkingBudget,
      includeThoughts: true,
      responseMimeType: 'application/json',
      jsonSchema: EXTRACT_FACTS_JSON_SCHEMA,
      temperature: 0.7,
      label: 'LoremasterExtract',
    });
    const parts = (response.candidates?.[0]?.content?.parts ?? []) as Array<{ text?: string; thought?: boolean }>;
    const thoughtParts = parts
      .filter((p): p is { text: string; thought?: boolean } => p.thought === true && typeof p.text === 'string')
      .map(p => p.text);
    return {
      result: {
        parsed: parseExtractFactsResponse(response.text ?? ''),
        raw: response.text ?? '',
        thoughts: thoughtParts,
        systemInstructionUsed,
        jsonSchemaUsed,
        promptUsed,
      },
    };
  });
  if (!newFacts) return null;

  if (onFactsExtracted) {
    const { proceed } = await onFactsExtracted(newFacts.parsed ?? []);
    if (!proceed) {
      return {
        refinementResult: null,
        debugInfo: {
          extract: {
            prompt: newFacts.promptUsed,
            systemInstruction: newFacts.systemInstructionUsed,
            jsonSchema: newFacts.jsonSchemaUsed,
            rawResponse: newFacts.raw,
            parsedPayload: newFacts.parsed ?? undefined,
            thoughts: newFacts.thoughts,
          },
          integrate: null,
        },
      };
    }
  }

  const integratePrompt = buildIntegrateFactsPrompt(
    themeName,
    existingFacts,
    newFacts.parsed ?? [],
    logMessage,
    currentScene,
  );
  const integration = await retryAiCall<{
    parsed: LoreRefinementResult;
    raw: string;
    thoughts: Array<string>;
    systemInstructionUsed: string;
    jsonSchemaUsed?: unknown;
    promptUsed: string;
  } | null>(async () => {
    params.onSetLoadingReason?.('loremaster_integrate');
    addProgressSymbol(LOADING_REASON_UI_MAP.loremaster_integrate.icon);
    const thinkingBudget = getThinkingBudget(1024);
    const {
      response,
      systemInstructionUsed,
      jsonSchemaUsed,
      promptUsed,
    } = await dispatchAIRequest({
      modelNames: [GEMINI_LITE_MODEL_NAME, GEMINI_MODEL_NAME],
      prompt: integratePrompt,
      systemInstruction: INTEGRATE_SYSTEM_INSTRUCTION,
      thinkingBudget,
      includeThoughts: true,
      responseMimeType: 'application/json',
      jsonSchema: INTEGRATE_FACTS_JSON_SCHEMA,
      temperature: 0.7,
      label: 'LoremasterIntegrate',
    });
    const parts = (response.candidates?.[0]?.content?.parts ?? []) as Array<{ text?: string; thought?: boolean }>;
    const thoughtParts = parts
      .filter((p): p is { text: string; thought?: boolean } => p.thought === true && typeof p.text === 'string')
      .map(p => p.text);
    const parsed = parseIntegrationResponse(response.text ?? '', existingFacts);
    return {
      result: parsed
        ? {
            parsed,
            raw: response.text ?? '',
            thoughts: thoughtParts,
            systemInstructionUsed,
            jsonSchemaUsed,
            promptUsed,
          }
        : null,
    };
  });
  return {
    refinementResult: integration?.parsed ?? null,
    debugInfo: {
      extract: {
        prompt: newFacts.promptUsed,
        systemInstruction: newFacts.systemInstructionUsed,
        jsonSchema: newFacts.jsonSchemaUsed,
        rawResponse: newFacts.raw,
        parsedPayload: newFacts.parsed ?? undefined,
        thoughts: newFacts.thoughts,
      },
      integrate: {
        prompt: integration?.promptUsed ?? integratePrompt,
        systemInstruction: integration?.systemInstructionUsed ?? INTEGRATE_SYSTEM_INSTRUCTION,
        jsonSchema: integration?.jsonSchemaUsed ?? INTEGRATE_FACTS_JSON_SCHEMA,
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
    systemInstruction?: string;
    jsonSchema?: unknown;
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

  const result = await retryAiCall<{
    parsed: Array<string> | null;
    raw: string;
    thoughts: Array<string>;
    systemInstructionUsed: string;
    jsonSchemaUsed?: unknown;
    promptUsed: string;
  } | null>(async () => {
    addProgressSymbol(LOADING_REASON_UI_MAP.loremaster_collect.icon);
    const thinkingBudget = getThinkingBudget(1024);
    const {
      response,
      systemInstructionUsed,
      jsonSchemaUsed,
      promptUsed,
    } = await dispatchAIRequest({
      modelNames: [MINIMAL_MODEL_NAME, GEMINI_LITE_MODEL_NAME, GEMINI_MODEL_NAME],
      prompt,
      systemInstruction: COLLECT_SYSTEM_INSTRUCTION,
      thinkingBudget,
      includeThoughts: true,
      responseMimeType: 'application/json',
      jsonSchema: COLLECT_FACTS_JSON_SCHEMA,
      temperature: 0.7,
      label: 'LoremasterCollect',
    });
    const parts = (response.candidates?.[0]?.content?.parts ?? []) as Array<{ text?: string; thought?: boolean }>;
    const thoughtParts = parts
      .filter((p): p is { text: string; thought?: boolean } => p.thought === true && typeof p.text === 'string')
      .map(p => p.text);
    return {
      result: {
        parsed: parseCollectFactsResponse(response.text ?? ''),
        raw: response.text ?? '',
        thoughts: thoughtParts,
        systemInstructionUsed,
        jsonSchemaUsed,
        promptUsed,
      },
    };
  });
  return {
    facts: result?.parsed ?? [],
    debugInfo: {
      prompt: result?.promptUsed ?? prompt,
      systemInstruction: result?.systemInstructionUsed ?? COLLECT_SYSTEM_INSTRUCTION,
      jsonSchema: result?.jsonSchemaUsed ?? COLLECT_FACTS_JSON_SCHEMA,
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
  recentLogEntries: Array<string>;
}

export interface DistillFactsServiceResult {
  refinementResult: LoreRefinementResult | null;
  debugInfo: {
    prompt: string;
    systemInstruction?: string;
    jsonSchema?: unknown;
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
    recentLogEntries,
  } = params;

  const prompt = buildDistillFactsPrompt(
    themeName,
    facts,
    currentQuest,
    currentObjective,
    inventoryItemNames,
    mapNodeNames,
    recentLogEntries,
  );

  const result = await retryAiCall<{
    parsed: LoreRefinementResult;
    raw: string;
    thoughts: Array<string>;
    systemInstructionUsed: string;
    jsonSchemaUsed?: unknown;
    promptUsed: string;
  } | null>(async () => {
    addProgressSymbol(LOADING_REASON_UI_MAP.loremaster_distill.icon);
    const thinkingBudget = getThinkingBudget(4096);
    const {
      response,
      systemInstructionUsed,
      jsonSchemaUsed,
      promptUsed,
    } = await dispatchAIRequest({
      modelNames: [GEMINI_PRO_MODEL_NAME, GEMINI_MODEL_NAME, GEMINI_LITE_MODEL_NAME],
      prompt,
      systemInstruction: DISTILL_SYSTEM_INSTRUCTION,
      thinkingBudget,
      includeThoughts: true,
      responseMimeType: 'application/json',
      jsonSchema: DISTILL_FACTS_JSON_SCHEMA,
      temperature: 0.7,
      label: 'LoremasterDistill',
    });
    const parts = (response.candidates?.[0]?.content?.parts ?? []) as Array<{ text?: string; thought?: boolean }>;
    const thoughtParts = parts
      .filter((p): p is { text: string; thought?: boolean } => p.thought === true && typeof p.text === 'string')
      .map(p => p.text);
    const parsed = parseIntegrationResponse(response.text ?? '', facts);
    return {
      result: parsed
        ? {
            parsed,
            raw: response.text ?? '',
            thoughts: thoughtParts,
            systemInstructionUsed,
            jsonSchemaUsed,
            promptUsed,
          }
        : null,
    };
  });

  return {
    refinementResult: result?.parsed ?? null,
    debugInfo: {
      prompt: result?.promptUsed ?? prompt,
      systemInstruction: result?.systemInstructionUsed ?? DISTILL_SYSTEM_INSTRUCTION,
      jsonSchema: result?.jsonSchemaUsed ?? DISTILL_FACTS_JSON_SCHEMA,
      rawResponse: result?.raw,
      parsedPayload: result?.parsed,
      observations: result?.parsed.observations,
      rationale: result?.parsed.rationale,
      thoughts: result?.thoughts,
    },
  };
};
