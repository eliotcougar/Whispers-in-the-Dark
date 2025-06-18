/**
 * @file services/corrections/placeDetails.ts
 * @description Helpers for correcting or inferring map node details.
 */

import { AdventureTheme, MapNode, MapNodeData, MapEdge, MinimalModelCallRecord } from '../../types';
import {
  MAX_RETRIES,
  NODE_DESCRIPTION_INSTRUCTION,
  ALIAS_INSTRUCTION,
} from '../../constants';
import { formatKnownPlacesForPrompt } from '../../utils/promptFormatters/map';
import { CORRECTION_TEMPERATURE, LOADING_REASON_UI_MAP } from '../../constants';
import { dispatchAIRequest } from '../modelDispatcher';
import { addProgressSymbol } from '../../utils/loadingProgress';
import { extractJsonFromFence, safeParseJson } from '../../utils/jsonUtils';
import { retryAiCall } from '../../utils/retry';
import { isApiConfigured } from '../apiClient';
import {
  VALID_NODE_TYPE_VALUES,
  MINIMAL_MODEL_NAME,
  AUXILIARY_MODEL_NAME,
  GEMINI_MODEL_NAME,
} from '../../constants';
import { NODE_TYPE_SYNONYMS, createHeuristicRegexes } from '../../utils/mapSynonyms';
import { MAP_NODE_TYPE_GUIDE } from '../../prompts/helperPrompts';

export const fetchCorrectedLocalPlace_Service = async (
  currentSceneDescription: string,
  currentTheme: AdventureTheme,
  knownMapNodes: Array<MapNode>,
  localTime: string | null,
  localEnvironment: string | null,
): Promise<string | null> => {
  if (!isApiConfigured()) {
    console.error('fetchCorrectedLocalPlace_Service: API Key not configured.');
    return null;
  }

  const knownPlacesContextForPrompt =
    knownMapNodes.length > 0
      ? 'Known map locations in this theme that might be relevant: ' +
        formatKnownPlacesForPrompt(knownMapNodes, true)
      : 'No specific map locations are currently known for this theme.';

  const prompt = `
Role: You are an AI assistant inferring a player's specific location, which is called "localPlace" in the game.
Task: Determine the most logical "localPlace" based on the provided context. This "localPlace" should be a concise descriptive string.

Context for Inference:
- Current Scene Description (primary source for inference): "${currentSceneDescription}"
- Current Theme: "${currentTheme.name}" (Theme Guidance: ${currentTheme.systemInstructionModifier})
- Current Local Time: "${localTime || 'Unknown'}"
- Current Local Environment: "${localEnvironment || 'Undetermined'}"
- ${knownPlacesContextForPrompt}

Guidance for "localPlace":
- It's a concise string describing the player's specific position within the scene, relative to one of the Known map locations.
- If the location is truly unclear from the scene, use "Undetermined Location".

Respond ONLY with the inferred "localPlace" as a single string.`;

  const systemInstruction = `Infer a player's "localPlace" based on narrative context. The "localPlace" should be a concise descriptive string. Respond ONLY with the string value.`;

  return retryAiCall<string>(async attempt => {
    try {
      addProgressSymbol(LOADING_REASON_UI_MAP['correction'].icon);
      const { response } = await dispatchAIRequest({
        modelNames: [MINIMAL_MODEL_NAME, AUXILIARY_MODEL_NAME, GEMINI_MODEL_NAME],
        prompt,
        systemInstruction,
        temperature: CORRECTION_TEMPERATURE,
        label: 'Corrections',
      });
      const aiResponse = response.text?.trim() ?? null;
      if (aiResponse !== null && aiResponse.trim().length > 0) {
        const correctedLocalPlace = aiResponse.trim();
        console.warn(
          `fetchCorrectedLocalPlace_Service: Returned corrected localPlace `,
          correctedLocalPlace,
          '.'
        );
        return { result: correctedLocalPlace };
      }
      console.warn(
        `fetchCorrectedLocalPlace_Service (Attempt ${attempt + 1}/$${MAX_RETRIES + 1}): AI call failed for localPlace. Received: null`,
      );
    } catch (error) {
      console.error(
        `fetchCorrectedLocalPlace_Service error (Attempt ${attempt + 1}/$${MAX_RETRIES + 1}):`,
        error,
      );
      throw error;
    }
    return { result: null };
  });
};

