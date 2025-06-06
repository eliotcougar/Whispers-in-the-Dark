
/**
 * @file mapCorrectionService.ts
 * @description Service for refining map structures (specifically chains of main nodes
 *              connected by temporary leaf nodes) using AI, and applying pruning logic.
 */

import { GenerateContentResponse } from "@google/genai";
import { AIMapUpdatePayload, MapChainToRefine, MapData, MapNode, MapEdge, AdventureTheme, MapNodeData } from '../types';
import { AUXILIARY_MODEL_NAME, MAX_RETRIES, GEMINI_MODEL_NAME } from '../constants';
import { MAP_CHAIN_CORRECTION_SYSTEM_INSTRUCTION } from '../prompts/mapPrompts';
import { dispatchAIRequest } from './modelDispatcher';
import { isApiConfigured } from './apiClient';
import { VALID_NODE_STATUS_VALUES, VALID_EDGE_TYPE_VALUES, VALID_EDGE_STATUS_VALUES } from '../utils/mapUpdateValidationUtils';
import { pruneAndRefineMapConnections } from '../utils/mapPruningUtils'; // Import pruning utility
import { structuredCloneGameState } from '../utils/cloneUtils';
import { isServerOrClientError } from '../utils/aiErrorUtils';


/**
 * Calls the AI model for correction purposes.
 * @param prompt The prompt string.
 * @param systemInstruction The system instruction for the AI.
 * @returns A promise that resolves to the AI's response or null on error.
 */
const callCorrectionAI = async (prompt: string, systemInstruction: string): Promise<GenerateContentResponse | null> => {
  if (!isApiConfigured()) {
    console.error("callCorrectionAI (mapCorrectionService): API Key not configured.");
    return null;
  }
  try {
    const response = await dispatchAIRequest(
      [AUXILIARY_MODEL_NAME, GEMINI_MODEL_NAME],
      prompt,
      systemInstruction,
      {
        responseMimeType: "application/json",
        temperature: 0.7,
      }
    );
    return response;
  } catch (error) {
    console.error(`callCorrectionAI (mapCorrectionService): Error during AI call:`, error);
    if (isServerOrClientError(error)) {
      return null;
    }
    return null;
  }
};

/**
 * Parses the AI's text response into an AIMapUpdatePayload object.
 * @param responseText The raw text response from the AI.
 * @returns The parsed AIMapUpdatePayload or null if parsing fails.
 */
const parseChainCorrectionResponse = (responseText: string): AIMapUpdatePayload | null => {
  let jsonStr = responseText.trim();
  const fenceRegex = /^```(?:json)?\s*\n?(.*?)\n?\s*```$/s;
  const fenceMatch = jsonStr.match(fenceRegex);
  if (fenceMatch && fenceMatch[1]) {
    jsonStr = fenceMatch[1].trim();
  }
  try {
    const parsed = JSON.parse(jsonStr);
    if (parsed && (parsed.nodesToUpdate || parsed.edgesToUpdate || parsed.edgesToAdd)) {
      return parsed as AIMapUpdatePayload;
    }
    console.warn("Parsed chain correction JSON is empty or lacks key update fields:", parsed);
    return null;
  } catch (e) {
    console.error("Failed to parse chain correction JSON response from AI:", e);
    console.debug("Original chain correction response text:", responseText);
    return null;
  }
};

/**
 * Validates the AIMapUpdatePayload received from the AI for chain correction.
 */
