/**
 * @file services/corrections/edgeFixes.ts
 * @description Helpers for correcting edge information and building connector chains.
 */

import {
  AdventureTheme,
  MapNode,
  MapEdgeData,
  AIMapUpdatePayload,
} from "../../types";
import {
  MAX_RETRIES,
  VALID_EDGE_TYPE_VALUES,
  VALID_EDGE_STATUS_VALUES,
  VALID_NODE_STATUS_VALUES,
  NODE_DESCRIPTION_INSTRUCTION,
  EDGE_DESCRIPTION_INSTRUCTION,
  ALIAS_INSTRUCTION,
  GEMINI_LITE_MODEL_NAME,
  GEMINI_MODEL_NAME,
  MINIMAL_MODEL_NAME,
} from "../../constants";
import { dispatchAIRequest } from "../modelDispatcher";
import { CORRECTION_TEMPERATURE } from "../../constants";
import { addProgressSymbol } from "../../utils/loadingProgress";
import { LOADING_REASON_UI_MAP } from "../../constants";
import { retryAiCall } from "../../utils/retry";
import { isApiConfigured } from "../apiClient";
import { extractJsonFromFence, safeParseJson } from "../../utils/jsonUtils";
import {
  EDGE_TYPE_SYNONYMS,
  createHeuristicRegexes,
} from "../../utils/mapSynonyms";
import { MAP_NODE_TYPE_GUIDE, MAP_EDGE_TYPE_GUIDE, MAP_NODE_HIERARCHY_GUIDE } from "../../prompts/helperPrompts";

export const fetchCorrectedEdgeType_Service = async (edgeInfo: {
  type?: string;
  description?: string;
}): Promise<MapEdgeData["type"] | null> => {
  const synonyms = EDGE_TYPE_SYNONYMS as Record<
    string,
    MapEdgeData["type"] | undefined
  >;

  if (edgeInfo.type) {
    const normalized =
      synonyms[edgeInfo.type.toLowerCase()] ?? edgeInfo.type.toLowerCase();
    if (
      (VALID_EDGE_TYPE_VALUES as ReadonlyArray<string>).includes(normalized)
    ) {
      return normalized as MapEdgeData["type"];
    }
  }

  const heuristics = createHeuristicRegexes(
    EDGE_TYPE_SYNONYMS,
    VALID_EDGE_TYPE_VALUES,
  );

  for (const [regex, type] of heuristics) {
    if (
      (edgeInfo.type && regex.test(edgeInfo.type)) ||
      (edgeInfo.description && regex.test(edgeInfo.description))
    ) {
      return type;
    }
  }

  if (!isApiConfigured()) {
    console.error("fetchCorrectedEdgeType_Service: API Key not configured.");
    return null;
  }

  const prompt = `Determine the most appropriate edge type for a map connection in a text adventure game.
${MAP_EDGE_TYPE_GUIDE}
Description: "${edgeInfo.description ?? "No description provided."}"
Valid edge types: ${VALID_EDGE_TYPE_VALUES.join(", ")}
Respond ONLY with the single edge type.`;

  const systemInstruction = `Infer a map edge's type. Answer with one of: ${VALID_EDGE_TYPE_VALUES.join(", ")}.`;
  return retryAiCall<MapEdgeData["type"]>(async (attempt) => {
    try {
      addProgressSymbol(LOADING_REASON_UI_MAP.correction.icon);
      const { response } = await dispatchAIRequest({
        modelNames: [
          MINIMAL_MODEL_NAME,
          GEMINI_LITE_MODEL_NAME,
          GEMINI_MODEL_NAME,
        ],
        prompt,
        systemInstruction,
        temperature: CORRECTION_TEMPERATURE,
        label: "Corrections",
      });
      const aiResponse = response.text?.trim();
      if (aiResponse) {
        const cleaned = aiResponse.trim().toLowerCase();
        const mapped = synonyms[cleaned] ?? cleaned;
        if (
          (VALID_EDGE_TYPE_VALUES as ReadonlyArray<string>).includes(mapped)
        ) {
          return { result: mapped as MapEdgeData["type"] };
        }
      }
    } catch (error: unknown) {
      console.error(
        `fetchCorrectedEdgeType_Service error (Attempt ${String(attempt + 1)}/$${String(MAX_RETRIES + 1)}):`,
        error,
      );
      throw error;
    }
    return { result: null };
  });
};

