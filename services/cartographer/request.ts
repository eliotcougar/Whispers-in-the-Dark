/**
 * @file request.ts
 * @description Helpers for sending map update requests to the cartographer AI.
 */
import { GenerateContentResponse } from '@google/genai';
import {
  GEMINI_LITE_MODEL_NAME,
  GEMINI_MODEL_NAME,
  MAX_RETRIES,
  LOADING_REASON_UI_MAP,
  VALID_NODE_STATUS_VALUES,
  VALID_NODE_TYPE_VALUES,
  VALID_EDGE_TYPE_VALUES,
  VALID_EDGE_STATUS_VALUES,
  VALID_NODE_STATUS_STRING,
  VALID_NODE_TYPE_STRING,
  VALID_EDGE_TYPE_STRING,
  VALID_EDGE_STATUS_STRING,
  NODE_DESCRIPTION_INSTRUCTION,
  EDGE_DESCRIPTION_INSTRUCTION,
  ALIAS_INSTRUCTION,
} from '../../constants';
import { dispatchAIRequest } from '../modelDispatcher';
import { isApiConfigured } from '../apiClient';
import { addProgressSymbol } from '../../utils/loadingProgress';
import { retryAiCall } from '../../utils/retry';
import {
  parseAIMapUpdateResponse,
} from './responseParser';
import {
  normalizeRemovalUpdates,
  dedupeEdgeOps,
  normalizeStatusAndTypeSynonyms,
  fixDeleteIdMixups,
} from './mapUpdateUtils';
import type {
  AIMapUpdatePayload,
  MinimalModelCallRecord,
} from '../../types';
import type { MapUpdateDebugInfo } from './types';

