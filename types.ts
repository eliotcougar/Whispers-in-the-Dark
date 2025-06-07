/**
 * @file types.ts
 * @description Shared TypeScript interfaces and types for the game's data structures.
 */

import { VALID_ITEM_TYPES } from './constants';
import { ALL_THEME_PACK_NAMES } from './themes'; // For ThemePackName

export type ItemType = typeof VALID_ITEM_TYPES[number];
export type ThemePackName = typeof ALL_THEME_PACK_NAMES[number];

// Added LoadingReason type
export type LoadingReason = 
  | 'storyteller' 
  | 'map' 
  | 'correction' 
  | 'dialogue_turn' 
  | 'dialogue_summary' 
  | 'dialogue_memory_creation'      // Added for memory summarization
  | 'dialogue_conclusion_summary'   // Added for final dialogue summary/updates
  | 'initial_load'
  | 'reality_shift_load' // Added for reality shift loading
  | null;


export interface KnownUse {
  actionName: string; // Text for the button, e.g., "Light Torch"
  promptEffect: string; // What to send to AI, e.g., "Player attempts to light the Torch"
  description?: string; // Optional: A small hint or detail about this use
  appliesWhenActive?: boolean; // If true, this use is shown when item.isActive is true
  appliesWhenInactive?: boolean; // If true, this use is shown when item.isActive is false (or undefined)
}

export interface Item {
  name: string; 
  type: ItemType;
  description: string; // Default/inactive description
  activeDescription?: string; // Optional: Description when item.isActive is true
  isActive?: boolean; // Defaults to false if undefined
  knownUses?: KnownUse[]; // Discovered specific ways to use the item
  isJunk?: boolean; // Flag for unimportant items
  // --- Fields for "update" action payloads ---
  newName?: string; 
  addKnownUse?: KnownUse; 
}

// This ItemChange is from the AI's perspective, and will be processed into ItemChangeRecord
export interface ItemChange {
  // For "gain" or "update", 'item' is an Item object.
  // For "lose", 'item' is a string (item name).
  item: string | Item | null;
  action: "gain" | "lose" | "update";
  invalidPayload?: unknown; // If the 'item' field was unparseable/invalid from AI
}

export interface DialogueSummaryRecord {
  summaryText: string;
  participants: string[]; // Names of characters involved in that dialogue
  timestamp: string; // localTime when the dialogue occurred
  location: string; // localPlace where the dialogue occurred
}

export interface Character {
  themeName: string;
  name: string;
  description: string;
  aliases?: string[];
  presenceStatus: 'distant' | 'nearby' | 'companion' | 'unknown';
  lastKnownLocation: string | null; // General location when not 'nearby' or 'companion', can be a MapNode.placeName or descriptive
  preciseLocation: string | null;    // Specific location in scene if 'nearby' or 'companion'
  dialogueSummaries?: DialogueSummaryRecord[]; // Stores summaries of past dialogues
}

// --- Dialogue Mode Types ---
export interface DialogueTurnResponsePart {
  speaker: string; 
  line: string;    
}

// Alias used throughout the codebase for clarity in dialogue history arrays.
export type DialogueHistoryEntry = DialogueTurnResponsePart;

// New structure for active dialogue state
export interface DialogueData {
  participants: string[];
  history: DialogueHistoryEntry[];
  options: string[];
}

// Structure for AI to return when initiating dialogue
export interface DialogueSetupPayload {
  participants: string[];
  initialNpcResponses: DialogueTurnResponsePart[];
  initialPlayerOptions: string[];
}

export interface DialogueAIResponse { // AI response for a single turn *during* dialogue
  npcResponses: DialogueTurnResponsePart[]; 
  playerOptions: string[]; 
  dialogueEnds?: boolean; 
  updatedParticipants?: string[]; 
}

export interface DialogueSummaryContext {
  mainQuest: string | null;
  currentObjective: string | null;
  currentScene: string;
  localTime: string | null;
  localEnvironment: string | null;
  localPlace: string | null; // The free-text local place string
  mapDataForTheme: MapData; // Map data for the current theme (nodes and edges)
  knownCharactersInTheme: Character[];
  inventory: Item[];
  playerGender: string;
  dialogueLog: DialogueHistoryEntry[]; 
  dialogueParticipants: string[];
  themeName: string; // Retained for direct theme name access if needed
  currentThemeObject: AdventureTheme | null; // Added for full theme object access
}

