/**
 * @file mapHierarchyService.ts
 * @description Service for generating hierarchical map nodes for a new theme.
 */

import { GenerateContentResponse } from '@google/genai';
import { AdventureTheme, MapEdge, MapEdgeData, MapNode, MapNodeData } from '../types';
import { AUXILIARY_MODEL_NAME, MAX_RETRIES, GEMINI_MODEL_NAME } from '../constants';
import { MAP_HIERARCHY_SYSTEM_INSTRUCTION } from '../prompts/mapPrompts';
import { dispatchAIRequest } from './modelDispatcher';
import { isApiConfigured } from './apiClient';

interface RawHierarchyNode {
  placeName: string;
  description: string;
  aliases?: string[];
  nodeType: NonNullable<MapNodeData['nodeType']>;
  status: MapNodeData['status'];
  parentPlaceName?: string | null;
}

export interface MapHierarchyResult {
  nodes: MapNode[];
  edges: MapEdge[];
  debugInfo: { prompt: string; rawResponse: string };
}

/**
 * Calls Gemini to generate a hierarchy of locations from the player's current position.
 */
export const fetchMapHierarchyFromLocation_Service = async (
  localPlace: string,
  sceneDescription: string | null,
  currentTheme: AdventureTheme
): Promise<MapHierarchyResult | null> => {
  if (!isApiConfigured()) {
    console.error('MapHierarchyService: API Key not configured.');
    return null;
  }

  const prompt = `
Theme: "${currentTheme.name}"
Theme Guidance: ${currentTheme.systemInstructionModifier}
Player Location: "${localPlace}"
Scene Description: "${sceneDescription || ''}"
Provide an array of location objects from largest region down to the player's location.`;

  const debugInfo: MapHierarchyResult['debugInfo'] = { prompt, rawResponse: '' };

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response: GenerateContentResponse = await dispatchAIRequest(
        [AUXILIARY_MODEL_NAME, GEMINI_MODEL_NAME],
        prompt,
        MAP_HIERARCHY_SYSTEM_INSTRUCTION,
        {
          responseMimeType: 'application/json',
          temperature: 0.75,
        }
      );

      debugInfo.rawResponse = response.text ?? '';
      const cleaned = debugInfo.rawResponse.trim().replace(/^```json\s*|\s*```$/g, '');
      const parsed = JSON.parse(cleaned);
      if (Array.isArray(parsed)) {
        const newNodes: MapNode[] = [];
        const idMap: Record<string, string> = {};
        parsed.forEach((obj: RawHierarchyNode) => {
          const base = obj.placeName.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
          const id = `${currentTheme.name}_${base}_${Date.now() % 10000}_${Math.random().toString(36).substring(2, 7)}`;
          idMap[obj.placeName] = id;
          const nodeData: MapNodeData = {
            description: obj.description,
            aliases: obj.aliases || [],
            status: obj.status,
            isLeaf: obj.nodeType === 'feature' || obj.nodeType === 'room',
            nodeType: obj.nodeType,
          };
          newNodes.push({ id, themeName: currentTheme.name, placeName: obj.placeName, position: { x: 0, y: 0 }, data: nodeData });
        });
        parsed.forEach((obj: RawHierarchyNode) => {
          if (obj.parentPlaceName) {
            const childId = idMap[obj.placeName];
            const parentId = idMap[obj.parentPlaceName];
            if (childId && parentId) {
              const childNode = newNodes.find(n => n.id === childId);
              if (childNode) childNode.data.parentNodeId = parentId;
            }
          }
        });
        return { nodes: newNodes, edges: [], debugInfo };
      }
    } catch (e) {
      console.error(`MapHierarchyService attempt ${attempt + 1} failed:`, e);
    }
  }

  return null;
};

