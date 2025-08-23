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
import { isApiConfigured } from '../apiClient';
import { retryAiCall } from '../../utils/retry';
import { parseInventoryResponse } from '../inventory/responseParser';
import { extractJsonFromFence, safeParseJson } from '../../utils/jsonUtils';

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
            description: 'ID of current holder such as player, node_* or npc_*',
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
  currentTheme: AdventureTheme,
): Promise<Array<ItemChange> | null> => {
  if (!isApiConfigured()) {
    console.error('fetchCorrectedItemChangeArray_Service: API Key not configured.');
    return null;
  }

  const prompt = `You are an AI assistant fixing a malformed inventory update JSON payload for a text adventure game.

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
- Theme Guidance: "${currentTheme.storyGuidance || 'General adventure theme.'}"

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
      "id": "item_old_lantern_7fr4",
      "name": "Old Lantern (flickering)"
    }
  },
  { // Example for moving an item to a new holder
    "action": "move",
    "item": {
      "id": "item_iron_sword_ab12",
      "name": "Iron Sword",
      "newHolderId": "npc_guard_4f3a"
    }
  },
  { // Example for toggling state on an existing item
    "action": "change",
    "item": {
      "id": "item_plasma_torch_7fr4",
      "name": "Plasma Torch",
      "isActive": true
    }
  },
  { // Example for adding new details to an existing item
    "action": "addDetails",
    "item": {
      "id": "item_mystic_orb_7fr4",
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

  return retryAiCall<Array<ItemChange>>(async attempt => {
    try {
      addProgressSymbol(LOADING_REASON_UI_MAP.correction.icon);
      const { response } = await dispatchAIRequest({
        modelNames: [GEMINI_LITE_MODEL_NAME, GEMINI_MODEL_NAME],
        prompt,
        systemInstruction,
        responseMimeType: 'application/json',
        jsonSchema: ITEM_CHANGE_SCHEMA,
        temperature: CORRECTION_TEMPERATURE,
        label: 'Corrections',
      });
      const aiResponse = safeParseJson<Array<ItemChange>>(extractJsonFromFence(response.text ?? ''));
      const parsedResult = aiResponse ? parseInventoryResponse(JSON.stringify(aiResponse)) : null;
      const validatedChanges = parsedResult ? parsedResult.itemChanges : null;
      if (validatedChanges) {
        return { result: validatedChanges };
      }
      console.warn(
        `fetchCorrectedItemChangeArray_Service (Attempt ${String(attempt + 1)}/${String(MAX_RETRIES + 1)}): corrected payload invalid.`,
        aiResponse,
      );
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
