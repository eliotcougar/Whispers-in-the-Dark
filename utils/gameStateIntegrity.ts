/**
 * @file gameStateIntegrity.ts
 * @description Helpers enforcing invariants on the core FullGameState object.
 */

import {
  AdventureTheme,
  FullGameState,
  HeroBackstory,
  HeroSheet,
  StoryArc,
  WorldFacts,
} from '../types';
import {
  PLACEHOLDER_THEME,
  createDefaultHeroBackstory,
  createDefaultHeroSheet,
  createDefaultStoryArc,
  createDefaultWorldFacts,
} from './initialStates';
import { isStoryArcValid } from './storyArcUtils';

export const ensureCoreGameStateIntegrity = (
  state: FullGameState,
  context: string,
): FullGameState => {
  const cast = state as FullGameState & {
    currentTheme?: AdventureTheme | null;
    mainQuest?: string | null;
    lastActionLog?: string | null;
    worldFacts?: WorldFacts | null;
    heroSheet?: HeroSheet | null;
    heroBackstory?: HeroBackstory | null;
    storyArc?: StoryArc | null;
    localTime?: string | null;
    localEnvironment?: string | null;
    localPlace?: string | null;
  };

  const repaired: Array<string> = [];

  if (!cast.currentTheme) {
    cast.currentTheme = PLACEHOLDER_THEME;
    repaired.push('currentTheme');
  }

  if (cast.mainQuest === undefined || cast.mainQuest === null) {
    cast.mainQuest = '';
    repaired.push('mainQuest');
  }

  if (cast.lastActionLog === undefined || cast.lastActionLog === null) {
    cast.lastActionLog = 'No actions recorded yet.';
    repaired.push('lastActionLog');
  }

  if (!cast.worldFacts) {
    cast.worldFacts = createDefaultWorldFacts();
    repaired.push('worldFacts');
  }

  if (!cast.heroSheet) {
    cast.heroSheet = createDefaultHeroSheet();
    repaired.push('heroSheet');
  }

  if (!cast.heroBackstory) {
    cast.heroBackstory = createDefaultHeroBackstory();
    repaired.push('heroBackstory');
  }

  if (!cast.storyArc || !isStoryArcValid(cast.storyArc)) {
    cast.storyArc = createDefaultStoryArc();
    repaired.push('storyArc');
  }

  if (cast.localTime === undefined || cast.localTime === null || cast.localTime.trim().length === 0) {
    cast.localTime = 'Unknown';
    repaired.push('localTime');
  }

  if (cast.localEnvironment === undefined || cast.localEnvironment === null || cast.localEnvironment.trim().length === 0) {
    cast.localEnvironment = 'Unknown';
    repaired.push('localEnvironment');
  }

  if (cast.localPlace === undefined || cast.localPlace === null || cast.localPlace.trim().length === 0) {
    cast.localPlace = 'Unknown';
    repaired.push('localPlace');
  }

  if (repaired.length > 0) {
    console.warn(
      `[gameStateIntegrity] Repaired core fields (${repaired.join(', ')}) while processing ${context}.`,
    );
  }

  return cast;
};

export const ensureCoreGameStateStackIntegrity = (
  stack: FullGameState | undefined,
  context: string,
): FullGameState | undefined => {
  if (!stack) return undefined;
  return ensureCoreGameStateIntegrity(stack, context);
};

