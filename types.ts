/**
 * @file types.ts
 * @description Shared TypeScript interfaces and types for the game's data structures.
 */

import {
  VALID_ITEM_TYPES,
  VALID_PRESENCE_STATUS_VALUES,
  VALID_NODE_STATUS_VALUES,
  VALID_NODE_TYPE_VALUES,
  VALID_EDGE_TYPE_VALUES,
  VALID_EDGE_STATUS_VALUES,
  VALID_TAGS,
  LOADING_REASONS,
  ThemePackNameConst,
} from './constants';

export type ItemType = typeof VALID_ITEM_TYPES[number];
export type PresenceStatus = typeof VALID_PRESENCE_STATUS_VALUES[number];
export type ThemePackName = ThemePackNameConst;
export type ItemTag = typeof VALID_TAGS[number];

export type LoadingReason = typeof LOADING_REASONS[number] | null;

export type MapNodeStatus = typeof VALID_NODE_STATUS_VALUES[number];
export type MapNodeType = typeof VALID_NODE_TYPE_VALUES[number];
export type MapEdgeType = typeof VALID_EDGE_TYPE_VALUES[number];
export type MapEdgeStatus = typeof VALID_EDGE_STATUS_VALUES[number];


export interface KnownUse {
  actionName: string; // Text for the button, e.g., "Light Torch"
  promptEffect: string; // What to send to AI, e.g., "Player attempts to light the Torch"
  description: string; // A small hint or detail about this use
  appliesWhenActive?: boolean; // If true, this use is shown when item.isActive is true
  appliesWhenInactive?: boolean; // If true, this use is shown when item.isActive is false (or undefined)
}

export interface ItemChapter {
  heading: string;
  description: string;
  contentLength: number;
  actualContent?: string;
  visibleContent?: string;
  imageData?: string;
}

export interface Item {
  id: string;
  name: string;
  type: ItemType;
  description: string; // Default/inactive description
  activeDescription?: string; // Optional: Description when item.isActive is true
  isActive?: boolean; // Defaults to false if undefined
  knownUses?: Array<KnownUse>; // Discovered specific ways to use the item
  tags?: Array<ItemTag>; // Tags for classification, e.g., ["junk"]
  stashed?: boolean; // Hidden pages and books when true
  holderId: string; // ID of the entity holding this item or 'player'
  /**
   * Text content for written items.
   *
   * For both 'page' and 'book' items, use the `chapters` array.
   * Page items should contain a single chapter object in this array.
   */
  chapters?: Array<ItemChapter>;
  lastWriteTurn?: number;
  lastInspectTurn?: number;
  // --- Fields for "change" action payloads ---
  newName?: string;
}

// This ItemChange is from the AI's perspective, and will be processed into ItemChangeRecord
export interface ItemReference {
  id?: string;
  name?: string;
}

export interface MoveItemPayload {
  id?: string;
  name?: string;
  newHolderId: string;
}

export type ItemChangePayload =
  Partial<Omit<Item, 'activeDescription'>> & { activeDescription?: string | null };

export interface NewItemSuggestion {
  name: string;
  type: ItemType;
  description: string;
  activeDescription?: string;
  isActive?: boolean;
  tags?: Array<ItemTag>;
  holderId?: string;
  chapters?: Array<ItemChapter>;
  knownUses?: Array<KnownUse>;
}

export interface AddDetailsPayload {
  id: string;
  name: string;
  type: ItemType;
  knownUses?: Array<KnownUse>;
  tags?: Array<ItemTag>;
  chapters?: Array<ItemChapter>;
}

export type ItemChange =
  | {
      action: 'create';
      item: Item;
      invalidPayload?: unknown;
    }
  | {
      action: 'destroy';
      item: ItemReference;
      invalidPayload?: unknown;
    }
  | {
      action: 'change';
      item: ItemChangePayload;
      invalidPayload?: unknown;
    }
  | {
      action: 'addDetails';
      item: AddDetailsPayload;
      invalidPayload?: unknown;
    }
  | {
      action: 'move';
      item: MoveItemPayload;
      invalidPayload?: unknown;
    };

export interface DialogueSummaryRecord {
  summaryText: string;
  participants: Array<string>; // Names of NPCs involved in that dialogue
  timestamp: string; // localTime when the dialogue occurred
  location: string; // localPlace where the dialogue occurred
}

