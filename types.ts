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
  LOADING_REASON_UI_MAP,
  ThemePackNameConst,
} from './constants';

export type ItemType = typeof VALID_ITEM_TYPES[number];
export type PresenceStatus = typeof VALID_PRESENCE_STATUS_VALUES[number];
export type ThemePackName = ThemePackNameConst;
export type ItemTag = typeof VALID_TAGS[number];

export type LoadingReason = keyof typeof LOADING_REASON_UI_MAP | null;
export type ThinkingEffort = 'Low' | 'Medium' | 'High';

// Explicit UI/logic states for app boot and turn loop
export type GameStartState =
  | 'idle'              // app not ready yet or no decision
  | 'title'             // title menu shown, waiting for user
  | 'gender_select'     // gender selection modal active
  | 'character_select'  // character selection modal active
  | 'seeding_facts'     // loremaster initial facts extraction
  | 'first_turn_ai'     // storyteller first turn request in-flight
  | 'loremaster_extract' // initial lore refinement after first turn
  | 'ready';            // game is initialized and awaiting input

export type GameTurnState =
  | 'idle'                 // not yet started
  | 'awaiting_input'       // waiting for player
  | 'player_action_prompt' // building prompt/context for action
  | 'storyteller'          // storyteller call in-flight
  | 'loremaster_collect'   // loremaster selecting relevant facts before storyteller
  | 'map_updates'          // applying map updates
  | 'inventory_updates'    // applying inventory/librarian hints
  | 'librarian_updates'    // applying librarian (written items) hints
  | 'loremaster_extract'    // loremaster refinement main step (extract)
  | 'dialogue_memory'      // creating NPC memories from dialogue
  | 'dialogue_turn'        // in-dialogue per-turn
  | 'dialogue_summary'     // summarizing dialogue outcome
  | 'act_transition'       // act intro/transition handling
  | 'victory'              // victory screen
  | 'error';               // error handling state

export interface GameSettings {
  enabledThemePacks: Array<ThemePackName>;
  thinkingEffort: ThinkingEffort;
  preferredPlayerName?: string;
}

export type MapNodeType = typeof VALID_NODE_TYPE_VALUES[number];
export type MapNodeStatus = typeof VALID_NODE_STATUS_VALUES[number];
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
  actualContent?: string;  // Optional, added when the player reads the item
  visibleContent?: string;  // Optional, added when the player reads the item
  imageData?: string;  // Optional, added when the player reads the item
}

export interface ItemData {
  name: string;
  type: ItemType;
  description: string; // Default/inactive description
  activeDescription?: string | null; // Optional: Description when item.isActive is true, null clears it
  isActive?: boolean; // Defaults to false if undefined
  knownUses?: Array<KnownUse>; // Discovered specific ways to use the item
  tags?: Array<ItemTag>; // Tags for classification, e.g., ["junk"]
  chapters?: Array<ItemChapter>; // Text content for written items
}

export interface Item extends ItemData {
  id: string;
  holderId: string; // ID of the entity holding this item or 'player'
  stashed?: boolean; // Hidden pages and books when true
  lastWriteTurn?: number;
  lastInspectTurn?: number;
}

export type ItemCreatePayload = ItemData & {
  id?: string;
  holderId: string;
};

export interface ItemReference {
  id?: Item['id'];
  name?: Item['name'];
}

export interface MoveItemPayload {
  id?: Item['id'];
  name?: Item['name'];
  newHolderId: Item['holderId'];
}

export type ItemChangePayload =
  Partial<ItemData> & {
    id?: string;
    holderId?: string;
    newName?: string;
  };

export interface AddDetailsPayload extends Pick<ItemData, 'name' | 'type' | 'knownUses' | 'tags' | 'chapters'> {
  id: Item['id'];
}

