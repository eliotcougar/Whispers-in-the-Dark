
/**
 * @file api.ts
 * @description Wrapper functions for the main storytelling AI interactions.
 */
import { GenerateContentResponse } from "@google/genai";
import { AdventureTheme } from '../../types';
import {
  GEMINI_MODEL_NAME,
  GEMINI_LITE_MODEL_NAME,
  MAX_RETRIES,
  LOADING_REASON_UI_MAP,
  MAIN_TURN_OPTIONS_COUNT,
  VALID_PRESENCE_STATUS_VALUES,
  VALID_ITEM_TYPES,
  VALID_ITEM_TYPES_STRING,
  VALID_TAGS,
  TEXT_STYLE_TAGS_STRING,
  PLAYER_HOLDER_ID,
  DEDICATED_BUTTON_USES_STRING,
  MIN_BOOK_CHAPTERS,
  MAX_BOOK_CHAPTERS,
  ALIAS_INSTRUCTION,
} from '../../constants';
import { SYSTEM_INSTRUCTION } from './systemPrompt';
import { dispatchAIRequest } from '../modelDispatcher';
import { isApiConfigured } from '../apiClient';
import { retryAiCall } from '../../utils/retry';
import { addProgressSymbol } from '../../utils/loadingProgress';

const STORYTELLER_VALID_TAGS = (VALID_TAGS).filter(
  tag => tag !== 'recovered' && tag !== 'stashed'
)

