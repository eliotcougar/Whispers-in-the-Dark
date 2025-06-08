
/**
 * @file mapPrompts.ts
 * @description Prompt templates and valid value lists for the map update AI.
 */

import { MAP_NODE_TYPE_GUIDE, MAP_EDGE_TYPE_GUIDE } from './helperPrompts';
import {
  VALID_NODE_STATUS_VALUES,
  VALID_NODE_TYPE_VALUES,
  VALID_EDGE_TYPE_VALUES,
  VALID_EDGE_STATUS_VALUES,
  NODE_DESCRIPTION_INSTRUCTION,
  EDGE_DESCRIPTION_INSTRUCTION,
  ALIAS_INSTRUCTION,
} from '../constants';

const formatValues = (arr: readonly string[]) => `['${arr.join("', '")}']`;

const VALID_NODE_STATUSES_FOR_MAP_AI = formatValues(VALID_NODE_STATUS_VALUES);
const VALID_EDGE_TYPES_FOR_MAP_AI = formatValues(VALID_EDGE_TYPE_VALUES);
const VALID_EDGE_STATUSES_FOR_MAP_AI = formatValues(VALID_EDGE_STATUS_VALUES);
const VALID_NODE_TYPES_FOR_MAP_AI = formatValues(VALID_NODE_TYPE_VALUES);

