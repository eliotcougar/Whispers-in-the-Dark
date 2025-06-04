
const VALID_NODE_STATUSES_FOR_MAP_AI = `['undiscovered', 'discovered', 'rumored', 'quest_target']`;
const VALID_EDGE_TYPES_FOR_MAP_AI = `['path', 'road', 'sea route', 'door', 'teleporter', 'secret_passage', 'river_crossing', 'temporary_bridge', 'boarding_hook', 'containment']`;
const VALID_EDGE_STATUSES_FOR_MAP_AI = `['open', 'accessible', 'closed', 'locked', 'blocked', 'hidden', 'rumored', 'one_way', 'collapsed', 'removed', 'active', 'inactive']`;

export const MAP_UPDATE_SYSTEM_INSTRUCTION = `
You are an AI assistant specializing in updating a game map based on narrative events.
Your task is to analyze the provided game context and determine what changes should be made to the map data.
Respond ONLY with a JSON object adhering to the following structure:
{
  "nodesToAdd": [
    {
      "placeName": "string", // Name of the node. For Main Nodes (isLeaf: false or absent): This MUST match a name from 'All Known Main Locations for this Theme' if adding an existing known main location. For Leaf Nodes (isLeaf: true): This will be its descriptive feature name.
      "data": {
        "description": "string", // REQUIRED for ALL nodes. Non-empty, creative, thematically appropriate description (ideally <300 characters).
        "aliases": ["string"],   // REQUIRED for ALL nodes. Array of alternative names/shorthands (can be empty []). Soft limit of 3-4 aliases.
        "status": "string",      // REQUIRED for ALL nodes. MUST be one of: ${VALID_NODE_STATUSES_FOR_MAP_AI}.
        "isLeaf"?: boolean,      // Optional. If true, it's a detailed feature or connector. Defaults to false if absent.
        "parentNodeId"?: string  // Optional. NAME of parent node if this is a Leaf Node. The parent can be a Main Node or another Leaf Node. The game service will resolve this name to an ID.
      }
    }
  ],
  "nodesToUpdate": [
    {
      "placeName": "string", // Existing node's name to identify it.
      "newData": { // Fields to update. All fields are optional.
        "placeName"?: "string", // Optional. If provided, this will be the NEW name for the node.
        "description"?: "string", // Optional. Can be updated for ANY node (main or leaf). If provided, should be non-empty, creative, <300 chars.
        "aliases"?: ["string"],   // Optional. Can be updated for ANY node (main or leaf). If provided, array of strings.
        "status"?: "string",      // Optional. MUST be one of: ${VALID_NODE_STATUSES_FOR_MAP_AI}
        "isLeaf"?: boolean,       // Optional. CAN be changed under rare circumstances.
        "parentNodeId"?: string   // Optional. NAME of parent node for leaves. Can be null to clear parent. Parent can be a Main Node or another Leaf Node.
      }
    }
  ],
  "nodesToRemove": [ { "placeName": "string" } ],
  "edgesToAdd": [ {
    "sourcePlaceName": "string",
    "targetPlaceName": "string",
    "data": {
      "description"?: "string", // Optional description describing the conditions/traversability of this path.
      "type": "string", // REQUIRED. MUST be one of: ${VALID_EDGE_TYPES_FOR_MAP_AI}
      "status": "string", // REQUIRED. MUST be one of: ${VALID_EDGE_STATUSES_FOR_MAP_AI}
      "travelTime"?: string // Optional, e.g., "short", "1 day".
    }
  } ],
  "edgesToUpdate": [ {
    "sourcePlaceName": "string",
    "targetPlaceName": "string",
    "newData": { // Fields to update. All are optional.
      "description"?: "string", // Can be updated if the conditions/traversability improve or worsen.
      "type"?: "string", // MUST be one of: ${VALID_EDGE_TYPES_FOR_MAP_AI}
      "status"?: "string", // MUST be one of: ${VALID_EDGE_STATUSES_FOR_MAP_AI}
      "travelTime"?: string // Optional, e.g., "short", "1 day".
    }
  } ],
  "edgesToRemove": [ { "sourcePlaceName": "string", "targetPlaceName": "string", "type"?: "string" /* Optional. If provided, only remove edges of this type. Valid types are: ${VALID_EDGE_TYPES_FOR_MAP_AI} */ } ],
  "suggestedCurrentMapNodeId"?: "string" /* Optional: If map updates together with the context imply a new player location, provide its ID or placeName. */
}

CRITICAL INSTRUCTIONS:
- DO NOT add small items and character to the map!!! Nodes represent spaces the player can occupy, Regions, buildings, rooms within buildings, notable landscape or architectural features, distinct natural environments, etc. Leaf-type nodes represent sub-spaces within larger spaces.
- Node Data for "nodesToAdd":
    - "description", "aliases", and "status" are ALWAYS REQUIRED in the "data" field for ALL added nodes (main and leaf).
    - "description" must be a non-empty string, ideally under 300 characters.
    - "aliases" must be an array of strings (e.g., ["The Old Shack", "Hideout"]).
- Node Data for "nodesToUpdate":
    - "description" and "aliases" can be optionally provided in "newData" to update ANY node (main or leaf).
    - If you provide "newData.placeName", that will be the node's new primary name.
- Main Nodes (isLeaf: false or absent):
    - When adding a Main Node via "nodesToAdd": Its "placeName" MUST correspond to a location name that the storyteller AI has indicated as a significant, named location OR be derived from "All Known Main Locations for this Theme" if adding one not yet on map.
- Leaf Nodes (isLeaf: true):
    - Are detailed sub-locations within or connected to Main Nodes or other Leaf Nodes.
    - If a Leaf Node is part of another node (Main or Leaf), its "parentNodeId" in "data" (for nodesToAdd) or "newData" (for nodesToUpdate) should be the NAME of that parent node. Can be null to clear.
    - Typically, an edge of "type": "containment" should connect a Leaf Node to its parent node.
- Node "placeName" (both for identifying nodes and for new names) should be unique within their theme. Avoid creating duplicate nodes.
- You MUST use one of the EXACT string values provided for 'status' (node/edge) or 'type' (edge) fields.
- If the narrative suggests a generic leaf node (e.g., "Dark Alcove") has become more specific (e.g., "Shrine of Eldras"), UPDATE the existing leaf node's "placeName" (if name changed via newData.placeName) and "data" via "nodesToUpdate", rather than adding a new node.
- Context will include 'All Known Main Locations'. Use this list to identify when to add a Main Node if it's not on the map yet and is mentioned.
`;