export interface ChainParentPair {
  sourceParent: MapNode;
  targetParent: MapNode;
}

export interface EdgeChainRequest {
  originalSource: MapNode;
  originalTarget: MapNode;
  pairs: Array<ChainParentPair>;
  sourceChain: Array<MapNode>;
  targetChain: Array<MapNode>;
  edgeData: MapEdgeData;
}

export interface ConnectorChainsServiceResult {
  payload: AIMapUpdatePayload | null;
  debugInfo: {
    prompt: string;
    rawResponse?: string;
    parsedPayload?: AIMapUpdatePayload;
    validationError?: string;
    observations?: string;
    rationale?: string;
    thoughts?: Array<string>;
  } | null;
}

export const CONNECTOR_CHAINS_JSON_SCHEMA = {
  type: "object",
  properties: {
    observations: {
      type: "string",
      minLength: 1500,
      description: "Contextually relevant observations about the chains and map graph.",
    },
    rationale: {
      type: "string",
      minLength: 1000,
      description: "Explain the reasoning behind your chain fixes and refinement suggestions.",
    },
    edgesToAdd: {
      type: "array",
      items: {
        type: "object",
        properties: {
          description: { type: "string", minLength: 30, description: EDGE_DESCRIPTION_INSTRUCTION },
          sourcePlaceName: { type: "string", description: "Name of the source feature node. MUST be a feature type node." },
          status: { enum: VALID_EDGE_STATUS_VALUES },
          targetPlaceName: { type: "string", description: "Name of the target feature node. MUST be a feature type node." },
          travelTime: { type: "string" },
          type: { enum: VALID_EDGE_TYPE_VALUES },
        },
        propertyOrdering: ["description", "sourcePlaceName", "status", "targetPlaceName", "travelTime", "type"],
        required: ["sourcePlaceName", "status", "targetPlaceName", "type"],
        additionalProperties: false,
      },
    },
    nodesToAdd: {
      type: "array",
      description: "List of nodes to add to the map.",
      minItems: 1,
      items: {
        type: "object",
        properties: {
          aliases: {
            type: "array",
            description: ALIAS_INSTRUCTION,
            minItems: 2,
            items: { type: "string" },
          },
          description: { type: "string", minLength: 30, description: NODE_DESCRIPTION_INSTRUCTION },
          nodeType: { enum: ["feature"] },
          parentNodeId: { type: "string", description: "Name of the Parent Node this feature belongs to, or 'Universe' (keyword for root node) if it has no parent" },
          placeName: { type: "string", description: "A contextually relevant location name, based on Theme and Scene Description" },
          status: { enum: VALID_NODE_STATUS_VALUES },
        },
        propertyOrdering: ["aliases", "description", "nodeType", "parentNodeId", "placeName", "status"],
        required: ["aliases", "description", "nodeType", "parentNodeId", "placeName", "status"],
        additionalProperties: false,
      },
    },
  },
  required: ["observations", "rationale", "edgesToAdd", "nodesToAdd"],
  propertyOrdering: [
    "observations",
    "rationale",
    "edgesToAdd",
    "nodesToAdd",
  ],
  additionalProperties: false,
} as const;