export const MAP_UPDATE_SYSTEM_INSTRUCTION = `
You are an AI assistant specializing in updating a game map based on narrative events.
${MAP_NODE_TYPE_GUIDE}
${MAP_EDGE_TYPE_GUIDE}
Your task is to analyze the provided game context and determine what changes should be made to the map data.
Respond ONLY with a JSON object adhering to the following structure:
{
  "nodesToAdd": [
    {
      "placeName": "string", // Name of the node. For sub-locations this can be a descriptive feature name.
      "data": {
        "description": "string", // REQUIRED for ALL nodes. ${NODE_DESCRIPTION_INSTRUCTION}.
        "aliases": ["string"],   // REQUIRED for ALL nodes. ${ALIAS_INSTRUCTION} (can be empty []). Soft limit of 3-4 aliases.
        "status": "string",      // REQUIRED for ALL nodes. MUST be one of: ${VALID_NODE_STATUSES_FOR_MAP_AI}.
        "nodeType": "string",    // REQUIRED. One of: ${VALID_NODE_TYPES_FOR_MAP_AI}. Indicates hierarchy level.
        "parentNodeId": string   // REQUIRED. NAME of parent node for hierarchical placement (use "Universe" only for the root node).
      }
    }
  ],
  "nodesToUpdate": [
    {
      "placeName": "string", // Existing node's name to identify it.
      "newData": { // Fields to update. All fields are optional.
        "placeName"?: "string", // Optional. If provided, this will be the NEW name for the node.
        "description"?: "string", // Optional. ${NODE_DESCRIPTION_INSTRUCTION}
        "aliases"?: ["string"],   // Optional. ${ALIAS_INSTRUCTION}
        "status"?: "string",      // Optional. MUST be one of: ${VALID_NODE_STATUSES_FOR_MAP_AI}
        "nodeType"?: "string",    // Optional. One of: ${VALID_NODE_TYPES_FOR_MAP_AI}
        "parentNodeId"?: string   // Optional. NAME of parent node for hierarchy. Can be null to clear parent. Parent can be any other node.
      }
    }
  ],
  "nodesToRemove": [ { "placeName": "string" } ],
  "edgesToAdd": [ {
    "sourcePlaceName": "string",
    "targetPlaceName": "string",
    "data": {
      "description"?: "string", // Optional description (${EDGE_DESCRIPTION_INSTRUCTION}).
      "type": "string", // REQUIRED. MUST be one of: ${VALID_EDGE_TYPES_FOR_MAP_AI}
      "status": "string", // REQUIRED. MUST be one of: ${VALID_EDGE_STATUSES_FOR_MAP_AI}
      "travelTime"?: string // Optional, e.g., "short", "1 day".
    }
  } ],
  "edgesToUpdate": [ {
    "sourcePlaceName": "string",
    "targetPlaceName": "string",
    "newData": { // Fields to update. All are optional.
      "description"?: "string", // ${EDGE_DESCRIPTION_INSTRUCTION} if conditions change.
      "type"?: "string", // MUST be one of: ${VALID_EDGE_TYPES_FOR_MAP_AI}
      "status"?: "string", // MUST be one of: ${VALID_EDGE_STATUSES_FOR_MAP_AI}
      "travelTime"?: string // Optional, e.g., "short", "1 day".
    }
  } ],
  "edgesToRemove": [ { "sourcePlaceName": "string", "targetPlaceName": "string", "type"?: "string" /* Optional. If provided, only remove edges of this type. Valid types are: ${VALID_EDGE_TYPES_FOR_MAP_AI} */ } ],
  "suggestedCurrentMapNodeId"?: "string" /* Optional: If map updates together with the context imply a new player location, provide its ID or placeName. */
}

CRITICAL INSTRUCTIONS:
- DO NOT add small items and characters to the map!!! Nodes represent spaces the player can occupy: regions, general locations, settlements, building exteriors or interiors, rooms, and notable landscape or architectural features. Features represent sub-spaces within larger spaces.
- Node Data for "nodesToAdd":
    - "description", "aliases", and "status" are ALWAYS REQUIRED in the "data" field for ALL added nodes.
    - "description" must be ${NODE_DESCRIPTION_INSTRUCTION}.
    - "aliases" must be an array of strings (${ALIAS_INSTRUCTION}).
    - You MUST provide "nodeType" to indicate hierarchy: ${VALID_NODE_TYPES_FOR_MAP_AI}.
- Node Data for "nodesToUpdate":
    - "description" and "aliases" can be optionally provided in "newData" to update ANY node.
    - If you provide "newData.placeName", that will be the node's new primary name.
      - When adding a new main location via "nodesToAdd", the "placeName" MUST correspond to a location name that the storyteller AI has indicated as significant.
    - You MUST include "parentNodeId" to specify the parent for every node except the root. The hierarchy relies solely on parentNodeId.
- Node "placeName" (both for identifying nodes and for new names) should be unique within their theme. Avoid creating duplicate nodes.
- NEVER add a node named "Universe" or create edges that reference a place named "Universe". That name is reserved for the root and already exists.
- You MUST use one of the EXACT string values provided for 'status' (node/edge) or 'type' (edge) fields.
- Edges may only connect feature nodes that share the same parent, whose parents share a common grandparent, or where one feature's parent is the grandparent of the other (child–grandchild connections).
  - Edges of type 'shortcut' are exempt from these hierarchy restrictions but still must connect feature nodes.
  - When you introduce connector features to satisfy hierarchy rules, give them the same status as their parent node. Any edges created to replace a prior connection should keep that connection's status unless explicitly updated.
- If the narrative suggests a generic feature node (e.g., "Dark Alcove") has become more specific (e.g., "Shrine of Eldras"), UPDATE the existing feature node's "placeName" (if name changed via newData.placeName) and "data" via "nodesToUpdate", rather than adding a new node.
- When renaming a node using "nodesToUpdate", omit any matching entry in "nodesToRemove" for that node.
`;