// New context type for detailed memory summarization
export interface DialogueMemorySummaryContext {
  themeName: string; // Retained for direct theme name access if needed
  currentThemeObject: AdventureTheme | null; // Added for full theme object access
  currentScene: string; // Scene at the START of the dialogue
  localTime: string | null;
  localEnvironment: string | null;
  localPlace: string | null;
  dialogueParticipants: string[];
  dialogueLog: DialogueHistoryEntry[];
}


export interface DialogueSummaryResponse {
  itemChange?: ItemChange[]; 
  charactersAdded?: {
    name: string; 
    description: string; 
    aliases?: string[]; 
    presenceStatus?: Character['presenceStatus']; 
    lastKnownLocation?: string | null; 
    preciseLocation?: string | null; 
  }[];
  charactersUpdated?: { 
    name: string; 
    newDescription?: string; 
    newAliases?: string[]; 
    addAlias?: string; 
    newPresenceStatus?: Character['presenceStatus'];
    newLastKnownLocation?: string | null; 
    newPreciseLocation?: string | null;
  }[];
  logMessage?: string; 
  mainQuest?: string; 
  currentObjective?: string;
  objectiveAchieved?: boolean;
  localTime?: string; 
  localEnvironment?: string; 
  localPlace?: string; 
  mapUpdated?: boolean; // This flag signals the map service to run
  currentMapNodeId?: string | undefined; // Suggestion for current location node ID
}
// --- End Dialogue Mode Types ---


export interface GameStateFromAI {
  sceneDescription: string; 
  options: string[]; 

  mainQuest?: string; 
  currentObjective?: string;
  itemChange: ItemChange[]; 
  logMessage?: string;
  charactersAdded?: { 
    name: string; 
    description: string; 
    aliases?: string[]; 
    presenceStatus?: Character['presenceStatus'];
    lastKnownLocation?: string | null; 
    preciseLocation?: string | null;
  }[]; 
  charactersUpdated?: { 
    name: string; 
    newDescription?: string; 
    newAliases?: string[]; 
    addAlias?: string; 
    newPresenceStatus?: Character['presenceStatus'];
    newLastKnownLocation?: string | null; 
    newPreciseLocation?: string | null;
  }[];
  objectiveAchieved?: boolean;
  localTime?: string;
  localEnvironment?: string;
  localPlace?: string;
  dialogueSetup?: DialogueSetupPayload;
  mapUpdated?: boolean; // This flag signals the map service to run
  currentMapNodeId?: string | undefined; // Suggestion for current location node ID
  // placesAdded and placesUpdated are removed from storyteller responsibility
}

export interface AdventureTheme {
  name: string;
  systemInstructionModifier: string;
  initialMainQuest: string;
  initialCurrentObjective: string;
  initialSceneDescriptionSeed: string;
  initialItems: string;
}

export interface ThemeMemory {
  summary: string;
  mainQuest: string;
  currentObjective: string;
  placeNames: string[]; // These will be MapNode.placeName of main map nodes in the theme
  characterNames: string[];
}

export interface ThemeHistoryState {
  [themeName: string]: ThemeMemory;
}

// --- TurnChanges Data Structures ---
export interface ItemChangeRecord {
  type: 'gain' | 'loss' | 'update';
  gainedItem?: Item;     // For 'gain'
  lostItem?: Item;       // For 'loss' (the full item object before it was lost)
  oldItem?: Item;        // For 'update' (item state before update)
  newItem?: Item;        // For 'update' (item state after update, including transformations)
}

export interface CharacterChangeRecord {
  type: 'add' | 'update';
  characterName: string; // Common identifier
  addedCharacter?: Character; // For 'add' (will include new presence fields)
  oldCharacter?: Character;   // For 'update' (will include old presence fields)
  newCharacter?: Character;   // For 'update' (will include new presence fields)
}

export interface TurnChanges {
  itemChanges: ItemChangeRecord[];
  characterChanges: CharacterChangeRecord[];
  objectiveAchieved: boolean;
  objectiveTextChanged: boolean;
  mainQuestTextChanged: boolean;
  localTimeChanged: boolean;
  localEnvironmentChanged: boolean;
  localPlaceChanged: boolean;
  currentMapNodeIdChanged?: boolean; 
  scoreChangedBy: number;
  mapDataChanged?: boolean; 
}
// --- End TurnChanges Data Structures ---

// --- Map Data Structures ---
export interface MapLayoutConfig {
  IDEAL_EDGE_LENGTH: number;
  NESTED_PADDING: number;
  NESTED_ANGLE_PADDING: number;
}