const isValidChainCorrectionPayload = (
  payload: AIMapUpdatePayload,
  chains: MapChainToRefine[],
  currentMapData: MapData // Needed to resolve temporary leaf names
): boolean => {
  if (!payload) return false;

  const updatedLeafTempPlaceNames = new Set<string>();
  const updatedLeafNewNames: Record<string, string> = {};

  if (!Array.isArray(payload.nodesToUpdate)) {
    console.warn("isValidChainCorrectionPayload: nodesToUpdate is not an array.");
    return false;
  }

  for (const chain of chains) {
    const leafA_node_from_map = currentMapData.nodes.find(n => n.id === chain.leafA_Info.nodeId);
    const leafB_node_from_map = currentMapData.nodes.find(n => n.id === chain.leafB_Info.nodeId);

    if (!leafA_node_from_map || !leafB_node_from_map) {
        console.warn(`isValidChainCorrectionPayload: Could not find leaf node(s) from chain in currentMapData. LeafA ID: ${chain.leafA_Info.nodeId}, LeafB ID: ${chain.leafB_Info.nodeId}`);
        return false;
    }

    const tempPlaceNameA = leafA_node_from_map.placeName;
    const tempPlaceNameB = leafB_node_from_map.placeName;

    const nodeAUpdate = payload.nodesToUpdate.find(nu => nu.placeName === tempPlaceNameA);
    const nodeBUpdate = payload.nodesToUpdate.find(nu => nu.placeName === tempPlaceNameB);

    if (!nodeAUpdate || !nodeBUpdate) {
      console.warn(`isValidChainCorrectionPayload: Missing update for one or both leaf nodes in chain (TempNames: A: ${tempPlaceNameA}, B: ${tempPlaceNameB}).`);
      return false;
    }

    if (!nodeAUpdate.newData || typeof nodeAUpdate.newData.placeName !== 'string' || nodeAUpdate.newData.placeName.trim() === '' ||
        typeof nodeAUpdate.newData.description !== 'string' || nodeAUpdate.newData.description.trim() === '' ||
        !Array.isArray(nodeAUpdate.newData.aliases) || !nodeAUpdate.newData.aliases.every(a => typeof a === 'string') ||
        (nodeAUpdate.newData.status && !VALID_NODE_STATUS_VALUES.includes(nodeAUpdate.newData.status as MapNodeData['status']))
    ) {
      console.warn(`isValidChainCorrectionPayload: Invalid newData for leaf node (temp name ${tempPlaceNameA}).`, nodeAUpdate.newData);
      return false;
    }
    updatedLeafTempPlaceNames.add(tempPlaceNameA);
    updatedLeafNewNames[tempPlaceNameA] = nodeAUpdate.newData.placeName;

    if (!nodeBUpdate.newData || typeof nodeBUpdate.newData.placeName !== 'string' || nodeBUpdate.newData.placeName.trim() === '' ||
        typeof nodeBUpdate.newData.description !== 'string' || nodeBUpdate.newData.description.trim() === '' ||
        !Array.isArray(nodeBUpdate.newData.aliases) || !nodeBUpdate.newData.aliases.every(a => typeof a === 'string') ||
        (nodeBUpdate.newData.status && !VALID_NODE_STATUS_VALUES.includes(nodeBUpdate.newData.status as MapNodeData['status']))
    ) {
      console.warn(`isValidChainCorrectionPayload: Invalid newData for leaf node (temp name ${tempPlaceNameB}).`, nodeBUpdate.newData);
      return false;
    }
    updatedLeafTempPlaceNames.add(tempPlaceNameB);
    updatedLeafNewNames[tempPlaceNameB] = nodeBUpdate.newData.placeName;
  }

  const edgeUpdates = payload.edgesToUpdate || [];
  const edgeAdds = payload.edgesToAdd || [];
  let updatedEdgesCount = 0;

  for (const chain of chains) {
    const leafA_node_from_map = currentMapData.nodes.find(n => n.id === chain.leafA_Info.nodeId);
    const leafB_node_from_map = currentMapData.nodes.find(n => n.id === chain.leafB_Info.nodeId);
    if (!leafA_node_from_map || !leafB_node_from_map) continue;

    const tempPlaceNameA = leafA_node_from_map.placeName;
    const tempPlaceNameB = leafB_node_from_map.placeName;
    const expectedLeafANewName = updatedLeafNewNames[tempPlaceNameA];
    const expectedLeafBNewName = updatedLeafNewNames[tempPlaceNameB];

    if (!expectedLeafANewName || !expectedLeafBNewName) {
        console.warn(`isValidChainCorrectionPayload: Could not find new names for leaves in chain processing edges. TempA: ${tempPlaceNameA}, TempB: ${tempPlaceNameB}`);
        return false;
    }

    const edgeUpdate = edgeUpdates.find(eu =>
      (eu.sourcePlaceName === expectedLeafANewName && eu.targetPlaceName === expectedLeafBNewName) ||
      (eu.sourcePlaceName === expectedLeafBNewName && eu.targetPlaceName === expectedLeafANewName)
    );
    const edgeAdd = edgeAdds.find(ea =>
      (ea.sourcePlaceName === expectedLeafANewName && ea.targetPlaceName === expectedLeafBNewName) ||
      (ea.sourcePlaceName === expectedLeafBNewName && ea.targetPlaceName === expectedLeafANewName)
    );
    const relevantEdgeChange = edgeUpdate || edgeAdd;

    if (!relevantEdgeChange) {
      console.warn(`isValidChainCorrectionPayload: Missing edge update/add for chain connecting ${expectedLeafANewName} and ${expectedLeafBNewName}.`);
      return false;
    }
    const edgeData = edgeUpdate ? edgeUpdate.newData : (edgeAdd ? edgeAdd.data : null);
    if (!edgeData || typeof edgeData.type !== 'string' || !VALID_EDGE_TYPE_VALUES.includes(edgeData.type as MapEdgeData['type']) ||
        typeof edgeData.status !== 'string' || !VALID_EDGE_STATUS_VALUES.includes(edgeData.status as MapEdgeData['status']) ||
        (edgeData.description && typeof edgeData.description !== 'string')
    ) {
      console.warn(`isValidChainCorrectionPayload: Invalid edge data for chain connecting ${expectedLeafANewName} and ${expectedLeafBNewName}.`, edgeData);
      return false;
    }
    updatedEdgesCount++;
  }
  if (updatedEdgesCount !== chains.length) {
      console.warn(`isValidChainCorrectionPayload: Number of updated/added edges (${updatedEdgesCount}) does not match number of chains (${chains.length}).`);
      return false;
  }
  return true;
};

