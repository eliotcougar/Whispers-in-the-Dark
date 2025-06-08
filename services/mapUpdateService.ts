
/**
 * @file mapUpdateService.ts
 * @description This service handles communication with an auxiliary AI model
 * to update the game's map data based on narrative events.
 */
import { GenerateContentResponse } from "@google/genai";
import {
  GameStateFromAI,
  AdventureTheme,
  MapData,
  MapNode,
  MapEdge,
  DialogueSummaryResponse,
  MapNodeData,
  MapEdgeData,
  AIMapUpdatePayload,
  MinimalModelCallRecord
} from '../types';
import {
  AUXILIARY_MODEL_NAME,
  MAX_RETRIES,
  GEMINI_MODEL_NAME,
  NODE_DESCRIPTION_INSTRUCTION,
  ALIAS_INSTRUCTION,
} from '../constants';
import { MAP_UPDATE_SYSTEM_INSTRUCTION } from '../prompts/mapPrompts';
import { dispatchAIRequest } from './modelDispatcher';
import { isApiConfigured } from './apiClient';
import { isValidAIMapUpdatePayload } from '../utils/mapUpdateValidationUtils';
import {
  VALID_NODE_STATUS_VALUES,
  VALID_NODE_TYPE_VALUES,
  VALID_EDGE_TYPE_VALUES,
  VALID_EDGE_STATUS_VALUES,
} from '../constants';
import { NODE_STATUS_SYNONYMS, NODE_TYPE_SYNONYMS, EDGE_TYPE_SYNONYMS, EDGE_STATUS_SYNONYMS } from '../utils/mapSynonyms';
import { structuredCloneGameState } from '../utils/cloneUtils';
import { isServerOrClientError } from '../utils/aiErrorUtils';
import { fetchLikelyParentNode_Service, EdgeChainRequest, fetchConnectorChains_Service } from './corrections/map';

// Local type definition for Place, matching what useGameLogic might prepare