export const fetchCorrectedPlaceDetails_Service = async (
  malformedMapNodePayloadString: string,
  logMessageContext: string | undefined,
  sceneDescriptionContext: string | undefined,
  currentTheme: AdventureTheme,
): Promise<{ name: string; description: string; aliases?: Array<string> } | null> => {
  if (!isApiConfigured()) {
    console.error('fetchCorrectedPlaceDetails_Service: API Key not configured.');
    return null;
  }

  let originalPlaceNameFromMalformed = 'Not specified or unparseable';
  try {
    const malformedObj = safeParseJson<Record<string, unknown>>(
      malformedMapNodePayloadString,
    );
    if (malformedObj && typeof malformedObj.name === 'string') {
      originalPlaceNameFromMalformed = `"${malformedObj.name}"`;
    } else if (
      typeof malformedMapNodePayloadString === 'string' &&
      !malformedMapNodePayloadString.startsWith('{')
    ) {
      originalPlaceNameFromMalformed = `"${malformedMapNodePayloadString}"`;
    }
  } catch {
    /* ignore */
  }

  const prompt = `
Role: You are an AI assistant correcting or completing a JSON payload for a map location (MapNode) in a text adventure game. The Map AI was supposed to provide full details but might have failed.
Task: Reconstruct the map location details ("name", "description", "aliases") based on narrative context and potentially incomplete/malformed data.

Malformed/Incomplete Map Location Payload (from Map AI):
\`\`\`json
${malformedMapNodePayloadString}
\`\`\`
(This might just be a name string like ${originalPlaceNameFromMalformed}, or an object missing required fields like 'description' or 'aliases'.)

Narrative Context:
- Log Message: "${logMessageContext || 'Not specified'}"
- Scene Description: "${sceneDescriptionContext || 'Not specified'}"
- Theme Guidance: "${currentTheme.systemInstructionModifier || 'General adventure theme.'}"

Required JSON Structure for corrected map location details:
{
  "name": "string",
  "description": "string", // ${NODE_DESCRIPTION_INSTRUCTION}
  "aliases": ["string"] // ${ALIAS_INSTRUCTION}
}

Respond ONLY with the single, complete, corrected JSON object.`;

  const systemInstruction = `Correct or complete a JSON payload for a map location. Ensure "name" (string, non-empty), "description" (${NODE_DESCRIPTION_INSTRUCTION}), and "aliases" (${ALIAS_INSTRUCTION}, array, can be empty) are provided. Adhere strictly to the JSON format.`;

  return retryAiCall<{ name: string; description: string; aliases?: Array<string> }>(
    async attempt => {
      try {
        addProgressSymbol(LOADING_REASON_UI_MAP['correction'].icon);
        const { response } = await dispatchAIRequest({
          modelNames: [AUXILIARY_MODEL_NAME, GEMINI_MODEL_NAME],
          prompt,
          systemInstruction,
          responseMimeType: 'application/json',
          temperature: CORRECTION_TEMPERATURE,
          label: 'Corrections',
        });
        const aiResponse = safeParseJson<{
          name: string;
          description: string;
          aliases?: Array<string>;
        }>(extractJsonFromFence(response.text ?? ''));
        if (
          aiResponse &&
          typeof aiResponse.name === 'string' &&
          aiResponse.name.trim() !== '' &&
          typeof aiResponse.description === 'string' &&
          aiResponse.description.trim() !== '' &&
          Array.isArray(aiResponse.aliases) &&
          aiResponse.aliases.every((a): a is string => typeof a === 'string')
        ) {
          return { result: aiResponse };
        }
        console.warn(
          `fetchCorrectedPlaceDetails_Service (Attempt ${attempt + 1}/$${MAX_RETRIES + 1}): Corrected map location payload invalid. Response:`,
          aiResponse,
        );
      } catch (error) {
        console.error(
          `fetchCorrectedPlaceDetails_Service error (Attempt ${attempt + 1}/$${MAX_RETRIES + 1}):`,
          error,
        );
        throw error;
      }
      return { result: null };
    },
  );
};

