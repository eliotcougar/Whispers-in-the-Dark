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
  const cast = state as Partial<FullGameState> & {
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

  if (typeof cast.mainQuest !== 'string') {
    cast.mainQuest = '';
    repaired.push('mainQuest');
  }

  if (typeof cast.lastActionLog !== 'string') {
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

  const localTimeValue = typeof cast.localTime === 'string' ? cast.localTime.trim() : '';
  if (localTimeValue.length === 0) {
    cast.localTime = 'Unknown';
    repaired.push('localTime');
  }

  const localEnvironmentValue = typeof cast.localEnvironment === 'string' ? cast.localEnvironment.trim() : '';
  if (localEnvironmentValue.length === 0) {
    cast.localEnvironment = 'Unknown';
    repaired.push('localEnvironment');
  }

  const localPlaceValue = typeof cast.localPlace === 'string' ? cast.localPlace.trim() : '';
  if (localPlaceValue.length === 0) {
    cast.localPlace = 'Unknown';
    repaired.push('localPlace');
  }

  if (repaired.length > 0) {
    console.warn(
      `[gameStateIntegrity] Repaired core fields (${repaired.join(', ')}) while processing ${context}.`,
    );
  }

  return cast as FullGameState;
};

export const ensureCoreGameStateStackIntegrity = (
  stack: FullGameState | undefined,
  context: string,
): FullGameState | undefined => {
  if (!stack) return undefined;
  return ensureCoreGameStateIntegrity(stack, context);
};