export interface NPC {
  id: string;
  themeName: string;
  name: string;
  description: string;
  aliases?: Array<string>;
  presenceStatus: PresenceStatus;
  lastKnownLocation: string | null; // General location when not 'nearby' or 'companion', can be a MapNode.placeName or descriptive
  preciseLocation: string | null;    // Specific location in scene if 'nearby' or 'companion'
  dialogueSummaries?: Array<DialogueSummaryRecord>; // Stores summaries of past dialogues
}

// --- Dialogue Mode Types ---
export interface DialogueTurnResponsePart {
  speaker: string;
  thought?: string;
  line: string;
}

// Alias used throughout the codebase for clarity in dialogue history arrays.
export type DialogueHistoryEntry = DialogueTurnResponsePart;

// New structure for active dialogue state
export interface DialogueData {
  participants: Array<string>;
  history: Array<DialogueHistoryEntry>;
  options: Array<string>;
}

// Structure for AI to return when initiating dialogue
export interface DialogueSetupPayload {
  participants: Array<string>;
  initialNpcResponses: Array<DialogueTurnResponsePart>;
  initialPlayerOptions: Array<string>;
}

export interface DialogueAIResponse { // AI response for a single turn *during* dialogue
  npcResponses: Array<DialogueTurnResponsePart>;
  playerOptions: Array<string>;
  dialogueEnds?: boolean;
  updatedParticipants?: Array<string>;
}

// Context object for building a dialogue turn prompt
export interface DialogueTurnContext {
  currentTheme: AdventureTheme;
  currentQuest: string | null;
  currentObjective: string | null;
  currentScene: string;
  localTime: string | null;
  localEnvironment: string | null;
  localPlace: string | null;
  knownMainMapNodesInTheme: Array<MapNode>;
  knownNPCsInTheme: Array<NPC>;
  inventory: Array<Item>;
  playerGender: string;
  dialogueHistory: Array<DialogueHistoryEntry>;
  playerLastUtterance: string;
  dialogueParticipants: Array<string>;
  relevantFacts: Array<string>;
}

export interface DialogueSummaryContext {
  mainQuest: string | null;
  currentObjective: string | null;
  currentScene: string;
  localTime: string | null;
  localEnvironment: string | null;
  localPlace: string | null; // The free-text local place string
  mapDataForTheme: MapData; // Map data for the current theme (nodes and edges)
  knownNPCsInTheme: Array<NPC>;
  inventory: Array<Item>;
  playerGender: string;
  dialogueLog: Array<DialogueHistoryEntry>; 
  dialogueParticipants: Array<string>;
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
  dialogueParticipants: Array<string>;
  dialogueLog: Array<DialogueHistoryEntry>;
}


export type DialogueSummaryResponse = GameStateFromAI;
// --- End Dialogue Mode Types ---


export interface GameStateFromAI {
  sceneDescription: string; 
  options: Array<string>; 

  mainQuest?: string; 
  currentObjective?: string;
  itemChange: Array<ItemChange>; 
  logMessage?: string;
  npcsAdded?: Array<{ 
    name: string; 
    description: string; 
    aliases?: Array<string>; 
    presenceStatus?: NPC['presenceStatus'];
    lastKnownLocation?: string | null; 
    preciseLocation?: string | null;
  }>; 
  npcsUpdated?: Array<{ 
    name: string; 
    newDescription?: string; 
    newAliases?: Array<string>; 
    addAlias?: string; 
    newPresenceStatus?: NPC['presenceStatus'];
    newLastKnownLocation?: string | null; 
    newPreciseLocation?: string | null;
  }>;
  objectiveAchieved?: boolean;
  localTime?: string;
  localEnvironment?: string;
  localPlace?: string;
  dialogueSetup?: DialogueSetupPayload;
  mapUpdated?: boolean; // This flag signals the map service to run
  currentMapNodeId?: string | undefined; // Suggestion for current location node ID
  mapHint?: string; // Optional hint about distant quest-related locations for MapAI
  playerItemsHint?: string;
  worldItemsHint?: string;
  npcItemsHint?: string;
  newItems?: Array<NewItemSuggestion>;
  // placesAdded and placesUpdated are removed from storyteller responsibility
}

export interface AdventureTheme {
  name: string;
  systemInstructionModifier: string;
  initialMainQuest: string;
  initialCurrentObjective: string;
  initialSceneDescriptionSeed: string;
  initialItems: string;
  playerJournalStyle: 'handwritten' | 'typed' | 'printed' | 'digital';
}