export type ItemChange =
  | {
      action: 'create';
      item: ItemCreatePayload;
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
  name: string;
  description: string;
  aliases?: Array<string>;
  presenceStatus: PresenceStatus;
  attitudeTowardPlayer: string;
  knowsPlayerAs: Array<string>;
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

export interface DialogueNpcAttitudeUpdate {
  name: string;
  newAttitudeTowardPlayer: string;
}

export interface DialogueNpcKnownNameUpdate {
  name: string;
  newKnownPlayerNames?: Array<string>;
  addKnownPlayerName?: string;
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
  npcAttitudeUpdates?: Array<DialogueNpcAttitudeUpdate>;
  npcKnownNameUpdates?: Array<DialogueNpcKnownNameUpdate>;
}

// Context object for building a dialogue turn prompt
export interface DialogueTurnContext {
  theme: AdventureTheme;
  currentQuest: string | null;
  currentObjective: string | null;
  currentScene: string;
  storyArc?: StoryArc | null;
  localTime: string | null;
  localEnvironment: string | null;
  localPlace: string | null;
  knownMainMapNodes: Array<MapNode>;
  knownNPCs: Array<NPC>;
  inventory: Array<Item>;
  heroSheet: HeroSheet | null;
  dialogueHistory: Array<DialogueHistoryEntry>;
  playerLastUtterance: string;
  dialogueParticipants: Array<string>;
  relevantFacts: Array<string>;
}

export interface DialogueSummaryContext {
  mainQuest: string | null;
  currentObjective: string | null;
  currentScene: string;
  storyArc?: StoryArc | null;
  localTime: string | null;
  localEnvironment: string | null;
  localPlace: string | null; // The free-text local place string
  mapDataSnapshot: MapData; // Map data snapshot for summary generation
  knownNPCs: Array<NPC>;
  inventory: Array<Item>;
  dialogueLog: Array<DialogueHistoryEntry>;
  dialogueParticipants: Array<string>;
  heroSheet: HeroSheet | null;
  themeName: string; // Retained for direct theme name access if needed
  theme: AdventureTheme | null; // Added for full theme object access
}

// New context type for detailed memory summarization
export interface DialogueMemorySummaryContext {
  themeName: string; // Retained for direct theme name access if needed
  theme: AdventureTheme | null; // Added for full theme object access
  currentScene: string; // Scene at the START of the dialogue
  storyArc?: StoryArc | null;
  localTime: string | null;
  localEnvironment: string | null;
  localPlace: string | null;
  dialogueParticipants: Array<string>;
  dialogueLog: Array<DialogueHistoryEntry>;
  heroShortName?: string;
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
    attitudeTowardPlayer: string;
    knowsPlayerAs?: Array<string>;
    lastKnownLocation?: string | null; 
    preciseLocation?: string | null;
  }>; 
  npcsUpdated?: Array<{
    name: string;
    newDescription?: string;
    newAliases?: Array<string>;
    addAlias?: string;
    newPresenceStatus?: NPC['presenceStatus'];
    newAttitudeTowardPlayer?: string;
    newKnownPlayerNames?: Array<string>;
    newKnownPlayerName?: string | null;
    newLastKnownLocation?: string | null;
    newPreciseLocation?: string | null;
  }>;
  objectiveAchieved?: boolean;
  mainQuestAchieved?: boolean;
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
  librarianHint?: string;
  newItems?: Array<ItemData>;
}

export interface AdventureTheme {
  name: string;
  storyGuidance: string;
  playerJournalStyle: 'handwritten' | 'typed' | 'printed' | 'digital';
}


export interface FactWithEntities {
  text: string;
  entities: Array<string>;
}

export interface LoreFact {
  id: number;
  text: string;
  entities: Array<string>;
  createdTurn: number;
  tier: number;
}

export interface LoreFactChange {
  action: 'add' | 'change' | 'delete';
  text?: string;
  entities?: Array<string>;
  tier?: number;
  createdTurn?: number;
  id?: number;
}

export interface GeneratedJournalEntry {
  heading: string;
  text: string;
}

export interface LoreRefinementResult {
  factsChange: Array<LoreFactChange>;
  loreRefinementOutcome: string;
  observations?: string;
  rationale?: string;
}

export interface WorldSheet {
  geography: string;
  climate: string;
  technologyLevel: string;
  supernaturalElements: string;
  majorFactions: Array<string>;
  keyResources: Array<string>;
  culturalNotes: Array<string>;
  notableLocations: Array<string>;
}

export interface HeroSheet {
  name: string;
  gender: string;
  heroShortName: string; // Single-word UI name; only alphanumeric and hyphen
  occupation: string;
  traits: Array<string>;
  startingItems: Array<string>;
}

export interface HeroBackstory {
  fiveYearsAgo: string;
  oneYearAgo: string;
  sixMonthsAgo: string;
  oneMonthAgo: string;
  oneWeekAgo: string;
  yesterday: string;
  now: string;
}

export interface CharacterOption {
  name: string;
  description: string;
}

export interface StoryAct {
  actNumber: number;
  title: string;
  description: string;
  mainObjective: string;
  sideObjectives: Array<string>;
  successCondition: string;
  completed: boolean;
}

export interface StoryArc {
  title: string;
  overview: string;
  acts: Array<StoryAct>;
  currentAct: number;
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
  mainQuestAchieved: boolean;
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
  type: MapNodeType;
  /** Optional legacy field retained for backward compatibility */
  nodeType?: MapNodeType;
  /** Pre-calculated radius used by nested circle layouts. */
  visualRadius?: number;
  [key: string]: unknown; // For any other custom data.
}

