/**
 * @file api.ts
 * @description Wrapper utilities for communicating with the cartographer AI.
 */
import { GenerateContentResponse } from '@google/genai';
import { GEMINI_MODEL_NAME, AUXILIARY_MODEL_NAME } from '../../constants';
import { dispatchAIRequest } from '../modelDispatcher';
import { addProgressSymbol } from '../../utils/loadingProgress';
import { SYSTEM_INSTRUCTION } from './systemPrompt';
import {
  MapData,
  MapNode,
  MapEdge,
  AIMapUpdatePayload,
  MinimalModelCallRecord,
} from '../../types';

export interface MapUpdateServiceResult {
  updatedMapData: MapData | null;
  /** All nodes created as part of this update (both from MapAI and service-generated). */
  newlyAddedNodes: MapNode[];
  /** All edges created as part of this update (both from MapAI and service-generated). */
  newlyAddedEdges: MapEdge[];
  debugInfo: {
    prompt: string;
    rawResponse?: string;
    parsedPayload?: AIMapUpdatePayload;
    validationError?: string;
    minimalModelCalls?: MinimalModelCallRecord[];
    connectorChainsDebugInfo?: {
      prompt: string;
      rawResponse?: string;
      parsedPayload?: AIMapUpdatePayload;
      validationError?: string;
    } | null;
  } | null;
}

/**
 * Executes a single cartographer AI call and returns the raw response.
 */
export const executeCartographerUpdate = async (
  prompt: string,
  systemInstruction: string = SYSTEM_INSTRUCTION,
): Promise<GenerateContentResponse> => {
  addProgressSymbol('▓▓');
  return dispatchAIRequest(
    [AUXILIARY_MODEL_NAME, GEMINI_MODEL_NAME],
    prompt,
    systemInstruction,
    {
      responseMimeType: 'application/json',
      temperature: 0.75,
    },
  );
};
