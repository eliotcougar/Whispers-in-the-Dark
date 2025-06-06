
/**
 * @file constants.ts
 * @description Global constants and default configuration values.
 */

import { ALL_THEME_PACK_NAMES } from './themes';

// Using gemini-2.5-flash-preview-04-17 model specified by API guidelines for general text tasks.
export const GEMINI_MODEL_NAME = "gemini-2.5-flash-preview-05-20";
export const AUXILIARY_MODEL_NAME = "gemini-2.0-flash"; // Updated for better capability
export const MINIMAL_MODEL_NAME = "gemma-3-27b-it" // Model for simplest string outputs
export const MAX_RETRIES = 3; // Max retries for most API calls
export const MAX_LOG_MESSAGES = 50; // Maximum number of messages to keep in the game log

export const DEVELOPER = "Eliot the Cougar"
export const CURRENT_GAME_VERSION = "1.3 (Spatio-Temporal Update)";
export const CURRENT_SAVE_GAME_VERSION = "3";
export const LOCAL_STORAGE_SAVE_KEY = "whispersInTheDark_gameState";

export const DEFAULT_STABILITY_LEVEL = 20; // Number of turns before chaos can occur
export const DEFAULT_CHAOS_LEVEL = 5;   // Percentage chance of chaos shift
export const DEFAULT_ENABLED_THEME_PACKS = [...ALL_THEME_PACK_NAMES];
export const DEFAULT_PLAYER_GENDER = "Male";

export const FREE_FORM_ACTION_MAX_LENGTH = 70;
export const FREE_FORM_ACTION_COST = 5;

export const VALID_ITEM_TYPES = [
  'single-use', 'multi-use', 'equipment',
  'container', 'key', 'weapon', 'ammunition', 'vehicle', 'knowledge', 'status effect'
] as const; // 'as const' makes it a tuple of string literals

export const VALID_ITEM_TYPES_STRING = VALID_ITEM_TYPES.map(type => `"${type}"`).join(' | ');

export const MAX_DIALOGUE_SUMMARIES_PER_CHARACTER = 5; // Max summaries to store per character
export const MAX_DIALOGUE_SUMMARIES_IN_PROMPT = 3;   // Max summaries to include in AI prompt
export const RECENT_LOG_COUNT_FOR_PROMPT = 10; // Number of log messages to include in AI prompts
