/**
 * @file services/corrections/inventory.ts
 * @description Correction helper for malformed inventory AI responses.
 */
import { AdventureTheme, ItemChange } from '../../types';
import {
  MAX_RETRIES,
  VALID_ITEM_TYPES,
  VALID_ACTIONS,
  VALID_ACTIONS_STRING,
  VALID_ITEM_TYPES_STRING,
  GEMINI_LITE_MODEL_NAME,
  GEMINI_MODEL_NAME,
} from '../../constants';
import { CORRECTION_TEMPERATURE, LOADING_REASON_UI_MAP } from '../../constants';
import { dispatchAIRequest } from '../modelDispatcher';
import { addProgressSymbol } from '../../utils/loadingProgress';
import { isApiConfigured } from '../geminiClient';
import { retryAiCall } from '../../utils/retry';
import { parseInventoryResponse } from '../inventory/responseParser';
import { safeParseJson } from '../../utils/jsonUtils';

const ITEM_CHANGE_SCHEMA = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      action: { enum: VALID_ACTIONS },
      item: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          type: { enum: VALID_ITEM_TYPES },
          description: { type: 'string' },
          activeDescription: { type: 'string' },
          isActive: { type: 'boolean' },
          holderId: {
            type: 'string',
            description: 'ID of current holder such as player, node-* or npc-*',
          },
          newHolderId: {
            type: 'string',
            description: 'Used with move action to specify new holder',
          },
          newName: {
            type: 'string',
            description: 'Used with change action for transformations',
          },
          tags: { type: 'array', items: { type: 'string' } },
          knownUses: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                actionName: { type: 'string' },
                promptEffect: { type: 'string' },
                description: { type: 'string' },
                appliesWhenActive: { type: 'boolean' },
                appliesWhenInactive: { type: 'boolean' },
              },
              required: ['actionName', 'promptEffect', 'description'],
            },
          },
          chapters: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                heading: { type: 'string' },
                description: { type: 'string' },
                contentLength: { type: 'number' },
              },
              required: ['heading', 'description', 'contentLength'],
            },
          },
        },
        required: ['name'],
      },
    },
    required: ['action', 'item'],
  },
} as const;

/**
 * Attempts to correct a malformed array of ItemChange objects returned by the
 * Inventory AI helper.
 */
