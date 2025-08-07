

/**
 * @file utils/initialStates.ts
 * @description Provides functions creating initial game states.
 */
import {
  FullGameState,
  MapLayoutConfig,
  ThemePackName
} from '../types';
import {
    CURRENT_SAVE_GAME_VERSION,
    DEFAULT_ENABLED_THEME_PACKS
} from '../constants';
import {
  DEFAULT_IDEAL_EDGE_LENGTH,
  DEFAULT_NESTED_PADDING,
  DEFAULT_NESTED_ANGLE_PADDING,
} from './mapLayoutUtils';
import {
  DEFAULT_LABEL_MARGIN_PX,
  DEFAULT_LABEL_LINE_HEIGHT_EM,
  DEFAULT_LABEL_OVERLAP_MARGIN_PX,
  DEFAULT_ITEM_ICON_SCALE,
  DEFAULT_VIEWBOX,
} from '../constants';


const getDefaultMapLayoutConfig = (): MapLayoutConfig => ({
    IDEAL_EDGE_LENGTH: DEFAULT_IDEAL_EDGE_LENGTH,
    NESTED_PADDING: DEFAULT_NESTED_PADDING,
    NESTED_ANGLE_PADDING: DEFAULT_NESTED_ANGLE_PADDING,
    LABEL_MARGIN_PX: DEFAULT_LABEL_MARGIN_PX,
    LABEL_LINE_HEIGHT_EM: DEFAULT_LABEL_LINE_HEIGHT_EM,
    LABEL_OVERLAP_MARGIN_PX: DEFAULT_LABEL_OVERLAP_MARGIN_PX,
    ITEM_ICON_SCALE: DEFAULT_ITEM_ICON_SCALE,
});

/**
 * Creates a default FullGameState with all numeric counters and collections
 * initialized to their starting values.
 */
export const getInitialGameStates = (): FullGameState => {
  return {
    saveGameVersion: CURRENT_SAVE_GAME_VERSION, 
    currentTheme: null, // Initialize currentTheme
    currentScene: "", 
    mainQuest: null, 
    currentObjective: null,
    actionOptions: [],
    inventory: [],
    playerJournal: [],
    lastJournalWriteTurn: 0,
    lastJournalInspectTurn: 0,
    lastLoreDistillTurn: 0,
    gameLog: [],
    lastActionLog: null,
    themeFacts: [],
    worldFacts: null,
    heroSheet: null,
    heroBackstory: null,
    storyArc: null,
    allNPCs: [],
    mapData: { nodes: [], edges: [] },
    currentMapNodeId: null,
    destinationNodeId: null,
    mapLayoutConfig: getDefaultMapLayoutConfig(),
    mapViewBox: DEFAULT_VIEWBOX,
    score: 0,
    localTime: "Unknown",
    localEnvironment: "Unknown",
    localPlace: "Unknown",
    globalTurnNumber: 0, // Initialized to 0
    
    dialogueState: null, 

    // Transient/Debug fields initialized
    objectiveAnimationType: null,
    lastDebugPacket: null,
    lastTurnChanges: null, 
    // Configuration snapshot
    enabledThemePacks: [...DEFAULT_ENABLED_THEME_PACKS],
    thinkingEffort: 'Medium',

    debugLore: false,
    debugGoodFacts: [],
    debugBadFacts: [],
  };
};

/**
 * Creates an initial game state using the specified configuration options.
 * Useful when starting a new game with user-supplied settings.
 */
export const getInitialGameStatesWithSettings = (
  enabledThemePacks: Array<ThemePackName>,
): FullGameState => {
  const base = getInitialGameStates();
  base.enabledThemePacks = [...enabledThemePacks];
  return base;
};