export interface ThemeMemory {
  summary: string;
  mainQuest: string;
  currentObjective: string;
  placeNames: Array<string>; // These will be MapNode.placeName of main map nodes in the theme
  npcNames: Array<string>;
}

export type ThemeHistoryState = Record<string, ThemeMemory>;

export interface FactWithEntities {
  text: string;
  entities: Array<string>;
}

export interface ThemeFact {
  id: number;
  text: string;
  entities: Array<string>;
  themeName: string;
  createdTurn: number;
  tier: number;
}

export interface ThemeFactChange {
  action: 'add' | 'change' | 'delete';
  fact?: Partial<Omit<ThemeFact, 'id' | 'createdTurn'>> & {
    createdTurn?: number;
  };
  id?: number;
}

export interface GeneratedJournalEntry {
  heading: string;
  text: string;
}

export interface LoreRefinementResult {
  factsChange: Array<ThemeFactChange>;
  loreRefinementOutcome: string;
  observations?: string;
  rationale?: string;
}

export interface LoremasterModeDebugInfo {
  prompt: string;
  rawResponse?: string;
  parsedPayload?:
    | Array<string>
    | Array<FactWithEntities>
    | LoreRefinementResult
    | GeneratedJournalEntry;
  observations?: string;
  rationale?: string;
  thoughts?: Array<string>;
  systemInstruction?: string;
  jsonSchema?: unknown;
}

export interface LoremasterRefineDebugInfo {
  extract?: LoremasterModeDebugInfo | null;
  integrate?: LoremasterModeDebugInfo | null;
}

// --- TurnChanges Data Structures ---
export interface ItemChangeRecord {
  type: 'acquire' | 'loss' | 'update';
  acquiredItem?: Item;   // For 'acquire'
  lostItem?: Item;       // For 'loss' (the full item object before it was lost)
  oldItem?: Item;        // For 'update' (item state before update)
  newItem?: Item;        // For 'update' (item state after update, including transformations)
}

export interface NPCChangeRecord {
  type: 'add' | 'update';
  npcName: string; // Common identifier
  addedNPC?: NPC; // For 'add' (will include new presence fields)
  oldNPC?: NPC;   // For 'update' (will include old presence fields)
  newNPC?: NPC;   // For 'update' (will include new presence fields)
}

export interface TurnChanges {
  itemChanges: Array<ItemChangeRecord>;
  npcChanges: Array<NPCChangeRecord>;
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
  LABEL_MARGIN_PX: number;
  LABEL_LINE_HEIGHT_EM: number;
  LABEL_OVERLAP_MARGIN_PX: number;
  /** Fraction of node diameter used for item icon size */
  ITEM_ICON_SCALE: number;
}

export interface MapNodeData {
  description: string; // Description is ALWAYS REQUIRED.
  aliases?: Array<string>;  // Optional, can be updated.
  status: MapNodeStatus;
  visited?: boolean; // Managed by game logic, not AI directly.
  parentNodeId?: string; // ID of parent node for hierarchical placement.
  nodeType: MapNodeType;
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
  type?: MapEdgeType;
  status?: MapEdgeStatus;
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
  nodes: Array<MapNode>;
  edges: Array<MapEdge>;
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
  observations?: string | null;
  rationale?: string | null;
  nodesToAdd?: Array<AINodeUpdate & {
    data: {
      status: MapNodeData['status'];
      parentNodeId: string;
    } & Partial<Omit<MapNodeData, 'status' | 'parentNodeId'>>;
  }> | null;
  nodesToUpdate?: Array<{ placeName: string; newData: Partial<MapNodeData> & { placeName?: string }; }> | null; // Added placeName to newData for renaming
  nodesToRemove?: Array<{ nodeId: string; nodeName?: string; }> | null;
  edgesToAdd?: Array<{ sourcePlaceName: string; targetPlaceName: string; data: MapEdge['data']; }> | null;
  edgesToUpdate?: Array<AIEdgeUpdate> | null;
  edgesToRemove?: Array<{ edgeId: string; sourceId?: string; targetId?: string; }> | null;
  suggestedCurrentMapNodeId?: string | null | undefined;
}
// --- End Map Update Service Payload ---


export interface MinimalModelCallRecord {
  prompt: string;
  systemInstruction: string;
  jsonSchema?: unknown;
  modelUsed: string;
  responseText: string;
  promptUsed?: string;
}

export interface DialogueTurnDebugEntry {
  prompt: string;
  rawResponse: string;
  thoughts?: Array<string>;
}


