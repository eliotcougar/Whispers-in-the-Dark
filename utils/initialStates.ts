

/**
 * @file utils/initialStates.ts
 * @description Provides functions creating initial game states.
 */
import {
  FullGameState,
  MapData,
  MapLayoutConfig,
  ThemePackName
} from '../types';
import { 
    CURRENT_SAVE_GAME_VERSION, 
    DEFAULT_PLAYER_GENDER, 
    DEFAULT_ENABLED_THEME_PACKS, 
    DEFAULT_STABILITY_LEVEL, 
    DEFAULT_CHAOS_LEVEL 
} from '../constants';
import { 
    DEFAULT_K_REPULSION, DEFAULT_K_SPRING, DEFAULT_IDEAL_EDGE_LENGTH, 
    DEFAULT_K_CENTERING, DEFAULT_K_UNTANGLE, DEFAULT_K_EDGE_NODE_REPULSION, // Added
    DEFAULT_DAMPING_FACTOR, DEFAULT_MAX_DISPLACEMENT, DEFAULT_LAYOUT_ITERATIONS 
} from './mapLayoutUtils';


const getDefaultMapLayoutConfig = (): MapLayoutConfig => ({
    K_REPULSION: DEFAULT_K_REPULSION,
    K_SPRING: DEFAULT_K_SPRING,
    IDEAL_EDGE_LENGTH: DEFAULT_IDEAL_EDGE_LENGTH,
    K_CENTERING: DEFAULT_K_CENTERING,
    K_UNTANGLE: DEFAULT_K_UNTANGLE,
    K_EDGE_NODE_REPULSION: DEFAULT_K_EDGE_NODE_REPULSION, // Added
    DAMPING_FACTOR: DEFAULT_DAMPING_FACTOR,
    MAX_DISPLACEMENT: DEFAULT_MAX_DISPLACEMENT,
    iterations: DEFAULT_LAYOUT_ITERATIONS,
});

/**
 * Creates a default FullGameState with all numeric counters and collections
 * initialized to their starting values.
 */
export const getInitialGameStates = (): FullGameState => {
  return {
    saveGameVersion: CURRENT_SAVE_GAME_VERSION, 
    currentThemeName: null,
    currentThemeObject: null, // Initialize currentThemeObject
    currentScene: "", 
    mainQuest: null, 
    currentObjective: null,
    actionOptions: [],
    inventory: [],
    gameLog: ["Welcome to Whispers in the Dark!"],
    lastActionLog: null,
    themeHistory: {},
    pendingNewThemeNameAfterShift: null,
    allCharacters: [],
    mapData: { nodes: [], edges: [] }, 
    currentMapNodeId: null, 
    mapLayoutConfig: getDefaultMapLayoutConfig(),
    score: 0,
    localTime: "Unknown",
    localEnvironment: "Unknown",
    localPlace: "Unknown",
    turnsSinceLastShift: 0,
    globalTurnNumber: 0, // Initialized to 0
    isCustomGameMode: false, // Initialize custom game mode
    
    dialogueState: null, 

    // Transient/Debug fields initialized
    objectiveAnimationType: null,
    lastDebugPacket: null,
    lastTurnChanges: null, 
    isAwaitingManualShiftThemeSelection: false, // Initialized
    // Configuration snapshot
    playerGender: DEFAULT_PLAYER_GENDER,
    enabledThemePacks: [...DEFAULT_ENABLED_THEME_PACKS],
    stabilityLevel: DEFAULT_STABILITY_LEVEL,
    chaosLevel: DEFAULT_CHAOS_LEVEL,
  };
};

/**
 * Creates an initial game state using the specified configuration options.
 * Useful when starting a new game with user-supplied settings.
 */
export const getInitialGameStatesWithSettings = (
  playerGender: string,
  enabledThemePacks: ThemePackName[],
  stabilityLevel: number,
  chaosLevel: number
): FullGameState => {
  const base = getInitialGameStates();
  base.playerGender = playerGender;
  base.enabledThemePacks = [...enabledThemePacks];
  base.stabilityLevel = stabilityLevel;
  base.chaosLevel = chaosLevel;
  return base;
};