interface RefineAIServiceInternalResult {
    payload: AIMapUpdatePayload | null;
    prompt: string;
    rawResponse?: string;
    validationError?: string;
}

/**
 * Internal version of refineMapChainsWithAI_Service that returns more debug info.
 */
async function refineMapChainsWithAI_Internal(
  chainsToRefine: MapChainToRefine[],
  currentMapData: MapData,
  currentTheme: AdventureTheme,
  gameContext: { sceneDescription: string; gameLogTail: string[] }
): Promise<RefineAIServiceInternalResult> {
    let promptParts: string[] = ["You need to refine the following map chain(s) based on their context within the game world."];
    promptParts.push("For each chain, provide refined details for the two leaf nodes and the edge connecting them.");

    chainsToRefine.forEach((chain, index) => {
        const mainNodeA = currentMapData.nodes.find(n => n.id === chain.mainNodeA_Id);
        const mainNodeB = currentMapData.nodes.find(n => n.id === chain.mainNodeB_Id);
        const leafA = currentMapData.nodes.find(n => n.id === chain.leafA_Info.nodeId);
        const leafB = currentMapData.nodes.find(n => n.id === chain.leafB_Info.nodeId);
        const edgeBetweenLeaves = currentMapData.edges.find(e => e.id === chain.edgeBetweenLeaves_Id);

        if (!mainNodeA || !mainNodeB || !leafA || !leafB || !edgeBetweenLeaves) {
          console.warn(`Skipping chain ${index + 1} in prompt construction due to missing elements in mapData for AI Refinement.`);
          return;
        }
        promptParts.push(`\nChain ${index + 1} Context:`);
        promptParts.push(`- MainNodeA: "${mainNodeA.placeName}" (ID: ${mainNodeA.id}). Description: "${mainNodeA.data.description.substring(0, 70)}..."`);
        promptParts.push(`- MainNodeB: "${mainNodeB.placeName}" (ID: ${mainNodeB.id}). Description: "${mainNodeB.data.description.substring(0, 70)}..."`);
        promptParts.push(`- LeafA_CurrentDetails (child of MainNodeA): Update target 'placeName': "${leafA.placeName}". Original name suggestion: "${chain.leafA_Info.nameSuggestion || 'N/A'}". Current description: "${leafA.data.description}"`);
        promptParts.push(`- LeafB_CurrentDetails (child of MainNodeB): Update target 'placeName': "${leafB.placeName}". Original name suggestion: "${chain.leafB_Info.nameSuggestion || 'N/A'}". Current description: "${leafB.data.description}"`);
        promptParts.push(`- EdgeBetweenLeaves_CurrentDetails (ID: ${edgeBetweenLeaves.id}): Connects LeafA and LeafB. Current type: "${edgeBetweenLeaves.data.type}", status: "${edgeBetweenLeaves.data.status}", description: "${edgeBetweenLeaves.data.description || 'N/A'}"`);
        if (chain.originalDirectEdgeId) {
             promptParts.push(`- Note: This chain replaces a direct connection (original ID: ${chain.originalDirectEdgeId}) that existed between ${mainNodeA.placeName} and ${mainNodeB.placeName}.`);
        }
    });
    promptParts.push(`\nOverall Game Context:\n- Theme: "${currentTheme.name}" (Modifier: ${currentTheme.systemInstructionModifier})\n- Current Scene Excerpt: "${gameContext.sceneDescription.substring(0, 200)}..."\n- Recent Log Entries (last 3): "${gameContext.gameLogTail.slice(-3).join(' | ')}"`);
    promptParts.push(`\nTask:\nBased on ALL the provided context for EACH chain:\n1.  For LeafA and LeafB in EACH chain:\n    -   Propose a new, thematic 'placeName' (this goes into 'newData.placeName').\n    -   Write a new, fitting 'description'.\n    -   Suggest relevant 'aliases' (can be an empty array).\n    -   Ensure 'status' remains valid (e.g., 'discovered').\n2.  For the EdgeBetweenLeaves in EACH chain:\n    -   Propose a new 'type' (from valid types).\n    -   Propose a new 'status' (from valid statuses).\n    -   Write a new, fitting 'description'.\n\nRespond with a single AIMapUpdatePayload JSON object containing all these refinements for ALL provided chains.\nUse the current Leaf temporary names (provided as 'Update target placeName' for each leaf, e.g., "TempLeaf_XYZ_A") as the 'placeName' key in your 'nodesToUpdate' objects.\nFor 'edgesToUpdate', use the NEW REFINED NAMES of the leaf nodes as 'sourcePlaceName' and 'targetPlaceName'.`);
    const fullPrompt = promptParts.join('\n');

    if (promptParts.length <= 3) {
        return { payload: null, prompt: fullPrompt, validationError: "No valid chains to process." };
    }
    
    let lastRawResponse: string | undefined = undefined;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        const aiResponse = await callCorrectionAI(fullPrompt, MAP_CHAIN_CORRECTION_SYSTEM_INSTRUCTION);
        lastRawResponse = aiResponse?.text;

        if (aiResponse && aiResponse.text) {
            const parsedPayload = parseChainCorrectionResponse(aiResponse.text);
            if (parsedPayload && isValidChainCorrectionPayload(parsedPayload, chainsToRefine, currentMapData)) {
                return { payload: parsedPayload, prompt: fullPrompt, rawResponse: lastRawResponse };
            } else {
                 const validationError = `Parsed payload invalid or does not match schema. Payload: ${JSON.stringify(parsedPayload)}, Response Text: ${aiResponse.text}`;
                if (attempt === MAX_RETRIES - 1) return { payload: null, prompt: fullPrompt, rawResponse: lastRawResponse, validationError };
            }
        } else {
            const validationError = `No response or empty text from AI.`;
            if (attempt === MAX_RETRIES - 1) return { payload: null, prompt: fullPrompt, rawResponse: lastRawResponse, validationError };
        }
    }
    return { payload: null, prompt: fullPrompt, rawResponse: lastRawResponse, validationError: "Max retries reached for AI chain refinement." };
}