export const STORYTELLER_JSON_SCHEMA = {
  type: 'object',
  properties: {
    currentMapNodeId: {
      type: 'string',
      description: 'Name or ID of the map node the player is currently at.',
    },
    currentObjective: {
      type: 'string',
      description:
        'Short-term objective reflecting the next immediate task. Provide only when updated.',
    },
    dialogueSetup: {
      type: 'object',
      description: 'Initiates dialogue when context suggests a conversation begins.',
      properties: {
        initialNpcResponses: {
          type: 'array',
          minItems: 1,
          items: {
            type: 'object',
            properties: {
              line: {
                type: 'string',
                description: 'Opening line spoken by the NPC.',
              },
              speaker: {
                type: 'string',
                description: 'Speaker NPC delivering the line.',
              },
            },
            required: ['speaker', 'line'],
            additionalProperties: false,
          },
        },
        initialPlayerOptions: {
          type: 'array',
          minItems: 4,
          maxItems: 8,
          items: { type: 'string' },
          description:
            'First-person dialogue choices, last one not necessarily politely, but contextually approprialely ends the conversation.',
        },
        participants: {
          type: 'array',
          minItems: 1,
          items: { type: 'string' },
          description:
            'NPC names taking part in the conversation, excluding the player.',
        },
      },
      required: ['participants', 'initialNpcResponses', 'initialPlayerOptions'],
      additionalProperties: false,
    },
    localEnvironment: {
      type: 'string',
      description: `Brief sentence describing the current environment or weather. e.g. 'Clear skies, warm sun'.`,
    },
    localPlace: {
      type: 'string',
      description: `Player's specific location in the scene, including the Place Name. e.g. 'Inside the Old Mill, near the quern'.`,
    },
    localTime: {
      type: 'string',
      description: `Concise description of current time. e.g. 'Midday', 'Early morning', '12:30'.`,
    },
    logMessage: {
      type: 'string',
      description:
        "Outcome of the player's previous actions, including any significant events, discoveries, or changes in the scene. This should be a concise narrative that captures the essence of what has happened since the last turn, providing additional context for the current scene.",
    },
    mainQuest: {
      type: 'string',
      description:
        'Long-term goal for the player. Provide only when it changes.',
    },
    mapHint: {
      type: 'string',
      maxLength: 1000,
      description: 'Short hints about new or changed relevant locations and their connections.',
    mapUpdated: {
      type: 'boolean',
      description:
        'Set to true if new locations or changes mean the map might need updating.',
    },
    newItems: {
      type: 'array',
      description: `Brand new items that must appear in the game this turn. Also includes status effects and afflictions of the player with item type "status effect"`,
      items: {
        type: 'object',
        properties: {
          activeDescription: {
            type: 'string',
            description: 'Optional description shown when the item is active or equipped.',
          },
          chapters: {
            type: 'array',
            description: `For the item types 'page', 'map', or 'picture' - exactly one chapter REQUIRED. For the item type 'book' - between ${String(
              MIN_BOOK_CHAPTERS,
            )} and ${String(MAX_BOOK_CHAPTERS)} chapters REQUIRED.`,
            items: {
              type: 'object',
              properties: {
                contentLength: { type: 'number', minLength: 50, maxLength: 500, description: 'Approximate length in words.' },
                description: {
                  type: 'string',
                  description: 'Detailed abstract of the chapter contents.',
                },
                heading: { type: 'string', description: 'Short heading for the chapter.' },
              },
              required: ['heading', 'description', 'contentLength'],
              additionalProperties: false,
            },
          },
          description: {
            type: 'string',
            description: 'Concise explanation of what the item is.'
          },
          holderId: {
            type: 'string',
            description: `ID or Name of the item holder. CAN be NPC, Location, or '${PLAYER_HOLDER_ID}'. CAN NOT be an Item. Use '${PLAYER_HOLDER_ID}' only if it is obvious from the context that the player actually acquired the item.`,
          },
          isActive: {
            type: 'boolean',
            description: 'Whether the item is currently active, equipped, worn, or piloted (if vehicle).'
          },
          knownUses: {
            type: 'array',
            description: `Optional interactive uses not covered by ${DEDICATED_BUTTON_USES_STRING}.`,
            items: {
              type: 'object',
              properties: {
                actionName: { type: 'string', description: 'Name of the use action.' },
                appliesWhenActive: { type: 'boolean', description: 'Use is available when item is active.' },
                appliesWhenInactive: { type: 'boolean', description: 'Use is available when item is inactive.' },
                description: { type: 'string', description: 'Tooltip hint for this use.' },
                promptEffect: { type: 'string', description: 'Short effect description for the AI.' },
              },
              required: ['actionName', 'promptEffect', 'description'],
              additionalProperties: false,
            },
          },
          name: { type: 'string', description: 'Item name as it will appear to the player.' },
          tags: {
            type: 'array',
            items: { enum: STORYTELLER_VALID_TAGS },
            description: `Descriptor tags. For written items such as page, book, map, picture, always supply the text style tag, one of ${TEXT_STYLE_TAGS_STRING}. Assign 'junk' only to unusable items.`,
          },
          type: {
            enum: VALID_ITEM_TYPES,
            description: `Item type. One of ${VALID_ITEM_TYPES_STRING}`,
          },
        },
        required: ['name', 'type', 'description'],
        additionalProperties: false,
      },
    },
    npcItemsHint: {
      type: 'string',
      description: 'Summary of items revealed to be carried by NPCs.',
    },
    npcsAdded: {
      type: 'array',
      description: 'NPCs introduced this turn.',
      items: {
        type: 'object',
        properties: {
          aliases: {
            type: 'array',
            items: { type: 'string', minItems: 1, maxItems: 3 },
            description: ALIAS_INSTRUCTION,
          },
          description: {
            type: 'string',
            minLength: 100,
            description:
              'Concise NPC description including role, appearance and personality.',
          },
          lastKnownLocation: {
            type: 'string',
            description: 'General location when presenceStatus is distant or unknown.',
          },
          name: {
            type: 'string',
            description: 'Unique NPC name introduced this turn.',
          },
          presenceStatus: {
            enum: VALID_PRESENCE_STATUS_VALUES,
            description: 'Current relation to the player: companion, nearby or distant.',
          },
          preciseLocation: {
            type: 'string',
            description: "NPC's exact position in the scene when presenceStatus is nearby or companion.",
          },
        },
        required: [
          'name',
          'description',
          'aliases',
          'presenceStatus',
          'lastKnownLocation',
        ],
        additionalProperties: false,
      },
    },
    npcsUpdated: {
      type: 'array',
      description: 'Updates to existing NPCs.',
      items: {
        type: 'object',
        properties: {
          addAlias: {
            type: 'string',
            description: `${ALIAS_INSTRUCTION} Single alias to append to the NPC record.`,
          },
          name: {
            type: 'string',
            description: 'Existing NPC name or ID being updated.',
          },
          newAliases: {
            type: 'array',
            items: { type: 'string', minItems: 1, maxItems: 3 },
            description: `${ALIAS_INSTRUCTION} When provided, it replaces all old Aliases for this NPC.`,
          },
          newDescription: {
            type: 'string',
            minLength: 100,
            description: 'Expanded or revised description for the NPC.',
          },
          newLastKnownLocation: {
            type: 'string',
            description: 'Updated general location if the NPC is away.',
          },
          newPreciseLocation: {
            type: 'string',
            description: 'Updated exact position in the scene, when newPresenceStatus is nearby or companion.',
          },
          newPresenceStatus: {
            enum: VALID_PRESENCE_STATUS_VALUES,
            description: 'Updated relation to the player or scene.',
          },
        },
        required: ['name'],
        additionalProperties: false,
      },
    },
    objectiveAchieved: {
      type: 'boolean',
      description: 'True when the current objective was successfully completed this turn.',
    },
    options: {
      type: 'array',
      minItems: MAIN_TURN_OPTIONS_COUNT,
      maxItems: MAIN_TURN_OPTIONS_COUNT,
      items: { type: 'string' },
      description: `Exactly ${String(
        MAIN_TURN_OPTIONS_COUNT,
      )} distinct action options for the player to choose to progress in the story, tailored to the context.`,
    },
    playerItemsHint: {
      type: 'string',
      description: 'Summary of player item gains, losses or state changes.',
    },
    sceneDescription: {
      type: 'string',
      minLength: 500,
      description:
        "Description of the scene, taking into account the entirety of the player's current situation and surroundings. Include relevant details the player must be aware of to make informed decisions. This should be an engaging text that sets the stage for the player's next actions.",
    },
    worldItemsHint: {
      type: 'string',
      description: 'Summary of items discovered or dropped in the world.',
    },
    },
  },
  required: [
    'sceneDescription',
    'options',
    'logMessage',
    'localTime',
    'localEnvironment',
    'localPlace',
  ],
  additionalProperties: false,
} as const;