export const MAP_CHAIN_CORRECTION_SYSTEM_INSTRUCTION = `
You are an AI assistant specializing in refining map structures in a text adventure game.
${MAP_NODE_TYPE_GUIDE}
${MAP_EDGE_TYPE_GUIDE}
Specifically, you will be given one or more "chains" of nodes: (MainNodeA - FeatureA - FeatureB - MainNodeB).
FeatureA and FeatureB were temporarily created and need proper names, descriptions, and aliases.
The edge connecting FeatureA and FeatureB also needs its type, status, and description refined.

Respond ONLY with a single JSON object adhering to the AIMapUpdatePayload structure:
{
  "nodesToUpdate": [
    {
      "placeName": "CURRENT_TEMP_FeatureA_Name", // This MUST be the temporary name of FeatureA from the prompt.
      "newData": {
        "placeName": "NEW_THEMATIC_FeatureA_Name", // Your suggested new, thematic name for FeatureA.
        "description": "string", // REQUIRED: ${NODE_DESCRIPTION_INSTRUCTION} for FeatureA.
        "aliases": ["string"],   // REQUIRED array of aliases for FeatureA (${ALIAS_INSTRUCTION}).
        "status": "string"       // REQUIRED valid node status (e.g., 'discovered').
      }
    },
    {
      "placeName": "CURRENT_TEMP_FeatureB_Name", // This MUST be the temporary name of FeatureB from the prompt.
      "newData": {
        "placeName": "NEW_THEMATIC_FeatureB_Name", // Your suggested new, thematic name for FeatureB.
        "description": "string", // REQUIRED: ${NODE_DESCRIPTION_INSTRUCTION} for FeatureB.
        "aliases": ["string"],   // REQUIRED array of aliases for FeatureB (${ALIAS_INSTRUCTION}).
        "status": "string"       // REQUIRED valid node status (e.g., 'discovered').
      }
    }
    // ... one entry for each feature node in EACH chain provided ...
  ],
  "edgesToUpdate": [ // Or "edgesToAdd" if you deem it more appropriate to create a new edge instead of updating.
    {
      "sourcePlaceName": "NEW_THEMATIC_FeatureA_Name", // The NEW name you just assigned to FeatureA.
      "targetPlaceName": "NEW_THEMATIC_FeatureB_Name", // The NEW name you just assigned to FeatureB.
      "newData": { // For "edgesToUpdate"
        "type": "string",        // REQUIRED valid edge type (e.g., 'path', 'door').
        "status": "string",      // REQUIRED valid edge status (e.g., 'open', 'locked').
        "description"?: "string" // Optional: ${EDGE_DESCRIPTION_INSTRUCTION}.
      }
      // OR "data" field if using "edgesToAdd" with the same required fields.
    }
    // ... one entry for the edge connecting the two FEATURES in EACH chain provided ...
  ]
  // "nodesToAdd", "nodesToRemove", "edgesToRemove", "suggestedCurrentMapNodeId" are NOT expected for this task.
}

CRITICAL INSTRUCTIONS:
- For EACH chain provided in the prompt:
    1.  Identify FeatureA and FeatureB using their current temporary 'placeName' as specified in the prompt (e.g., "TempFeature_XYZ_A").
    2.  In your 'nodesToUpdate' array, create one entry for FeatureA and one for FeatureB.
        -   The outer 'placeName' for these entries MUST be the CURRENT temporary name of the feature.
        -   Inside 'newData', provide a NEW thematic 'placeName', a 'description', 'aliases', and 'status'. All are required.
    3.  In your 'edgesToUpdate' (or 'edgesToAdd') array, create one entry for the edge connecting these two features.
        -   'sourcePlaceName' and 'targetPlaceName' MUST be the NEW thematic names you assigned to FeatureA and FeatureB in step 2.
        -   Inside 'newData' (or 'data' if 'edgesToAdd'), provide 'type', 'status', and optionally 'description'. All are required except optional description.
- Ensure all provided string values for 'status' (node/edge) and 'type' (edge) are from the valid lists:
  - Node Statuses: ${VALID_NODE_STATUSES_FOR_MAP_AI}
  - Edge Types: ${VALID_EDGE_TYPES_FOR_MAP_AI}
  - Edge Statuses: ${VALID_EDGE_STATUSES_FOR_MAP_AI}
- Base your refinements on the context of MainNodeA, MainNodeB, the feature suggestions, the edge details, and the overall game context.
- The goal is to make these temporary connections feel like natural, integrated parts of the map.
`;

export const MAP_HIERARCHY_SYSTEM_INSTRUCTION = `
You are an AI assistant generating hierarchical map nodes for a text adventure game.
${MAP_NODE_TYPE_GUIDE}
Given context about the player's current location and theme, return a JSON array describing
locations from the broadest region down to the player's specific position.
Each entry should have:
  "placeName": string,
  "description": string,
  "aliases": ["string"],
  "nodeType": ${VALID_NODE_TYPES_FOR_MAP_AI},
  "status": ${VALID_NODE_STATUSES_FOR_MAP_AI},
  "parentPlaceName"?: string|null
The first entry must have parentPlaceName null. Respond ONLY with the JSON array.`;
