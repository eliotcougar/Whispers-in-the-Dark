/**
 * @file mapRenameService.ts
 * @description Service for assigning thematic names and descriptions to
 *              newly created map nodes and edges.
 */

import {
  AdventureTheme,
  MapNode,
  MapEdge,
  MapData,
  RenameMapElementsPayload,
  MapRenameDebugInfo,
} from '../types';
import { updateNodeId } from '../utils/mapIdUtils';
import {
  MAX_RETRIES,
  NODE_DESCRIPTION_INSTRUCTION,
  ALIAS_INSTRUCTION,
  EDGE_DESCRIPTION_INSTRUCTION,
  AUXILIARY_MODEL_NAME,
  GEMINI_MODEL_NAME,
} from '../constants';
import { dispatchAIRequest } from './modelDispatcher';
import { CORRECTION_TEMPERATURE } from './corrections/base';
import { isApiConfigured } from './apiClient';


/**
 * Calls the auxiliary AI to generate better names/descriptions for new nodes
 * and edges.
 */
export interface RenameMapElementsServiceResult {
  payload: RenameMapElementsPayload | null;
  debugInfo: MapRenameDebugInfo;
}

export const renameMapElements_Service = async (
  mapData: MapData,
  newNodes: MapNode[],
  newEdges: MapEdge[],
  currentTheme: AdventureTheme,
  context: { sceneDescription: string; gameLogTail: string[] }
): Promise<RenameMapElementsServiceResult> => {
  const baseDebug: MapRenameDebugInfo = { prompt: '' };
  if (!isApiConfigured() || (newNodes.length === 0 && newEdges.length === 0)) {
    return { payload: null, debugInfo: baseDebug };
  }

  const nodesList = newNodes
    .map(n => {
      const parent = n.data.parentNodeId
        ? mapData.nodes.find(p => p.id === n.data.parentNodeId)
        : undefined;
      const parentInfo = parent
        ? `Parent: "${parent.placeName}" (Desc: "${parent.data.description}")`
        : 'No parent';
      return `- ID: ${n.id}, Temp Name: "${n.placeName}", Type: ${n.data.nodeType}, ${parentInfo}`;
    })
    .join('\n');
  const edgesList = newEdges
    .map(e => `- ID: ${e.id}, connects ${e.sourceNodeId} -> ${e.targetNodeId}, Type: ${e.data.type}`)
    .join('\n');

const basePrompt = `You are an AI assistant tasked with assigning thematic names and descriptions
for newly created map elements in a text adventure game.
Current Theme: "${currentTheme.name}" (${currentTheme.systemInstructionModifier})

  const debugInfo: MapRenameDebugInfo = { prompt: basePrompt };
  let promptToSend = basePrompt;
  let validPayload: RenameMapElementsPayload | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    if (attempt > 0 && debugInfo.validationError) {
      promptToSend = `${basePrompt}\nCRITICALLY IMPORTANT: ${debugInfo.validationError}`;
    } else {
      promptToSend = basePrompt;
    }
    debugInfo.prompt = promptToSend;
    try {
      const response = await dispatchAIRequest(
        [AUXILIARY_MODEL_NAME, GEMINI_MODEL_NAME],
        promptToSend,
        systemInst,
        { responseMimeType: 'application/json', temperature: CORRECTION_TEMPERATURE }
      );
      debugInfo.rawResponse = response.text ?? '';
      let jsonStr = (response.text ?? '').trim();
      const fenceMatch = jsonStr.match(/^```(?:json)?\s*\n?(.*?)\n?\s*```$/s);
      if (fenceMatch && fenceMatch[1]) jsonStr = fenceMatch[1].trim();
      const parsed = JSON.parse(jsonStr) as Partial<RenameMapElementsPayload>;
      if (
        parsed &&
        Array.isArray(parsed.nodes) &&
        Array.isArray(parsed.edges) &&
        parsed.nodes.every(n => typeof n.id === 'string' && typeof n.placeName === 'string' && typeof n.description === 'string' && (n.aliases === undefined || (Array.isArray(n.aliases) && n.aliases.every(a => typeof a === 'string')))) &&
        parsed.edges.every(e => typeof e.id === 'string' && typeof e.description === 'string')
      ) {
        validPayload = parsed as RenameMapElementsPayload;
        debugInfo.parsedPayload = validPayload;
        debugInfo.validationError = undefined;
        break;
      } else {
        debugInfo.parsedPayload = parsed as RenameMapElementsPayload;
        debugInfo.validationError = 'Parsed payload failed validation.';
      }
    } catch (err) {
      debugInfo.rawResponse = `Error: ${err instanceof Error ? err.message : String(err)}`;
      debugInfo.validationError = 'Error during rename AI call or parsing.';

  return { payload: validPayload, debugInfo };

  const systemInst = 'Rename provided map nodes and edges with thematic names. Completely rewrite the placeName, description, and aliases according to the provided context. Return strict JSON.';

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const result = await callCorrectionAI<RenameMapElementsPayload>(prompt, systemInst);
    if (
      result &&
      Array.isArray(result.nodes) &&
      Array.isArray(result.edges)
    ) {
      return result;
    }
  }
  return null;
};

/**
 * Applies rename payload modifications directly to the map data.
 */
export const applyRenamePayload = (
  mapData: { nodes: MapNode[]; edges: MapEdge[] },
  payload: RenameMapElementsPayload
): void => {
  payload.nodes.forEach(nu => {
    const node = mapData.nodes.find(n => n.id === nu.id);
    if (node) {
      node.placeName = nu.placeName;
      node.data.description = nu.description;
      node.data.aliases = nu.aliases || [];
      updateNodeId(mapData, node.id, node.placeName);
    }
  });
  payload.edges.forEach(eu => {
    const edge = mapData.edges.find(e => e.id === eu.id);
    if (edge) {
      edge.data.description = eu.description;
    }
  });
};