export const fetchFullPlaceDetailsForNewMapNode_Service = async (
  mapNodePlaceName: string,
  logMessageContext: string | undefined,
  sceneDescriptionContext: string | undefined,
  currentTheme: AdventureTheme,
): Promise<{ name: string; description: string; aliases?: Array<string> } | null> => {
  if (!isApiConfigured()) {
    console.error('fetchFullPlaceDetailsForNewMapNode_Service: API Key not configured.');
    return null;
  }

  const prompt = `
Role: You are an AI assistant that generates detailed information for a new game map location (a main MapNode) that has just been added to the game map. The Map AI should have provided these details, but this is a fallback.
Task: Given the name of this new map location and the current narrative context, provide a suitable description and aliases for it. The provided 'Map Location Name to Detail' is fixed and MUST be used as the 'name' in your JSON response.

Map Location Name to Detail: "${mapNodePlaceName}"

Narrative Context:
- Log Message: "${logMessageContext || 'Not specified'}"
- Scene Description: "${sceneDescriptionContext || 'Not specified'}"
- Theme Guidance: "${currentTheme.systemInstructionModifier || 'General adventure theme.'}"

Required JSON Structure:
{
  "name": "${mapNodePlaceName}",
  "description": "string", // ${NODE_DESCRIPTION_INSTRUCTION}
  "aliases": ["string"] // ${ALIAS_INSTRUCTION}
}

Respond ONLY with the single, complete JSON object.`;

  const systemInstruction = `Generate detailed JSON for a new game map location. The 'name' field in the output is predetermined and MUST match the input. Focus on creating ${NODE_DESCRIPTION_INSTRUCTION} and aliases (${ALIAS_INSTRUCTION}, array, can be empty). Adhere strictly to the JSON format.`;

  return retryAiCall<{ name: string; description: string; aliases?: Array<string> }>(
    async attempt => {
      try {
        addProgressSymbol(LOADING_REASON_UI_MAP['correction'].icon);
        const { response } = await dispatchAIRequest({
          modelNames: [AUXILIARY_MODEL_NAME, GEMINI_MODEL_NAME],
          prompt,
          systemInstruction,
          responseMimeType: 'application/json',
          temperature: CORRECTION_TEMPERATURE,
          label: 'Corrections',
        });
        const aiResponse = safeParseJson<{
          name: string;
          description: string;
          aliases?: Array<string>;
        }>(extractJsonFromFence(response.text ?? ''));
        if (
          aiResponse &&
          typeof aiResponse.name === 'string' &&
          aiResponse.name === mapNodePlaceName &&
          typeof aiResponse.description === 'string' &&
          aiResponse.description.trim() !== '' &&
          Array.isArray(aiResponse.aliases) &&
          aiResponse.aliases.every((alias): alias is string => typeof alias === 'string')
        ) {
          return { result: aiResponse };
        }
        console.warn(
          `fetchFullPlaceDetailsForNewMapNode_Service (Attempt ${attempt + 1}/$${MAX_RETRIES + 1}): Corrected map location payload invalid or name mismatch for "${mapNodePlaceName}". Response:`,
          aiResponse,
        );
      } catch (error) {
        console.error(
          `fetchFullPlaceDetailsForNewMapNode_Service error (Attempt ${attempt + 1}/$${MAX_RETRIES + 1}):`,
          error,
        );
        throw error;
      }
      return { result: null };
    },
  );
};

