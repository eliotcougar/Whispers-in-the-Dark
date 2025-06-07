/**
 * @file services/corrections/map.ts
 * @description Correction helpers for map and location related data.
 */
import { AdventureTheme, MapNode, MapNodeData, MapEdgeData, MapEdge, MinimalModelCallRecord } from '../../types';
import {
  MAX_RETRIES,
  NODE_DESCRIPTION_INSTRUCTION,
  ALIAS_INSTRUCTION,
} from '../../constants';
import { formatKnownPlacesForPrompt } from '../../utils/promptFormatters/map';
import { callCorrectionAI, callMinimalCorrectionAI } from './base';
import { isApiConfigured } from '../apiClient';
import { VALID_NODE_TYPE_VALUES, VALID_EDGE_TYPE_VALUES } from '../../constants';
import {
  NODE_TYPE_SYNONYMS,
  EDGE_TYPE_SYNONYMS,
  createHeuristicRegexes,
} from '../../utils/mapSynonyms';
import { MAP_NODE_TYPE_GUIDE, MAP_EDGE_TYPE_GUIDE } from '../../prompts/helperPrompts';

/**
 * Infers or corrects the player's current local place string.
 */
export const fetchCorrectedLocalPlace_Service = async (
  currentSceneDescription: string,
  currentTheme: AdventureTheme,
  knownMapNodes: MapNode[],
  localTime: string | null,
  localEnvironment: string | null
): Promise<string | null> => {
  if (!isApiConfigured()) {
    console.error('fetchCorrectedLocalPlace_Service: API Key not configured.');
    return null;
  }

  const knownPlacesContextForPrompt = knownMapNodes.length > 0
    ? 'Known map locations in this theme that might be relevant: ' + formatKnownPlacesForPrompt(knownMapNodes, true)
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

  const systemInstructionForFix = `Infer a player's "localPlace" based on narrative context. The "localPlace" should be a concise descriptive string. Respond ONLY with the string value.`;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const correctedPlaceResponse = await callMinimalCorrectionAI(prompt, systemInstructionForFix);
    if (correctedPlaceResponse !== null && correctedPlaceResponse.trim().length > 0) {
      const correctedPlace = correctedPlaceResponse.trim();
      console.warn(`fetchCorrectedLocalPlace_Service: Returned corrected localPlace `, correctedPlace, `.`);
      return correctedPlace;
    } else {
      console.warn(`fetchCorrectedLocalPlace_Service (Attempt ${attempt + 1}/${MAX_RETRIES + 1}): AI call failed for localPlace. Received: null`);
    }
    if (attempt === MAX_RETRIES) return null;
  }
  return null;
};

/**
 * Corrects or completes map node details such as description or aliases.
 */
