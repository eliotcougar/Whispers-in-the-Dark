import {
  GEMINI_LITE_MODEL_NAME,
  GEMINI_MODEL_NAME,
  LOADING_REASON_UI_MAP,
  ACT_NATURE_BY_NUMBER,
  RECENT_LOG_COUNT_FOR_PROMPT,
} from '../../constants';
import { dispatchAIRequest } from '../modelDispatcher';
import { addProgressSymbol } from '../../utils/loadingProgress';
import { retryAiCall } from '../../utils/retry';
import { safeParseJson } from '../../utils/jsonUtils';
import { isApiConfigured } from '../geminiClient';
import { getThinkingBudget, getMaxOutputTokens } from '../thinkingConfig';
import type {
  AdventureTheme,
  WorldFacts,
  HeroSheet,
  HeroBackstory,
  CharacterOption,
  StoryArc,
  StoryAct,
} from '../../types';
import { isStoryArcValid } from '../../utils/storyArcUtils';

interface StoryActData {
  title: string;
  description: string;
  mainObjective: string;
  sideObjectives: Array<string>;
  successCondition: string;
}

interface StoryArcData {
  title: string;
  overview: string;
  acts: Array<StoryActData>;
}

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
    heroShortName: { type: 'string', description: 'Single-word name for UI; only alphanumeric and hyphen.' },
    occupation: { type: 'string' },
    traits: { type: 'array', items: { type: 'string' } },
    startingItems: { type: 'array', items: { type: 'string' } },
  },
  required: ['name', 'heroShortName', 'occupation', 'traits', 'startingItems'],
  additionalProperties: false,
} as const;


const storyActSchema = {
  type: 'object',
  properties: {
    title: { type: 'string', description: 'Creative title for the act.' },
    description: { type: 'string', minLength: 3000 },
    mainObjective: { type: 'string', description: 'Main objective that must be achieved in order to complete the act.' },
    sideObjectives: { type: 'array', items: { type: 'string' } },
    successCondition: { type: 'string', description: 'Actionable, clearly defined condition for finishing the act and moving forvard into the next act.' },
  },
  required: [
    'title',
    'description',
    'mainObjective',
    'sideObjectives',
    'successCondition',
  ],
  additionalProperties: false,
} as const;

const storyArcSchema = {
  type: 'object',
  properties: {
    title: { type: 'string', description: 'Creative title for the whole storyline.' },
    overview: { type: 'string', description: 'High level story overview, like a book series synopsis, without going into specifics of the story, and not describing specific acts.', minLength: 3000 },
    acts: { type: 'array', minItems: 1, maxItems: 1, items: storyActSchema },
  },
  required: ['title', 'overview', 'acts'],
  additionalProperties: false,
} as const;

const heroBackstorySchema = {
  type: 'object',
  description: 'Narrative description of what was happening to the player character in each of the time periods up until present moment.',
  properties: {
    fiveYearsAgo: { type: 'string', minLength: 2000, description: 'Narrative story from 5 years ago.' },
    oneYearAgo: { type: 'string', minLength: 2000, description: 'Narrative story from one year ago.' }, 
    sixMonthsAgo: { type: 'string', minLength: 2000, description: 'Narrative story from 6 months ago.' },
    oneMonthAgo: { type: 'string', minLength: 2000, description: 'Narrative story from one month ago.' },
    oneWeekAgo: { type: 'string', minLength: 2000, description: 'Narrative story from last week.' },
    yesterday: { type: 'string', minLength: 2000, description: 'Narrative story from yesterday.' },
    now: { type: 'string', minLength: 2000, description: 'Narrative story leading to the present moment.' },
    storyArc: storyArcSchema,
  },
  required: [
    'fiveYearsAgo',
    'oneYearAgo',
    'sixMonthsAgo',
    'oneMonthAgo',
    'oneWeekAgo',
    'yesterday',
    'now',
    'storyArc',
  ],
  additionalProperties: false,
} as const;

export interface WorldDataResult {
  worldFacts: WorldFacts | null;
  heroSheet: HeroSheet | null;
  heroBackstory: HeroBackstory | null;
  storyArc: StoryArc | null;
}