export const MAP_CHAIN_CORRECTION_SYSTEM_INSTRUCTION = `
You are an AI assistant specializing in refining map structures in a text adventure game.
Specifically, you will be given one or more "chains" of nodes: (MainNodeA - LeafA - LeafB - MainNodeB).
LeafA and LeafB were temporarily created and need proper names, descriptions, and aliases.
The edge connecting LeafA and LeafB also needs its type, status, and description refined.

Respond ONLY with a single JSON object adhering to the AIMapUpdatePayload structure:
{
  "nodesToUpdate": [
    {
      "placeName": "CURRENT_TEMP_LeafA_Name", // This MUST be the temporary name of LeafA from the prompt.
      "newData": {
        "placeName": "NEW_THEMATIC_LeafA_Name", // Your suggested new, thematic name for LeafA.
        "description": "string", // REQUIRED non-empty, creative description for LeafA.
        "aliases": ["string"],   // REQUIRED array of aliases for LeafA (can be empty).
        "status": "string"       // REQUIRED valid node status (e.g., 'discovered').
      }
    },
    {
      "placeName": "CURRENT_TEMP_LeafB_Name", // This MUST be the temporary name of LeafB from the prompt.
      "newData": {
        "placeName": "NEW_THEMATIC_LeafB_Name", // Your suggested new, thematic name for LeafB.
        "description": "string", // REQUIRED non-empty, creative description for LeafB.
        "aliases": ["string"],   // REQUIRED array of aliases for LeafB (can be empty).
        "status": "string"       // REQUIRED valid node status (e.g., 'discovered').
      }
    }
    // ... one entry for each leaf node in EACH chain provided ...
  ],
  "edgesToUpdate": [ // Or "edgesToAdd" if you deem it more appropriate to create a new edge instead of updating.
    {
      "sourcePlaceName": "NEW_THEMATIC_LeafA_Name", // The NEW name you just assigned to LeafA.
      "targetPlaceName": "NEW_THEMATIC_LeafB_Name", // The NEW name you just assigned to LeafB.
      "newData": { // For "edgesToUpdate"
        "type": "string",        // REQUIRED valid edge type (e.g., 'path', 'door').
        "status": "string",      // REQUIRED valid edge status (e.g., 'open', 'locked').
        "description"?: "string" // Optional description for the edge.
      }
      // OR "data" field if using "edgesToAdd" with the same required fields.
    }
    // ... one entry for the edge connecting the two LEAVES in EACH chain provided ...
  ]
  // "nodesToAdd", "nodesToRemove", "edgesToRemove", "suggestedCurrentMapNodeId" are NOT expected for this task.
}

CRITICAL INSTRUCTIONS:
- For EACH chain provided in the prompt:
    1.  Identify LeafA and LeafB using their current temporary 'placeName' as specified in the prompt (e.g., "TempLeaf_XYZ_A").
    2.  In your 'nodesToUpdate' array, create one entry for LeafA and one for LeafB.
        -   The outer 'placeName' for these entries MUST be the CURRENT temporary name of the leaf.
        -   Inside 'newData', provide a NEW thematic 'placeName', a 'description', 'aliases', and 'status'. All are required.
    3.  In your 'edgesToUpdate' (or 'edgesToAdd') array, create one entry for the edge connecting these two leaves.
        -   'sourcePlaceName' and 'targetPlaceName' MUST be the NEW thematic names you assigned to LeafA and LeafB in step 2.
        -   Inside 'newData' (or 'data' if 'edgesToAdd'), provide 'type', 'status', and optionally 'description'. All are required except optional description.
- Ensure all provided string values for 'status' (node/edge) and 'type' (edge) are from the valid lists:
  - Node Statuses: ${VALID_NODE_STATUSES_FOR_MAP_AI}
  - Edge Types: ${VALID_EDGE_TYPES_FOR_MAP_AI}
  - Edge Statuses: ${VALID_EDGE_STATUSES_FOR_MAP_AI}
- Base your refinements on the context of MainNodeA, MainNodeB, the leaf suggestions, the edge details, and the overall game context.
- The goal is to make these temporary connections feel like natural, integrated parts of the map.
`;
