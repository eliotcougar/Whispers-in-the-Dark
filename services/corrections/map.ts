/**
 * @file services/corrections/map.ts
 * @description Correction helpers for map and location related data.
 */
import { AdventureTheme, MapNode, MapNodeData, MapEdgeData, MapEdge, AIMapUpdatePayload, MinimalModelCallRecord } from '../../types';
import {
  MAX_RETRIES,
  NODE_DESCRIPTION_INSTRUCTION,
  EDGE_DESCRIPTION_INSTRUCTION,
  ALIAS_INSTRUCTION,
  GEMINI_MODEL_NAME,
  AUXILIARY_MODEL_NAME,
} from '../../constants';
import { formatKnownPlacesForPrompt } from '../../utils/promptFormatters/map';
import { callCorrectionAI, callMinimalCorrectionAI } from './base';
import { dispatchAIRequest } from '../modelDispatcher';
import { CORRECTION_TEMPERATURE } from './base';
import { isApiConfigured } from '../apiClient';
import { extractJsonFromFence, safeParseJson } from '../../utils/jsonUtils';
import { addProgressSymbol } from '../../utils/loadingProgress';
import {
  VALID_NODE_TYPE_VALUES,
  VALID_EDGE_TYPE_VALUES,
  VALID_NODE_STATUS_VALUES,
  VALID_EDGE_STATUS_VALUES,
} from '../../constants';
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

export interface ChainParentPair {
  sourceParent: MapNode;
  targetParent: MapNode;
}

export interface EdgeChainRequest {
  originalSource: MapNode;
  originalTarget: MapNode;
  pairs: ChainParentPair[];
  sourceChain: MapNode[];
  targetChain: MapNode[];
  edgeData: MapEdgeData;
}

export interface ConnectorChainsServiceResult {
  payload: AIMapUpdatePayload | null;
  debugInfo: {
    prompt: string;
    rawResponse?: string;
    parsedPayload?: AIMapUpdatePayload;
    validationError?: string;
  } | null;
}

