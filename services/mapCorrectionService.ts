/**
 * @file mapCorrectionService.ts
 * @description Service for refining map structures (specifically chains of main nodes
 *              connected by temporary feature node(s)) using AI, and applying pruning logic.
 */

import {
  AIMapUpdatePayload,
  MapChainToRefine,
  MapData,
  AdventureTheme,
} from "../types";
import {
  AUXILIARY_MODEL_NAME,
  GEMINI_MODEL_NAME,
  MAX_RETRIES,
} from "../constants";
import { MAP_CHAIN_CORRECTION_SYSTEM_INSTRUCTION } from "../prompts/mapPrompts";
import {
  VALID_NODE_STATUS_VALUES,
  VALID_EDGE_TYPE_VALUES,
  VALID_EDGE_STATUS_VALUES,
} from "../utils/mapUpdateValidationUtils";
import { pruneAndRefineMapConnections } from "../utils/mapPruningUtils";
import { structuredCloneGameState } from "../utils/cloneUtils";
import { updateNodeId } from "../utils/mapIdUtils";
import { dispatchAIRequest } from "./modelDispatcher";
import { isServerOrClientError } from "../utils/aiErrorUtils";

/**
 * Parses the AI's text response into an AIMapUpdatePayload object.
 * @param responseText The raw text response from the AI.
 * @returns The parsed AIMapUpdatePayload or null if parsing fails.
 */
