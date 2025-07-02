
/**
 * @file constants.ts
 * @description Global constants and default configuration values.
 */


// Using gemini-2.5-flash model specified by API guidelines for general text tasks.
export const GEMINI_MODEL_NAME = "gemini-2.5-flash";
export const GEMINI_LITE_MODEL_NAME = "gemini-2.5-flash-lite-preview-06-17"; // Updated for better capability
export const MINIMAL_MODEL_NAME = "gemma-3-27b-it" // Model for simplest string outputs
export const TINY_MODEL_NAME = "gemma-3n-e4b-it" // Fastest free model with 8000 input limit

// Temperature used for correction helpers
export const CORRECTION_TEMPERATURE = 0.8;

// Per-minute rate limits for each model
export const GEMINI_MODEL_RPM = 10;
export const GEMINI_LITE_MODEL_RPM = 15;
export const MINIMAL_MODEL_RPM = 30;
export const TINY_MODEL_RPM = 30;

// List of available theme pack names used for default configuration.
export const ALL_THEME_PACK_NAMES_CONST = [
  'Fantasy & Myth',
  'Science Fiction & Future',
  'Horror & Dark Mystery',
  'Action & Wasteland',
  'Testing',
] as const;

export type ThemePackNameConst = typeof ALL_THEME_PACK_NAMES_CONST[number];

export const MAX_RETRIES = 3; // Max retries for most API calls
export const MAX_CHAIN_REFINEMENT_ROUNDS = 3; // Max rounds for refining connector chains
export const MAX_LOG_MESSAGES = 50; // Maximum number of messages to keep in the game log

export const DEVELOPER = "Eliot the Cougar"
export const CURRENT_GAME_VERSION = "1.4.0 (Ink and Quill)";
export const CURRENT_SAVE_GAME_VERSION = "7";
export const LOCAL_STORAGE_SAVE_KEY = "whispersInTheDark_gameState";
export const LOCAL_STORAGE_DEBUG_KEY = "whispersInTheDark_debugPacket";
export const LOCAL_STORAGE_DEBUG_LORE_KEY = "whispersInTheDark_debugLore";
export const LOCAL_STORAGE_API_KEY = "whispersInTheDark_geminiApiKey";
export const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID ?? '';

export const DEFAULT_STABILITY_LEVEL = 30; // Number of turns before chaos can occur
export const DEFAULT_CHAOS_LEVEL = 5;   // Percentage chance of chaos shift
export const DEFAULT_ENABLED_THEME_PACKS = ALL_THEME_PACK_NAMES_CONST.filter(
  name => name !== 'Testing'
);
export const DEFAULT_PLAYER_GENDER = "Male";
export const PLAYER_HOLDER_ID = "player";
export const PLAYER_JOURNAL_ID = "player_journal";

export const MAIN_TURN_OPTIONS_COUNT = 6; // Number of action choices shown each main turn

export const FREE_FORM_ACTION_MAX_LENGTH = 70;
export const FREE_FORM_ACTION_COST = 5;

export const JOURNAL_WRITE_COOLDOWN = 5; // Turns before a journal can be written again

export const INSPECT_COOLDOWN = 10; // Turns before the same item can be inspected again

export const DISTILL_LORE_INTERVAL = 10; // Turns between automatic lore distillation

export const MIN_BOOK_CHAPTERS = 4;
export const MAX_BOOK_CHAPTERS = 10;

export const VALID_ITEM_TYPES = [
  'single-use',
  'multi-use',
  'equipment',
  'container',
  'key',
  'weapon',
  'ammunition',
  'vehicle',
  'immovable',
  'status effect',
  'page',
  'book',
  'picture',
  'map',
] as const; // 'as const' makes it a tuple of string literals

export const VALID_ITEM_TYPES_STRING = VALID_ITEM_TYPES.map(type => type).join(', ');

