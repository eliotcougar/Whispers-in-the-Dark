/**
 * @file services/corrections/map.ts
 * @description Correction helpers for map and location related data.
 */
import { AdventureTheme, MapNode, MapNodeData, MapEdgeData } from '../../types';
import { MAX_RETRIES } from '../../constants';
import { formatKnownPlacesForPrompt } from '../../utils/promptFormatters/map';
import { callCorrectionAI, callMinimalCorrectionAI } from './base';
import { isApiConfigured } from '../apiClient';
import { VALID_NODE_TYPE_VALUES, VALID_EDGE_TYPE_VALUES } from '../../utils/mapUpdateValidationUtils';

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
  "description": "string",
  "aliases": ["string"]
}

Respond ONLY with the single, complete, corrected JSON object.`;

  const systemInstructionForFix = `Correct or complete a JSON payload for a map location. Ensure "name" (string, non-empty), "description" (string, non-empty), and "aliases" (array of strings, can be empty) are provided. Adhere strictly to the JSON format.`;

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
  "description": "string",
  "aliases": ["string"]
}

Respond ONLY with the single, complete JSON object.`;

  const systemInstructionForFix = `Generate detailed JSON for a new game map location. The 'name' field in the output is predetermined and MUST match the input. Focus on creating a fitting, non-empty description and aliases (array of strings, can be empty). Adhere strictly to the JSON format.`;

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
  const synonyms: Record<string, NonNullable<MapNodeData['nodeType']>> = {
    area: 'region',
    zone: 'region',
    province: 'region',
    territory: 'region',
    town: 'city',
    village: 'city',
    settlement: 'city',
    structure: 'building',
    edifice: 'building',
    chamber: 'room',
    hall: 'room',
    landmark: 'feature',
    spot: 'feature',
    forest: 'region',
    woods: 'region',
    jungle: 'region',
    grove: 'region',
    mountain: 'region',
    mountains: 'region',
    range: 'region',
    peak: 'region',
    valley: 'region',
    desert: 'region',
    swamp: 'region',
    marsh: 'region',
    marshland: 'region',
    bog: 'region',
    fen: 'region',
    sea: 'region',
    ocean: 'region',
    'open sea': 'region',
    'open ocean': 'region',
    coast: 'region',
    coastline: 'region',
    shore: 'region',
    island: 'region',
    archipelago: 'region',
    peninsula: 'region',
    plateau: 'region',
    hill: 'region',
    hills: 'region',
    plains: 'region',
    lake: 'region',
    bay: 'region',
    lagoon: 'region',
    fjord: 'region',
    river: 'feature',
    stream: 'feature',
    creek: 'feature',
    waterfall: 'feature',
    beach: 'feature',
    cliff: 'feature',
    canyon: 'feature',
    gorge: 'feature',
    ravine: 'feature',
    reef: 'feature',
    cave: 'feature',
    cavern: 'feature',
    grotto: 'feature'
  };

  if (nodeInfo.nodeType) {
    const normalized = synonyms[nodeInfo.nodeType.toLowerCase()] || nodeInfo.nodeType.toLowerCase();
    if (VALID_NODE_TYPE_VALUES.includes(normalized as MapNodeData['nodeType'])) {
      return normalized as MapNodeData['nodeType'];
    }
  }

  const heuristics: [RegExp, NonNullable<MapNodeData['nodeType']>][] = [
    [/region|province|area|zone|territory|forest|woods|jungle|grove|mountain|mountains|range|peak|valley|desert|swamp|marsh|marshland|bog|fen|sea|ocean|open\ssea|open\socean|coast|coastline|shore|island|archipelago|peninsula|plateau|hill|hills|plains|lake|bay|lagoon|fjord/i, 'region'],
    [/city|town|village|settlement/i, 'city'],
    [/building|tower|house|fort|castle|structure|edifice/i, 'building'],
    [/room|chamber|hall|quarters/i, 'room'],
    [/river|stream|creek|waterfall|beach|cliff|canyon|gorge|ravine|reef|cave|cavern|grotto/i, 'feature']
  ];

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
      if (VALID_NODE_TYPE_VALUES.includes(mapped as MapNodeData['nodeType'])) {
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
  const synonyms: Record<string, MapEdgeData['type']> = {
    trail: 'path',
    track: 'path',
    walkway: 'path',
    footpath: 'path',
    street: 'road',
    roadway: 'road',
    highway: 'road',
    lane: 'road',
    avenue: 'road',
    boulevard: 'road',
    seaway: 'sea route',
    'sea path': 'sea route',
    'ocean route': 'sea route',
    portal: 'teleporter',
    warp: 'teleporter',
    gate: 'door',
    gateway: 'door',
    'secret passageway': 'secret_passage',
    hidden_passage: 'secret_passage',
    tunnel: 'secret_passage',
    ford: 'river_crossing',
    ferry: 'river_crossing',
    bridge: 'temporary_bridge',
    'makeshift_bridge': 'temporary_bridge',
    'temporary crossing': 'temporary_bridge',
    grapple: 'boarding_hook',
    'grappling_hook': 'boarding_hook'
  };

  if (edgeInfo.type) {
    const normalized = synonyms[edgeInfo.type.toLowerCase()] || edgeInfo.type.toLowerCase();
    if (VALID_EDGE_TYPE_VALUES.includes(normalized as MapEdgeData['type'])) {
      return normalized as MapEdgeData['type'];
    }
  }

  const heuristics: [RegExp, MapEdgeData['type']][] = [
    [/trail|track|walkway|footpath/i, 'path'],
    [/road|street|highway|avenue|boulevard|lane|roadway/i, 'road'],
    [/sea\sroute|seaway|sea\spath|ocean\sroute/i, 'sea route'],
    [/door|gate|gateway/i, 'door'],
    [/teleporter|portal|warp/i, 'teleporter'],
    [/secret\spassage|hidden\spassage|tunnel/i, 'secret_passage'],
    [/river\scrossing|ford|ferry/i, 'river_crossing'],
    [/temporary\sbridge|makeshift\sbridge|bridge|temporary\scrossing/i, 'temporary_bridge'],
    [/boarding\shook|grapple|grappling\shook/i, 'boarding_hook']
  ];

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
Description: "${edgeInfo.description || 'No description provided.'}"
Valid edge types: ${VALID_EDGE_TYPE_VALUES.join(', ')}
Respond ONLY with the single edge type.`;

  const systemInstr = `Infer a map edge's type. Answer with one of: ${VALID_EDGE_TYPE_VALUES.join(', ')}.`;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const typeResp = await callMinimalCorrectionAI(prompt, systemInstr);
    if (typeResp) {
      const cleaned = typeResp.trim().toLowerCase();
      const mapped = synonyms[cleaned] || cleaned;
      if (VALID_EDGE_TYPE_VALUES.includes(mapped as MapEdgeData['type'])) {
        return mapped as MapEdgeData['type'];
      }
    }
  }
  return null;
};