const parseChainCorrectionResponse = (
  responseText: string,
): AIMapUpdatePayload | null => {
  let jsonStr = responseText.trim();
  const fenceRegex = /^```(?:json)?\s*\n?(.*?)\n?\s*```$/s;
  const fenceMatch = jsonStr.match(fenceRegex);
  if (fenceMatch && fenceMatch[1]) {
    jsonStr = fenceMatch[1].trim();
  }
  try {
    const parsed: unknown = JSON.parse(jsonStr);
    if (
      parsed &&
      typeof parsed === "object" &&
      ("nodesToUpdate" in parsed ||
        "edgesToUpdate" in parsed ||
        "edgesToAdd" in parsed)
    ) {
      return parsed as AIMapUpdatePayload;
    }
    console.warn(
      "Parsed chain correction JSON is empty or lacks key update fields:",
      parsed,
    );
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
  currentMapData: MapData, // Needed to resolve temporary feature names
): boolean => {
  if (!payload) return false;

  const updatedFeatureTempPlaceNames = new Set<string>();
  const updatedFeatureNewNames: Record<string, string> = {};

  if (!Array.isArray(payload.nodesToUpdate)) {
    console.warn(
      "isValidChainCorrectionPayload: nodesToUpdate is not an array.",
    );
    return false;
  }

  for (const chain of chains) {
    const featureA_node_from_map = currentMapData.nodes.find(
      (n) => n.id === chain.featureA_Info.nodeId,
    );
    const featureB_node_from_map = currentMapData.nodes.find(
      (n) => n.id === chain.featureB_Info.nodeId,
    );

    if (!featureA_node_from_map || !featureB_node_from_map) {
      console.warn(
        `isValidChainCorrectionPayload: Could not find feature node(s) from chain in currentMapData. FeatureA ID: ${chain.featureA_Info.nodeId}, FeatureB ID: ${chain.featureB_Info.nodeId}`,
      );
      return false;
    }

    const tempFeatureNameA = featureA_node_from_map.placeName;
    const tempFeatureNameB = featureB_node_from_map.placeName;

    const nodeAUpdate = payload.nodesToUpdate.find(
      (nu) => nu.placeName === tempFeatureNameA,
    );
    const nodeBUpdate = payload.nodesToUpdate.find(
      (nu) => nu.placeName === tempFeatureNameB,
    );

    if (!nodeAUpdate || !nodeBUpdate) {
      console.warn(
        `isValidChainCorrectionPayload: Missing update for one or both feature node(s) in chain (TempNames: A: ${tempFeatureNameA}, B: ${tempFeatureNameB}).`,
      );
      return false;
    }

    if (
      !nodeAUpdate.newData ||
      typeof nodeAUpdate.newData.placeName !== "string" ||
      nodeAUpdate.newData.placeName.trim() === "" ||
      typeof nodeAUpdate.newData.description !== "string" ||
      nodeAUpdate.newData.description.trim() === "" ||
      !Array.isArray(nodeAUpdate.newData.aliases) ||
      !nodeAUpdate.newData.aliases.every((a) => typeof a === "string") ||
      (nodeAUpdate.newData.status &&
        !VALID_NODE_STATUS_VALUES.includes(nodeAUpdate.newData.status))
    ) {
      console.warn(
        `isValidChainCorrectionPayload: Invalid newData for feature node (temp name ${tempFeatureNameA}).`,
        nodeAUpdate.newData,
      );
      return false;
    }
    updatedFeatureTempPlaceNames.add(tempFeatureNameA);
    updatedFeatureNewNames[tempFeatureNameA] = nodeAUpdate.newData.placeName;

    if (
      !nodeBUpdate.newData ||
      typeof nodeBUpdate.newData.placeName !== "string" ||
      nodeBUpdate.newData.placeName.trim() === "" ||
      typeof nodeBUpdate.newData.description !== "string" ||
      nodeBUpdate.newData.description.trim() === "" ||
      !Array.isArray(nodeBUpdate.newData.aliases) ||
      !nodeBUpdate.newData.aliases.every((a) => typeof a === "string") ||
      (nodeBUpdate.newData.status &&
        !VALID_NODE_STATUS_VALUES.includes(nodeBUpdate.newData.status))
    ) {
      console.warn(
        `isValidChainCorrectionPayload: Invalid newData for feature node (temp name ${tempFeatureNameB}).`,
        nodeBUpdate.newData,
      );
      return false;
    }
  }

  const edgeUpdates = payload.edgesToUpdate || [];
  const edgeAdds = payload.edgesToAdd || [];
  let updatedEdgesCount = 0;

  for (const chain of chains) {
    const featureA_node_from_map = currentMapData.nodes.find(
      (n) => n.id === chain.featureA_Info.nodeId,
    );
    const featureB_node_from_map = currentMapData.nodes.find(
      (n) => n.id === chain.featureB_Info.nodeId,
    );
    if (!featureA_node_from_map || !featureB_node_from_map) continue;

    const tempFeatureNameA = featureA_node_from_map.placeName;
    const tempFeatureNameB = featureB_node_from_map.placeName;
    const expectedFeatureANewName = updatedFeatureNewNames[tempFeatureNameA];
    const expectedFeatureBNewName = updatedFeatureNewNames[tempFeatureNameB];

    if (!expectedFeatureANewName || !expectedFeatureBNewName) {
      console.warn(
        `isValidChainCorrectionPayload: Could not find new names for features in chain processing edges. TempA: ${tempFeatureNameA}, TempB: ${tempFeatureNameB}`,
      );
      return false;
    }

    const edgeUpdate = edgeUpdates.find(
      (eu) =>
        (eu.sourcePlaceName === expectedFeatureANewName &&
          eu.targetPlaceName === expectedFeatureBNewName) ||
        (eu.sourcePlaceName === expectedFeatureBNewName &&
          eu.targetPlaceName === expectedFeatureANewName),
    );
    const edgeAdd = edgeAdds.find(
      (ea) =>
        (ea.sourcePlaceName === expectedFeatureANewName &&
          ea.targetPlaceName === expectedFeatureBNewName) ||
        (ea.sourcePlaceName === expectedFeatureBNewName &&
          ea.targetPlaceName === expectedFeatureANewName),
    );
    const relevantEdgeChange = edgeUpdate || edgeAdd;

    if (!relevantEdgeChange) {
      console.warn(
        `isValidChainCorrectionPayload: Missing edge update/add for chain connecting ${expectedFeatureANewName} and ${expectedFeatureBNewName}.`,
      );
      return false;
    }
    const edgeData = edgeUpdate
      ? edgeUpdate.newData
      : edgeAdd
        ? edgeAdd.data
        : null;
    if (
      !edgeData ||
      typeof edgeData.type !== "string" ||
      !VALID_EDGE_TYPE_VALUES.includes(edgeData.type) ||
      typeof edgeData.status !== "string" ||
      !VALID_EDGE_STATUS_VALUES.includes(edgeData.status) ||
      (edgeData.description && typeof edgeData.description !== "string")
    ) {
      console.warn(
        `isValidChainCorrectionPayload: Invalid edge data for chain connecting ${expectedFeatureANewName} and ${expectedFeatureBNewName}.`,
        edgeData,
      );
      return false;
    }
    updatedEdgesCount++;
  }
  if (updatedEdgesCount !== chains.length) {
    console.warn(
      `isValidChainCorrectionPayload: Number of updated/added edges (${updatedEdgesCount}) does not match number of chains (${chains.length}).`,
    );
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

const buildChainRefinementPrompt = (
  chains: MapChainToRefine[],
  mapData: MapData,
  theme: AdventureTheme,
  context: { sceneDescription: string; gameLogTail: string[] },
): string => {
  const parts: string[] = [
    "You need to refine the following map chain(s) based on their context within the game world.",
    "For each chain, provide refined details for the two feature node(s) and the edge connecting them.",
  ];
  chains.forEach((chain, idx) => {
    const mainA = mapData.nodes.find((n) => n.id === chain.mainNodeA_Id);
    const mainB = mapData.nodes.find((n) => n.id === chain.mainNodeB_Id);
    const featA = mapData.nodes.find(
      (n) => n.id === chain.featureA_Info.nodeId,
    );
    const featB = mapData.nodes.find(
      (n) => n.id === chain.featureB_Info.nodeId,
    );
    const connecting = mapData.edges.find(
      (e) => e.id === chain.edgeBetweenFeatures_Id,
    );
    if (!mainA || !mainB || !featA || !featB || !connecting) {
      console.warn(
        `Skipping chain ${idx + 1} in prompt construction due to missing elements.`,
      );
      return;
    }
    parts.push(`\nChain ${idx + 1} Context:`);
    parts.push(
      `- MainNodeA: "${mainA.placeName}" (ID: ${mainA.id}). Description: "${mainA.data.description.substring(0, 70)}..."`,
    );
    parts.push(
      `- MainNodeB: "${mainB.placeName}" (ID: ${mainB.id}). Description: "${mainB.data.description.substring(0, 70)}..."`,
    );
    parts.push(
      `- FeatureA_CurrentDetails (child of MainNodeA): Update target 'placeName': "${featA.placeName}". Original name suggestion: "${chain.featureA_Info.nameSuggestion || "N/A"}". Current description: "${featA.data.description}"`,
    );
    parts.push(
      `- FeatureB_CurrentDetails (child of MainNodeB): Update target 'placeName': "${featB.placeName}". Original name suggestion: "${chain.featureB_Info.nameSuggestion || "N/A"}". Current description: "${featB.data.description}"`,
    );
    parts.push(
      `- EdgeBetweenFeatures_CurrentDetails (ID: ${connecting.id}): Connects FeatureA and FeatureB. Current type: "${connecting.data.type}", status: "${connecting.data.status}", description: "${connecting.data.description || "N/A"}"`,
    );
    if (chain.originalDirectEdgeId) {
      parts.push(
        `- Note: This chain replaces a direct connection (original ID: ${chain.originalDirectEdgeId}) that existed between ${mainA.placeName} and ${mainB.placeName}.`,
      );
    }
  });
  parts.push(
    `\nOverall Game Context:\n- Theme: "${theme.name}" (Modifier: ${theme.systemInstructionModifier})\n- Current Scene Excerpt: "${context.sceneDescription.substring(0, 200)}..."\n- Recent Log Entries (last 3): "${context.gameLogTail.slice(-3).join(" | ")}"`,
  );
  parts.push(
    `\nTask:\nBased on ALL the provided context for EACH chain:\n1.  For FeatureA and FeatureB in EACH chain:\n    -   Propose a new, thematic 'placeName' (this goes into 'newData.placeName').\n    -   Write a new, fitting 'description'.\n    -   Suggest relevant 'aliases' (can be an empty array).\n    -   Ensure 'status' remains valid (e.g., 'discovered').\n2.  For the EdgeBetweenFeatures in EACH chain:\n    -   Propose a new 'type' (from valid types).\n    -   Propose a new 'status' (from valid statuses).\n    -   Write a new, fitting 'description'.\n\nRespond with a single AIMapUpdatePayload JSON object containing all these refinements for ALL provided chains.\nUse the current Feature temporary names (provided as 'Update target placeName' for each feature, e.g., "TempFeature_XYZ_A") as the 'placeName' key in your 'nodesToUpdate' objects.\nFor 'edgesToUpdate', use the NEW REFINED NAMES of the feature node(s) as 'sourcePlaceName' and 'targetPlaceName'.`,
  );
  return parts.join("\n");
};

async function refineMapChainsWithAI(
  chainsToRefine: MapChainToRefine[],
  currentMapData: MapData,
  currentTheme: AdventureTheme,
  gameContext: { sceneDescription: string; gameLogTail: string[] },
): Promise<RefineAIServiceInternalResult> {
  const prompt = buildChainRefinementPrompt(
    chainsToRefine,
    currentMapData,
    currentTheme,
    gameContext,
  );
  if (chainsToRefine.length === 0) {
    return {
      payload: null,
      prompt,
      validationError: "No valid chains to process.",
    };
  }
  let lastRawResponse: string | undefined;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const response = await dispatchAIRequest(
        [AUXILIARY_MODEL_NAME, GEMINI_MODEL_NAME],
        prompt,
        MAP_CHAIN_CORRECTION_SYSTEM_INSTRUCTION,
        { responseMimeType: "application/json", temperature: 0.7 },
      );
      lastRawResponse = response.text;
      const parsedPayload = parseChainCorrectionResponse(response.text ?? "");
      if (
        parsedPayload &&
        isValidChainCorrectionPayload(
          parsedPayload,
          chainsToRefine,
          currentMapData,
        )
      ) {
        return { payload: parsedPayload, prompt, rawResponse: lastRawResponse };
      }
      const validationError = `Parsed payload invalid or does not match schema. Payload: ${JSON.stringify(parsedPayload)}, Response Text: ${response.text}`;
      if (attempt === MAX_RETRIES - 1)
        return {
          payload: null,
          prompt,
          rawResponse: lastRawResponse,
          validationError,
        };
    } catch (err) {
      lastRawResponse = err instanceof Error ? err.message : String(err);
      if (!isServerOrClientError(err)) throw err;
      if (attempt === MAX_RETRIES - 1)
        return {
          payload: null,
          prompt,
          rawResponse: lastRawResponse,
          validationError: "AI request failed.",
        };
    }
  }
  return {
    payload: null,
    prompt,
    rawResponse: lastRawResponse,
    validationError: "Max retries reached for AI chain refinement.",
  };
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
  refinementPayload: AIMapUpdatePayload,
): { updatedMapData: MapData; changesMade: boolean } {
  const workingMapData: MapData = structuredCloneGameState(currentMapData);
  let changesMadeOverall = false;

  chains.forEach((chain) => {
    const featureANodeIndex = workingMapData.nodes.findIndex(
      (n) => n.id === chain.featureA_Info.nodeId,
    );
    const featureBNodeIndex = workingMapData.nodes.findIndex(
      (n) => n.id === chain.featureB_Info.nodeId,
    );

    if (featureANodeIndex === -1 || featureBNodeIndex === -1) {
      console.warn(
        `applyChainRefinementPayload: Feature node(s) for chain (A: ${chain.featureA_Info.nodeId}, B: ${chain.featureB_Info.nodeId}) not found in workingMapData.`,
      );
      return;
    }

    const tempFeatureNameA = workingMapData.nodes[featureANodeIndex].placeName;
    const tempFeatureNameB = workingMapData.nodes[featureBNodeIndex].placeName;

    const nodeAUpdateData = (refinementPayload.nodesToUpdate || []).find(
      (upd) => upd.placeName === tempFeatureNameA,
    )?.newData;
    const nodeBUpdateData = (refinementPayload.nodesToUpdate || []).find(
      (upd) => upd.placeName === tempFeatureNameB,
    )?.newData;

    let refinedFeatureAName = tempFeatureNameA;
    let refinedFeatureBName = tempFeatureNameB;
    let localChangesThisChain = false;

    if (nodeAUpdateData) {
      const nodeA = workingMapData.nodes[featureANodeIndex];
      if (nodeAUpdateData.placeName)
        nodeA.placeName = nodeAUpdateData.placeName;
      if (nodeAUpdateData.description)
        nodeA.data.description = nodeAUpdateData.description;
      if (nodeAUpdateData.aliases) nodeA.data.aliases = nodeAUpdateData.aliases;
      if (nodeAUpdateData.status) nodeA.data.status = nodeAUpdateData.status;
      updateNodeId(workingMapData, nodeA.id, nodeA.placeName);
      refinedFeatureAName = nodeA.placeName;
      localChangesThisChain = true;
    }

    if (nodeBUpdateData) {
      const nodeB = workingMapData.nodes[featureBNodeIndex];
      if (nodeBUpdateData.placeName)
        nodeB.placeName = nodeBUpdateData.placeName;
      if (nodeBUpdateData.description)
        nodeB.data.description = nodeBUpdateData.description;
      if (nodeBUpdateData.aliases) nodeB.data.aliases = nodeBUpdateData.aliases;
      if (nodeBUpdateData.status) nodeB.data.status = nodeBUpdateData.status;
      updateNodeId(workingMapData, nodeB.id, nodeB.placeName);
      refinedFeatureBName = nodeB.placeName;
      localChangesThisChain = true;
    }

    const edgeDataToApply =
      (refinementPayload.edgesToUpdate || []).find(
        (eu) =>
          (eu.sourcePlaceName === refinedFeatureAName &&
            eu.targetPlaceName === refinedFeatureBName) ||
          (eu.sourcePlaceName === refinedFeatureBName &&
            eu.targetPlaceName === refinedFeatureAName),
      )?.newData ||
      (refinementPayload.edgesToAdd || []).find(
        (ea) =>
          (ea.sourcePlaceName === refinedFeatureAName &&
            ea.targetPlaceName === refinedFeatureBName) ||
          (ea.sourcePlaceName === refinedFeatureBName &&
            ea.targetPlaceName === refinedFeatureAName),
      )?.data;

    if (edgeDataToApply) {
      const edgeIndex = workingMapData.edges.findIndex(
        (e) => e.id === chain.edgeBetweenFeatures_Id,
      );
      if (edgeIndex !== -1) {
        workingMapData.edges[edgeIndex].data = {
          ...workingMapData.edges[edgeIndex].data,
          ...edgeDataToApply,
        };
        localChangesThisChain = true;
      } else {
        console.warn(
          `applyChainRefinementPayload: Edge with ID ${chain.edgeBetweenFeatures_Id} not found for update.`,
        );
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
  gameContext: { sceneDescription: string; gameLogTail: string[] },
): Promise<MapCorrectionServiceResult> {
  const pruningResult = pruneAndRefineMapConnections(
    initialMapData,
    currentTheme.name,
  );
  let workingMapData = pruningResult.updatedMapData;
  const mapDataChangedByPruning =
    JSON.stringify(initialMapData) !== JSON.stringify(workingMapData);

  const debugInfo: MapCorrectionServiceResult["debugInfo"] = {
    pruningDebugInfo: {
      chainsToRefineCount: pruningResult.chainsToRefine.length,
    },
  };
  let mapDataChangedByRefinement = false;

  if (pruningResult.chainsToRefine.length > 0) {
    const refinementServiceResult = await refineMapChainsWithAI(
      pruningResult.chainsToRefine,
      workingMapData,
      currentTheme,
      gameContext,
    );

    debugInfo.refinementDebugInfo = {
      prompt: refinementServiceResult.prompt,
      rawResponse: refinementServiceResult.rawResponse,
      parsedPayload: refinementServiceResult.payload || undefined, // Ensure undefined if null
      validationError: refinementServiceResult.validationError,
    };

    if (refinementServiceResult.payload) {
      const applyResult = applyChainRefinementPayloadToMapData(
        workingMapData,
        pruningResult.chainsToRefine,
        refinementServiceResult.payload,
      );
      workingMapData = applyResult.updatedMapData;
      mapDataChangedByRefinement = applyResult.changesMade;
    }
  }

  return {
    refinedMapData: workingMapData,
    mapDataChanged: mapDataChangedByPruning || mapDataChangedByRefinement,
    debugInfo,
  };
}