export const fetchCorrectedNodeType_Service = async (
  nodeInfo: { placeName: string; nodeType?: string; description?: string },
): Promise<NonNullable<MapNodeData['nodeType']> | null> => {
  const synonyms = NODE_TYPE_SYNONYMS as Record<string, MapNodeData['nodeType'] | undefined>;

  if (nodeInfo.nodeType) {
      const normalized =
        synonyms[nodeInfo.nodeType.toLowerCase()] ?? nodeInfo.nodeType.toLowerCase();
    if ((VALID_NODE_TYPE_VALUES as ReadonlyArray<string>).includes(normalized)) {
      return normalized as MapNodeData['nodeType'];
    }
  }

  const heuristics = createHeuristicRegexes(
    NODE_TYPE_SYNONYMS,
    VALID_NODE_TYPE_VALUES,
  );

  for (const [regex, type] of heuristics) {
    if (
      regex.test(nodeInfo.placeName) ||
      (nodeInfo.description && regex.test(nodeInfo.description))
    ) {
      return type;
    }
  }

  if (!isApiConfigured()) {
    console.error('fetchCorrectedNodeType_Service: API Key not configured.');
    return null;
  }

  const prompt = `Determine the most appropriate nodeType for a map location in a text adventure game.
${MAP_NODE_TYPE_GUIDE}
Location Name: "${nodeInfo.placeName}"
Description: "${nodeInfo.description || 'No description provided.'}"
Valid node types: ${VALID_NODE_TYPE_VALUES.join(', ')}
Respond ONLY with the single node type.`;

  const systemInstruction = `Infer a map node's type. Answer with one of: ${VALID_NODE_TYPE_VALUES.join(', ')}.`;
  return retryAiCall<NonNullable<MapNodeData['nodeType']>>(async attempt => {
    try {
      addProgressSymbol(LOADING_REASON_UI_MAP['correction'].icon);
      const { response } = await dispatchAIRequest({
        modelNames: [MINIMAL_MODEL_NAME, AUXILIARY_MODEL_NAME, GEMINI_MODEL_NAME],
        prompt,
        systemInstruction,
        temperature: CORRECTION_TEMPERATURE,
        label: 'Corrections',
      });
      const aiResponse = response.text?.trim();
      if (aiResponse) {
        const cleaned = aiResponse.trim().toLowerCase();
        const mapped = synonyms[cleaned] ?? cleaned;
        if ((VALID_NODE_TYPE_VALUES as ReadonlyArray<string>).includes(mapped)) {
          return { result: mapped as MapNodeData['nodeType'] };
        }
      }
    } catch (error) {
      console.error(
        `fetchCorrectedNodeType_Service error (Attempt ${attempt + 1}/$${MAX_RETRIES + 1}):`,
        error,
      );
      throw error;
    }
    return { result: null };
  });
};