export const MAP_UPDATE_JSON_SCHEMA = {
  type: 'object',
  properties: {
    observations: {
      type: 'string',
      minLength: 2000,
      description:
        "Contextually relevant observations about the current map state and relationships.",
    },
    rationale: {
      type: 'string',
      minLength: 1000,
      description:
        'Explanation of the reasons for the changes. Feature nodes can not be parents of other feature nodes.',
    },
    nodesToAdd: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          placeName: {
            type: 'string',
            description:
              'Name of the node. Should not contain a comma. For sub-locations this can be a descriptive feature name.',
          },
          data: {
            type: 'object',
            properties: {
              description: {
                type: 'string',
                minLength: 30,
                description: NODE_DESCRIPTION_INSTRUCTION,
              },
              aliases: {
                type: 'array',
                minItems: 1,
                items: { type: 'string' },
                description: ALIAS_INSTRUCTION,
              },
              status: { enum: VALID_NODE_STATUS_VALUES, description: `One of ${VALID_NODE_STATUS_STRING}` },
              nodeType: { enum: VALID_NODE_TYPE_VALUES, description: `One of ${VALID_NODE_TYPE_STRING}` },
              parentNodeId: {
                type: 'string',
                description: 'Parent Node ID, or "Universe" for top-level nodes. Use placeName when referencing other nodes in this response.',
              },
            },
            required: ['description', 'aliases', 'status', 'nodeType', 'parentNodeId'],
            additionalProperties: false,
          },
        },
        required: ['placeName', 'data'],
        additionalProperties: false,
      },
    },
    nodesToUpdate: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          placeName: { type: 'string', description: 'Existing node ID or name to identify it.' },
          newData: {
            type: 'object',
            properties: {
              placeName: {
                type: 'string',
                description: 'If provided, this will be the new name for the node.',
              },
              description: { type: 'string', description: NODE_DESCRIPTION_INSTRUCTION },
              aliases: { type: 'array', items: { type: 'string' }, minItems: 1, description: ALIAS_INSTRUCTION },
              status: { enum: VALID_NODE_STATUS_VALUES, description: `One of ${VALID_NODE_STATUS_STRING}` },
              nodeType: { enum: VALID_NODE_TYPE_VALUES, description: `One of ${VALID_NODE_TYPE_STRING}` },
              parentNodeId: {
                type: 'string',
                description:
                  'Parent Node ID, or "Universe" for top-level nodes. Parent can not be a feature node. Use placeName when referencing other nodes in this response.',
              },
            },
            additionalProperties: false,
          },
        },
        required: ['placeName', 'newData'],
        additionalProperties: false,
      },
    },
    nodesToRemove: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          nodeId: { type: 'string' },
          nodeName: { type: 'string' },
        },
        required: ['nodeId'],
        additionalProperties: false,
      },
    },
    edgesToAdd: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          sourcePlaceName: { type: 'string', description: 'Source node ID or placeName. Use placeName when referencing other nodes in this response.' },
          targetPlaceName: { type: 'string', description: 'Target node ID or placeName. Use placeName when referencing other nodes in this response.' },
          data: {
            type: 'object',
            properties: {
              description: { type: 'string', description: EDGE_DESCRIPTION_INSTRUCTION },
              type: { enum: VALID_EDGE_TYPE_VALUES, description: `One of ${VALID_EDGE_TYPE_STRING}` },
              status: { enum: VALID_EDGE_STATUS_VALUES, description: `One of ${VALID_EDGE_STATUS_STRING}` },
              travelTime: { type: 'string' },
            },
            required: ['type', 'status'],
            additionalProperties: false,
          },
        },
        required: ['sourcePlaceName', 'targetPlaceName', 'data'],
        additionalProperties: false,
      },
    },
    edgesToUpdate: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          sourcePlaceName: { type: 'string', description: 'Source node ID or placeName. Use placeName when referencing other nodes in this response.' },
          targetPlaceName: { type: 'string', description: 'Target node ID or placeName. Use placeName when referencing other nodes in this response.' },
          newData: {
            type: 'object',
            properties: {
              description: { type: 'string', description: EDGE_DESCRIPTION_INSTRUCTION },
              type: { enum: VALID_EDGE_TYPE_VALUES, description: `One of ${VALID_EDGE_TYPE_STRING}` },
              status: { enum: VALID_EDGE_STATUS_VALUES, description: `One of ${VALID_EDGE_STATUS_STRING}` },
              travelTime: { type: 'string', description: 'Approximate travel time for the route.' },
            },
            additionalProperties: false,
          },
        },
        required: ['sourcePlaceName', 'targetPlaceName', 'newData'],
        additionalProperties: false,
      },
    },
    edgesToRemove: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          edgeId: { type: 'string' },
          sourceId: { type: 'string' },
          targetId: { type: 'string' },
        },
        required: ['edgeId'],
        additionalProperties: false,
      },
    },
    suggestedCurrentMapNodeId: {
      type: 'string',
      description:
        'If map updates and the context both imply a new player location, provide its node ID or placeName.',
    },
  },
  required: ['observations', 'rationale'],
  additionalProperties: false,
} as const;

/**
 * Executes the cartographer AI request with model fallback.
 */
export const executeMapUpdateRequest = async (
  prompt: string,
  systemInstruction: string,
): Promise<{
  response: GenerateContentResponse;
  thoughts: Array<string>;
  systemInstructionUsed: string;
  jsonSchemaUsed?: unknown;
  promptUsed: string;
}> => {
  if (!isApiConfigured()) {
    console.error('API Key not configured for Map Update Service.');
    throw new Error('API Key not configured.');
  }
  const result = await retryAiCall<{
    response: GenerateContentResponse;
    thoughts: Array<string>;
    systemInstructionUsed: string;
    jsonSchemaUsed?: unknown;
    promptUsed: string;
  }>(async () => {
    addProgressSymbol(LOADING_REASON_UI_MAP.map.icon);
    const { response, systemInstructionUsed, jsonSchemaUsed, promptUsed } = await dispatchAIRequest({
      modelNames: [GEMINI_LITE_MODEL_NAME, GEMINI_MODEL_NAME],
      prompt,
      systemInstruction,
      thinkingBudget: 4096,
      includeThoughts: true,
      responseMimeType: 'application/json',
      jsonSchema: MAP_UPDATE_JSON_SCHEMA,
      temperature: 0.75,
      label: 'Cartographer',
    });
    const parts = (response.candidates?.[0]?.content?.parts ?? []) as Array<{ text?: string; thought?: boolean }>;
    const thoughtParts = parts
      .filter((p): p is { text: string; thought?: boolean } => p.thought === true && typeof p.text === 'string')
      .map(p => p.text);
    return { result: { response, thoughts: thoughtParts, systemInstructionUsed, jsonSchemaUsed, promptUsed } };
  });
  if (!result) {
    throw new Error('Failed to execute map update request.');
  }
  return result;
};