export const fetchConnectorChains_Service = async (
  requests: Array<EdgeChainRequest>,
  context: {
    sceneDescription: string;
    logMessage: string | undefined;
    currentTheme: AdventureTheme;
    themeNodes: Array<MapNode>;
  },
): Promise<ConnectorChainsServiceResult> => {
  if (!isApiConfigured() || requests.length === 0)
    return { payload: null, debugInfo: null };

  const buildGraph = () => {
    const nodeMap = new Map<string, MapNode>();
    const edgeMap = new Map<
      string,
      { source: MapNode; target: MapNode; data: MapEdgeData }
    >();
    const chainLines: Array<string> = [];

    requests.forEach((r, idx) => {
      const visited = new Set<string>();
      const orderedParents: Array<MapNode> = [];
      [...r.sourceChain, ...r.targetChain.slice().reverse()].forEach((p) => {
        if (p.data.nodeType !== "feature" && !visited.has(p.id)) {
          orderedParents.push(p);
          visited.add(p.id);
          nodeMap.set(p.id, p);
        }
      });
      if (orderedParents.length === 0) {
        if (!visited.has(r.originalSource.id)) {
          orderedParents.push(r.originalSource);
          visited.add(r.originalSource.id);
          nodeMap.set(r.originalSource.id, r.originalSource);
        }
        if (!visited.has(r.originalTarget.id)) {
          orderedParents.push(r.originalTarget);
          visited.add(r.originalTarget.id);
          nodeMap.set(r.originalTarget.id, r.originalTarget);
        }
      }

      for (let i = 0; i < orderedParents.length - 1; i++) {
        const a = orderedParents[i];
        const b = orderedParents[i + 1];
        const key = a.id < b.id ? `${a.id}|${b.id}` : `${b.id}|${a.id}`;
        if (!edgeMap.has(key))
          edgeMap.set(key, { source: a, target: b, data: r.edgeData });
      }

      chainLines.push(
        `Chain ${String(idx + 1)}: ${orderedParents.map((p) => `"${p.placeName}"`).join(" -> ")}`,
      );
    });

    const nodeLines = Array.from(nodeMap.values())
      .map((p, i) => {
        const features =
          context.themeNodes
            .filter(
              (n) =>
                n.data.parentNodeId === p.id && n.data.nodeType === "feature",
            )
            .map(
              (f) =>
                ` - "${f.placeName}" (${f.data.nodeType}, ${f.data.status}, ${f.data.description})`,
            )
            .join("\n") || " - None";
        return `Node ${String(i + 1)}: "${p.placeName}" (Type: ${p.data.nodeType}, Status: ${p.data.status}, Description: ${p.data.description})\n${features}`;
      })
      .join("\n");

    const edgeLines = Array.from(edgeMap.values())
      .map((e, i) => {
        return `Edge ${String(i + 1)}: "${e.source.placeName}" -> "${e.target.placeName}" (Type: ${e.data.type ?? "path"}, Status: ${e.data.status ?? "open"}, Desc: ${e.data.description ?? "None"})`;
      })
      .join("\n");

    return `Parent Nodes:\n${nodeLines}\n\nEdges:\n${edgeLines}\n\nChains:\n${chainLines.join("\n")}`;
  };

  const graphBlock = buildGraph();

  const prompt = `Suggest chains of locations (feature nodes) to connect distant map nodes in a text adventure.
** Context: **
Scene Description: "${context.sceneDescription}"
Theme: "${context.currentTheme.name}" (${context.currentTheme.systemInstructionModifier})

---

## Graph:
${graphBlock}`;

  const systemInstruction = `Imagine a Player travelling along the provided chains. For each Parent Node in the graph imagine locations within them that may connect them to their neighbours.
CHOOSE ONE for each Parent Node:
- IF there is a contextually appropriate feature node already present under that Parent Node, use it directly in edgesToAdd.
- IF there is 'None', or no appropriate candidate feature node exists under that Parent Node, you MUST use nodesToAdd to add a contextually appropriate feature node with full information, based on Context.

ALWAYS choose between selecting an existing feature node OR adding a new one. NEVER leave a Parent Node without a feature node connected to neighbour Parent Nodes' feature nodes.
You can add edges ONLY between feature nodes. NEVER try to connect feature nodes to Parent Nodes directly. NEVER try to connect Parent Nodes to each other.
New edges MUST inherit the original chain edge type and status.
Every new node MUST have a unique placeName. Use only the valid node/edge status and type values.
Edges MUST connect ALL feature nodes along each chain path using the shared feature nodes for common Parent Nodes.

${MAP_NODE_TYPE_GUIDE}
${MAP_EDGE_TYPE_GUIDE}
${MAP_NODE_HIERARCHY_GUIDE}
`;
  const result = await retryAiCall<ConnectorChainsServiceResult>(async attempt => {
    try {
      console.log(
        `fetchConnectorChains_Service (Attempt ${String(attempt + 1)}/${String(MAX_RETRIES + 1)})`,
      );
      addProgressSymbol(LOADING_REASON_UI_MAP.correction.icon);
      const { response } = await dispatchAIRequest({
        modelNames: [GEMINI_LITE_MODEL_NAME, GEMINI_MODEL_NAME],
        prompt,
        systemInstruction: systemInstruction,
        thinkingBudget: 2048,
        includeThoughts: true,
        responseMimeType: "application/json",
        jsonSchema: CONNECTOR_CHAINS_JSON_SCHEMA,
        temperature: CORRECTION_TEMPERATURE,
        label: "Corrections",
      });
      const parts = (response.candidates?.[0]?.content?.parts ?? []) as Array<{
        text?: string;
        thought?: boolean;
      }>;
      const thoughtParts = parts
        .filter(
          (p): p is { text: string; thought?: boolean } =>
            p.thought === true && typeof p.text === "string",
        )
        .map(p => p.text);

      const debugInfo: ConnectorChainsServiceResult["debugInfo"] = {
        prompt,
        rawResponse: response.text ?? "",
        parsedPayload: undefined,
        validationError: undefined,
        observations: undefined,
        rationale: undefined,
        thoughts: thoughtParts.length > 0 ? thoughtParts : undefined,
      };

      const jsonStr = extractJsonFromFence(response.text ?? "");
      const parsed: unknown = safeParseJson(jsonStr);
      if (!parsed) {
        debugInfo.validationError = "Failed to parse JSON";
        return { result: { payload: null, debugInfo } };
      }
      let parsedPayload: AIMapUpdatePayload | null = null;
      if (Array.isArray(parsed)) {
        parsedPayload = parsed.reduce<AIMapUpdatePayload>((acc, entry) => {
          if (entry && typeof entry === "object") {
            const maybeObj = entry as Partial<AIMapUpdatePayload>;
            if (Array.isArray(maybeObj.nodesToAdd)) {
              acc.nodesToAdd = [...(acc.nodesToAdd ?? []), ...maybeObj.nodesToAdd];
            }
            if (Array.isArray(maybeObj.edgesToAdd)) {
              acc.edgesToAdd = [...(acc.edgesToAdd ?? []), ...maybeObj.edgesToAdd];
            }
            if (maybeObj.observations && !acc.observations) {
              acc.observations = maybeObj.observations;
            }
            if (maybeObj.rationale && !acc.rationale) {
              acc.rationale = maybeObj.rationale;
            }
          }
          return acc;
        }, {});
      } else if (typeof parsed === "object") {
        parsedPayload = parsed as AIMapUpdatePayload;
      }
      debugInfo.parsedPayload = parsedPayload ?? undefined;
      if (parsedPayload) {
        if (parsedPayload.observations && !debugInfo.observations) {
          debugInfo.observations = parsedPayload.observations;
        }
        if (parsedPayload.rationale && !debugInfo.rationale) {
          debugInfo.rationale = parsedPayload.rationale;
        }
      }
      if (parsedPayload && (parsedPayload.nodesToAdd || parsedPayload.edgesToAdd)) {
        return { result: { payload: parsedPayload, debugInfo } };
      }
      debugInfo.validationError = "Parsed JSON missing nodesToAdd or edgesToAdd";
      return { result: { payload: null, debugInfo } };
    } catch (error: unknown) {
      console.error(
        `fetchConnectorChains_Service error (Attempt ${String(attempt + 1)}/${String(MAX_RETRIES + 1)}):`,
        error,
      );
      throw error;
    }
  });

  return result ?? { payload: null, debugInfo: null };
};
