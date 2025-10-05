/**
 * @file initPromptHelpers.ts
 * @description Helper for constructing initial game prompts.
 */
import {
  AdventureTheme,
  WorldSheet,
  HeroSheet,
  HeroBackstory,
  StoryArc,
} from '../types';
import { buildNewGameFirstTurnPrompt } from '../services/storyteller';
import { isStoryArcValid } from '../utils/storyArcUtils';
import {
  createDefaultWorldSheet,
  createDefaultHeroSheet,
  createDefaultHeroBackstory,
} from '../utils/initialStates';

export interface BuildInitialGamePromptOptions {
  theme: AdventureTheme;
  storyArc?: StoryArc | null;
  WorldSheet?: WorldSheet;
  heroSheet?: HeroSheet;
  heroBackstory?: HeroBackstory;
}

/**
 * Build the storyteller prompt used when starting a new game.
 */
export const buildInitialGamePrompt = (
  options: BuildInitialGamePromptOptions,
): string => {
  const { theme, storyArc, WorldSheet, heroSheet, heroBackstory } = options;
  if (!storyArc || !isStoryArcValid(storyArc)) {
    throw new Error('buildInitialGamePrompt: missing or invalid story arc');
  }

  const prompt = buildNewGameFirstTurnPrompt(
    theme,
    storyArc,
    WorldSheet ?? createDefaultWorldSheet(),
    heroSheet ?? createDefaultHeroSheet(),
    heroBackstory ?? createDefaultHeroBackstory(),
  );
  return prompt;
};