export interface MapNode extends MapNodeData {
  id: string; // Unique identifier for the node
  placeName: string; // User-facing name of the location/feature. Must be unique within its theme.
  position: { x: number; y: number }; // For map visualization
}

export interface MapEdgeData {
  description?: string;
  type: MapEdgeType;
  status: MapEdgeStatus;
  travelTime?: string;
  [key: string]: unknown;
}

export interface MapEdge extends MapEdgeData {
  id: string; // Unique identifier for the edge
  sourceNodeId: string;
  targetNodeId: string;
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
  description?: string;
  status?: MapEdgeData['status'];
  travelTime?: string;
  type?: MapEdgeData['type'];
}

export interface AIEdgeAdd extends AIEdgeUpdate {
  status: MapEdgeData['status'];
  type: MapEdgeData['type'];
}

export interface AINodeUpdate {
  placeName: string; // Existing node ID or name to identify it.
  aliases?: Array<string>;
  description?: string;
  type?: MapNodeData['type'];
  nodeType?: MapNodeData['type'];
  parentNodeId?: string;
  status?: MapNodeData['status'];
  newPlaceName?: string;
}

export interface AINodeAdd extends AINodeUpdate {
  aliases: Array<string>;
  description: string;
  type: MapNodeData['type'];
  parentNodeId: string;
  status: MapNodeData['status'];
}

export interface AIMapUpdatePayload {
  observations?: string | null;
  rationale?: string | null;
  nodesToAdd?: Array<AINodeAdd> | null;
  nodesToUpdate?: Array<AINodeUpdate> | null;
  nodesToRemove?: Array<{ nodeId: string; nodeName?: string; }> | null;
  edgesToAdd?: Array<AIEdgeAdd> | null;
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
  librarianDebugInfo?: {
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
  theme: AdventureTheme; // Stores the full theme object
  currentScene: string;
  actionOptions: Array<string>; 
  mainQuest: string;
  currentObjective: string | null;
  inventory: Array<Item>;
  playerJournal: Array<ItemChapter>;
  lastJournalWriteTurn: number;
  lastJournalInspectTurn: number;
  lastLoreDistillTurn: number;
  gameLog: Array<string>;
  lastActionLog: string;
  loreFacts: Array<LoreFact>;
  WorldSheet: WorldSheet;
  heroSheet: HeroSheet;
  heroBackstory: HeroBackstory;
  storyArc: StoryArc;
  allNPCs: Array<NPC>;
  mapData: MapData; // Single source of truth for map/location data
  currentMapNodeId: string | null; // ID of the MapNode the player is currently at
  destinationNodeId: string | null; // Optional destination node ID
  mapLayoutConfig: MapLayoutConfig;
  mapViewBox: string;
  score: number;
  localTime: string;
  localEnvironment: string;
  localPlace: string; // Free-text description, ideally aligns with a map node
  globalTurnNumber: number; // New field
  dialogueState: DialogueData | null;
  isVictory: boolean;

  // Explicit state machines (transient; not persisted in save subset)
  startState?: GameStartState;
  turnState?: GameTurnState;

  // Configuration snapshot (remains part of FullGameState for runtime and saving)
  enabledThemePacks: Array<ThemePackName>;
  thinkingEffort: ThinkingEffort;

  debugLore: boolean;
  debugGoodFacts: Array<string>;
  debugBadFacts: Array<string>;

  // Transient/Debug fields (not part of SavedGameDataShape)
  objectiveAnimationType: 'success' | 'neutral' | null;
  lastDebugPacket: DebugPacket | null; 
  lastTurnChanges: TurnChanges | null; 
}

// Defines the subset of FullGameState that is actually saved.
export type SavedGameDataShape = Pick<
  FullGameState,
  | 'saveGameVersion'
  | 'theme' // Full theme object persistence
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
  | 'loreFacts'
  | 'WorldSheet'
  | 'heroSheet'
  | 'heroBackstory'
  | 'storyArc'
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
  | 'globalTurnNumber'
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
  newAttitudeTowardPlayer?: string;
  newKnownPlayerNames?: Array<string>;
  newKnownPlayerName?: string | null;
  newLastKnownLocation?: string | null;
  newPreciseLocation?: string | null;
}

// Payload for a validated new NPC, used in parsing
export interface ValidNewNPCPayload {
  name: string;
  description: string;
  aliases?: Array<string>;
  presenceStatus?: NPC['presenceStatus'];
  attitudeTowardPlayer: string;
  knowsPlayerAs?: Array<string>;
  lastKnownLocation?: string | null;
  preciseLocation?: string | null;
}