export const fetchCorrectedPlaceDetails_Service = async (
  malformedMapNodePayloadString: string,
  logMessageContext: string | undefined,
  sceneDescriptionContext: string | undefined,
  currentTheme: AdventureTheme
): Promise<{ name: string; description: string; aliases?: string[] } | null> => {
  if (!isApiConfigured()) {
    console.error('fetchCorrectedPlaceDetails_Service: API Key not configured.');
    return null;
  }

  let originalPlaceNameFromMalformed = 'Not specified or unparseable';
  try {
    const malformedObj: Record<string, unknown> =
      JSON.parse(malformedMapNodePayloadString) as Record<string, unknown>;
    if (malformedObj && typeof malformedObj.name === 'string') {
      originalPlaceNameFromMalformed = `"${malformedObj.name}"`;
    } else if (typeof malformedMapNodePayloadString === 'string' && !malformedMapNodePayloadString.startsWith('{')) {
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

  const systemInstructionForFix = `Correct or complete a JSON payload for a map location. Ensure "name" (string, non-empty), "description" (${NODE_DESCRIPTION_INSTRUCTION}), and "aliases" (${ALIAS_INSTRUCTION}, array, can be empty) are provided. Adhere strictly to the JSON format.`;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const correctedPayload = await callCorrectionAI<{ name: string; description: string; aliases?: string[] }>(prompt, systemInstructionForFix);
    if (
      correctedPayload &&
      typeof correctedPayload.name === 'string' && correctedPayload.name.trim() !== '' &&
      typeof correctedPayload.description === 'string' && correctedPayload.description.trim() !== '' &&
      Array.isArray(correctedPayload.aliases) && correctedPayload.aliases.every((a): a is string => typeof a === 'string')
    ) {
      return correctedPayload;
    } else {
      console.warn(`fetchCorrectedPlaceDetails_Service (Attempt ${attempt + 1}/${MAX_RETRIES + 1}): Corrected map location payload invalid. Response:`, correctedPayload);
    }
    if (attempt === MAX_RETRIES) return null;
  }
  return null;
};

/**
 * Fetches full details for a newly introduced map node name.
 */
export const fetchFullPlaceDetailsForNewMapNode_Service = async (
  mapNodePlaceName: string,
  logMessageContext: string | undefined,
  sceneDescriptionContext: string | undefined,
  currentTheme: AdventureTheme
): Promise<{ name: string; description: string; aliases?: string[] } | null> => {
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

  const systemInstructionForFix = `Generate detailed JSON for a new game map location. The 'name' field in the output is predetermined and MUST match the input. Focus on creating ${NODE_DESCRIPTION_INSTRUCTION} and aliases (${ALIAS_INSTRUCTION}, array, can be empty). Adhere strictly to the JSON format.`;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const correctedPayload = await callCorrectionAI<{ name: string; description: string; aliases?: string[] }>(prompt, systemInstructionForFix);
    if (
      correctedPayload &&
      typeof correctedPayload.name === 'string' && correctedPayload.name === mapNodePlaceName &&
      typeof correctedPayload.description === 'string' && correctedPayload.description.trim() !== '' &&
      Array.isArray(correctedPayload.aliases) && correctedPayload.aliases.every((alias): alias is string => typeof alias === 'string')
    ) {
      return correctedPayload;
    } else {
      console.warn(`fetchFullPlaceDetailsForNewMapNode_Service (Attempt ${attempt + 1}/${MAX_RETRIES + 1}): Corrected map location payload invalid or name mismatch for "${mapNodePlaceName}". Response:`, correctedPayload);
    }
    if (attempt === MAX_RETRIES) return null;
  }
  return null;
};

/**
 * Attempts to correct or infer a missing or invalid nodeType for a MapNode.
 */
export const fetchCorrectedNodeType_Service = async (
  nodeInfo: { placeName: string; nodeType?: string; description?: string }
): Promise<NonNullable<MapNodeData['nodeType']> | null> => {
  const synonyms = NODE_TYPE_SYNONYMS;

  if (nodeInfo.nodeType) {
    const normalized = synonyms[nodeInfo.nodeType.toLowerCase()] || nodeInfo.nodeType.toLowerCase();
    if ((VALID_NODE_TYPE_VALUES as readonly string[]).includes(normalized)) {
      return normalized as MapNodeData['nodeType'];
    }
  }

  const heuristics = createHeuristicRegexes(
    NODE_TYPE_SYNONYMS,
    VALID_NODE_TYPE_VALUES
  );

  for (const [regex, type] of heuristics) {
    if (regex.test(nodeInfo.placeName) || (nodeInfo.description && regex.test(nodeInfo.description))) {
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

  const systemInstr = `Infer a map node's type. Answer with one of: ${VALID_NODE_TYPE_VALUES.join(', ')}.`;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const typeResp = await callMinimalCorrectionAI(prompt, systemInstr);
    if (typeResp) {
      const cleaned = typeResp.trim().toLowerCase();
        const mapped = synonyms[cleaned] || cleaned;
        if ((VALID_NODE_TYPE_VALUES as readonly string[]).includes(mapped)) {
          return mapped as MapNodeData['nodeType'];
        }
    }
  }
  return null;
};

/**
 * Attempts to correct or infer a missing or invalid edge type for a MapEdge.
 */
export const fetchCorrectedEdgeType_Service = async (
  edgeInfo: { type?: string; description?: string }
): Promise<MapEdgeData['type'] | null> => {
  const synonyms = EDGE_TYPE_SYNONYMS;

  if (edgeInfo.type) {
    const normalized = synonyms[edgeInfo.type.toLowerCase()] || edgeInfo.type.toLowerCase();
    if ((VALID_EDGE_TYPE_VALUES as readonly string[]).includes(normalized)) {
      return normalized as MapEdgeData['type'];
    }
  }

  const heuristics = createHeuristicRegexes(
    EDGE_TYPE_SYNONYMS,
    VALID_EDGE_TYPE_VALUES
  );

  for (const [regex, type] of heuristics) {
    if ((edgeInfo.type && regex.test(edgeInfo.type)) || (edgeInfo.description && regex.test(edgeInfo.description))) {
      return type;
    }
  }

  if (!isApiConfigured()) {
    console.error('fetchCorrectedEdgeType_Service: API Key not configured.');
    return null;
  }

  const prompt = `Determine the most appropriate edge type for a map connection in a text adventure game.
${MAP_EDGE_TYPE_GUIDE}
Description: "${edgeInfo.description || 'No description provided.'}"
Valid edge types: ${VALID_EDGE_TYPE_VALUES.join(', ')}
Respond ONLY with the single edge type.`;

  const systemInstr = `Infer a map edge's type. Answer with one of: ${VALID_EDGE_TYPE_VALUES.join(', ')}.`;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const typeResp = await callMinimalCorrectionAI(prompt, systemInstr);
    if (typeResp) {
      const cleaned = typeResp.trim().toLowerCase();
        const mapped = synonyms[cleaned] || cleaned;
        if ((VALID_EDGE_TYPE_VALUES as readonly string[]).includes(mapped)) {
          return mapped as MapEdgeData['type'];
        }
    }
  }
  return null;
};

