/**
 * @file mapRenameService.ts
 * @description Service for assigning thematic names and descriptions to
 *              newly created map nodes and edges.
 */

import { AdventureTheme, MapNode, MapEdge, MapData, RenameMapElementsPayload } from '../types';
import { updateNodeId } from '../utils/mapIdUtils';
import {
  MAX_RETRIES,
  NODE_DESCRIPTION_INSTRUCTION,
  ALIAS_INSTRUCTION,
  EDGE_DESCRIPTION_INSTRUCTION,
} from '../constants';
import { dispatchAIRequest } from './modelDispatcher';
import { CORRECTION_TEMPERATURE } from './corrections/base';
import { isApiConfigured } from './apiClient';

export interface RenameMapElementsServiceResult {
  payload: RenameMapElementsPayload | null;
  debugInfo: {
    prompt: string;
    rawResponse?: string;
    parsedPayload?: RenameMapElementsPayload;
    validationError?: string;
  } | null;
}


/**
 * Calls the auxiliary AI to generate better names/descriptions for new nodes
 * and edges.
 */
export const renameMapElements_Service = async (
  mapData: MapData,
  newNodes: MapNode[],
  newEdges: MapEdge[],
  currentTheme: AdventureTheme,
  context: { sceneDescription: string; gameLogTail: string[] }
): Promise<RenameMapElementsServiceResult> => {
  if (!isApiConfigured() || (newNodes.length === 0 && newEdges.length === 0)) {
    return { payload: null, debugInfo: null };
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

const prompt = `You are an AI assistant tasked with assigning thematic names and descriptions
for newly created map elements in a text adventure game.
Current Theme: "${currentTheme.name}" (${currentTheme.systemInstructionModifier})
Scene Description: "${context.sceneDescription}"
Recent Events:\n -"${context.gameLogTail.slice(-5).join('\n -')}"
New Nodes:\n${nodesList || 'None'}\nNew Edges:\n${edgesList || 'None'}\n
Respond ONLY with a JSON object of the following form:
{ "nodes": [ { "id": "string", "placeName": "string", "description": "string", // ${NODE_DESCRIPTION_INSTRUCTION}
    "aliases": ["string"] // ${ALIAS_INSTRUCTION}
  } ],
  "edges": [ { "id": "string", "description": "string" // ${EDGE_DESCRIPTION_INSTRUCTION} } ] }
Arrays can be empty if either Nodes or Edges are None. All fields are REQUIRED. Keep IDs exactly as provided.`;

  const systemInst = 'Rename provided map nodes and edges with thematic names. Completely rewrite the placeName, description, and aliases according to the provided context. Return strict JSON.';

  const debugInfo: RenameMapElementsServiceResult['debugInfo'] = { prompt };

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      debugInfo.prompt = prompt;
      const response = await dispatchAIRequest(
        ['auxiliary', 'gemini-pro'],
        prompt,
        systemInst,
        { responseMimeType: 'application/json', temperature: CORRECTION_TEMPERATURE }
      );
      debugInfo.rawResponse = response.text ?? '';
      let jsonStr = (response.text ?? '').trim();
      const fenceRegex = /^```(?:json)?\s*\n?(.*?)\n?\s*```$/s;
      const fenceMatch = jsonStr.match(fenceRegex);
      if (fenceMatch && fenceMatch[1]) {
        jsonStr = fenceMatch[1].trim();
      }
      const result = JSON.parse(jsonStr) as RenameMapElementsPayload;
      debugInfo.parsedPayload = result;
      if (result && Array.isArray(result.nodes) && Array.isArray(result.edges)) {
        return { payload: result, debugInfo };
      }
      debugInfo.validationError = 'Parsed JSON missing nodes or edges array';
    } catch (error) {
      debugInfo.validationError = `Error: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  return { payload: null, debugInfo };
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