export const generateWorldFacts = async (
  theme: AdventureTheme,
): Promise<WorldFacts | null> => {
  if (!isApiConfigured()) {
    console.error('generateWorldFacts: API key not configured.');
    return null;
  }
  const prompt =
    `Using the theme description "${theme.storyGuidance}", expand it into a world profile.`;
  const request = async () => {
      const thinkingBudget = getThinkingBudget(1024);
      const maxOutputTokens = getMaxOutputTokens(1024);
      const { response } = await dispatchAIRequest({
        modelNames: [GEMINI_LITE_MODEL_NAME, GEMINI_MODEL_NAME],
        prompt,
        systemInstruction: 'Respond only with JSON matching the provided schema.',
        thinkingBudget,
        includeThoughts: false,
        responseMimeType: 'application/json',
        jsonSchema: worldFactsSchema,
        label: 'WorldFacts',
        maxOutputTokens,
      });
    return response.text ?? null;
  };
  return retryAiCall<WorldFacts>(async () => {
    addProgressSymbol(LOADING_REASON_UI_MAP.initial_load.icon);
    const text = await request();
    return { result: text ? safeParseJson<WorldFacts>(text) : null };
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
    Generate 50 strictly ${gender} full names with occasional optional nicknames appropriate for the theme "${theme.name}".
    Allowed templates: 'FirstName LastName', 'FirstName "Nickname" LastName', or 'Prefix FirstName LastName'.
    UNIQUENESS REQUIREMENTS (very important):
    - Each FirstName must be unique across the entire list (no repeats or trivial variants).
    - Each LastName must be unique across the entire list (no repeats or trivial variants).
    - Each Nickname (if present) must be unique across the entire list.
    - Avoid minor spelling variants or simple diacritic tweaks; use genuinely different names.
    - Aim for diverse cultural origins to maximize variety.
    Respond ONLY with a JSON array of 50 distinct strings.`;
  const request = async () => {
      const thinkingBudget = getThinkingBudget(1024);
      const maxOutputTokens = getMaxOutputTokens(1024);
      const { response } = await dispatchAIRequest({
        modelNames: [GEMINI_LITE_MODEL_NAME, GEMINI_MODEL_NAME],
        prompt,
        systemInstruction: 'Respond with a JSON array of strings.',
        thinkingBudget,
        includeThoughts: false,
        responseMimeType: 'application/json',
        jsonSchema: { type: 'array', minItems: 50, items: { type: 'string' } },
        label: 'HeroNames',
        maxOutputTokens,
      });
    return response.text ?? null;
  };
  return retryAiCall<Array<string>>(async () => {
    addProgressSymbol(LOADING_REASON_UI_MAP.initial_load.icon);
    const text = await request();
    return { result: text ? safeParseJson<Array<string>>(text) : null };
  });
};

export const generateCharacterDescriptions = async (
  theme: AdventureTheme,
  gender: string,
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
    Provide a short adventurous description for each of these potential ${gender} player characters appropriate for the theme "${theme.name}":
    ${names.join('\n')}`;
  const request = async () => {
    const thinkingBudget = getThinkingBudget(1024);
    const maxOutputTokens = getMaxOutputTokens(1024);
    const { response } = await dispatchAIRequest({
      modelNames: [GEMINI_LITE_MODEL_NAME, GEMINI_MODEL_NAME],
      prompt,
      systemInstruction:
        'Respond with a JSON array matching the provided names with their descriptions.',
      thinkingBudget,
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
        maxOutputTokens,
      });
    return response.text ?? null;
  };
  return retryAiCall<Array<CharacterOption>>(async () => {
    addProgressSymbol(LOADING_REASON_UI_MAP.initial_load.icon);
    const text = await request();
    return { result: text ? safeParseJson<Array<CharacterOption>>(text) : null };
  });
};

export const generateHeroData = async (
  theme: AdventureTheme,
  heroGender: string,
  worldFacts: WorldFacts,
  heroName?: string,
  heroDescription?: string,
): Promise<{ heroSheet: HeroSheet | null; heroBackstory: HeroBackstory | null; storyArc: StoryArc | null } | null> => {
  if (!isApiConfigured()) {
    console.error('generateHeroData: API key not configured.');
    return null;
  }
  const heroSheetPrompt =
    `Using the theme "${theme.name}" and these world details:
    ${JSON.stringify(worldFacts)}
    The player's character gender is ${heroGender}.` +
    (heroName ? ` Their name is ${heroName}.` : '') +
    (heroDescription ? ` Here is a short description of the hero: ${heroDescription}.` : '') +
    ' Create a brief character sheet including occupation, notable traits, and starting items.' +
    ' Also include "heroShortName": a single-word short name used in UI and dialogue, composed only of alphanumeric characters and hyphens (no underscores). Strongly PREFER using the exact FirstName part of the full name for "heroShortName"; choose a different single-word alias only if the FirstName would be ambiguous in this world/context.';
    const request = async (prompt: string, schema: unknown, label: string) => {
      const thinkingBudget = getThinkingBudget(1024);
      const maxOutputTokens = getMaxOutputTokens(1024);
      const { response } = await dispatchAIRequest({
        modelNames: [GEMINI_LITE_MODEL_NAME, GEMINI_MODEL_NAME],
        prompt,
        systemInstruction: 'Respond only with JSON matching the provided schema.',
        thinkingBudget,
        includeThoughts: false,
        responseMimeType: 'application/json',
        jsonSchema: schema,
        label,
        maxOutputTokens,
      });
      return response.text ?? null;
    };
  return retryAiCall<{ heroSheet: HeroSheet | null; heroBackstory: HeroBackstory | null; storyArc: StoryArc | null }>(
    async () => {
      addProgressSymbol(LOADING_REASON_UI_MAP.initial_load.icon);
      const sheetText = await request(heroSheetPrompt, heroSheetSchema, 'HeroSheet');
      const parsedSheet = sheetText ? safeParseJson<HeroSheet>(sheetText) : null;
      if (parsedSheet) {
        parsedSheet.gender = heroGender;
        // Ensure heroShortName exists and is sanitized
        const baseFromName = parsedSheet.name.split(/\s+/)[0] || 'Hero';
        const candidate = (parsedSheet.heroShortName && parsedSheet.heroShortName.trim().length > 0)
          ? parsedSheet.heroShortName
          : baseFromName;
        parsedSheet.heroShortName = (candidate
          .replace(/[ _]+/g, '-')
          .replace(/[^a-zA-Z0-9-]/g, '')
          .replace(/-+/g, '-')
          .replace(/^-+|-+$/g, '')) || 'Hero';
      }
      const finalHeroName = heroName ?? parsedSheet?.name ?? 'the hero';
      const backstoryPrompt =
        `Using these world details:
        ${JSON.stringify(worldFacts)}
        and this hero sheet:
        ${sheetText ?? ''}
        ${heroDescription ? `The hero's description is: ${heroDescription}.` : ''}
        Write a short backstory for ${finalHeroName} using these time markers: 5 years ago, 1 year ago, 6 months ago, 1 month ago, 1 week ago, yesterday, and now.` +
        ' Then outline a five act narrative arc for this adventure with an overview of at least 3000 characters.' +
        ' Provide details only for Act 1 (exposition) including a description of at least 3000 characters, the main objective, two side quests, and the success condition to proceed to the next act (rising action).';
      const backstoryText = await request(backstoryPrompt, heroBackstorySchema, 'HeroBackstory');
      const parsedData = backstoryText
        ? safeParseJson<HeroBackstory & { storyArc: StoryArcData }>(backstoryText)
        : null;
      let storyArc: StoryArc | null = null;
      let heroBackstory: HeroBackstory | null = null;
      if (parsedData) {
        const { storyArc: arcData, ...rest } = parsedData;
        storyArc = {
          title: arcData.title,
          overview: arcData.overview,
          acts: arcData.acts.map((a, i) => ({
            ...a,
            actNumber: i + 1,
            completed: false,
          })),
          currentAct: 1,
        };
        heroBackstory = rest;
      }
      if (storyArc && !isStoryArcValid(storyArc)) {
        throw new Error('generateHeroData: invalid story arc');
      }
      return {
        result: {
          heroSheet: parsedSheet ?? null,
          heroBackstory,
          storyArc,
        },
      };
    },
  );
};


export const generateWorldData = async (
  theme: AdventureTheme,
  heroGender: string,
): Promise<WorldDataResult | null> => {
  if (!isApiConfigured()) {
    console.error('generateWorldData: API key not configured.');
    return null;
  }

  const worldFactsPrompt =
    `Using the theme description "${theme.storyGuidance}", expand it into a detailed world profile.`;

    const request = async (
      prompt: string,
      schema: unknown,
      label: string,
    ): Promise<string | null> => {
      const thinkingBudget = getThinkingBudget(1024);
      const maxOutputTokens = getMaxOutputTokens(1024);
      const { response } = await dispatchAIRequest({
        modelNames: [GEMINI_LITE_MODEL_NAME, GEMINI_MODEL_NAME],
        prompt,
        systemInstruction: 'Respond only with JSON matching the provided schema.',
        thinkingBudget,
        includeThoughts: false,
        responseMimeType: 'application/json',
        jsonSchema: schema,
        label,
        maxOutputTokens,
      });
      return response.text ?? null;
    };

  return retryAiCall<WorldDataResult>(async () => {
    addProgressSymbol(LOADING_REASON_UI_MAP.initial_load.icon);
    const factsText = await request(worldFactsPrompt, worldFactsSchema, 'WorldFacts');
    const parsedFacts = factsText ? safeParseJson<WorldFacts>(factsText) : null;

    const heroData = await generateHeroData(theme, heroGender, parsedFacts ?? {
      geography: '',
      climate: '',
      technologyLevel: '',
      supernaturalElements: '',
      majorFactions: [],
      keyResources: [],
      culturalNotes: [],
      notableLocations: [],
    });

    return {
      result: {
        worldFacts: parsedFacts ?? null,
        heroSheet: heroData?.heroSheet ?? null,
        heroBackstory: heroData?.heroBackstory ?? null,
        storyArc: heroData?.storyArc ?? null,
      },
    };
  });
};

export const generateNextStoryAct = async (
  theme: AdventureTheme,
  worldFacts: WorldFacts,
  heroSheet: HeroSheet,
  storyArc: StoryArc,
  gameLog: Array<string>,
  lastScene: string,
): Promise<StoryAct | null> => {
  if (!isApiConfigured()) {
    console.error('generateNextStoryAct: API key not configured.');
    return null;
  }

  const nextActNumber = storyArc.currentAct + 1;
  const nature = ACT_NATURE_BY_NUMBER[nextActNumber];
  if (!nature) {
    return null;
  }

  const completedActs = storyArc.acts
    .filter(a => a.actNumber <= storyArc.currentAct)
    .map(a => `Act ${String(a.actNumber)}: ${a.description}`)
    .join('\n');

  const logLines = gameLog.slice(-RECENT_LOG_COUNT_FOR_PROMPT).join('\n');

  const finalNote =
    nextActNumber === 5
      ? ' This is the final act of the game. Provide a successCondition that clearly ends the entire story.'
      : '';

  const prompt = `Using the theme "${theme.name}" continue the narrative.\n\n` +
    `World Facts:\n${JSON.stringify(worldFacts)}\n\n` +
    `Player Character:\n${JSON.stringify(heroSheet)}\n\n` +
    `Story Arc Title: ${storyArc.title}\nOverview: ${storyArc.overview}\n\n` +
    `Completed Acts:\n${completedActs}\n\n` +
    `Last Scene:\n${lastScene}\n\n` +
    `Recent Log:\n${logLines}\n\n` +
    `Generate full details for Act ${String(nextActNumber)} (${nature}).${finalNote}`;

    const request = async () => {
      const thinkingBudget = getThinkingBudget(1024);
      const maxOutputTokens = getMaxOutputTokens(1024);
      const { response } = await dispatchAIRequest({
        modelNames: [GEMINI_LITE_MODEL_NAME, GEMINI_MODEL_NAME],
        prompt,
        systemInstruction: 'Respond only with JSON matching the provided schema.',
        thinkingBudget,
        includeThoughts: false,
        responseMimeType: 'application/json',
        jsonSchema: storyActSchema,
        label: 'NextAct',
        maxOutputTokens,
      });
      return response.text ?? null;
    };

  return retryAiCall<StoryAct>(async () => {
    addProgressSymbol(LOADING_REASON_UI_MAP.storyteller.icon);
    const text = await request();
    const parsed = text
      ? safeParseJson<StoryActData>(text)
      : null;
    if (!parsed) return { result: null };
    const newAct: StoryAct = {
      actNumber: nextActNumber,
      title: parsed.title,
      description: parsed.description,
      mainObjective: parsed.mainObjective,
      sideObjectives: parsed.sideObjectives,
      successCondition: parsed.successCondition,
      completed: false,
    };
    return { result: newAct };
  });
};

export default generateWorldData;
