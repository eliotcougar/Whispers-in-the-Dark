/**
 * @file mapRenameService.ts
 * @description Service for assigning thematic names and descriptions to
 *              newly created map nodes and edges.
 */

import { AdventureTheme, MapNode, MapEdge } from '../types';
import { updateNodeId } from '../utils/mapIdUtils';
import { MAX_RETRIES } from '../constants';
import { callCorrectionAI } from './corrections/base';
import { isApiConfigured } from './apiClient';

export interface RenameMapElementsPayload {
  nodes: { id: string; placeName: string; description: string; aliases?: string[] }[];
  edges: { id: string; description: string }[];
}

/**
 * Calls the auxiliary AI to generate better names/descriptions for new nodes
 * and edges.
 */
export const renameMapElements_Service = async (
  newNodes: MapNode[],
  newEdges: MapEdge[],
  currentTheme: AdventureTheme,
  context: { sceneDescription: string; gameLogTail: string[] }
): Promise<RenameMapElementsPayload | null> => {
  if (!isApiConfigured() || (newNodes.length === 0 && newEdges.length === 0)) {
    return null;
  }

  const nodesList = newNodes
    .map(n => `- ID: ${n.id}, Temp Name: "${n.placeName}", Type: ${n.data.nodeType}`)
    .join('\n');
  const edgesList = newEdges
    .map(e => `- ID: ${e.id}, connects ${e.sourceNodeId} -> ${e.targetNodeId}, Type: ${e.data.type}`)
    .join('\n');

  const prompt = `You are an AI assistant tasked with assigning thematic names and descriptions
for newly created map elements in a text adventure game.
Current Theme: "${currentTheme.name}" (${currentTheme.systemInstructionModifier})
Scene Snippet: "${context.sceneDescription.substring(0, 150)}"
Recent Log: "${context.gameLogTail.slice(-3).join(' | ')}"
New Nodes:\n${nodesList || 'None'}\nNew Edges:\n${edgesList || 'None'}\n
Respond ONLY with a JSON object of the following form:
{ "nodes": [ { "id": "string", "placeName": "string", "description": "string", "aliases": ["string"] } ],
  "edges": [ { "id": "string", "description": "string" } ] }
Each array can be empty. Keep IDs exactly as provided.`;

  const systemInst = 'Rename provided map nodes and edges with thematic names. Return strict JSON.';

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