export const fetchLikelyParentNode_Service = async (
  proposedNode: {
    placeName: string;
    description?: string;
    nodeType?: string;
    status?: string;
    aliases?: Array<string>;
  },
  context: {
    sceneDescription: string;
    logMessage: string | undefined;
    localPlace: string;
    currentTheme: AdventureTheme;
    currentMapNodeId: string | null;
    themeNodes: Array<MapNode>;
    themeEdges: Array<MapEdge>;
  },
  debugLog?: Array<MinimalModelCallRecord>,
): Promise<string | null> => {
  if (!isApiConfigured()) {
    console.error('fetchLikelyParentNode_Service: API Key not configured.');
    return null;
  }

  const currentNode =
    context.currentMapNodeId &&
    context.themeNodes.find(n => n.id === context.currentMapNodeId);

  const nodeMap = new Map<string, MapNode>();
  context.themeNodes.forEach(n => nodeMap.set(n.id, n));

  const adjacency = new Map<string, Set<string>>();
  context.themeNodes.forEach(n => adjacency.set(n.id, new Set<string>()));
  context.themeEdges.forEach(e => {
    if (!adjacency.has(e.sourceNodeId)) adjacency.set(e.sourceNodeId, new Set());
    if (!adjacency.has(e.targetNodeId)) adjacency.set(e.targetNodeId, new Set());
    const setA = adjacency.get(e.sourceNodeId);
    if (setA) setA.add(e.targetNodeId);
    const setB = adjacency.get(e.targetNodeId);
    if (setB) setB.add(e.sourceNodeId);
  });

  const nodeLines = context.themeNodes
    .map(n => `- ${n.id} ("${n.placeName}")`)
    .join('\n');

  const edgeLines = context.themeEdges
    .map(e => `${e.id} ${e.sourceNodeId}->${e.targetNodeId}`)
    .join('\n');

  const prompt = `Infer the best parent for a new map node in a text adventure game.
Map Node: "${proposedNode.placeName}" (${proposedNode.nodeType || 'feature'})
Scene: "${context.sceneDescription}"
Current location: ${context.localPlace}
Current Map Node: ${currentNode ? currentNode.placeName : 'Unknown'}
Possible Nodes:\n${nodeLines}
Edges:\n${edgeLines}
Respond ONLY with the name or id of the best parent node, or "Universe" if none.`;

  const systemInstruction = `Choose the most logical parent node name or id for the provided Map Node. If none is suitable use "Universe".`;

  return retryAiCall<string>(async attempt => {
    try {
      addProgressSymbol(LOADING_REASON_UI_MAP['correction'].icon);
      const { response } = await dispatchAIRequest({
        modelNames: [MINIMAL_MODEL_NAME, AUXILIARY_MODEL_NAME, GEMINI_MODEL_NAME],
        prompt,
        systemInstruction,
        temperature: CORRECTION_TEMPERATURE,
        label: 'Corrections',
        debugLog,
      });
      const aiResponse = response.text?.trim();
      if (aiResponse) {
        return { result: aiResponse.trim() };
      }
    } catch (error) {
      console.error(
        `fetchLikelyParentNode_Service error (Attempt ${attempt + 1}/$${MAX_RETRIES + 1}):`,
        error,
      );
      throw error;
    }
    return { result: null };
  });
};

export const fetchCorrectedNodeIdentifier_Service = async (
  malformedIdentifier: string,
  context: {
    themeNodes: Array<MapNode>;
    currentLocationId: string | null;
  },
  debugLog?: Array<MinimalModelCallRecord>,
): Promise<string | null> => {
  if (!isApiConfigured()) {
    console.error('fetchCorrectedNodeIdentifier_Service: API Key not configured.');
    return null;
  }

  const nodeList = context.themeNodes.map(n => `- ${n.id} ("${n.placeName}")`).join('\n');

  const prompt = `A different AI referred to a map location using an incorrect identifier: "${malformedIdentifier}".
Known map nodes in the current theme:\n${nodeList}\nChoose the most likely intended node ID from the list above. Respond with an empty string if none match.`;

  const systemInstruction = 'Respond ONLY with a single node ID from the list or an empty string.';

  return retryAiCall<string>(async attempt => {
    try {
      addProgressSymbol(LOADING_REASON_UI_MAP['correction'].icon);
      const { response } = await dispatchAIRequest({
        modelNames: [MINIMAL_MODEL_NAME, AUXILIARY_MODEL_NAME, GEMINI_MODEL_NAME],
        prompt,
        systemInstruction,
        temperature: CORRECTION_TEMPERATURE,
        label: 'Corrections',
        debugLog,
      });
      const resp = response.text?.trim();
      if (resp) {
        const cleaned = resp.trim();
        const match = context.themeNodes.find(n => n.id === cleaned);
        if (match) return { result: match.id };
        const byName = context.themeNodes.find(n => n.placeName === cleaned);
        if (byName) return { result: byName.id };
      }
    } catch (error) {
      console.error(
        `fetchCorrectedNodeIdentifier_Service error (Attempt ${attempt + 1}/$${MAX_RETRIES + 1}):`,
        error,
      );
      throw error;
    }
    return { result: null };
  });
};