export const VALID_ACTIONS = [
  'create',
  'change',
  'move',
  'destroy',
  'addDetails',
] as const;
export const VALID_ACTIONS_STRING = VALID_ACTIONS.map(action => action).join(', ');

export const COMMON_TAGS = [
  'default',
  'junk',
] as const;

export const INTERNAL_TAGS = ['stashed'] as const;

export const TEXT_STYLE_TAGS = [
  'printed',
  'handwritten',
  'typed',
  'digital',
] as const;

export const TEXT_MOD_TAGS = [
  'faded',
  'smudged',
  'torn',
  'glitching',
  'encrypted',
  'foreign',
  'gothic',
  'runic',
  'recovered',
] as const;

export const WRITING_TAGS = [...TEXT_STYLE_TAGS, ...TEXT_MOD_TAGS] as const;

export const VALID_TAGS = [...COMMON_TAGS, ...INTERNAL_TAGS, ...WRITING_TAGS] as const;

export const COMMON_TAGS_STRING = COMMON_TAGS.map(t => t).join(', ');
export const TEXT_STYLE_TAGS_STRING = TEXT_STYLE_TAGS.map(t => t).join(', ');
export const TEXT_MOD_TAGS_STRING = TEXT_MOD_TAGS.map(t => t).join(', ');
export const WRITING_TAGS_STRING = WRITING_TAGS.map(t => t).join(', ');
export const VALID_TAGS_STRING = VALID_TAGS.map(t => t).join(', ');

export const DEDICATED_BUTTON_USES = [
  'inspect',
  'use',
  'drop',
  'discard',
  'enter',
  'park',
  'read',
  'write',
] as const;

export const DEDICATED_BUTTON_USES_STRING = DEDICATED_BUTTON_USES.map(u => u).join(', ');

export const VALID_PRESENCE_STATUS_VALUES = [
  'distant',
  'nearby',
  'companion',
  'unknown',
] as const;

export const VALID_PRESENCE_STATUS_VALUES_STRING = VALID_PRESENCE_STATUS_VALUES.map(s => s).join(', ');

export const LOADING_REASONS = [
  'storyteller',
  'map',
  'correction',
  'inventory',
  'dialogue_turn',
  'dialogue_summary',
  'dialogue_memory_creation',
  'dialogue_conclusion_summary',
  'initial_load',
  'reality_shift_load',
  'visualize',
  'page',
  'journal',
  'loremaster_collect',
  'loremaster_extract',
  'loremaster_write',
  'loremaster_refine',
  'book'
] as const;

export const LOADING_REASON_UI_MAP: Record<(typeof LOADING_REASONS)[number], { text: string; icon: string }> = {
  storyteller: { text: 'Dungeon Master thinks...', icon: '░░' },
  map: { text: 'Cartographer draws the map...', icon: '░░' },
  correction: { text: 'Dungeon Master is fixing mistakes...', icon: '▓' },
  inventory: { text: 'Dungeon Master handles items...', icon: '░░' },
  dialogue_turn: { text: 'Conversation continues...', icon: '░░' },
  dialogue_summary: { text: 'Dialogue concludes...', icon: '░░' },
  dialogue_memory_creation: { text: 'Memories form...', icon: '░░' },
  dialogue_conclusion_summary: { text: 'Returning to the world...', icon: '░░' },
  initial_load: { text: 'Loading...', icon: '░░' },
  reality_shift_load: { text: 'Reality shifts...', icon: '░░' },
  visualize: { text: 'Visualizing the scene...', icon: '░░' },
  page: { text: 'Reading...', icon: '░░' },
  journal: { text: 'Writing...', icon: '░░' },
  loremaster_collect: { text: 'Loremaster picks facts...', icon: '░' },
  loremaster_extract: { text: 'Loremaster extracts new lore...', icon: '░' },
  loremaster_write: { text: 'Loremaster writes down lore...', icon: '░' },
  loremaster_refine: { text: 'Loremaster refines lore...', icon: '░' },
  book: { text: 'Reading...', icon: '░░' }
};