export interface DebugPacket {
  prompt: string;
  rawResponseText: string | null;
  parsedResponse: GameStateFromAI | null;
  error?: string;
  timestamp: string;
  systemInstruction?: string;
  jsonSchema?: unknown;
  storytellerThoughts?: Array<string> | null;
  mapUpdateDebugInfo?: {
    prompt: string;
    systemInstruction?: string;
    jsonSchema?: unknown;
    rawResponse?: string;
    parsedPayload?: AIMapUpdatePayload;
    validationError?: string;
    observations?: string;
    rationale?: string;
    thoughts?: Array<string>;
    minimalModelCalls?: Array<MinimalModelCallRecord>;
    connectorChainsDebugInfo?: Array<{
      round: number;
      prompt: string;
      rawResponse?: string;
      parsedPayload?: AIMapUpdatePayload;
      validationError?: string;
      thoughts?: Array<string>;
      observations?: string;
      rationale?: string;
    }> | null;
  } | null;
  inventoryDebugInfo?: {
    prompt: string;
    systemInstruction?: string;
    jsonSchema?: unknown;
    rawResponse?: string;
    parsedItemChanges?: Array<ItemChange>;
    observations?: string;
    rationale?: string;
    thoughts?: Array<string>;
  } | null;
  loremasterDebugInfo?: {
    collect?: LoremasterModeDebugInfo | null;
    extract?: LoremasterModeDebugInfo | null;
    integrate?: LoremasterModeDebugInfo | null;
    distill?: LoremasterModeDebugInfo | null;
    journal?: LoremasterModeDebugInfo | null;
  } | null;
  dialogueDebugInfo?: {
    turns: Array<DialogueTurnDebugEntry>;
    systemInstruction?: string;
    jsonSchema?: unknown;
    summaryPrompt?: string;
    summaryRawResponse?: string;
    summaryThoughts?: Array<string>;
  } | null;
}


export interface FullGameState {
  saveGameVersion: string; 
  currentThemeName: string | null; // Retained for quick access and backward compatibility
  currentThemeObject: AdventureTheme | null; // Stores the full theme object
  currentScene: string;
  actionOptions: Array<string>; 
  mainQuest: string | null;
  currentObjective: string | null;
  inventory: Array<Item>;
  playerJournal: Array<ItemChapter>;
  lastJournalWriteTurn: number;
  lastJournalInspectTurn: number;
  lastLoreDistillTurn: number;
  gameLog: Array<string>;
  lastActionLog: string | null;
  themeHistory: ThemeHistoryState;
  themeFacts: Array<ThemeFact>;
  pendingNewThemeNameAfterShift: string | null;
  allNPCs: Array<NPC>;
  mapData: MapData; // Single source of truth for map/location data
  currentMapNodeId: string | null; // ID of the MapNode the player is currently at
  destinationNodeId: string | null; // Optional destination node ID
  mapLayoutConfig: MapLayoutConfig;
  mapViewBox: string;
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
  enabledThemePacks: Array<ThemePackName>;
  stabilityLevel: number;
  chaosLevel: number;

  debugLore: boolean;
  debugGoodFacts: Array<string>;
  debugBadFacts: Array<string>;

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
  | 'playerJournal'
  | 'lastJournalWriteTurn'
  | 'lastJournalInspectTurn'
  | 'lastLoreDistillTurn'
  | 'gameLog'
  | 'lastActionLog'
  | 'themeHistory'
  | 'themeFacts'
  | 'pendingNewThemeNameAfterShift'
  | 'allNPCs'
  | 'mapData'
  | 'currentMapNodeId'
  | 'destinationNodeId'
  | 'mapLayoutConfig'
  | 'mapViewBox'
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

export type DebugPacketStack = [DebugPacket | null, (DebugPacket | null)?];

export interface SavedGameStack {
  current: SavedGameDataShape;
  previous: SavedGameDataShape | null;
}



// Payload for a validated NPC update, used in parsing
export interface ValidNPCUpdatePayload {
  name: string;
  newDescription?: string;
  newAliases?: Array<string>;
  addAlias?: string;
  newPresenceStatus?: NPC['presenceStatus'];
  newLastKnownLocation?: string | null;
  newPreciseLocation?: string | null;
}

// Payload for a validated new NPC, used in parsing
export interface ValidNewNPCPayload {
  name: string;
  description: string;
  aliases?: Array<string>;
  presenceStatus?: NPC['presenceStatus'];
  lastKnownLocation?: string | null;
  preciseLocation?: string | null;
}