export interface MapUpdateServiceResult {
  updatedMapData: MapData | null;
  /** All nodes created as part of this update (both from MapAI and service-generated). */
  newlyAddedNodes: MapNode[];
  /** All edges created as part of this update (both from MapAI and service-generated). */
  newlyAddedEdges: MapEdge[];
  /** Nodes that were generated via the minimal model and therefore may need renaming. */
  renameCandidateNodes: MapNode[];
  /** Edges that were generated via the minimal model and therefore may need renaming. */
  renameCandidateEdges: MapEdge[];
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
 * Sends a prompt and system instruction to the auxiliary AI model and returns
 * the raw response.
 */
const callMapUpdateAI = async (prompt: string, systemInstruction: string): Promise<GenerateContentResponse> => {
  return dispatchAIRequest(
    [AUXILIARY_MODEL_NAME, GEMINI_MODEL_NAME],
    prompt,
    systemInstruction,
    {
      responseMimeType: "application/json",
      temperature: 0.75,
    }
  );
};

/**
 * Parses the AI's map update response into an AIMapUpdatePayload structure.
 */
const parseAIMapUpdateResponse = (responseText: string): AIMapUpdatePayload | null => {
  let jsonStr = responseText.trim();
  const fenceRegex = /^```(?:json)?\s*\n?(.*?)\n?\s*```$/s;
  const fenceMatch = jsonStr.match(fenceRegex);
  if (fenceMatch && fenceMatch[1]) {
    jsonStr = fenceMatch[1].trim();
  }
  try {
    const parsed: unknown = JSON.parse(jsonStr);
    // Drop any illegal attempts to add/update/remove the special root node
    // "Universe" and discard edges referring to it before validation.
    if (parsed && typeof parsed === 'object') {
      const payload = parsed as AIMapUpdatePayload;
      const nameIsUniverse = (n: unknown): boolean =>
        typeof n === 'string' && n.trim().toLowerCase() === 'universe';
      if (Array.isArray(payload.nodesToAdd)) {
        payload.nodesToAdd = payload.nodesToAdd.filter(n => !nameIsUniverse(n.placeName));
      }
      if (Array.isArray(payload.nodesToUpdate)) {
        payload.nodesToUpdate = payload.nodesToUpdate.filter(n => !nameIsUniverse(n.placeName));
      }
      if (Array.isArray(payload.nodesToRemove)) {
        payload.nodesToRemove = payload.nodesToRemove.filter(n => !nameIsUniverse(n.placeName));
      }
      const filterEdgeArray = <T extends { sourcePlaceName: string; targetPlaceName: string }>(
        arr: T[] | undefined
      ): T[] =>
        (arr || []).filter(
          e => !nameIsUniverse(e.sourcePlaceName) && !nameIsUniverse(e.targetPlaceName)
        );
      if (Array.isArray(payload.edgesToAdd)) {
        payload.edgesToAdd = filterEdgeArray(payload.edgesToAdd);
      }
      if (Array.isArray(payload.edgesToUpdate)) {
        payload.edgesToUpdate = filterEdgeArray(payload.edgesToUpdate);
      }
      if (Array.isArray(payload.edgesToRemove)) {
        payload.edgesToRemove = filterEdgeArray(payload.edgesToRemove);
      }
    }
    if (isValidAIMapUpdatePayload(parsed as AIMapUpdatePayload | null)) {
      return parsed as AIMapUpdatePayload;
    }
    console.warn("Parsed map update JSON does not match AIMapUpdatePayload structure or is empty:", parsed);
    return null;
  } catch (e) {
    console.error("Failed to parse map update JSON response from AI:", e);
    console.debug("Original map update response text:", responseText);
    return null;
  }
};

/**
 * Converts node/edge update operations that merely set a
 * status suggesting removal (e.g., "removed", "deleted") into
 * proper remove operations. This prevents validation errors when
 * MapAI uses an update action with a removal status.
 */
const normalizeRemovalUpdates = (payload: AIMapUpdatePayload) => {
  const nodeRemovalSynonyms = new Set([
    'removed',
    'deleted',
    'destroyed',
    'eliminated',
    'erased',
    'gone',
    'lost',
    'obliterated',
    'terminated',
    'discarded'
  ]);
  const edgeRemovalSynonyms = new Set([
    'removed',
    'deleted',
    'destroyed',
    'eliminated',
    'erased',
    'gone',
    'lost',
    'severed',
    'cut',
    'broken',
    'disconnected',
    'obliterated',
    'terminated',
    'dismantled'
  ]);

  const updatedNodesToUpdate: typeof payload.nodesToUpdate = [];
  const updatedNodesToRemove: typeof payload.nodesToRemove = payload.nodesToRemove ? [...payload.nodesToRemove] : [];
  (payload.nodesToUpdate || []).forEach(nodeUpd => {
    const statusVal = nodeUpd.newData?.status?.toLowerCase();
    if (statusVal && nodeRemovalSynonyms.has(statusVal)) {
      updatedNodesToRemove.push({ placeName: nodeUpd.placeName });
    } else {
      updatedNodesToUpdate.push(nodeUpd);
    }
  });
  payload.nodesToUpdate = updatedNodesToUpdate.length > 0 ? updatedNodesToUpdate : undefined;
  payload.nodesToRemove = updatedNodesToRemove.length > 0 ? updatedNodesToRemove : undefined;

  const updatedEdgesToUpdate: typeof payload.edgesToUpdate = [];
  const updatedEdgesToRemove: typeof payload.edgesToRemove = payload.edgesToRemove ? [...payload.edgesToRemove] : [];
  (payload.edgesToUpdate || []).forEach(edgeUpd => {
    const statusVal = edgeUpd.newData?.status?.toLowerCase();
    if (statusVal && edgeRemovalSynonyms.has(statusVal)) {
      updatedEdgesToRemove.push({
        sourcePlaceName: edgeUpd.sourcePlaceName,
        targetPlaceName: edgeUpd.targetPlaceName,
        type: edgeUpd.newData.type
      });
    } else {
      updatedEdgesToUpdate.push(edgeUpd);
    }
  });
  payload.edgesToUpdate = updatedEdgesToUpdate.length > 0 ? updatedEdgesToUpdate : undefined;
  payload.edgesToRemove = updatedEdgesToRemove.length > 0 ? updatedEdgesToRemove : undefined;
};

/**
 * Normalizes status and type fields within the payload to
 * their canonical values, accepting various synonyms.
 * Returns an array of error strings for values that remain
 * invalid after synonym normalization.
 */
const normalizeStatusAndTypeSynonyms = (payload: AIMapUpdatePayload): string[] => {
  const errors: string[] = [];

  const nodeStatusSynonyms = NODE_STATUS_SYNONYMS;
  const nodeTypeSynonyms = NODE_TYPE_SYNONYMS;
  const edgeTypeSynonyms = EDGE_TYPE_SYNONYMS;
  const edgeStatusSynonyms = EDGE_STATUS_SYNONYMS;

  const applyNodeDataFix = (data: Partial<MapNodeData> | undefined, context: string) => {
    if (!data) return;
    if (data.status) {
      const mapped = nodeStatusSynonyms[data.status.toLowerCase()];
      if (mapped) data.status = mapped;
      if (!VALID_NODE_STATUS_VALUES.includes(data.status)) {
        errors.push(`${context} invalid status "${data.status}"`);
      }
    }
    if (data.nodeType) {
      const mapped = nodeTypeSynonyms[data.nodeType.toLowerCase()];
      if (mapped) data.nodeType = mapped;
      if (!VALID_NODE_TYPE_VALUES.includes(data.nodeType)) {
        errors.push(`${context} invalid nodeType "${data.nodeType}"`);
      }
    }
  };

  const applyEdgeDataFix = (data: Partial<MapEdgeData> | undefined, context: string) => {
    if (!data) return;
    if (data.type) {
      const mapped = edgeTypeSynonyms[data.type.toLowerCase()];
      if (mapped) data.type = mapped;
      if (!VALID_EDGE_TYPE_VALUES.includes(data.type)) {
        errors.push(`${context} invalid type "${data.type}"`);
      }
    }
    if (data.status) {
      const mapped = edgeStatusSynonyms[data.status.toLowerCase()];
      if (mapped) data.status = mapped;
      if (!VALID_EDGE_STATUS_VALUES.includes(data.status)) {
        errors.push(`${context} invalid status "${data.status}"`);
      }
    }
  };

  (payload.nodesToAdd || []).forEach((n, idx) => applyNodeDataFix(n.data, `nodesToAdd[${idx}]`));
  (payload.nodesToUpdate || []).forEach((n, idx) => applyNodeDataFix(n.newData, `nodesToUpdate[${idx}].newData`));
  (payload.edgesToAdd || []).forEach((e, idx) => applyEdgeDataFix(e.data, `edgesToAdd[${idx}]`));
  (payload.edgesToUpdate || []).forEach((e, idx) => applyEdgeDataFix(e.newData, `edgesToUpdate[${idx}].newData`));
  (payload.edgesToRemove || []).forEach((e, idx) => {
    if (e.type) {
      const mapped = edgeTypeSynonyms[e.type.toLowerCase()];
      if (mapped) e.type = mapped;
        if (!VALID_EDGE_TYPE_VALUES.includes(e.type)) {
        errors.push(`edgesToRemove[${idx}] invalid type "${e.type}"`);
      }
    }
  });

  return errors;
};

/**
 * Updates the game map based on narrative events and AI suggestions.
 * Implements a retry loop for fetching and validating the AI map update payload.
 * @param aiResponse The AI response from the main game turn or dialogue summary.
 * @param currentMapData The current state of the map.
 * @param currentTheme The currently active adventure theme.
 * @param allKnownMainMapNodesForTheme An array of `MapNode` objects representing all main locations known for the current theme.
 * @param previousMapNodeId The ID of the map node the player was at before this turn.
 * @returns A promise resolving to a MapUpdateServiceResult.
 */
export const updateMapFromAIData_Service = async (
  aiResponse: GameStateFromAI | DialogueSummaryResponse,
  currentMapData: MapData,
  currentTheme: AdventureTheme,
  allKnownMainMapNodesForTheme: MapNode[],
  previousMapNodeId: string | null
): Promise<MapUpdateServiceResult | null> => {
  if (!isApiConfigured()) {
    console.error("API Key not configured for Map Update Service.");
    return null;
  }

  const sceneDesc = 'sceneDescription' in aiResponse ? aiResponse.sceneDescription : "";
  const logMsg = aiResponse.logMessage || "";
  const localPlace = aiResponse.localPlace || "Unknown";
  const referenceMapNodeId =
    'currentMapNodeId' in aiResponse && aiResponse.currentMapNodeId
      ? aiResponse.currentMapNodeId
      : previousMapNodeId;

  const currentThemeNodesFromMapData = currentMapData.nodes.filter(n => n.themeName === currentTheme.name);
  const currentThemeNodeIdsSet = new Set(currentThemeNodesFromMapData.map(n => n.id));
  const currentThemeEdgesFromMapData = currentMapData.edges.filter(e =>
    currentThemeNodeIdsSet.has(e.sourceNodeId) && currentThemeNodeIdsSet.has(e.targetNodeId)
  );
  const minimalModelCalls: MinimalModelCallRecord[] = [];
  const themeNodeIdMap = new Map<string, MapNode>();
  const themeNodeNameMap = new Map<string, MapNode>();
  const themeNodeAliasMap = new Map<string, MapNode>();
  const themeEdgesMap = new Map<string, MapEdge[]>();
  currentThemeNodesFromMapData.forEach(n => {
    themeNodeIdMap.set(n.id, n);
    themeNodeNameMap.set(n.placeName, n);
    if (n.data.aliases) {
      n.data.aliases.forEach(a => themeNodeAliasMap.set(a.toLowerCase(), n));
    }
  });
  currentThemeEdgesFromMapData.forEach(e => {
    if (!themeEdgesMap.has(e.sourceNodeId)) themeEdgesMap.set(e.sourceNodeId, []);
    if (!themeEdgesMap.has(e.targetNodeId)) themeEdgesMap.set(e.targetNodeId, []);
    themeEdgesMap.get(e.sourceNodeId)!.push(e);
    themeEdgesMap.get(e.targetNodeId)!.push(e);
  });

  let previousMapNodeContext = "Player's Previous Map Node: Unknown or N/A.";
  if (previousMapNodeId) {
    const prevNode = themeNodeIdMap.get(previousMapNodeId);
    if (prevNode) {
      previousMapNodeContext = `Player's Previous Map Node: Was at "${prevNode.placeName}" (ID: ${prevNode.id}, Type: ${prevNode.data.nodeType === 'feature' ? 'Feature' : 'Main'}, Visited: ${!!prevNode.data.visited}).`;
    }
  }

  const existingMapContext = `
Current Map Nodes (for your reference):
${currentThemeNodesFromMapData.length > 0 ? currentThemeNodesFromMapData.map(n => `- "${n.placeName}" (ID: ${n.id}, Feature: ${n.data.nodeType === 'feature'}, Visited: ${!!n.data.visited}, ParentNodeId: ${n.data.parentNodeId || 'N/A'}, Status: ${n.data.status || 'N/A'})`).join('\n') : "None exist yet."}

Current Map Edges (for your reference):
${currentThemeEdgesFromMapData.length > 0 ? currentThemeEdgesFromMapData.map(e => `- ${e.data.status || 'N/A'} ${e.data.type || 'N/A'} from ${e.sourceNodeId} to ${e.targetNodeId}`).join('\n') : "None exist yet."}
`;

  const allKnownMainPlacesString = allKnownMainMapNodesForTheme.length > 0
    ? allKnownMainMapNodesForTheme.map(p => `"${p.placeName}" (Description: "${p.data.description.substring(0,100)}...")`).join('; ')
    : "No main places are pre-defined for this theme.";


  const basePrompt = `
Narrative Context for Map Update:
- Current Theme: "${currentTheme.name}"
- System Modifier for Theme: ${currentTheme.systemInstructionModifier}
- Player's Current Location Description (localPlace): "${localPlace}"
- ${previousMapNodeContext}
- Scene Description: "${sceneDesc}"
- Log Message (outcome of last action): "${logMsg}"
- All Known Main Locations for this Theme (these are expected to be main map nodes): ${allKnownMainPlacesString}.
- Your task is to analyze this narrative context and suggest additions, updates, or removals to the map data.

${existingMapContext}
---
Based on the Narrative Context and existing map context, provide a JSON response adhering to the MAP_UPDATE_SYSTEM_INSTRUCTION.
Key points:
- For ALL nodes in 'nodesToAdd', you MUST provide 'description' (${NODE_DESCRIPTION_INSTRUCTION}), 'aliases' (${ALIAS_INSTRUCTION}, can be empty), and 'status'.
- For ALL nodes in 'nodesToAdd', you MUST provide 'description' (non-empty string, <300 chars), 'aliases' (array of strings, can be empty), and 'status'.
  - If any new specific places (feature nodes) within or between main locations are described, add them and specify their parent via \`parentNodeId\`.
- Check if you can assign a definitive parent node for any orphan nodes (Parent node N/A).
- All nodes MUST represent physical locations.
- If connections (paths, doors, etc.) are revealed or changed, update edges.
 - If new details are revealed about a location (main or feature), update description and/or aliases.
 - If the Player's new 'localPlace' tells that they are at a specific feature node (existing or newly added), suggest it in 'suggestedCurrentMapNodeId'.
`;
  let prompt = basePrompt;
  const debugInfo: MapUpdateServiceResult['debugInfo'] = { prompt: basePrompt, minimalModelCalls };
  let validParsedPayload: AIMapUpdatePayload | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      console.log(`Map Update Service: Attempt ${attempt + 1}/${MAX_RETRIES}`);
      if (attempt > 0 && debugInfo.validationError) {
        prompt = `${basePrompt}\nCRITICALLY IMPORTANT: ${debugInfo.validationError}`;
      } else {
        prompt = basePrompt;
      }
      debugInfo.prompt = prompt;
      const response = await callMapUpdateAI(prompt, MAP_UPDATE_SYSTEM_INSTRUCTION);
      debugInfo.rawResponse = response.text ?? '';
      const parsedPayloadAttempt = parseAIMapUpdateResponse(response.text ?? '');

      if (parsedPayloadAttempt) {
        normalizeRemovalUpdates(parsedPayloadAttempt);
        const synonymErrors = normalizeStatusAndTypeSynonyms(parsedPayloadAttempt);
        if (isValidAIMapUpdatePayload(parsedPayloadAttempt)) {
            debugInfo.parsedPayload = parsedPayloadAttempt;
            validParsedPayload = parsedPayloadAttempt; // Successfully got a valid payload
            debugInfo.validationError = undefined; // Clear any previous validation error
            break; // Exit retry loop
        } else {
            console.warn(`Map Update Service (Attempt ${attempt + 1}/${MAX_RETRIES}): Payload parsed but FAILED VALIDATION. Invalid payload:`, parsedPayloadAttempt);
            const errMsg = synonymErrors.length > 0 ? `Invalid values: ${synonymErrors.join('; ')}` : 'Parsed payload failed structural/value validation.';
            debugInfo.validationError = errMsg;
            debugInfo.parsedPayload = parsedPayloadAttempt; // Store the invalid payload for debugging
        }
      } else {
         debugInfo.validationError = "Failed to parse AI response into valid JSON map update payload.";
         // debugInfo.parsedPayload will remain undefined or as per last invalid attempt
      }
      if (attempt === MAX_RETRIES - 1) {
        console.error("Map Update Service: Failed to get valid map update payload after all retries.");
      }
    } catch (error) {
      console.error(`Error in map update service (Attempt ${attempt + 1}/${MAX_RETRIES}):`, error);
      if (isServerOrClientError(error)) {
        debugInfo.rawResponse = `Error: ${error instanceof Error ? error.message : String(error)}`;
        debugInfo.validationError = `Processing error: ${error instanceof Error ? error.message : String(error)}`;
        return {
          updatedMapData: null,
          newlyAddedNodes: [],
          newlyAddedEdges: [],
          renameCandidateNodes: [],
          renameCandidateEdges: [],
          debugInfo,
        };
      }
      debugInfo.rawResponse = `Error: ${error instanceof Error ? error.message : String(error)}`;
      debugInfo.validationError = `Processing error: ${error instanceof Error ? error.message : String(error)}`;
      if (attempt === MAX_RETRIES - 1) {
        console.error("Map Update Service: Failed after all retries due to processing error.");
      }
    }
  }

  if (!validParsedPayload) {
    return {
      updatedMapData: null,
      newlyAddedNodes: [],
      newlyAddedEdges: [],
      renameCandidateNodes: [],
      renameCandidateEdges: [],
      debugInfo,
    }; // Return null if no valid payload after all retries
  }

  // Proceed with map data processing using validParsedPayload
  const newMapData: MapData = structuredCloneGameState(currentMapData);
  const newNodesInBatchIdNameMap: Record<string, { id: string; name: string }> = {};
  const newlyAddedNodes: MapNode[] = [];
  const newlyAddedEdges: MapEdge[] = [];
  const renameCandidateNodes: MapNode[] = [];
  const renameCandidateEdges: MapEdge[] = [];
  const pendingChainRequests: EdgeChainRequest[] = [];
  const processedChainKeys = new Set<string>();

  // Refresh lookup maps for the cloned map data
  themeNodeIdMap.clear();
  themeNodeNameMap.clear();
  themeNodeAliasMap.clear();
  themeEdgesMap.clear();
  newMapData.nodes
    .filter(n => n.themeName === currentTheme.name)
    .forEach(n => {
      themeNodeIdMap.set(n.id, n);
      themeNodeNameMap.set(n.placeName, n);
      if (n.data.aliases) n.data.aliases.forEach(a => themeNodeAliasMap.set(a.toLowerCase(), n));
    });
  newMapData.edges.forEach(e => {
    if (themeNodeIdMap.has(e.sourceNodeId) && themeNodeIdMap.has(e.targetNodeId)) {
      if (!themeEdgesMap.has(e.sourceNodeId)) themeEdgesMap.set(e.sourceNodeId, []);
      if (!themeEdgesMap.has(e.targetNodeId)) themeEdgesMap.set(e.targetNodeId, []);
      themeEdgesMap.get(e.sourceNodeId)!.push(e);
      themeEdgesMap.get(e.targetNodeId)!.push(e);
    }
  });

  // Annihilation Step (remains the same)
  let nodesToAddOps_mut: AIMapUpdatePayload['nodesToAdd'] = [...(validParsedPayload.nodesToAdd || [])];
  const nodesToRemove_mut = [...(validParsedPayload.nodesToRemove || [])];
  let edgesToAdd_mut = [...(validParsedPayload.edgesToAdd || [])];
  const edgesToRemove_mut = [...(validParsedPayload.edgesToRemove || [])];

  const finalNodesToAddOps: typeof nodesToAddOps_mut = [];
  if (nodesToAddOps_mut) {
    for (const nodeAdd of nodesToAddOps_mut) {
        const removeIndex = nodesToRemove_mut.findIndex(nr => nr.placeName.toLowerCase() === nodeAdd.placeName.toLowerCase());
        if (removeIndex !== -1) {
            nodesToRemove_mut.splice(removeIndex, 1);
        } else { finalNodesToAddOps.push(nodeAdd); }
    }
    nodesToAddOps_mut = finalNodesToAddOps;
  }

  const finalEdgesToAdd: typeof edgesToAdd_mut = [];
  for (const edgeAdd of edgesToAdd_mut) {
      const removeIndex = edgesToRemove_mut.findIndex(er => {
          const namesMatch = (er.sourcePlaceName.toLowerCase() === edgeAdd.sourcePlaceName.toLowerCase() && er.targetPlaceName.toLowerCase() === edgeAdd.targetPlaceName.toLowerCase()) ||
                           (er.sourcePlaceName.toLowerCase() === edgeAdd.targetPlaceName.toLowerCase() && er.targetPlaceName.toLowerCase() === edgeAdd.sourcePlaceName.toLowerCase());
          if (!namesMatch) return false;
          return !er.type || er.type === edgeAdd.data?.type;
      });
      if (removeIndex !== -1) { edgesToRemove_mut.splice(removeIndex, 1);
      } else { finalEdgesToAdd.push(edgeAdd); }
  }
  edgesToAdd_mut = finalEdgesToAdd;

  const dedupedEdges: typeof edgesToAdd_mut = [];
  const edgeKeySet = new Set<string>();
  for (const e of edgesToAdd_mut) {
      const src = e.sourcePlaceName.toLowerCase();
      const tgt = e.targetPlaceName.toLowerCase();
      const type = e.data?.type || 'path';
      const key = src < tgt ? `${src}|${tgt}|${type}` : `${tgt}|${src}|${type}`;
      if (!edgeKeySet.has(key)) {
          edgeKeySet.add(key);
          dedupedEdges.push(e);
      }
  }
  edgesToAdd_mut = dedupedEdges;

  // If a node is being renamed via nodesToUpdate, ignore any matching
  // nodesToRemove operation referencing either the old or new name.
  (validParsedPayload.nodesToUpdate || []).forEach(upd => {
    const updNames = [upd.placeName.toLowerCase()];
    if (upd.newData.placeName)
      updNames.push(upd.newData.placeName.toLowerCase());
    for (const name of updNames) {
      const idx = nodesToRemove_mut.findIndex(r => r.placeName.toLowerCase() === name);
      if (idx !== -1) nodesToRemove_mut.splice(idx, 1);
    }
  });

  /**
   * Resolves a node reference by either place name or ID.
   * This is used for edges and node updates where the AI might
   * provide either identifier form.
   */
  const findNodeByIdentifier = (
    identifier?: string,
  ): MapNode | { id: string; name: string } | undefined => {
    if (!identifier) return undefined;
    const byName = themeNodeNameMap.get(identifier);
    if (byName) return byName;
    const byId = themeNodeIdMap.get(identifier);
    if (byId) return byId;
    const byAlias = themeNodeAliasMap.get(identifier.toLowerCase());
    if (byAlias) return byAlias;
    if (newNodesInBatchIdNameMap[identifier])
      return newNodesInBatchIdNameMap[identifier];
    const fromBatch = Object.values(newNodesInBatchIdNameMap).find(
      entry => entry.id === identifier || entry.name === identifier,
    );
    return fromBatch;
  };

  // --- Hierarchical Node Addition ---
  let unresolvedQueue: AIMapUpdatePayload['nodesToAdd'] = [...(nodesToAddOps_mut || [])];
  let triedParentInference = false;

  while (unresolvedQueue.length > 0) {
    const nextQueue: typeof unresolvedQueue = [];
    for (const nodeAddOp of unresolvedQueue) {
      let resolvedParentId: string | undefined = undefined;
      if (nodeAddOp.data?.parentNodeId) {
        if (nodeAddOp.data.parentNodeId === 'Universe') {
          resolvedParentId = undefined;
        } else {
          const parent = findNodeByIdentifier(nodeAddOp.data.parentNodeId) as MapNode | undefined;
          if (parent) {
            resolvedParentId = parent.id;
            const childType = nodeAddOp.data.nodeType ?? 'feature';
            if (parent.data.nodeType === childType) {
              resolvedParentId = parent.data.parentNodeId;
            }
          } else {
            nextQueue.push(nodeAddOp);
            continue;
          }
        }
      }

      const baseNameForId = nodeAddOp.placeName
        .replace(/\s+/g, '_')
        .replace(/[^a-zA-Z0-9_]/g, '');
      const newNodeId = `node_${baseNameForId}_${Date.now()%10000}_${Math.random()
        .toString(36)
        .substring(2, 7)}`;

      const {
        description,
        aliases,
        parentNodeId: _ignoredParent,
        status,
        nodeType,
        visited: _ignoredVisited,
        ...rest
      } = nodeAddOp.data;
      void _ignoredParent;
      void _ignoredVisited;

      const newNodeData: MapNodeData = {
        description: description || '',
        aliases: aliases || [],
        status,
        parentNodeId: resolvedParentId,
        nodeType: nodeType ?? 'feature',
        ...rest,
      };

      const newNode: MapNode = {
        id: newNodeId,
        themeName: currentTheme.name,
        placeName: nodeAddOp.placeName,
        position: nodeAddOp.initialPosition || { x: 0, y: 0 },
        data: newNodeData,
      };

      newMapData.nodes.push(newNode);
      newlyAddedNodes.push(newNode);
      themeNodeIdMap.set(newNodeId, newNode);
      themeNodeNameMap.set(nodeAddOp.placeName, newNode);
      if (newNode.data.aliases) {
        newNode.data.aliases.forEach(a => themeNodeAliasMap.set(a.toLowerCase(), newNode));
      }
      newNodesInBatchIdNameMap[nodeAddOp.placeName] = { id: newNodeId, name: nodeAddOp.placeName };
    }

    if (nextQueue.length === unresolvedQueue.length) {
      if (!triedParentInference) {
        for (const unresolved of nextQueue) {
          const guessed = await fetchLikelyParentNode_Service(
            {
              placeName: unresolved.placeName,
              description: unresolved.data.description,
              nodeType: unresolved.data.nodeType,
              status: unresolved.data.status,
              aliases: unresolved.data.aliases,
            },
            {
              sceneDescription: sceneDesc,
              logMessage: logMsg,
              localPlace,
              currentTheme,
              currentMapNodeId: referenceMapNodeId,
              themeNodes: currentThemeNodesFromMapData,
              themeEdges: currentThemeEdgesFromMapData,
            },
            minimalModelCalls
          );
          unresolved.data.parentNodeId = guessed || 'Universe';
        }
        triedParentInference = true;
        unresolvedQueue = nextQueue;
        continue;
      } else {
        console.warn(
          'MapUpdate: Some nodes could not be added due to unresolved parents after AI assistance:',
          nextQueue.map(n => n.placeName).join(', ')
        );
        break;
      }
    }
    unresolvedQueue = nextQueue;
  }

  // Process Node Updates (after all adds, so placeName changes are based on initial state of batch)
  (validParsedPayload.nodesToUpdate || []).forEach(nodeUpdateOp => {
    const node = findNodeByIdentifier(nodeUpdateOp.placeName) as MapNode | undefined;

    if (node) {

        // Handle parentNodeId update
        let resolvedParentIdOnUpdate: string | undefined | null = node.data.parentNodeId; // Default to existing

        if (nodeUpdateOp.newData?.parentNodeId !== undefined) {
            if (nodeUpdateOp.newData.parentNodeId === null) { // Explicitly clearing parent
                resolvedParentIdOnUpdate = undefined; // Store as undefined if cleared
            } else if (typeof nodeUpdateOp.newData.parentNodeId === 'string') {
                if (nodeUpdateOp.newData.parentNodeId === 'Universe') {
                    resolvedParentIdOnUpdate = undefined;
                } else {
                    // Allow parent to be ANY node
                    const parentNode = findNodeByIdentifier(nodeUpdateOp.newData.parentNodeId) as MapNode | undefined;
                    if (parentNode) {
                        resolvedParentIdOnUpdate = parentNode.id;
                        const intendedType = nodeUpdateOp.newData.nodeType ?? node.data.nodeType;
                        if (parentNode.data.nodeType === intendedType) {
                            resolvedParentIdOnUpdate = parentNode.data.parentNodeId;
                        }
                    } else {
                        console.warn(`MapUpdate (nodesToUpdate): Feature node "${nodeUpdateOp.placeName}" trying to update parentNodeId to NAME "${nodeUpdateOp.newData.parentNodeId}" which was not found.`);
                        resolvedParentIdOnUpdate = undefined; // Or keep old one: node.data.parentNodeId
                    }
                }
            }
        }

        // Apply general data updates
        if (nodeUpdateOp.newData) {
            if (nodeUpdateOp.newData.description !== undefined) node.data.description = nodeUpdateOp.newData.description;
            if (nodeUpdateOp.newData.aliases !== undefined) {
                node.data.aliases = nodeUpdateOp.newData.aliases;
                for (const [k, v] of Array.from(themeNodeAliasMap.entries())) {
                  if (v.id === node.id) themeNodeAliasMap.delete(k);
                }
                node.data.aliases.forEach(a => themeNodeAliasMap.set(a.toLowerCase(), node));
            }
            if (nodeUpdateOp.newData.status !== undefined) node.data.status = nodeUpdateOp.newData.status;
            if (nodeUpdateOp.newData.nodeType !== undefined) node.data.nodeType = nodeUpdateOp.newData.nodeType;

            // Update parentNodeId based on resolution
            node.data.parentNodeId = resolvedParentIdOnUpdate;

            // Apply other custom data, excluding handled fields
            for (const key in nodeUpdateOp.newData) {
            if (!['description', 'aliases', 'status', 'parentNodeId', 'nodeType', 'placeName', 'visited'].includes(key)) {
                (node.data as Record<string, unknown>)[key] = (nodeUpdateOp.newData as Record<string, unknown>)[key];
            }
            }
            // Handle placeName change last, as it might affect lookups for newNodesInBatchIdNameMap if not careful
            if (nodeUpdateOp.newData.placeName && nodeUpdateOp.newData.placeName !== node.placeName) {
                // If this node was newly added in THIS batch, update its entry in newNodesInBatchIdNameMap
                const oldBatchEntryKey = Object.keys(newNodesInBatchIdNameMap).find(key => newNodesInBatchIdNameMap[key].id === node.id);
                if (oldBatchEntryKey) {
                    delete newNodesInBatchIdNameMap[oldBatchEntryKey];
                    newNodesInBatchIdNameMap[nodeUpdateOp.newData.placeName] = { id: node.id, name: nodeUpdateOp.newData.placeName };
                }
                themeNodeNameMap.delete(node.placeName);
                const oldName = node.placeName;
                node.placeName = nodeUpdateOp.newData.placeName;
                themeNodeNameMap.set(node.placeName, node);
                if (!node.data.aliases) node.data.aliases = [];
                if (!node.data.aliases.includes(oldName)) node.data.aliases.push(oldName);
                for (const [k, v] of Array.from(themeNodeAliasMap.entries())) {
                  if (v.id === node.id) themeNodeAliasMap.delete(k);
                }
                node.data.aliases.forEach(a => themeNodeAliasMap.set(a.toLowerCase(), node));
            }
        }
    } else {
        console.warn(`MapUpdate (nodesToUpdate): Node with original name "${nodeUpdateOp.placeName}" not found for update.`);
    }
  });

  // Process Node Removals
  nodesToRemove_mut.forEach(nodeRemoveOp => {
      const node = findNodeByIdentifier(nodeRemoveOp.placeName) as MapNode | undefined;
      if (node) {
          const removedNodeId = node.id;
          const index = newMapData.nodes.findIndex(n => n.id === removedNodeId);
          if (index !== -1) newMapData.nodes.splice(index, 1);
          themeNodeNameMap.delete(node.placeName);
          themeNodeIdMap.delete(removedNodeId);
          // Also remove edges connected to this node
          newMapData.edges = newMapData.edges.filter(edge => edge.sourceNodeId !== removedNodeId && edge.targetNodeId !== removedNodeId);
          themeEdgesMap.forEach((edgesArr: MapEdge[], nid: string) => {
              themeEdgesMap.set(nid, edgesArr.filter(e => e.sourceNodeId !== removedNodeId && e.targetNodeId !== removedNodeId));
          });
          themeEdgesMap.delete(removedNodeId);
          for (const [k, v] of Array.from(themeNodeAliasMap.entries())) {
              if (v.id === removedNodeId) themeNodeAliasMap.delete(k);
          }
          // Remove from newNodesInBatchIdNameMap if it was added then removed in same batch
          const batchKey = Object.keys(newNodesInBatchIdNameMap).find(k => newNodesInBatchIdNameMap[k].id === removedNodeId || k === nodeRemoveOp.placeName);
          if (batchKey) delete newNodesInBatchIdNameMap[batchKey];
      } else {
          console.warn(`MapUpdate (nodesToRemove): Node "${nodeRemoveOp.placeName}" not found for removal.`);
      }
  });

  // Determines whether two feature nodes can be directly connected based on the
  // hierarchy rules. Allowed connections are:
  //   1) sibling features (same parent)
  //   2) features whose parents share the same grandparent
  //   3) a feature and another feature whose parent is the child's grandparent
  const isEdgeConnectionAllowed = (
      nodeA: MapNode,
      nodeB: MapNode,
      edgeType?: MapEdgeData['type']
  ): boolean => {
      if (edgeType === 'shortcut') return true;
      if (nodeA.data.nodeType !== 'feature' || nodeB.data.nodeType !== 'feature') {
          return false;
      }

      const parentA = nodeA.data.parentNodeId
        ? themeNodeIdMap.get(nodeA.data.parentNodeId)
        : null;
      const parentB = nodeB.data.parentNodeId
        ? themeNodeIdMap.get(nodeB.data.parentNodeId)
        : null;

      if (!parentA || !parentB) return false;
      if (parentA.id === parentB.id) return true;

      const grandA = parentA.data.parentNodeId
        ? themeNodeIdMap.get(parentA.data.parentNodeId)
        : null;
      const grandB = parentB.data.parentNodeId
        ? themeNodeIdMap.get(parentB.data.parentNodeId)
        : null;

      if (grandA && grandB && grandA.id === grandB.id) return true;

      // Allow child-to-grandchild feature connections across hierarchy levels
      if (grandA && parentB.id === grandA.id) return true;
      if (grandB && parentA.id === grandB.id) return true;

      // Allow connections between features whose parents are both direct children of the root
      if (
        parentA.data.parentNodeId === 'Universe' &&
        parentB.data.parentNodeId === 'Universe'
      )
        return true;

      if (parentA.id === 'Universe' && grandB && grandB.id === 'Universe')
        return true;
      if (parentB.id === 'Universe' && grandA && grandA.id === 'Universe')
        return true;

      return false;
  };

  const generateUniqueId = (prefix: string) => `${prefix}${Date.now()%10000}_${Math.random().toString(36).substring(2,7)}`;

  const addEdgeWithTracking = (
      a: MapNode,
      b: MapNode,
      data: MapEdgeData,
      markForRename = false
  ): MapEdge => {
      const existing = (themeEdgesMap.get(a.id) || []).find(
          e =>
              ((e.sourceNodeId === a.id && e.targetNodeId === b.id) ||
                  (e.sourceNodeId === b.id && e.targetNodeId === a.id)) &&
              e.data.type === data.type
      );
      if (existing) return existing;
      const id = generateUniqueId(`edge_${a.id}_to_${b.id}_`);
      const edge: MapEdge = { id, sourceNodeId: a.id, targetNodeId: b.id, data };
      newMapData.edges.push(edge);
      newlyAddedEdges.push(edge);
      if (markForRename) renameCandidateEdges.push(edge);
      let arrA = themeEdgesMap.get(a.id); if (!arrA) { arrA = []; themeEdgesMap.set(a.id, arrA); } arrA.push(edge);
      let arrB = themeEdgesMap.get(b.id); if (!arrB) { arrB = []; themeEdgesMap.set(b.id, arrB); } arrB.push(edge);
      return edge;
  };

  const getNodeDepth = (node: MapNode): number => {
      let depth = 0;
      let current: MapNode | undefined = node;
      while (current.data.parentNodeId) {
          const parent = themeNodeIdMap.get(current.data.parentNodeId);
          if (!parent) break;
          depth++;
          current = parent;
      }
      return depth;
  };




  // Process Edges (uses findNodeByIdentifier which checks newMapData nodes directly)
  for (const edgeAddOp of edgesToAdd_mut) {
      const sourceNodeRef = findNodeByIdentifier(edgeAddOp.sourcePlaceName);
      const targetNodeRef = findNodeByIdentifier(edgeAddOp.targetPlaceName);

      if (!sourceNodeRef || !targetNodeRef) {
          console.warn(`MapUpdate: Skipping edge add due to missing source ("${edgeAddOp.sourcePlaceName}") or target ("${edgeAddOp.targetPlaceName}") node.`);
          continue;
      }

      const sourceNode = themeNodeIdMap.get(sourceNodeRef.id)!;
      const targetNode = themeNodeIdMap.get(targetNodeRef.id)!;

      const pairKey =
        sourceNode.id < targetNode.id
          ? `${sourceNode.id}|${targetNode.id}|${edgeAddOp.data?.type || 'path'}`
          : `${targetNode.id}|${sourceNode.id}|${edgeAddOp.data?.type || 'path'}`;
      if (processedChainKeys.has(pairKey)) continue;
      processedChainKeys.add(pairKey);

      const chainPairs: EdgeChainRequest['pairs'] = [];
      const sourceChain: MapNode[] = [sourceNode];
      const targetChain: MapNode[] = [targetNode];
      let nodeA: MapNode = sourceNode;
      let nodeB: MapNode = targetNode;
      let attempts = 0;
      let lastKey = '';
      while (!isEdgeConnectionAllowed(nodeA, nodeB, edgeAddOp.data?.type) && attempts < 10) {
          const stepKey = `${nodeA.id}|${nodeB.id}`;
          if (stepKey !== lastKey) {
            chainPairs.push({ sourceParent: nodeA, targetParent: nodeB });
            lastKey = stepKey;
          }
          const depthA = getNodeDepth(nodeA);
          const depthB = getNodeDepth(nodeB);
          if (depthA >= depthB && nodeA.data.parentNodeId) {
              const parentA = themeNodeIdMap.get(nodeA.data.parentNodeId);
              if (parentA) { nodeA = parentA; sourceChain.push(nodeA); } else break;
          } else if (nodeB.data.parentNodeId) {
              const parentB = themeNodeIdMap.get(nodeB.data.parentNodeId);
              if (parentB) { nodeB = parentB; targetChain.push(nodeB); } else break;
          } else {
              break;
          }
          attempts++;
      }

      if (!isEdgeConnectionAllowed(nodeA, nodeB, edgeAddOp.data?.type)) {
          const finalKey = `${nodeA.id}|${nodeB.id}`;
          if (finalKey !== lastKey) {
            chainPairs.push({ sourceParent: nodeA, targetParent: nodeB });
          }
          pendingChainRequests.push({
            originalSource: sourceNode,
            originalTarget: targetNode,
            pairs: chainPairs,
            sourceChain,
            targetChain,
            edgeData: edgeAddOp.data || { type: 'path', status: 'open' },
          });
          continue;
      }

      addEdgeWithTracking(
        nodeA,
        nodeB,
        {
          ...(edgeAddOp.data || {}),
          status:
            edgeAddOp.data?.status ||
            (nodeA.data.status === 'rumored' || nodeB.data.status === 'rumored' ? 'rumored' : 'open'),
        },
        false
      );
  }

  (validParsedPayload.edgesToUpdate || []).forEach(edgeUpdateOp => {
    const sourceNodeRef = findNodeByIdentifier(edgeUpdateOp.sourcePlaceName);
    const targetNodeRef = findNodeByIdentifier(edgeUpdateOp.targetPlaceName);
     if (!sourceNodeRef || !targetNodeRef) { console.warn(`MapUpdate: Skipping edge update due to missing source ("${edgeUpdateOp.sourcePlaceName}") or target ("${edgeUpdateOp.targetPlaceName}") node.`); return; }
    const sourceNodeId = sourceNodeRef.id;
    const targetNodeId = targetNodeRef.id;
    const sourceNode = themeNodeIdMap.get(sourceNodeId);
    const targetNode = themeNodeIdMap.get(targetNodeId);
    if (!sourceNode || !targetNode) return;

    // Find edge to update. If type is specified in newData, it's part of the match criteria.
    // Otherwise, find any edge and update its type.
    const candidateEdges = (themeEdgesMap.get(sourceNodeId) || []).filter(
      e =>
        (e.sourceNodeId === sourceNodeId && e.targetNodeId === targetNodeId) ||
        (e.sourceNodeId === targetNodeId && e.targetNodeId === sourceNodeId)
    );

    const checkType = edgeUpdateOp.newData.type || candidateEdges[0]?.data.type;
    if (!isEdgeConnectionAllowed(sourceNode, targetNode, checkType)) {
      console.warn(
        `MapUpdate: Edge update between "${sourceNode.placeName}" and "${targetNode.placeName}" violates hierarchy rules. Skipping update.`
      );
      return;
    }
    let edgeToUpdate = candidateEdges.find(e => edgeUpdateOp.newData.type ? e.data.type === edgeUpdateOp.newData.type : true);
    if (!edgeToUpdate) edgeToUpdate = candidateEdges[0];

    if (edgeToUpdate) {
        edgeToUpdate.data = { ...edgeToUpdate.data, ...edgeUpdateOp.newData };
    } else {
        console.warn(`MapUpdate (edgesToUpdate): Edge between "${edgeUpdateOp.sourcePlaceName}" and "${edgeUpdateOp.targetPlaceName}" not found for update.`);
    }
  });

  edgesToRemove_mut.forEach(edgeRemoveOp => {
      const sourceNodeRef = findNodeByIdentifier(edgeRemoveOp.sourcePlaceName);
      const targetNodeRef = findNodeByIdentifier(edgeRemoveOp.targetPlaceName);
      if (!sourceNodeRef || !targetNodeRef) { console.warn(`MapUpdate: Skipping edge removal due to missing source ("${edgeRemoveOp.sourcePlaceName}") or target ("${edgeRemoveOp.targetPlaceName}") node.`); return; }
      const sourceNodeId = sourceNodeRef.id; const targetNodeId = targetNodeRef.id;
      const removalType = edgeRemoveOp.type;

      const remainingEdges: MapEdge[] = [];
      newMapData.edges.forEach(edge => {
          const matchesNodes = (edge.sourceNodeId === sourceNodeId && edge.targetNodeId === targetNodeId) ||
                               (edge.sourceNodeId === targetNodeId && edge.targetNodeId === sourceNodeId);
          if (!matchesNodes || (removalType && edge.data.type !== removalType)) {
              remainingEdges.push(edge);
          } else {
              const arr1 = themeEdgesMap.get(edge.sourceNodeId);
              if (arr1) themeEdgesMap.set(edge.sourceNodeId, arr1.filter(e => e !== edge));
              const arr2 = themeEdgesMap.get(edge.targetNodeId);
              if (arr2) themeEdgesMap.set(edge.targetNodeId, arr2.filter(e => e !== edge));
          }
      });
      newMapData.edges = remainingEdges;
  });

  if (pendingChainRequests.length > 0) {
      const chainResult = await fetchConnectorChains_Service(pendingChainRequests, {
        sceneDescription: sceneDesc,
        logMessage: logMsg,
        currentTheme,
        themeNodes: newMapData.nodes.filter(n => n.themeName === currentTheme.name)
      });
      if (chainResult.debugInfo) {
        debugInfo.connectorChainsDebugInfo = chainResult.debugInfo;
      }
      if (chainResult.payload) {
        (chainResult.payload.nodesToAdd || []).forEach(nAdd => {
          const nodeData = nAdd.data || { status: 'discovered', nodeType: 'feature', parentNodeId: 'Universe', description: '', aliases: [] };
          const parent = nodeData.parentNodeId && nodeData.parentNodeId !== 'Universe'
            ? (findNodeByIdentifier(nodeData.parentNodeId) as MapNode | undefined)
            : undefined;
          const parentId = parent ? parent.id : undefined;
          const newId = generateUniqueId(`node_${nAdd.placeName.replace(/\s+/g,'_').replace(/[^a-zA-Z0-9_]/g,'')}_`);
          const node: MapNode = {
            id: newId,
            themeName: currentTheme.name,
            placeName: nAdd.placeName,
            position: parent ? { ...parent.position } : { x: 0, y: 0 },
            data: { ...nodeData, parentNodeId: parentId }
          } as MapNode;
          newMapData.nodes.push(node);
          newlyAddedNodes.push(node);
          renameCandidateNodes.push(node);
          themeNodeIdMap.set(node.id, node);
          themeNodeNameMap.set(node.placeName, node);
        });
        (chainResult.payload.edgesToAdd || []).forEach(eAdd => {
          const src = findNodeByIdentifier(eAdd.sourcePlaceName) as MapNode | undefined;
          const tgt = findNodeByIdentifier(eAdd.targetPlaceName) as MapNode | undefined;
          if (src && tgt) {
            if (isEdgeConnectionAllowed(src, tgt, eAdd.data?.type)) {
              addEdgeWithTracking(
                src,
                tgt,
                eAdd.data || { type: 'path', status: 'open' },
                true,
              );
            } else {
              console.warn(
                `Connector chain edge between "${src.placeName}" and "${tgt.placeName}" violates hierarchy rules. Skipping.`,
              );
            }
          }
        });
      }
  }

  // --- End of Temporary Feature Upgrade (parent-child edges cleaned up) ---


  return {
    updatedMapData: newMapData,
    newlyAddedNodes,
    newlyAddedEdges,
    renameCandidateNodes,
    renameCandidateEdges,
    debugInfo,
  };
};