// This function is now the primary way gameAIService interacts with Gemini for main game turns. It takes a fully constructed prompt.
export const executeAIMainTurn = async (
  fullPrompt: string,
): Promise<{
  response: GenerateContentResponse;
  thoughts: Array<string>;
  systemInstructionUsed: string;
  jsonSchemaUsed?: unknown;
  promptUsed: string;
}> => {
  if (!isApiConfigured()) {
    console.error('API Key not configured for Gemini Service.');
    return Promise.reject(new Error('API Key not configured.'));
  }

  const result = await retryAiCall<{
    response: GenerateContentResponse;
    thoughts: Array<string>;
    systemInstructionUsed: string;
    jsonSchemaUsed?: unknown;
    promptUsed: string;
  }>(async attempt => {
    try {
      console.log(
        `Executing storyteller turn (Attempt ${String(attempt + 1)}/${String(MAX_RETRIES + 1)})`,
      );
      addProgressSymbol(LOADING_REASON_UI_MAP.storyteller.icon);
      const {
        response,
        systemInstructionUsed,
        jsonSchemaUsed,
        promptUsed,
      } = await dispatchAIRequest({
        modelNames: [GEMINI_MODEL_NAME],
        prompt: fullPrompt,
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 1.0,
        thinkingBudget: 4096,
        includeThoughts: true,
        responseMimeType: 'application/json',
        jsonSchema: STORYTELLER_JSON_SCHEMA,
        label: 'Storyteller',
      });
      const parts = (response.candidates?.[0]?.content?.parts ?? []) as Array<{
        text?: string;
        thought?: boolean;
      }>;
      const thoughts = parts
        .filter((p): p is { text: string; thought?: boolean } => p.thought === true && typeof p.text === 'string')
        .map(p => p.text);
      return {
        result: { response, thoughts, systemInstructionUsed, jsonSchemaUsed, promptUsed },
      };
    } catch (error: unknown) {
      console.error(
        `Error executing AI Main Turn (Attempt ${String(attempt + 1)}/${String(MAX_RETRIES + 1)}):`,
        error,
      );
      throw error;
    }
  });

  if (result) {
    return result;
  }

  throw new Error('Failed to execute AI Main Turn after maximum retries.');
};


// Summarization service remains largely the same as its prompting needs are different.
export const summarizeThemeAdventure_Service = async (
  themeToSummarize: AdventureTheme, // Changed to AdventureTheme object
  lastSceneDescription: string,
  actionLog: Array<string>
): Promise<string | null> => {
  if (!isApiConfigured()) {
    console.error("API Key not configured for Gemini Service. Cannot summarize.");
    return null;
  }

  const relevantLogMessages = actionLog.slice(-20).join("\n - ");

  const summarizationPrompt = `
You are a masterful storyteller tasked with summarizing a segment of a text-based adventure game.
The adventure took place in a theme called: "${themeToSummarize.name}".
The theme's specific guidance was: "${themeToSummarize.systemInstructionModifier}"

The player's last known situation (scene description) in this theme was:
"${lastSceneDescription}"

Here are some of the recent key actions and events that occurred in this theme, leading up to that scene:
- ${relevantLogMessages}

Based *only* on the provided last scene and the action log, provide a concise summary (target 5-7 sentences, absolute maximum 300 words) of what the player experienced and achieved in this theme segment. This summary will help the player recall their progress if they return to this theme later.
Focus on key discoveries, significant challenges overcome, and the general state of their progression *before* the last scene (including any Main Quest progress). Do not invent new information or outcomes beyond what's implied by the logs and the final scene.
The summary should be written in a narrative style, from a perspective that describes the player's journey.
Do not include any preamble. Just provide the summary text itself.
`;

  const result = await retryAiCall<string>(async attempt => {
    try {
      console.log(
        `Summarizing adventure for theme "${themeToSummarize.name}" (Attempt ${String(
          attempt + 1,
        )}/${String(MAX_RETRIES + 1)})`,
      );
      addProgressSymbol(LOADING_REASON_UI_MAP.storyteller.icon);
      const { response } = await dispatchAIRequest({
        modelNames: [GEMINI_LITE_MODEL_NAME, GEMINI_MODEL_NAME],
        prompt: summarizationPrompt,
        temperature: 0.8,
        label: 'Summarize',
      });
      const text = (response.text ?? '').trim();
      if (text) {
        return { result: text };
      }
      console.warn(
        `executeAdventureSummary (Attempt ${String(attempt + 1)}/${String(
          MAX_RETRIES + 1,
        )}): empty response`,
      );
    } catch (error: unknown) {
      console.error(
        `Error summarizing adventure for theme "${themeToSummarize.name}" (Attempt ${String(
          attempt + 1,
        )}/${String(MAX_RETRIES + 1)}):`,
        error,
      );
      throw error;
    }
    return { result: null };
  });

  return result;
};