/**
 * Suggests the most likely parent node name for a new map node when the provided
 * parent cannot be resolved.
 */
export const fetchLikelyParentNode_Service = async (
  proposedNode: {
    placeName: string;
    description?: string;
    nodeType?: string;
    status?: string;
    aliases?: string[];
  },
    context: {
      sceneDescription: string;
      logMessage: string | undefined;
      localPlace: string;
      currentTheme: AdventureTheme;
      currentMapNodeId: string | null;
      themeNodes: MapNode[];
      themeEdges: MapEdge[];
    },
    debugLog?: MinimalModelCallRecord[]
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
    if (adjacency.has(e.sourceNodeId) && adjacency.has(e.targetNodeId)) {
      adjacency.get(e.sourceNodeId)!.add(e.targetNodeId);
      adjacency.get(e.targetNodeId)!.add(e.sourceNodeId);
    }
  });

  context.themeNodes.forEach(n => {
    const pid = n.data.parentNodeId;
    if (pid && pid !== 'Universe' && adjacency.has(pid)) {
      adjacency.get(n.id)!.add(pid);
      adjacency.get(pid)!.add(n.id);
    }
  });

  const distMap = new Map<string, number>();
  if (currentNode && adjacency.has(currentNode.id)) {
    const queue: string[] = [currentNode.id];
    distMap.set(currentNode.id, 0);
    while (queue.length > 0) {
      const id = queue.shift()!;
      const d = distMap.get(id)!;
      adjacency.get(id)!.forEach(neigh => {
        if (!distMap.has(neigh)) {
          distMap.set(neigh, d + 1);
          queue.push(neigh);
        }
      });
    }
  }

  const nodesWithDist = context.themeNodes.map(n => {
    const dist = distMap.has(n.id) ? distMap.get(n.id)! : Number.MAX_SAFE_INTEGER;
    return { node: n, dist };
  });

  nodesWithDist.sort((a, b) => a.dist - b.dist);

  const nodeLines = nodesWithDist
    .map(({ node }) => {
      const parent =
        node.data.parentNodeId && node.data.parentNodeId !== 'Universe'
          ? context.themeNodes.find(nn => nn.id === node.data.parentNodeId)
          : null;
      const parentName = parent ? parent.placeName : 'Universe';
      const aliasStr =
        node.data.aliases && node.data.aliases.length > 0
          ? `Aliases: ${node.data.aliases.join(', ')}`
          : 'No aliases';
      const descStr = node.data.description || 'No description';
      return `- "${node.placeName}" (Type: ${node.data.nodeType}, Status: ${
        node.data.status
      }, Parent: ${parentName}, Desc: "${descStr}", ${aliasStr})`;
    })
    .join('\n');

  const prompt = `Determine the most probable parent location for a new map node in a text adventure game.
Scene Description: "${context.sceneDescription}"
Log Message: "${context.logMessage || 'None'}"
Player Local Place: "${context.localPlace}"
Current Theme: "${context.currentTheme.name}" (${context.currentTheme.systemInstructionModifier})
Proposed Node Details: Name "${proposedNode.placeName}", Type "${proposedNode.nodeType || 'unknown'}", Status "${proposedNode.status || 'unknown'}", Description "${proposedNode.description || 'N/A'}"
Existing Nodes ordered by proximity to player (shortest hops):
${nodeLines}
Map data above is your main reference. Scene description and log message are just supportive clues.
Respond ONLY with the name of the best parent node from the list above, or "Universe" if none are suitable.`;

  const systemInstr =
    'Choose the most logical parent node name for a new map node based on the map data. Respond only with that single name.';

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const resp = await callMinimalCorrectionAI(prompt, systemInstr, debugLog);
    if (resp && resp.trim().length > 0) {
      return resp.trim();
    }
  }
  return null;
};