/**
 * Applies the AI's refinement payload to the map data.
 * @param currentMapData The map data (potentially modified by pruning).
 * @param chains The original chains that were sent for refinement.
 * @param refinementPayload The AI's payload with refinement suggestions.
 * @returns An object with the updated map data and a flag indicating if changes were made.
 */
function applyChainRefinementPayloadToMapData(
  currentMapData: MapData,
  chains: MapChainToRefine[],
  refinementPayload: AIMapUpdatePayload
): { updatedMapData: MapData; changesMade: boolean } {
  const workingMapData: MapData = structuredCloneGameState(currentMapData);
  let changesMadeOverall = false;

  chains.forEach(chain => {
    const leafANodeIndex = workingMapData.nodes.findIndex(n => n.id === chain.leafA_Info.nodeId);
    const leafBNodeIndex = workingMapData.nodes.findIndex(n => n.id === chain.leafB_Info.nodeId);

    if (leafANodeIndex === -1 || leafBNodeIndex === -1) {
      console.warn(`applyChainRefinementPayload: Leaf node(s) for chain (A: ${chain.leafA_Info.nodeId}, B: ${chain.leafB_Info.nodeId}) not found in workingMapData.`);
      return;
    }

    const tempPlaceNameA = workingMapData.nodes[leafANodeIndex].placeName;
    const tempPlaceNameB = workingMapData.nodes[leafBNodeIndex].placeName;

    const nodeAUpdateData = (refinementPayload.nodesToUpdate || []).find(upd => upd.placeName === tempPlaceNameA)?.newData;
    const nodeBUpdateData = (refinementPayload.nodesToUpdate || []).find(upd => upd.placeName === tempPlaceNameB)?.newData;

    let refinedLeafAName = tempPlaceNameA;
    let refinedLeafBName = tempPlaceNameB;
    let localChangesThisChain = false;

    if (nodeAUpdateData) {
      const nodeA = workingMapData.nodes[leafANodeIndex];
      if (nodeAUpdateData.placeName) nodeA.placeName = nodeAUpdateData.placeName;
      if (nodeAUpdateData.description) nodeA.data.description = nodeAUpdateData.description;
      if (nodeAUpdateData.aliases) nodeA.data.aliases = nodeAUpdateData.aliases;
      if (nodeAUpdateData.status) nodeA.data.status = nodeAUpdateData.status;
      refinedLeafAName = nodeA.placeName;
      localChangesThisChain = true;
    }

    if (nodeBUpdateData) {
      const nodeB = workingMapData.nodes[leafBNodeIndex];
      if (nodeBUpdateData.placeName) nodeB.placeName = nodeBUpdateData.placeName;
      if (nodeBUpdateData.description) nodeB.data.description = nodeBUpdateData.description;
      if (nodeBUpdateData.aliases) nodeB.data.aliases = nodeBUpdateData.aliases;
      if (nodeBUpdateData.status) nodeB.data.status = nodeBUpdateData.status;
      refinedLeafBName = nodeB.placeName;
      localChangesThisChain = true;
    }

    const edgeDataToApply = (refinementPayload.edgesToUpdate || []).find(eu =>
      (eu.sourcePlaceName === refinedLeafAName && eu.targetPlaceName === refinedLeafBName) ||
      (eu.sourcePlaceName === refinedLeafBName && eu.targetPlaceName === refinedLeafAName)
    )?.newData || (refinementPayload.edgesToAdd || []).find(ea =>
      (ea.sourcePlaceName === refinedLeafAName && ea.targetPlaceName === refinedLeafBName) ||
      (ea.sourcePlaceName === refinedLeafBName && ea.targetPlaceName === refinedLeafAName)
    )?.data;

    if (edgeDataToApply) {
      const edgeIndex = workingMapData.edges.findIndex(e => e.id === chain.edgeBetweenLeaves_Id);
      if (edgeIndex !== -1) {
        workingMapData.edges[edgeIndex].data = { ...workingMapData.edges[edgeIndex].data, ...edgeDataToApply };
        localChangesThisChain = true;
      } else {
        console.warn(`applyChainRefinementPayload: Edge with ID ${chain.edgeBetweenLeaves_Id} not found for update.`);
      }
    }
    if (localChangesThisChain) changesMadeOverall = true;
  });

  return { updatedMapData: workingMapData, changesMade: changesMadeOverall };
}


