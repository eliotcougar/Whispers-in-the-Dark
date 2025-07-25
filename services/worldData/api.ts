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
import type {
  AdventureTheme,
  WorldFacts,
  HeroSheet,
  HeroBackstory,
  CharacterOption,
} from '../../types';

const worldFactsSchema = {
  type: 'object',
  properties: {
    geography: { type: 'string', minLength: 1000 },
    climate: { type: 'string' },
    technologyLevel: { type: 'string' },
    supernaturalElements: { type: 'string' },
    majorFactions: { type: 'array', items: { type: 'string' }, description: 'Names of the factions and their brief description' },
    keyResources: { type: 'array', items: { type: 'string' } },
    culturalNotes: { type: 'array', items: { type: 'string' } },
    notableLocations: { type: 'array', items: { type: 'string' }, description: 'Notable geographic locations and their brief description' },
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
    fiveYearsAgo: { type: 'string', minLength: 2000 },
    oneYearAgo: { type: 'string', minLength: 2000 },
    sixMonthsAgo: { type: 'string', minLength: 2000 },
    oneMonthAgo: { type: 'string', minLength: 2000 },
    oneWeekAgo: { type: 'string', minLength: 2000 },
    yesterday: { type: 'string', minLength: 2000 },
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

export const generateWorldFacts = async (
  theme: AdventureTheme,
): Promise<WorldFacts | null> => {
  if (!isApiConfigured()) {
    console.error('generateWorldFacts: API key not configured.');
    return null;
  }
  const prompt =
    `Using the theme description "${theme.systemInstructionModifier}" and the seed "${theme.initialSceneDescriptionSeed}", expand them into a world profile.`;
  const request = async () => {
    const { response } = await dispatchAIRequest({
      modelNames: [GEMINI_LITE_MODEL_NAME, GEMINI_MODEL_NAME],
      prompt,
      systemInstruction: 'Respond only with JSON matching the provided schema.',
      thinkingBudget: 1024,
      includeThoughts: false,
      responseMimeType: 'application/json',
      jsonSchema: worldFactsSchema,
      label: 'WorldFacts',
    });
    return response.text ?? null;
  };
  return retryAiCall<WorldFacts>(async () => {
    addProgressSymbol(LOADING_REASON_UI_MAP.initial_load.icon);
    const text = await request();
    return { result: text ? safeParseJson<WorldFacts>(extractJsonFromFence(text)) : null };
  });
};

export const generateCharacterNames = async (
  theme: AdventureTheme,
  gender: string,
  worldFacts: WorldFacts,
): Promise<Array<string> | null> => {
  if (!isApiConfigured()) {
    console.error('generateCharacterNames: API key not configured.');
    return null;
  }
  const prompt =
    `Using this world description:
    ${JSON.stringify(worldFacts)}
    Generate 50 ${gender} or gender-neutral full names with occasional optional nicknames appropriate for the theme "${theme.name}".
    The names shouls follow 'First Name Last Name' or 'First Name "Nickname" Last Name' or 'Prefix First Name Last Name' template.
    Strongly avoid repeating First Names, Last Names, and Nicknames throughout the list. They all should be unique.`;
  const request = async () => {
    const { response } = await dispatchAIRequest({
      modelNames: [GEMINI_LITE_MODEL_NAME, GEMINI_MODEL_NAME],
      prompt,
      systemInstruction: 'Respond with a JSON array of strings.',
      thinkingBudget: 1024,
      includeThoughts: false,
      responseMimeType: 'application/json',
      jsonSchema: { type: 'array', minItems: 50, items: { type: 'string' } },
      label: 'HeroNames',
    });
    return response.text ?? null;
  };
  return retryAiCall<Array<string>>(async () => {
    addProgressSymbol(LOADING_REASON_UI_MAP.initial_load.icon);
    const text = await request();
    return { result: text ? safeParseJson<Array<string>>(extractJsonFromFence(text)) : null };
  });
};

export const generateCharacterDescriptions = async (
  theme: AdventureTheme,
  worldFacts: WorldFacts,
  names: Array<string>,
): Promise<Array<CharacterOption> | null> => {
  if (!isApiConfigured()) {
    console.error('generateCharacterDescriptions: API key not configured.');
    return null;
  }
  const prompt =
    `Using this world description:
    ${JSON.stringify(worldFacts)}
    Provide a short adventurous description for each of these potential player characters appropriate for the theme "${theme.name}":
    ${names.join('\n')}`;
  const request = async () => {
    const { response } = await dispatchAIRequest({
      modelNames: [GEMINI_LITE_MODEL_NAME, GEMINI_MODEL_NAME],
      prompt,
      systemInstruction:
        'Respond with a JSON array matching the provided names with their descriptions.',
      thinkingBudget: 1024,
      includeThoughts: false,
      responseMimeType: 'application/json',
      jsonSchema: {
        type: 'array',
        items: {
          type: 'object',
          properties: { name: { type: 'string' }, description: { type: 'string', minLength: 2000 } },
          required: ['name', 'description'],
          additionalProperties: false,
        },
      },
      label: 'HeroDescriptions',
    });
    return response.text ?? null;
  };
  return retryAiCall<Array<CharacterOption>>(async () => {
    addProgressSymbol(LOADING_REASON_UI_MAP.initial_load.icon);
    const text = await request();
    return { result: text ? safeParseJson<Array<CharacterOption>>(extractJsonFromFence(text)) : null };
  });
};

export const generateHeroData = async (
  theme: AdventureTheme,
  playerGender: string,
  worldFacts: WorldFacts,
  heroName: string,
  heroDescription: string,
): Promise<{ heroSheet: HeroSheet | null; heroBackstory: HeroBackstory | null } | null> => {
  if (!isApiConfigured()) {
    console.error('generateHeroData: API key not configured.');
    return null;
  }
  const heroSheetPrompt =
    `Using the theme "${theme.name}" and these world details:
    ${JSON.stringify(worldFacts)}
    The player's character gender is ${playerGender} and their name is ${heroName}.
    Here is a short description of the hero: ${heroDescription}.
    Create a brief character sheet including occupation, notable traits, and starting items.`;
  const request = async (prompt: string, schema: unknown, label: string) => {
    const { response } = await dispatchAIRequest({
      modelNames: [GEMINI_LITE_MODEL_NAME, GEMINI_MODEL_NAME],
      prompt,
      systemInstruction: 'Respond only with JSON matching the provided schema.',
      thinkingBudget: 1024,
      includeThoughts: false,
      responseMimeType: 'application/json',
      jsonSchema: schema,
      label,
    });
    return response.text ?? null;
  };
  return retryAiCall<{ heroSheet: HeroSheet | null; heroBackstory: HeroBackstory | null }>(
    async () => {
      addProgressSymbol(LOADING_REASON_UI_MAP.initial_load.icon);
      const sheetText = await request(heroSheetPrompt, heroSheetSchema, 'HeroSheet');
      const parsedSheet = sheetText ? safeParseJson<HeroSheet>(extractJsonFromFence(sheetText)) : null;
      const backstoryPrompt =
        `Using these world details:
        ${JSON.stringify(worldFacts)}
        and this hero sheet:
        ${sheetText ?? ''}
        The hero's description is: ${heroDescription}.
        Write a short backstory for ${heroName} using these time markers: 5 years ago, 1 year ago, 6 months ago, 1 month ago, 1 week ago, and yesterday.`;
      const backstoryText = await request(backstoryPrompt, heroBackstorySchema, 'HeroBackstory');
      const parsedBackstory = backstoryText ? safeParseJson<HeroBackstory>(extractJsonFromFence(backstoryText)) : null;
      return { result: { heroSheet: parsedSheet ?? null, heroBackstory: parsedBackstory ?? null } };
    },
  );
};

export const generateWorldData = async (
  theme: AdventureTheme,
  playerGender: string,
): Promise<WorldDataResult | null> => {
  if (!isApiConfigured()) {
    console.error('generateWorldData: API key not configured.');
    return null;
  }

  const worldFactsPrompt =
    `Using the theme description "${theme.systemInstructionModifier}" and the seed scene "${theme.initialSceneDescriptionSeed}", expand them into a detailed world profile.`;

  const request = async (
    prompt: string,
    schema: unknown,
    label: string,
  ): Promise<string | null> => {
    const { response } = await dispatchAIRequest({
      modelNames: [GEMINI_LITE_MODEL_NAME, GEMINI_MODEL_NAME],
      prompt,
      systemInstruction: 'Respond only with JSON matching the provided schema.',
      thinkingBudget: 1024,
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
