
/**
 * @file mapUpdateService.ts
 * @description This service handles communication with an auxiliary AI model
 * to update the game's map data based on narrative events.
 */
import { GenerateContentResponse } from "@google/genai";
import { GameStateFromAI, AdventureTheme, MapData, MapNode, MapEdge, DialogueSummaryResponse, MapNodeData, MapEdgeData, AIMapUpdatePayload, AINodeUpdate } from '../types';
import { AUXILIARY_MODEL_NAME, MAX_RETRIES } from '../constants';
import { MAP_UPDATE_SYSTEM_INSTRUCTION } from '../prompts/mapPrompts';
import { ai } from './geminiClient';
import { isApiConfigured } from './apiClient';
import { formatKnownPlacesForPrompt } from '../utils/promptFormatters/map';
import { isValidAIMapUpdatePayload } from '../utils/mapUpdateValidationUtils';
import { structuredCloneGameState } from '../utils/cloneUtils';

// Local type definition for Place, matching what useGameLogic might prepare
interface Place {
  name: string;
  description: string;
  themeName: string;
  aliases?: string[];
}

export interface MapUpdateServiceResult {
  updatedMapData: MapData | null;
  debugInfo: {
    prompt: string;
    rawResponse?: string;
    parsedPayload?: AIMapUpdatePayload;
    validationError?: string;
  } | null;
}

const callMapUpdateAI = async (prompt: string, systemInstruction: string): Promise<GenerateContentResponse> => {
  return ai.models.generateContent({
    model: AUXILIARY_MODEL_NAME, // Will now use gemini-2.5-flash-preview-04-17
    contents: prompt,
    config: {
      systemInstruction: systemInstruction,
      responseMimeType: "application/json",
      temperature: 0.75,
      // Omit thinkingConfig for higher quality (default enabled)
    }
  });
};

