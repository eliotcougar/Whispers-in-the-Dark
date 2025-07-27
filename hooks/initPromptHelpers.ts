/**
 * @file initPromptHelpers.ts
 * @description Helper for constructing initial game prompts.
 */
import {
  AdventureTheme,
  WorldFacts,
  HeroSheet,
  HeroBackstory,
  StoryArc,
} from '../types';
import { buildNewGameFirstTurnPrompt } from '../services/storyteller';

export interface BuildInitialGamePromptOptions {
  theme: AdventureTheme;
  storyArc?: StoryArc | null;
  heroGender: string;
  worldFacts?: WorldFacts;
  heroSheet?: HeroSheet;
  heroBackstory?: HeroBackstory;
}

/**
 * Build the storyteller prompt used when starting a new game.
 */
export const buildInitialGamePrompt = (
  options: BuildInitialGamePromptOptions,
): string => {
  const { theme, storyArc, heroGender, worldFacts, heroSheet, heroBackstory } = options;

  const prompt = buildNewGameFirstTurnPrompt(
    theme,
    storyArc ?? null,
    heroGender,
    worldFacts ?? {
      geography: '',
      climate: '',
      technologyLevel: '',
      supernaturalElements: '',
      majorFactions: [],
      keyResources: [],
      culturalNotes: [],
      notableLocations: [],
    },
    heroSheet ?? { name: 'Hero', gender: 'Not Specified', occupation: '', traits: [], startingItems: [] },
    heroBackstory ?? {
      fiveYearsAgo: '',
      oneYearAgo: '',
      sixMonthsAgo: '',
      oneMonthAgo: '',
      oneWeekAgo: '',
      yesterday: '',
      now: '',
    },
  );
  return prompt;
};