export interface MapUpdateRequestResult {
  payload: AIMapUpdatePayload | null;
  debugInfo: MapUpdateDebugInfo;
}

/**
 * Requests a map update payload and validates the response.
 */
export const fetchMapUpdatePayload = async (
  basePrompt: string,
  systemInstruction: string,
  minimalModelCalls: Array<MinimalModelCallRecord>,
): Promise<MapUpdateRequestResult> => {
  let prompt = basePrompt;
  const debugInfo: MapUpdateDebugInfo = {
    prompt: basePrompt,
    systemInstruction,
    jsonSchema: undefined,
    observations: undefined,
    rationale: undefined,
    minimalModelCalls,
    connectorChainsDebugInfo: [],
  };
  let validParsedPayload: AIMapUpdatePayload | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; ) {
    try {
      console.log(`Map Update Service: Attempt ${String(attempt + 1)}/${String(MAX_RETRIES)}`);
      if (attempt > 0 && debugInfo.validationError) {
        prompt = `${basePrompt}\nCRITICALLY IMPORTANT: Your previous attempt has triggered an error: ${debugInfo.validationError}`;
      } else {
        prompt = basePrompt;
      }
      debugInfo.prompt = prompt;
      const {
        response,
        thoughts,
        systemInstructionUsed,
        jsonSchemaUsed,
        promptUsed,
      } = await executeMapUpdateRequest(prompt, systemInstruction);
      debugInfo.rawResponse = response.text ?? '';
      if (thoughts.length > 0) debugInfo.thoughts = thoughts;
      debugInfo.systemInstruction = systemInstructionUsed;
      debugInfo.jsonSchema = jsonSchemaUsed;
      debugInfo.prompt = promptUsed;
      const { payload: parsedPayload, validationError: parseError } = parseAIMapUpdateResponse(response.text ?? '');
      if (parsedPayload) {
        debugInfo.observations = parsedPayload.observations ?? debugInfo.observations;
        debugInfo.rationale = parsedPayload.rationale ?? debugInfo.rationale;
        normalizeRemovalUpdates(parsedPayload);
        fixDeleteIdMixups(parsedPayload);
        const synonymErrors = normalizeStatusAndTypeSynonyms(parsedPayload);
        dedupeEdgeOps(parsedPayload);
        if (!synonymErrors.length) {
          validParsedPayload = parsedPayload;
          debugInfo.parsedPayload = parsedPayload;
          debugInfo.validationError = undefined;
          break;
        }
        debugInfo.parsedPayload = parsedPayload;
        debugInfo.validationError =
          synonymErrors.length > 0
            ? `Invalid values: ${synonymErrors.join('; ')}`
            : 'Parsed payload failed structural/value validation.';
      } else {
        debugInfo.validationError = parseError ?? 'Failed to parse AI response into valid JSON map update payload.';
      }
      if (attempt === MAX_RETRIES - 1) {
        console.error('Map Update Service: Failed to get valid map update payload after all retries.');
      }
      attempt++;
    } catch (error: unknown) {
      console.error(`Error in map update request (Attempt ${String(attempt + 1)}/${String(MAX_RETRIES)}):`, error);
      debugInfo.rawResponse = `Error: ${error instanceof Error ? error.message : String(error)}`;
      debugInfo.validationError = `Processing error: ${error instanceof Error ? error.message : String(error)}`;
      if (attempt === MAX_RETRIES - 1) {
        break;
      }
      attempt++;
    }
  }

  return { payload: validParsedPayload, debugInfo };
};