export const fetchConnectorChains_Service = async (
  requests: EdgeChainRequest[],
  context: {
    sceneDescription: string;
    logMessage: string | undefined;
    currentTheme: AdventureTheme;
    themeNodes: MapNode[];
  }
): Promise<ConnectorChainsServiceResult> => {
  addProgressSymbol('▒▒');
  if (!isApiConfigured() || requests.length === 0)
    return { payload: null, debugInfo: null };

  const formatValues = (arr: readonly string[]) => `[${arr.map(v => `'${v}'`).join(', ')}]`;
  const NODE_STATUS_LIST = formatValues(VALID_NODE_STATUS_VALUES);
  const EDGE_TYPE_LIST = formatValues(VALID_EDGE_TYPE_VALUES);
  const EDGE_STATUS_LIST = formatValues(VALID_EDGE_STATUS_VALUES);

  const buildGraph = () => {
    const nodeMap = new Map<string, MapNode>();
    const edgeMap = new Map<string, { source: MapNode; target: MapNode; data: MapEdgeData }>();
    const chainLines: string[] = [];

    requests.forEach((r, idx) => {
      const visited = new Set<string>();
      const orderedParents: MapNode[] = [];
      [...r.sourceChain, ...r.targetChain.slice().reverse()].forEach(p => {
        if (p.data.nodeType !== 'feature' && !visited.has(p.id)) {
          orderedParents.push(p);
          visited.add(p.id);
          nodeMap.set(p.id, p);
        }
      });

      for (let i = 0; i < orderedParents.length - 1; i++) {
        const a = orderedParents[i];
        const b = orderedParents[i + 1];
        const key = a.id < b.id ? `${a.id}|${b.id}` : `${b.id}|${a.id}`;
        if (!edgeMap.has(key)) edgeMap.set(key, { source: a, target: b, data: r.edgeData });
      }

      chainLines.push(`Chain ${idx + 1}: ${orderedParents.map(p => `"${p.placeName}"`).join(' -> ')}`);
    });

    const nodeLines = Array.from(nodeMap.values())
      .map((p, i) => {
        const features = context.themeNodes
          .filter(n => n.data.parentNodeId === p.id && n.data.nodeType === 'feature')
          .map(f => ` - "${f.placeName}" (${f.data.nodeType}, ${f.data.status}, ${f.data.description || 'No description'})`)
          .join('\n') || ' - None';
        return `Node ${i + 1}: "${p.placeName}" (Type: ${p.data.nodeType}, Status: ${p.data.status}, Description: ${p.data.description || 'No description'})\n${features}`;
      })
      .join('\n');

    const edgeLines = Array.from(edgeMap.values())
      .map((e, i) => {
        return `Edge ${i + 1}: "${e.source.placeName}" -> "${e.target.placeName}" (Type: ${e.data.type || 'path'}, Status: ${e.data.status || 'open'}, Desc: ${e.data.description || 'None'})`;
      })
      .join('\n');

    return `Parent Nodes:\n${nodeLines}\n\nEdges:\n${edgeLines}\n\nChains:\n${chainLines.join('\n')}`;
  };

  const graphBlock = buildGraph();

  const prompt = `Suggest chains of locations (feature nodes) to connect distant map nodes in a text adventure.
** Context: **
Scene Description: "${context.sceneDescription}"
Theme: "${context.currentTheme.name}" (${context.currentTheme.systemInstructionModifier})

---

Graph:
${graphBlock}
`;

  const systemInstr = `Imagine a Player travelling along the provided chains. For each Parent Node in the graph imagine locations within them that may connect them to their neighbours.
CHOOSE ONE for each Parent Node:
- IF there is a contextually appropriate feature node already present under that Parent Node, use it directly in edgesToAdd.
- IF there is 'None', or no appropriate candidate feature node exists under that Parent Node, you MUST use nodesToAdd to add a contextually appropriate feature node with full information, based on Context.

ALWAYS choose between selecting an existing feature node OR adding a new one. NEVER leave a Parent Node without a feature node connected to neighbour Parent Nodes' feature nodes.
You can add edges ONLY between feature nodes. NEVER try to connect feature nodes to Parent Nodes directly. NEVER try to connect Parent Nodes to each other.
New edges MUST inherit the original chain edge type and status.
Every new node MUST have a unique placeName. Use only the valid node/edge status and type values.
Edges MUST connect ALL feature nodes along each chain path using the shared feature nodes for common Parent Nodes.

${MAP_EDGE_TYPE_GUIDE}
Return a single JSON object representing a single set of feature nodes and edges between them.
Return ONLY a JSON object strictly matching this structure:
{
  "nodesToAdd": [
    {
      "placeName": "string", /* A contextually relevant location name, based on Theme and Scene Description
      "data": {
        "description": "string", /* ${NODE_DESCRIPTION_INSTRUCTION} */
        "aliases": ["string"], /* ${ALIAS_INSTRUCTION} */
        "status": "string", /* ${NODE_STATUS_LIST} */
        "nodeType": "feature", /* ONLY add 'feature' type nodes! */
        "parentNodeId": "string" /* Name of the Parent Node this feature belongs to, or 'Universe' (keyword for root node) if it has no parent */
      }
    }
  ],
  "edgesToAdd": [
    {
      "sourcePlaceName": "string", /* MUST ALWAYS reference a 'feature' type node! */
      "targetPlaceName": "string", /* MUST ALWAYS reference a 'feature' type node! */
      "data": {
        "description": "string", /* ${EDGE_DESCRIPTION_INSTRUCTION} */
        "type": "string", /* ${EDGE_TYPE_LIST} */
        "status": "string" /* ${EDGE_STATUS_LIST} */
      }
    }
  ]
}`;

  const debugInfo: ConnectorChainsServiceResult['debugInfo'] = { prompt };

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      debugInfo.prompt = prompt;
      const response = await dispatchAIRequest(
        [AUXILIARY_MODEL_NAME, GEMINI_MODEL_NAME],
        prompt,
        systemInstr,
        { responseMimeType: 'application/json', temperature: CORRECTION_TEMPERATURE }
      );
      debugInfo.rawResponse = response.text ?? '';
      const jsonStr = extractJsonFromFence(response.text ?? '');
      const parsed: unknown = safeParseJson(jsonStr);
      if (!parsed) {
        debugInfo.validationError = 'Failed to parse JSON';
        return { payload: null, debugInfo };
      }
      let result: AIMapUpdatePayload | null = null;
      if (Array.isArray(parsed)) {
        result = parsed.reduce<AIMapUpdatePayload>((acc, entry) => {
          if (entry && typeof entry === 'object') {
            const maybeObj = entry as Partial<AIMapUpdatePayload>;
            if (Array.isArray(maybeObj.nodesToAdd)) {
              acc.nodesToAdd = [
                ...(acc.nodesToAdd || []),
                ...maybeObj.nodesToAdd,
              ];
            }
            if (Array.isArray(maybeObj.edgesToAdd)) {
              acc.edgesToAdd = [
                ...(acc.edgesToAdd || []),
                ...maybeObj.edgesToAdd,
              ];
            }
          }
          return acc;
        }, {} as AIMapUpdatePayload);
      } else if (parsed && typeof parsed === 'object') {
        result = parsed as AIMapUpdatePayload;
      }
      debugInfo.parsedPayload = result as AIMapUpdatePayload;
      if (result && (result.nodesToAdd || result.edgesToAdd)) {
        return { payload: result, debugInfo };
      }
      debugInfo.validationError = 'Parsed JSON missing nodesToAdd or edgesToAdd';
    } catch (error) {
      debugInfo.validationError = `Error: ${error instanceof Error ? error.message : String(error)}`;
    }
  }
  return { payload: null, debugInfo };
};