export const fetchCorrectedItemChangeArray_Service = async (
  malformedResponseText: string,
  logMessage: string | undefined,
  sceneDescription: string | undefined,
  playerItemsHint: string,
  worldItemsHint: string,
  npcItemsHint: string,
  currentNodeId: string | null,
  companionsContext: string,
  nearbyNpcsContext: string,
  theme: AdventureTheme,
): Promise<Array<ItemChange> | null> => {
  if (!isApiConfigured()) {
    console.error('fetchCorrectedItemChangeArray_Service: API Key not configured.');
    return null;
  }

  const basePrompt = `You are an AI assistant fixing a malformed inventory update JSON payload for a text adventure game.

## Malformed Payload:
\`\`\`json
${malformedResponseText}
\`\`\`

## Narrative Context:
- Log Message: "${logMessage ?? 'Not specified'}"
- Scene Description: "${sceneDescription ?? 'Not specified'}"
- Player Items Hint: "${playerItemsHint}"
- World Items Hint: "${worldItemsHint}"
- NPC Items Hint: "${npcItemsHint}"
- Current Place ID: "${currentNodeId ?? 'unknown'}"
- Companions: ${companionsContext}
- Nearby NPCs: ${nearbyNpcsContext}
- Theme Guidance: "${theme.storyGuidance || 'General adventure theme.'}"

Task: Provide ONLY the corrected JSON array of ItemChange objects.`;

  const systemInstruction = `Correct a JSON array of ItemChange objects for the inventory system.
Each element must be { "action": (${VALID_ACTIONS_STRING}), "item": { ... } }.
Item properties must appear in this order: id, name, type, description, activeDescription, isActive, holderId, newHolderId, newName, tags, knownUses, chapters.
Valid item types: ${VALID_ITEM_TYPES_STRING}.

## Examples:
[
  { // Example for creating a new item from context
    "action": "create",
    "item": {
      "name": "Old Lantern",
      "type": "equipment",
      "description": "A dusty old lantern that still flickers faintly.",
      "activeDescription": "The lantern is lit and casts a warm glow.",
      "isActive": false,
      "holderId": "player",
      "tags": [],
      "knownUses": [
        {
          "actionName": "Light the Lantern",
          "promptEffect": "Light the lantern to illuminate the area.",
          "description": "Use this to light your way in dark places.",
          "appliesWhenActive": false,
          "appliesWhenInactive": true
        },
        {
          "actionName": "Extinguish the Lantern",
          "promptEffect": "Extinguish the lantern.",
          "description": "Extinguish and conserve the fuel",
          "appliesWhenActive": true,
          "appliesWhenInactive": false
        }
      ],
      "chapters": []
    }
  },
  { // Example for destroying an existing item
    "action": "destroy",
    "item": {
      "id": "item-old-lantern-7fr4",
      "name": "Old Lantern (flickering)"
    }
  },
  { // Example for moving an item to a new holder
    "action": "move",
    "item": {
      "id": "item-iron-sword-ab12",
      "name": "Iron Sword",
      "newHolderId": "npc-guard-4f3a"
    }
  },
  { // Example for toggling state on an existing item
    "action": "change",
    "item": {
      "id": "item-plasma-torch-7fr4",
      "name": "Plasma Torch",
      "isActive": true
    }
  },
  { // Example for adding new details to an existing item
    "action": "addDetails",
    "item": {
      "id": "item-mystic-orb-7fr4",
      "name": "Mystic Orb",
      "type": "single-use",
      "knownUses": [
        {
          "actionName": "Peer into the Orb",
          "promptEffect": "Peer into the Mystic Orb, trying to glimpse the future.",
          "description": "Try to see the beyond",
          "appliesWhenActive": true
        }
      ]
    }
  },
  { // Example for creating a single-page written item
    "action": "create",
    "item": {
      "name": "Smudged Note",
      "type": "page",
      "description": "A hastily scribbled message with a big smudge over it.",
      "holderId": "player",
      "tags": ["typed", "smudged"],
      "chapters": [
        {
          "heading": "Warning",
          "description": "A hastily scribbled message about the dangers of the sunken tunnel.",
          "contentLength": 50
        }
      ]
    }
  },
  { // Example for creating a multi-chapter book
    "action": "create",
    "item": {
      "name": "Explorer's Adventures",
      "type": "book",
      "description": "Weathered log of travels.",
      "holderId": "player",
      "tags": ["handwritten", "faded"],
      "chapters": [
        {
          "heading": "Preface",
          "description": "Introduction. Written by the author, explaining his decisions to start his travels.",
          "contentLength": 53
        },
        {
          "heading": "Journey One",
          "description": "First trip. The author travelled to Vibrant Isles in the search of the Endless Waterfall",
          "contentLength": 246
        },
        {
          "heading": "Journey Two",
          "description": "Second Trip. The author's adventure in Desolate Steppes in the search of Magnificent Oasis",
          "contentLength": 312
        },
        {
          "heading": "Final Thoughts",
          "description": "The author's contemplation about whether the journeys were worth it",
          "contentLength": 98
        }
      ]
    }
  }
]

Respond ONLY with the corrected JSON array.`;

  let promptToUse = basePrompt;
  let lastErrorMessage: string | null = null;

  return retryAiCall<Array<ItemChange>>(async attempt => {
    try {
      addProgressSymbol(LOADING_REASON_UI_MAP.corrections.icon);
      if (attempt > 0 && lastErrorMessage) {
        promptToUse = `${basePrompt}\n\n[Parser Feedback]\n${lastErrorMessage}`;
      } else {
        promptToUse = basePrompt;
      }
      const { response } = await dispatchAIRequest({
        modelNames: [GEMINI_LITE_MODEL_NAME, GEMINI_MODEL_NAME],
        prompt: promptToUse,
        systemInstruction,
        responseMimeType: 'application/json',
        jsonSchema: ITEM_CHANGE_SCHEMA,
        temperature: CORRECTION_TEMPERATURE,
        label: 'Corrections',
      });
      const aiResponse = safeParseJson<Array<ItemChange>>(response.text ?? '');
      let parseErrorThisAttempt: string | null = null;
      const parsedResult = aiResponse
        ? parseInventoryResponse(JSON.stringify(aiResponse), message => {
            parseErrorThisAttempt = message;
          })
        : null;
      const validatedChanges = parsedResult ? parsedResult.itemChanges : null;
      if (validatedChanges) {
        lastErrorMessage = null;
        return { result: validatedChanges };
      }
      console.warn(
        `fetchCorrectedItemChangeArray_Service (Attempt ${String(attempt + 1)}/${String(MAX_RETRIES + 1)}): corrected payload invalid.`,
        aiResponse,
      );
    if (typeof parseErrorThisAttempt === 'string') {
      lastErrorMessage = parseErrorThisAttempt;
    } else {
      lastErrorMessage = 'Corrected inventory payload must contain valid ItemChange entries following the documented schema.';
    }
    } catch (error: unknown) {
      console.error(
        `fetchCorrectedItemChangeArray_Service error (Attempt ${String(attempt + 1)}/${String(MAX_RETRIES + 1)}):`,
        error,
      );
      throw error;
    }
    return { result: null };
  });
};