// Centralized map node/edge valid values

export const VALID_NODE_STATUS_VALUES = [
  'undiscovered',
  'discovered',
  'rumored',
  'quest_target',
  'blocked',
] as const;

export const VALID_NODE_STATUS_STRING = VALID_NODE_STATUS_VALUES.map(s => s).join(', ');

export const VALID_NODE_TYPE_VALUES = [
  'region',
  'location',
  'settlement',
  'district',
  'exterior',
  'interior',
  'room',
  'feature',
] as const;

export const VALID_NODE_TYPE_STRING = VALID_NODE_TYPE_VALUES.map(s => s).join(', ');

// Hierarchy levels for node types (lower index = higher level)
export const NODE_TYPE_LEVELS: Record<(typeof VALID_NODE_TYPE_VALUES)[number], number> =
  VALID_NODE_TYPE_VALUES.reduce((acc, type, idx) => {
    acc[type] = idx;
    return acc;
  }, {} as Record<(typeof VALID_NODE_TYPE_VALUES)[number], number>);

export const VALID_EDGE_TYPE_VALUES = [
  'path',
  'road',
  'sea route',
  'door',
  'teleporter',
  'secret_passage',
  'river_crossing',
  'temporary_bridge',
  'boarding_hook',
  'shortcut',
] as const;

export const VALID_EDGE_TYPE_STRING = VALID_EDGE_TYPE_VALUES.map(s => s).join(', ');

export const VALID_EDGE_STATUS_VALUES = [
  'open',
  'accessible',
  'closed',
  'locked',
  'blocked',
  'hidden',
  'rumored',
  'one_way',
  'collapsed',
  'removed',
  'active',
  'inactive',
] as const;

export const VALID_EDGE_STATUS_STRING = VALID_EDGE_STATUS_VALUES.map(s => s).join(', ');

export const NON_DISPLAYABLE_EDGE_STATUSES = [
  'collapsed',
  'hidden',
  'removed',
];

export const NODE_RADIUS = 20;
export const VIEWBOX_WIDTH_INITIAL = 1000;
export const VIEWBOX_HEIGHT_INITIAL = 750;
export const DEFAULT_VIEWBOX = `${String(-VIEWBOX_WIDTH_INITIAL / 2)} ${String(-VIEWBOX_HEIGHT_INITIAL / 2)} ${String(VIEWBOX_WIDTH_INITIAL)} ${String(VIEWBOX_HEIGHT_INITIAL)}`;
export const EDGE_HOVER_WIDTH = 8;
export const MAX_LABEL_LINES = 4;
export const DEFAULT_LABEL_MARGIN_PX = 10;
export const DEFAULT_LABEL_LINE_HEIGHT_EM = 1.1;
export const DEFAULT_LABEL_OVERLAP_MARGIN_PX = 2;
/** Default size for item icons as a fraction of node diameter */
export const DEFAULT_ITEM_ICON_SCALE = 0.3;


export const MAX_DIALOGUE_SUMMARIES_PER_NPC = 5; // Max summaries to store per NPC
export const MAX_DIALOGUE_SUMMARIES_IN_PROMPT = 3;   // Max summaries to include in AI prompt
export const MIN_DIALOGUE_TURN_OPTIONS = 4; // Minimum dialogue options per turn
export const MAX_DIALOGUE_TURN_OPTIONS = 8; // Maximum dialogue options per turn
export const RECENT_LOG_COUNT_FOR_PROMPT = 10; // Number of log messages to include in AI prompts

// Standard instructions for AI-generated text fields
export const NODE_DESCRIPTION_INSTRUCTION =
  'a short creative description of the location, <300 chars';
export const EDGE_DESCRIPTION_INSTRUCTION =
  'a short creative description, focusing of travel conditions of the path';
export const ALIAS_INSTRUCTION = 'alternative names, partial names, shorthands. Avoid generic common terms.';