export interface MapCorrectionServiceResult {
  refinedMapData: MapData;
  mapDataChanged: boolean;
  debugInfo: {
    pruningDebugInfo?: { chainsToRefineCount: number };
    refinementDebugInfo?: {
      prompt?: string;
      rawResponse?: string;
      parsedPayload?: AIMapUpdatePayload;
      validationError?: string;
    };
  };
}

/**
 * Orchestrates map pruning and AI-based refinement of connection chains.
 * @param initialMapData The current map data before any corrections.
 * @param currentTheme The active adventure theme.
 * @param gameContext Contextual information like scene description and game log.
 * @returns A promise resolving to a MapCorrectionServiceResult.
 */
export async function executeMapCorrectionAndRefinement_Service(
  initialMapData: MapData,
  currentTheme: AdventureTheme,
  gameContext: { sceneDescription: string; gameLogTail: string[] }
): Promise<MapCorrectionServiceResult> {
  const pruningResult = pruneAndRefineMapConnections(initialMapData, currentTheme.name);
  let workingMapData = pruningResult.updatedMapData;
  const mapDataChangedByPruning = JSON.stringify(initialMapData) !== JSON.stringify(workingMapData);

  const debugInfo: MapCorrectionServiceResult['debugInfo'] = {
    pruningDebugInfo: { chainsToRefineCount: pruningResult.chainsToRefine.length }
  };
  let mapDataChangedByRefinement = false;

  if (pruningResult.chainsToRefine.length > 0) {
    const refinementServiceResult = await refineMapChainsWithAI_Internal(
        pruningResult.chainsToRefine, workingMapData, currentTheme, gameContext
    );

    debugInfo.refinementDebugInfo = {
        prompt: refinementServiceResult.prompt,
        rawResponse: refinementServiceResult.rawResponse,
        parsedPayload: refinementServiceResult.payload || undefined, // Ensure undefined if null
        validationError: refinementServiceResult.validationError
    };

    if (refinementServiceResult.payload) {
      const applyResult = applyChainRefinementPayloadToMapData(
        workingMapData,
        pruningResult.chainsToRefine,
        refinementServiceResult.payload
      );
      workingMapData = applyResult.updatedMapData;
      mapDataChangedByRefinement = applyResult.changesMade;
    }
  }

  return {
    refinedMapData: workingMapData,
    mapDataChanged: mapDataChangedByPruning || mapDataChangedByRefinement,
    debugInfo
  };
}