/**
 * When an edge references a node name that doesn't exist, this helper attempts
 * to pick the most likely existing node the AI might have meant. Nodes are
 * ordered by hop distance from the player's current location before being
 * presented to the minimal model.
 */
export const fetchLikelyExistingNodeForEdge_Service = async (
  missingNodeName: string,
  partnerNode: MapNode | null,
  context: {
    sceneDescription: string;
    logMessage: string | undefined;
    localPlace: string;
    currentTheme: AdventureTheme;
    currentMapNodeId: string | null;
    themeNodes: MapNode[];
    themeEdges: MapEdge[];
  },
  debugLog?: MinimalModelCallRecord[]
): Promise<string | null> => {
  if (!isApiConfigured()) {
    console.error('fetchLikelyExistingNodeForEdge_Service: API Key not configured.');
    return null;
  }

  const nodeMap = new Map<string, MapNode>();
  context.themeNodes.forEach(n => nodeMap.set(n.id, n));

  const adjacency = new Map<string, Set<string>>();
  context.themeNodes.forEach(n => adjacency.set(n.id, new Set<string>()));
  context.themeEdges.forEach(e => {
    if (adjacency.has(e.sourceNodeId) && adjacency.has(e.targetNodeId)) {
      adjacency.get(e.sourceNodeId)!.add(e.targetNodeId);
      adjacency.get(e.targetNodeId)!.add(e.sourceNodeId);
    }
  });
  context.themeNodes.forEach(n => {
    const pid = n.data.parentNodeId;
    if (pid && pid !== 'Universe' && adjacency.has(pid)) {
      adjacency.get(n.id)!.add(pid);
      adjacency.get(pid)!.add(n.id);
    }
  });

  const distMap = new Map<string, number>();
  if (context.currentMapNodeId && adjacency.has(context.currentMapNodeId)) {
    const queue: string[] = [context.currentMapNodeId];
    distMap.set(context.currentMapNodeId, 0);
    while (queue.length > 0) {
      const id = queue.shift()!;
      const d = distMap.get(id)!;
      adjacency.get(id)!.forEach(neigh => {
        if (!distMap.has(neigh)) {
          distMap.set(neigh, d + 1);
          queue.push(neigh);
        }
      });
    }
  }

  const nodesWithDist = context.themeNodes.map(n => {
    const dist = distMap.has(n.id) ? distMap.get(n.id)! : Number.MAX_SAFE_INTEGER;
    return { node: n, dist };
  });

  nodesWithDist.sort((a, b) => a.dist - b.dist);

  const nodeLines = nodesWithDist
    .map(({ node }) => {
      const parent =
        node.data.parentNodeId && node.data.parentNodeId !== 'Universe'
          ? context.themeNodes.find(nn => nn.id === node.data.parentNodeId)
          : null;
      const parentName = parent ? parent.placeName : 'Universe';
      const aliasStr =
        node.data.aliases && node.data.aliases.length > 0
          ? `Aliases: ${node.data.aliases.join(', ')}`
          : 'No aliases';
      const descStr = node.data.description || 'No description';
      return `- "${node.placeName}" (Type: ${
        node.data.nodeType
      }, Parent: ${parentName}, Desc: "${descStr}", ${aliasStr})`;
    })
    .join('\n');

  const prompt = `Resolve an unknown map node name for an edge connection in a text adventure game.
Missing Name: "${missingNodeName}"
Scene Description: "${context.sceneDescription}"
Log Message: "${context.logMessage || 'None'}"
Player Local Place: "${context.localPlace}"
Current Theme: "${context.currentTheme.name}" (${context.currentTheme.systemInstructionModifier})
${partnerNode ? `Known Other Node: "${partnerNode.placeName}" (Desc: "${partnerNode.data.description || 'No description'}", Aliases: ${partnerNode.data.aliases?.join(', ') || 'None'})` : ''}
Existing Nodes ordered by proximity to player (shortest hops):
${nodeLines}
Map data is the primary reference. Scene description and log message are only additional context.
Respond ONLY with the name of the best matching node from the list above.`;

  const systemInstr = 'Choose the most probable existing node name based primarily on the map data. Respond only with that single name.';

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const resp = await callMinimalCorrectionAI(prompt, systemInstr, debugLog);
    if (resp && resp.trim().length > 0) {
      return resp.trim();
    }
  }
  return null;
};