export interface MapNodeData {
  description: string; // Description is ALWAYS REQUIRED.
  aliases?: string[];  // Optional, can be updated.
  status: 'undiscovered' | 'discovered' | 'rumored' | 'quest_target';
  visited?: boolean; // Managed by game logic, not AI directly.
  parentNodeId?: string; // ID of parent node for hierarchical placement.
  nodeType:
    | 'region'
    | 'location'
    | 'settlement'
    | 'exterior'
    | 'interior'
    | 'room'
    | 'feature';
  /** Pre-calculated radius used by nested circle layouts. */
  visualRadius?: number;
  [key: string]: unknown; // For any other custom data.
}

export interface MapNode {
  id: string; // Unique identifier for the node
  themeName: string;
  placeName: string; // User-facing name of the location/feature. Must be unique within its theme.
  position: { x: number; y: number }; // For map visualization
  data: MapNodeData;
}

export interface MapEdgeData {
  description?: string;
  type?:
    | 'path'
    | 'road'
    | 'sea route'
    | 'door'
    | 'teleporter'
    | 'secret_passage'
    | 'river_crossing'
    | 'temporary_bridge'
    | 'boarding_hook'
    | 'shortcut';
  status?: 'open' | 'accessible' | 'closed' | 'locked' | 'blocked' | 'hidden' | 'rumored' | 'one_way' | 'collapsed' | 'removed' | 'active' | 'inactive'; 
  travelTime?: string; 
  [key: string]: unknown;
}

export interface MapEdge {
  id: string; // Unique identifier for the edge
  sourceNodeId: string;
  targetNodeId: string;
  data: MapEdgeData;
}

export interface MapData {
  nodes: MapNode[];
  edges: MapEdge[];
}
// --- End Map Data Structures ---

// --- Map Update Service Payload ---
export interface AIEdgeUpdate { 
  sourcePlaceName: string; 
  targetPlaceName: string; 
  newData: MapEdge['data']; 
}

export interface AINodeUpdate {
  placeName: string; // User-facing name to identify the node for update or to set for a new node.
  data: Partial<MapNodeData> & { description?: string }; // 'description' mainly provided for feature-level nodes.
  initialPosition?: { x: number; y: number };
}

export interface AIMapUpdatePayload {
  // parentNodeId is mandatory for each entry in nodesToAdd. The value is a NAME
  // of the intended parent node (use "Universe" for the root node).
  // Description and aliases are required for all new nodes.
  nodesToAdd?: (AINodeUpdate & {
    data: {
      status: MapNodeData['status'];
      parentNodeId: string;
    } & Partial<Omit<MapNodeData, 'status' | 'parentNodeId'>>;
  })[];
  nodesToUpdate?: { placeName: string; newData: Partial<MapNodeData> & { placeName?: string }; }[]; // Added placeName to newData for renaming
  nodesToRemove?: { placeName: string; }[]; 
  edgesToAdd?: { sourcePlaceName: string; targetPlaceName: string; data: MapEdge['data']; }[]; 
  edgesToUpdate?: AIEdgeUpdate[]; 
  edgesToRemove?: { sourcePlaceName: string; targetPlaceName: string; type?: MapEdgeData['type']; }[]; 
  suggestedCurrentMapNodeId?: string | undefined; 
}
// --- End Map Update Service Payload ---

// --- Map Pruning & Refinement Types ---
export interface MapChainFeatureInfo {
  nodeId: string;         // ID of the feature node
  isTemporary: boolean;   // Was this feature created by the pruning utility?
  nameSuggestion?: string; // Suggested name by pruning utility (e.g. "Exit from [MainNodeA_Name]")
}

export interface MapChainToRefine {
  mainNodeA_Id: string;
  mainNodeB_Id: string;
  featureA_Info: MapChainFeatureInfo; // Feature child of mainNodeA
  featureB_Info: MapChainFeatureInfo; // Feature child of mainNodeB
  edgeBetweenFeatures_Id: string; // ID of the edge connecting featureA and featureB (if it exists and needs refinement)
  originalDirectEdgeId: string; // ID of the original direct edge between mainNodeA and mainNodeB that was removed
}
// --- End Map Pruning & Refinement Types ---

export interface MinimalModelCallRecord {
  prompt: string;
  systemInstruction: string;
  modelUsed: string;
  responseText: string;
}

