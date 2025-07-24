import {
  GEMINI_LITE_MODEL_NAME,
  GEMINI_MODEL_NAME,
  LOADING_REASON_UI_MAP,
} from '../../constants';
import { dispatchAIRequest } from '../modelDispatcher';
import { addProgressSymbol } from '../../utils/loadingProgress';
import { retryAiCall } from '../../utils/retry';
import { extractJsonFromFence, safeParseJson } from '../../utils/jsonUtils';
import { isApiConfigured } from '../apiClient';
import type { AdventureTheme, WorldFacts, HeroSheet, HeroBackstory } from '../../types';

const worldFactsSchema = {
  type: 'object',
  properties: {
    geography: { type: 'string' },
    climate: { type: 'string' },
    technologyLevel: { type: 'string' },
    supernaturalElements: { type: 'string' },
    majorFactions: { type: 'array', items: { type: 'string' } },
    keyResources: { type: 'array', items: { type: 'string' } },
    culturalNotes: { type: 'array', items: { type: 'string' } },
    notableLocations: { type: 'array', items: { type: 'string' } },
  },
  required: [
    'geography',
    'climate',
    'technologyLevel',
    'supernaturalElements',
    'majorFactions',
    'keyResources',
    'culturalNotes',
    'notableLocations',
  ],
  additionalProperties: false,
} as const;

const heroSheetSchema = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    occupation: { type: 'string' },
    traits: { type: 'array', items: { type: 'string' } },
    startingItems: { type: 'array', items: { type: 'string' } },
  },
  required: ['name', 'occupation', 'traits', 'startingItems'],
  additionalProperties: false,
} as const;

const heroBackstorySchema = {
  type: 'object',
  properties: {
    fiveYearsAgo: { type: 'string' },
    oneYearAgo: { type: 'string' },
    sixMonthsAgo: { type: 'string' },
    oneMonthAgo: { type: 'string' },
    oneWeekAgo: { type: 'string' },
    yesterday: { type: 'string' },
  },
  required: [
    'fiveYearsAgo',
    'oneYearAgo',
    'sixMonthsAgo',
    'oneMonthAgo',
    'oneWeekAgo',
    'yesterday',
  ],
  additionalProperties: false,
} as const;

export interface WorldDataResult {
  worldFacts: WorldFacts | null;
  heroSheet: HeroSheet | null;
  heroBackstory: HeroBackstory | null;
}

export const generateWorldData = async (
  theme: AdventureTheme,
  playerGender: string,
): Promise<WorldDataResult | null> => {
  if (!isApiConfigured()) {
    console.error('generateWorldData: API key not configured.');
    return null;
  }

  const worldFactsPrompt =
    `Using the theme description "${theme.systemInstructionModifier}" and the seed ` +
    `"${theme.initialSceneDescriptionSeed}", expand them into a world profile.`;

  const request = async (
    prompt: string,
    schema: unknown,
    label: string,
  ): Promise<string | null> => {
    const { response } = await dispatchAIRequest({
      modelNames: [GEMINI_LITE_MODEL_NAME, GEMINI_MODEL_NAME],
      prompt,
      systemInstruction: 'Respond only with JSON matching the provided schema.',
      thinkingBudget: 512,
      includeThoughts: false,
      responseMimeType: 'application/json',
      jsonSchema: schema,
      label,
    });
    return response.text ?? null;
  };

  return retryAiCall<WorldDataResult>(async () => {
    addProgressSymbol(LOADING_REASON_UI_MAP.initial_load.icon);
    const factsText = await request(worldFactsPrompt, worldFactsSchema, 'WorldFacts');
    const parsedFacts = factsText ? safeParseJson<WorldFacts>(extractJsonFromFence(factsText)) : null;

    const heroSheetPrompt =
      `Using the theme "${theme.name}" and these world details:\n${factsText ?? ''}\n` +
      `The player's character gender is "${playerGender}". ` +
      'Create a brief character sheet including a generated name, occupation, notable traits, and starting items.';
    const heroSheetText = await request(heroSheetPrompt, heroSheetSchema, 'HeroSheet');
    const parsedSheet = heroSheetText ? safeParseJson<HeroSheet>(extractJsonFromFence(heroSheetText)) : null;

    const heroName = parsedSheet?.name ?? 'the hero';
    const heroBackstoryPrompt =
      `Using these world details:\n${factsText ?? ''}\nand this hero sheet:\n${heroSheetText ?? ''}\n` +
      `Write a short backstory for ${heroName} using these time markers: ` +
      '5 years ago, 1 year ago, 6 months ago, 1 month ago, 1 week ago, and yesterday.';
    const backstoryText = await request(heroBackstoryPrompt, heroBackstorySchema, 'HeroBackstory');
    const parsedBackstory = backstoryText ? safeParseJson<HeroBackstory>(extractJsonFromFence(backstoryText)) : null;
    return {
      result: {
        worldFacts: parsedFacts ?? null,
        heroSheet: parsedSheet ?? null,
        heroBackstory: parsedBackstory ?? null,
      },
    };
  });
};

export default generateWorldData;