/**
 * Decides how to resolve a feature node that incorrectly has child nodes.
 * The minimal model chooses between converting the child to a sibling or
 * upgrading the parent to contain the child.
 */
export const decideFeatureHierarchyUpgrade_Service = async (
  parentFeature: MapNode,
  childNode: MapNode,
  currentTheme: AdventureTheme,
  debugLog?: MinimalModelCallRecord[]
): Promise<'convert_child' | 'upgrade_parent' | null> => {
  if (!isApiConfigured()) {
    console.error('decideFeatureHierarchyUpgrade_Service: API Key not configured.');
    return null;
  }

  const prompt = `A feature node has acquired a child which violates the map hierarchy rules.
Parent Feature: "${parentFeature.placeName}" (Desc: "${parentFeature.data.description}")
Child Node: "${childNode.placeName}" (Type: ${childNode.data.nodeType})
Choose the best fix: "convert_child" to make the child a sibling, or "upgrade_parent" to upgrade the parent to a higher-level node.`;

  const systemInstr = 'Respond only with convert_child or upgrade_parent.';

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const resp = await callMinimalCorrectionAI(prompt, systemInstr, debugLog);
    if (resp) {
      const cleaned = resp.trim().toLowerCase();
      if (cleaned.includes('upgrade')) return 'upgrade_parent';
      if (cleaned.includes('convert') || cleaned.includes('sibling')) return 'convert_child';
    }
  }
  return null;
};

/**
 * Suggests the best feature child under a parent node to serve as a connector
 * when adding an edge. The minimal model can select an existing feature or
 * propose a short new name if none are suitable.
 */
export const fetchConnectorFeatureName_Service = async (
  parentNode: MapNode,
  targetNode: MapNode,
  context: {
    sceneDescription: string;
    logMessage: string | undefined;
    currentTheme: AdventureTheme;
    themeNodes: MapNode[];
  },
  debugLog?: MinimalModelCallRecord[]
): Promise<string | null> => {
  if (!isApiConfigured()) {
    console.error('fetchConnectorFeatureName_Service: API Key not configured.');
    return null;
  }

  const features = context.themeNodes.filter(
    n => n.data.parentNodeId === parentNode.id && n.data.nodeType === 'feature'
  );
  const featureLines =
    features.length > 0
      ? features
          .map(f => {
            const aliasStr =
              f.data.aliases && f.data.aliases.length > 0
                ? `Aliases: ${f.data.aliases.join(', ')}`
                : 'No aliases';
            const descStr = f.data.description || 'No description';
            return `- "${f.placeName}" (Desc: "${descStr}", ${aliasStr})`;
          })
          .join('\n')
      : 'None';

  const parentAlias =
    parentNode.data.aliases && parentNode.data.aliases.length > 0
      ? parentNode.data.aliases.join(', ')
      : 'None';
  const parentDesc = parentNode.data.description || 'No description';
  const targetAlias =
    targetNode.data.aliases && targetNode.data.aliases.length > 0
      ? targetNode.data.aliases.join(', ')
      : 'None';
  const targetDesc = targetNode.data.description || 'No description';

  const prompt = `Select the best existing feature under "${parentNode.placeName}" (Desc: "${parentDesc}", Aliases: ${parentAlias}) to connect toward "${targetNode.placeName}" (Desc: "${targetDesc}", Aliases: ${targetAlias}) or suggest a short new feature name.
Existing Features:
${featureLines}
Scene Description: "${context.sceneDescription}"
Log Message: "${context.logMessage || 'None'}"
Theme: "${context.currentTheme.name}"
Map data is primary; scene and log are extra context.`;

  const systemInstr =
    'Respond ONLY with the chosen feature name. Base the choice primarily on the map data. Avoid generic words like "connector", "connection", "connect", or "link".';

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const resp = await callMinimalCorrectionAI(prompt, systemInstr, debugLog);
    if (resp && resp.trim().length > 0) {
      return resp.trim();
    }
  }
  return null;
};
