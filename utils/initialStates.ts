

/**
 * @file utils/initialStates.ts
 * @description Provides functions creating initial game states.
 */
import {
  AdventureTheme,
  FullGameState,
  HeroBackstory,
  HeroSheet,
  MapLayoutConfig,
  StoryArc,
  ThemePackName,
  WorldFacts,
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

export const PLACEHOLDER_THEME: AdventureTheme = {
  name: 'Pending Adventure',
  storyGuidance: 'Theme selection is still in progress.',
  playerJournalStyle: 'typed',
};

export const createDefaultWorldFacts = (): WorldFacts => ({
  geography: 'Unknown',
  climate: 'Unknown',
  technologyLevel: 'Unknown',
  supernaturalElements: 'Unknown',
  majorFactions: [],
  keyResources: [],
  culturalNotes: [],
  notableLocations: [],
});

export const createDefaultHeroSheet = (): HeroSheet => ({
  name: 'Hero',
  gender: 'Male',
  heroShortName: 'Hero',
  occupation: '',
  traits: [],
  startingItems: [],
});

export const createDefaultHeroBackstory = (): HeroBackstory => ({
  fiveYearsAgo: '',
  oneYearAgo: '',
  sixMonthsAgo: '',
  oneMonthAgo: '',
  oneWeekAgo: '',
  yesterday: '',
  now: '',
});

export const createDefaultStoryArc = (): StoryArc => ({
  title: 'Uncharted Journey',
  overview: 'The grand tale has not yet begun.',
  acts: [
    {
      actNumber: 1,
      title: 'Act I: Beginnings',
      description: 'Awaiting initialization.',
      mainObjective: 'Initialize the adventure.',
      sideObjectives: [],
      successCondition: 'Complete initial setup.',
      completed: false,
    },
  ],
  currentAct: 1,
});

/**
 * Creates a default FullGameState with all numeric counters and collections
 * initialized to their starting values.
 */
export const getInitialGameStates = (): FullGameState => {
  return {
    saveGameVersion: CURRENT_SAVE_GAME_VERSION, 
    theme: PLACEHOLDER_THEME,
    currentScene: "", 
    mainQuest: "",
    currentObjective: null,
    actionOptions: [],
    inventory: [],
    playerJournal: [],
    lastJournalWriteTurn: 0,
    lastJournalInspectTurn: 0,
    lastLoreDistillTurn: 0,
    gameLog: [],
    lastActionLog: 'No actions recorded yet.',
    themeFacts: [],
    worldFacts: createDefaultWorldFacts(),
    heroSheet: createDefaultHeroSheet(),
    heroBackstory: createDefaultHeroBackstory(),
    storyArc: createDefaultStoryArc(),
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
    isVictory: false,
    startState: 'idle',
    turnState: 'idle',

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