const parseAIMapUpdateResponse = (responseText: string): AIMapUpdatePayload | null => {
  let jsonStr = responseText.trim();
  const fenceRegex = /^```(?:json)?\s*\n?(.*?)\n?\s*```$/s;
  const fenceMatch = jsonStr.match(fenceRegex);
  if (fenceMatch && fenceMatch[1]) {
    jsonStr = fenceMatch[1].trim();
  }
  try {
    const parsed = JSON.parse(jsonStr);
    // A more robust check might be needed here depending on how minimal a valid payload can be
    if (parsed && (parsed.nodesToAdd || parsed.nodesToUpdate || parsed.nodesToRemove || parsed.edgesToAdd || parsed.edgesToUpdate || parsed.edgesToRemove || parsed.suggestedCurrentMapNodeId !== undefined)) {
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

  const currentThemeNodesFromMapData = currentMapData.nodes.filter(n => n.themeName === currentTheme.name);
  const currentThemeNodeIdsSet = new Set(currentThemeNodesFromMapData.map(n => n.id));
  const currentThemeEdgesFromMapData = currentMapData.edges.filter(e =>
    currentThemeNodeIdsSet.has(e.sourceNodeId) && currentThemeNodeIdsSet.has(e.targetNodeId)
  );
  const themeNodeIdMap = new Map<string, MapNode>();
  const themeNodeNameMap = new Map<string, MapNode>();
  const themeEdgesMap = new Map<string, MapEdge[]>();
  currentThemeNodesFromMapData.forEach(n => {
    themeNodeIdMap.set(n.id, n);
    themeNodeNameMap.set(n.placeName, n);
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
      previousMapNodeContext = `Player's Previous Map Node: Was at "${prevNode.placeName}" (ID: ${prevNode.id}, Type: ${prevNode.data.isLeaf ? 'Leaf' : 'Main'}, Visited: ${!!prevNode.data.visited}).`;
    }
  }

  const existingMapContext = `
Current Map Nodes (for your reference):
${currentThemeNodesFromMapData.length > 0 ? currentThemeNodesFromMapData.map(n => `- Node: "${n.placeName}" (ID: ${n.id}, Leaf: ${!!n.data.isLeaf}, Visited: ${!!n.data.visited}, ParentNodeId: ${n.data.parentNodeId || 'N/A'}, Status: ${n.data.status || 'N/A'})`).join('\n') : "None exist yet."}

Current Map Edges (for your reference):
${currentThemeEdgesFromMapData.length > 0 ? currentThemeEdgesFromMapData.map(e => `- Edge from node ID ${e.sourceNodeId} to node ID ${e.targetNodeId}, Type: ${e.data.type || 'N/A'}, Status: ${e.data.status || 'N/A'}`).join('\n') : "None exist yet."}
`;

  const allKnownMainPlacesString = allKnownMainMapNodesForTheme.length > 0
    ? allKnownMainMapNodesForTheme.map(p => `"${p.placeName}" (Description: "${p.data.description.substring(0,100)}...")`).join('; ')
    : "No main places are pre-defined for this theme.";


  const prompt = `
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
- If the narrative mentions a main location that is NOT yet on the map, add it.
- For ALL nodes in 'nodesToAdd', you MUST provide 'description' (non-empty string, <300 chars), 'aliases' (array of strings, can be empty), and 'status'.
- If any new specific places (leaf nodes) within or between main locations are described, add them, and connect to their respective parent Nodes with type="containment" edges.
- All nodes MUST represent physical locations.
- If connections (paths, doors, etc.) are revealed or changed, update edges.
- If new details are revealed about a location (main or leaf), update description and/or aliases.
- If the Player's new 'localPlace' tells that they are at a specific map node leaf (existing or newly added), suggest it in 'suggestedCurrentMapNodeId'.
`;
  const debugInfo: MapUpdateServiceResult['debugInfo'] = { prompt };
  let validParsedPayload: AIMapUpdatePayload | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      console.log(`Map Update Service: Attempt ${attempt + 1}/${MAX_RETRIES}`);
      const response = await callMapUpdateAI(prompt, MAP_UPDATE_SYSTEM_INSTRUCTION);
      debugInfo.rawResponse = response.text ?? '';
      const parsedPayloadAttempt = parseAIMapUpdateResponse(response.text ?? '');

      if (parsedPayloadAttempt) {
        normalizeRemovalUpdates(parsedPayloadAttempt);
        if (isValidAIMapUpdatePayload(parsedPayloadAttempt)) {
            debugInfo.parsedPayload = parsedPayloadAttempt;
            validParsedPayload = parsedPayloadAttempt; // Successfully got a valid payload
            debugInfo.validationError = undefined; // Clear any previous validation error
            break; // Exit retry loop
        } else {
            console.warn(`Map Update Service (Attempt ${attempt + 1}/${MAX_RETRIES}): Payload parsed but FAILED VALIDATION. Invalid payload:`, parsedPayloadAttempt);
            debugInfo.validationError = "Parsed payload failed structural/value validation.";
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
      debugInfo.rawResponse = `Error: ${error instanceof Error ? error.message : String(error)}`;
      debugInfo.validationError = `Processing error: ${error instanceof Error ? error.message : String(error)}`;
      if (attempt === MAX_RETRIES - 1) {
        console.error("Map Update Service: Failed after all retries due to processing error.");
      }
    }
  }

  if (!validParsedPayload) {
    return { updatedMapData: null, debugInfo }; // Return null if no valid payload after all retries
  }

  // Proceed with map data processing using validParsedPayload
  const newMapData: MapData = structuredCloneGameState(currentMapData);
  const newNodesInBatchIdNameMap: Record<string, { id: string; name: string }> = {};

  // Refresh lookup maps for the cloned map data
  themeNodeIdMap.clear();
  themeNodeNameMap.clear();
  themeEdgesMap.clear();
  newMapData.nodes
    .filter(n => n.themeName === currentTheme.name)
    .forEach(n => {
      themeNodeIdMap.set(n.id, n);
      themeNodeNameMap.set(n.placeName, n);
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
  let nodesToRemove_mut = [...(validParsedPayload.nodesToRemove || [])];
  let edgesToAdd_mut = [...(validParsedPayload.edgesToAdd || [])];
  let edgesToRemove_mut = [...(validParsedPayload.edgesToRemove || [])];

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

  /**
   * Resolves a node reference by either place name or ID.
   * This is used for edges and node updates where the AI might
   * provide either identifier form.
   */
  const findNodeByIdentifier = (identifier: string): MapNode | { id: string; name: string } | undefined => {
    const byName = themeNodeNameMap.get(identifier);
    if (byName) return byName;
    const byId = themeNodeIdMap.get(identifier);
    if (byId) return byId;
    if (newNodesInBatchIdNameMap[identifier]) return newNodesInBatchIdNameMap[identifier];
    const fromBatch = Object.values(newNodesInBatchIdNameMap).find(entry => entry.id === identifier || entry.name === identifier);
    return fromBatch;
  };

  // --- Two-Pass Node Addition ---
  const mainNodesToAddOps = (nodesToAddOps_mut || []).filter(op => !op.data?.isLeaf);
  const leafNodesToAddOps = (nodesToAddOps_mut || []).filter(op => op.data?.isLeaf);

  // Pass 1: Add Main Nodes
  mainNodesToAddOps.forEach(nodeAddOp => {
    // Check if a main node with this name already exists in the theme
    const existingMainNode = findNodeByIdentifier(nodeAddOp.placeName) as MapNode | undefined;
    if (existingMainNode && !existingMainNode.data.isLeaf) {
        console.warn(`MapUpdate (nodesToAdd - Pass 1): Main node "${nodeAddOp.placeName}" already exists. Skipping add.`);
        if (!newNodesInBatchIdNameMap[existingMainNode.placeName]) {
            newNodesInBatchIdNameMap[existingMainNode.placeName] = { id: existingMainNode.id, name: existingMainNode.placeName };
        }
        return;
    }

    const baseNameForId = nodeAddOp.placeName.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
    const newNodeId = `${currentTheme.name}_main_${baseNameForId}_${Date.now()%10000}_${Math.random().toString(36).substring(2,7)}`;

    const newNodeData: MapNodeData = {
        description: nodeAddOp.data.description || '', // Ensure string
        aliases: nodeAddOp.data.aliases || [],
        status: nodeAddOp.data.status,
        isLeaf: false, // Explicitly false for main nodes
        // parentNodeId is not applicable for main nodes from this payload structure
        ...(nodeAddOp.data ? (({ description, aliases, parentNodeId, isLeaf, status, visited, ...rest }) => rest)(nodeAddOp.data) : {})
    };

    const newNode: MapNode = { id: newNodeId, themeName: currentTheme.name, placeName: nodeAddOp.placeName, position: nodeAddOp.initialPosition || { x: 0, y: 0 }, data: newNodeData };
    newMapData.nodes.push(newNode);
    themeNodeIdMap.set(newNodeId, newNode);
    themeNodeNameMap.set(nodeAddOp.placeName, newNode);
    newNodesInBatchIdNameMap[nodeAddOp.placeName] = { id: newNodeId, name: nodeAddOp.placeName };
  });

  // Pass 2: Add Leaf Nodes
  leafNodesToAddOps.forEach(nodeAddOp => {
    // Check if a leaf node with this name (and potentially same parent if specified) already exists
    const potentialLeaf = findNodeByIdentifier(nodeAddOp.placeName) as MapNode | undefined;
    let existingLeafNode: MapNode | undefined;
    if (potentialLeaf && potentialLeaf.data.isLeaf) {
        if (nodeAddOp.data?.parentNodeId) {
            const parent = findNodeByIdentifier(nodeAddOp.data.parentNodeId) as MapNode | undefined;
            if (parent && potentialLeaf.data.parentNodeId === parent.id) {
                existingLeafNode = potentialLeaf;
            }
        } else {
            existingLeafNode = potentialLeaf;
        }
    }
    if (existingLeafNode) {
        console.warn(`MapUpdate (nodesToAdd - Pass 2): Leaf node "${nodeAddOp.placeName}" seems to already exist. Skipping add.`);
         if (!newNodesInBatchIdNameMap[existingLeafNode.placeName]) {
            newNodesInBatchIdNameMap[existingLeafNode.placeName] = { id: existingLeafNode.id, name: existingLeafNode.placeName };
        }
        return;
    }

    const baseNameForId = nodeAddOp.placeName.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
    const newNodeId = `${currentTheme.name}_leaf_${baseNameForId}_${Date.now()%10000}_${Math.random().toString(36).substring(2,7)}`;

    let resolvedParentNodeId: string | undefined = undefined;
    if (nodeAddOp.data?.parentNodeId) {
        const parentNode = findNodeByIdentifier(nodeAddOp.data.parentNodeId) as MapNode | undefined;
        if (parentNode) {
            resolvedParentNodeId = parentNode.id;
        } else {
            console.warn(`MapUpdate (nodesToAdd - Pass 2): Leaf node "${nodeAddOp.placeName}" specifies parent NAME "${nodeAddOp.data.parentNodeId}" which was not found among existing or newly added nodes.`);
        }
    }

    const newNodeData: MapNodeData = {
        description: nodeAddOp.data.description || '',
        aliases: nodeAddOp.data.aliases || [],
        status: nodeAddOp.data.status,
        isLeaf: true, // Explicitly true for leaf nodes
        parentNodeId: resolvedParentNodeId,
        ...(nodeAddOp.data ? (({ description, aliases, parentNodeId, isLeaf, status, visited, ...rest }) => rest)(nodeAddOp.data) : {})
    };

    const newNode: MapNode = { id: newNodeId, themeName: currentTheme.name, placeName: nodeAddOp.placeName, position: nodeAddOp.initialPosition || { x: 0, y: 0 }, data: newNodeData };
    newMapData.nodes.push(newNode);
    themeNodeIdMap.set(newNodeId, newNode);
    themeNodeNameMap.set(nodeAddOp.placeName, newNode);
    newNodesInBatchIdNameMap[nodeAddOp.placeName] = { id: newNodeId, name: nodeAddOp.placeName };
  });

  // Process Node Updates (after all adds, so placeName changes are based on initial state of batch)
  (validParsedPayload.nodesToUpdate || []).forEach(nodeUpdateOp => {
    const node = findNodeByIdentifier(nodeUpdateOp.placeName) as MapNode | undefined;

    if (node) {

        // Handle parentNodeId update specifically for leaves
        let resolvedParentIdOnUpdate: string | undefined | null = node.data.parentNodeId; // Default to existing
        const effectiveIsLeafForUpdate = nodeUpdateOp.newData?.isLeaf !== undefined ? nodeUpdateOp.newData.isLeaf : node.data.isLeaf;

        if (effectiveIsLeafForUpdate && nodeUpdateOp.newData?.parentNodeId !== undefined) {
            if (nodeUpdateOp.newData.parentNodeId === null) { // Explicitly clearing parent
                resolvedParentIdOnUpdate = undefined; // Store as undefined if cleared
            } else if (typeof nodeUpdateOp.newData.parentNodeId === 'string') {
                // Allow parent to be ANY node (main or leaf)
                const parentNode = findNodeByIdentifier(nodeUpdateOp.newData!.parentNodeId) as MapNode | undefined;
                if (parentNode) {
                    resolvedParentIdOnUpdate = parentNode.id;
                } else {
                    console.warn(`MapUpdate (nodesToUpdate): Leaf node "${nodeUpdateOp.placeName}" trying to update parentNodeId to NAME "${nodeUpdateOp.newData.parentNodeId}" which was not found.`);
                    resolvedParentIdOnUpdate = undefined; // Or keep old one: node.data.parentNodeId
                }
            }
        }

        // Apply general data updates
        if (nodeUpdateOp.newData) {
            if (nodeUpdateOp.newData.description !== undefined) node.data.description = nodeUpdateOp.newData.description;
            if (nodeUpdateOp.newData.aliases !== undefined) node.data.aliases = nodeUpdateOp.newData.aliases;
            if (nodeUpdateOp.newData.status !== undefined) node.data.status = nodeUpdateOp.newData.status;
            if (nodeUpdateOp.newData.isLeaf !== undefined) node.data.isLeaf = nodeUpdateOp.newData.isLeaf;

            // Update parentNodeId based on resolution
            node.data.parentNodeId = resolvedParentIdOnUpdate;

            // Apply other custom data, excluding handled fields
            for (const key in nodeUpdateOp.newData) {
                if (!['description', 'aliases', 'status', 'isLeaf', 'parentNodeId', 'placeName', 'visited'].includes(key)) {
                    (node.data as any)[key] = (nodeUpdateOp.newData as any)[key];
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
                node.placeName = nodeUpdateOp.newData.placeName;
                themeNodeNameMap.set(node.placeName, node);
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
          for (const [nid, edges] of themeEdgesMap) {
              themeEdgesMap.set(nid, edges.filter(e => e.sourceNodeId !== removedNodeId && e.targetNodeId !== removedNodeId));
          }
          themeEdgesMap.delete(removedNodeId);
          // Remove from newNodesInBatchIdNameMap if it was added then removed in same batch
          const batchKey = Object.keys(newNodesInBatchIdNameMap).find(k => newNodesInBatchIdNameMap[k].id === removedNodeId || k === nodeRemoveOp.placeName);
          if (batchKey) delete newNodesInBatchIdNameMap[batchKey];
      } else {
          console.warn(`MapUpdate (nodesToRemove): Node "${nodeRemoveOp.placeName}" not found for removal.`);
      }
  });

  // Process Edges (uses findNodeByIdentifier which checks newMapData nodes directly)
  edgesToAdd_mut.forEach(edgeAddOp => {
      const sourceNodeRef = findNodeByIdentifier(edgeAddOp.sourcePlaceName);
      const targetNodeRef = findNodeByIdentifier(edgeAddOp.targetPlaceName);
      if (!sourceNodeRef || !targetNodeRef) {
          console.warn(`MapUpdate: Skipping edge add due to missing source ("${edgeAddOp.sourcePlaceName}") or target ("${edgeAddOp.targetPlaceName}") node for new edge.`); return;
      }
      const sourceNodeId = sourceNodeRef.id; const targetNodeId = targetNodeRef.id;
      const newEdgeId = `${sourceNodeId}_to_${targetNodeId}_${Date.now()%10000}_${Math.random().toString(36).substring(2,7)}`;
      const existingEdgeOfTheSameType = (themeEdgesMap.get(sourceNodeId) || []).find(e =>
          ((e.sourceNodeId === sourceNodeId && e.targetNodeId === targetNodeId) || (e.sourceNodeId === targetNodeId && e.targetNodeId === sourceNodeId))
          && e.data.type === edgeAddOp.data?.type
      );
      if (!existingEdgeOfTheSameType) {
          const newEdge = { id: newEdgeId, sourceNodeId, targetNodeId, data: edgeAddOp.data || {} } as MapEdge;
          newMapData.edges.push(newEdge);
          if (!themeEdgesMap.has(sourceNodeId)) themeEdgesMap.set(sourceNodeId, []);
          if (!themeEdgesMap.has(targetNodeId)) themeEdgesMap.set(targetNodeId, []);
          themeEdgesMap.get(sourceNodeId)!.push(newEdge);
          themeEdgesMap.get(targetNodeId)!.push(newEdge);
      } else {
           console.warn(`MapUpdate: Edge of type "${edgeAddOp.data?.type}" already exists between "${edgeAddOp.sourcePlaceName}" and "${edgeAddOp.targetPlaceName}". Skipping add.`);
      }
  });

  (validParsedPayload.edgesToUpdate || []).forEach(edgeUpdateOp => {
    const sourceNodeRef = findNodeByIdentifier(edgeUpdateOp.sourcePlaceName);
    const targetNodeRef = findNodeByIdentifier(edgeUpdateOp.targetPlaceName);
     if (!sourceNodeRef || !targetNodeRef) { console.warn(`MapUpdate: Skipping edge update due to missing source ("${edgeUpdateOp.sourcePlaceName}") or target ("${edgeUpdateOp.targetPlaceName}") node.`); return; }
    const sourceNodeId = sourceNodeRef.id; const targetNodeId = targetNodeRef.id;

    // Find edge to update. If type is specified in newData, it's part of the match criteria.
    // Otherwise, find any edge and update its type.
    const candidateEdges = (themeEdgesMap.get(sourceNodeId) || []).filter(e =>
        (e.sourceNodeId === sourceNodeId && e.targetNodeId === targetNodeId) ||
        (e.sourceNodeId === targetNodeId && e.targetNodeId === sourceNodeId)
    );
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

  // --- Upgrade Leaf Nodes to Main Nodes if they have >= 6 containment edges ---
  const nodesToUpgradeIndices: number[] = [];
  newMapData.nodes.forEach((node, index) => {
    if (node.data.isLeaf && node.themeName === currentTheme.name) {
      const connectedEdges = themeEdgesMap.get(node.id) || [];
      const containmentEdgeCount = connectedEdges.filter(edge => edge.data.type === 'containment').length;

      if (containmentEdgeCount >= 6) {
        nodesToUpgradeIndices.push(index);
      }
    }
  });

  if (nodesToUpgradeIndices.length > 0) {
    console.log(`MapUpdate: Upgrading ${nodesToUpgradeIndices.length} leaf node(s) to main nodes due to high containment edge count.`);
    nodesToUpgradeIndices.forEach(index => {
      const nodeToUpgrade = newMapData.nodes[index];
      console.log(`  - Upgrading node: "${nodeToUpgrade.placeName}" (ID: ${nodeToUpgrade.id})`);
      nodeToUpgrade.data.isLeaf = false;
      nodeToUpgrade.data.parentNodeId = undefined;
      // Optionally, you could clear or generalize its description/aliases here,
      // or queue it for a detail fetch via correctionService if its details were too leaf-specific.
      // For now, just changing status.
    });
  }
  // --- End of Leaf Upgrade Logic ---


  return { updatedMapData: newMapData, debugInfo };
};