export interface DebugPacket {
  prompt: string;
  rawResponseText: string | null;
  parsedResponse: GameStateFromAI | DialogueSummaryResponse | null;
  error?: string;
  timestamp: string;
  mapUpdateDebugInfo?: {
    prompt: string;
    rawResponse?: string;
    parsedPayload?: AIMapUpdatePayload;
    validationError?: string;
    minimalModelCalls?: MinimalModelCallRecord[];
  } | null;
  mapPruningDebugInfo?: {
    pruningDebugInfo?: { chainsToRefineCount: number };
    refinementDebugInfo?: {
      prompt?: string;
      rawResponse?: string;
      parsedPayload?: AIMapUpdatePayload;
      validationError?: string;
    };
  } | null;
}


export interface FullGameState {
  saveGameVersion: string; 
  currentThemeName: string | null; // Retained for quick access and backward compatibility
  currentThemeObject: AdventureTheme | null; // Stores the full theme object
  currentScene: string;
  actionOptions: string[]; 
  mainQuest: string | null;
  currentObjective: string | null;
  inventory: Item[];
  gameLog: string[]; 
  lastActionLog: string | null;
  themeHistory: ThemeHistoryState;
  pendingNewThemeNameAfterShift: string | null; 
  allCharacters: Character[];
  mapData: MapData; // Single source of truth for map/location data
  currentMapNodeId: string | null; // ID of the MapNode the player is currently at
  mapLayoutConfig: MapLayoutConfig; 
  score: number;
  localTime: string | null;
  localEnvironment: string | null;
  localPlace: string | null; // Free-text description, ideally aligns with a map node
  turnsSinceLastShift: number;
  globalTurnNumber: number; // New field
  dialogueState: DialogueData | null;
  isCustomGameMode: boolean; 

  // Configuration snapshot (remains part of FullGameState for runtime and saving)
  playerGender: string;
  enabledThemePacks: ThemePackName[];
  stabilityLevel: number;
  chaosLevel: number;

  // Transient/Debug fields (not part of SavedGameDataShape)
  objectiveAnimationType: 'success' | 'neutral' | null;
  lastDebugPacket: DebugPacket | null; 
  lastTurnChanges: TurnChanges | null; 
  isAwaitingManualShiftThemeSelection?: boolean; // Transient: True if game is waiting for theme selection after manual shift in custom mode
}

// Defines the subset of FullGameState that is actually saved for V3.
export type SavedGameDataShape = Pick<
  FullGameState,
  | 'saveGameVersion'
  | 'currentThemeName' // Retained for backward compatibility and quick lookup
  | 'currentThemeObject' // Added for full theme object persistence
  | 'currentScene'
  | 'actionOptions'
  | 'mainQuest'
  | 'currentObjective'
  | 'inventory'
  | 'gameLog'
  | 'lastActionLog'
  | 'themeHistory'
  | 'pendingNewThemeNameAfterShift'
  | 'allCharacters'
  | 'mapData'
  | 'currentMapNodeId' 
  | 'mapLayoutConfig' 
  | 'score'
  | 'localTime'
  | 'localEnvironment'
  | 'localPlace'
  | 'turnsSinceLastShift'
  | 'globalTurnNumber'
  | 'playerGender'
  | 'enabledThemePacks'
  | 'stabilityLevel'
  | 'chaosLevel'
  | 'isCustomGameMode' 
>;

export type GameStateStack = [FullGameState, FullGameState?];


export interface ProcessedGameContext {
  inventory: Item[];
  mainQuest: string | null;
  currentObjective: string | null;
  mapData: MapData; // Main map nodes of the current theme will be used for place context
  currentThemeName: string | null; 
  currentThemeObject: AdventureTheme | null; // Added
  allCharacters: Character[];
  localTime: string | null;
  localEnvironment: string | null;
  localPlace: string | null;
  sceneDescription: string; 
  actionOptions: string[];    
  // allPlaces removed
}

// Payload for a validated character update, used in parsing
export type ValidCharacterUpdatePayload = {
  name: string;
  newDescription?: string;
  newAliases?: string[];
  addAlias?: string;
  newPresenceStatus?: Character['presenceStatus'];
  newLastKnownLocation?: string | null;
  newPreciseLocation?: string | null;
};

// Payload for a validated new character, used in parsing
export type ValidNewCharacterPayload = {
  name: string;
  description: string;
  aliases?: string[];
  presenceStatus?: Character['presenceStatus'];
  lastKnownLocation?: string | null;
  preciseLocation?: string | null;
};
