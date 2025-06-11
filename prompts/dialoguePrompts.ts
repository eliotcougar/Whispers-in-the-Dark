
/**
 * @file dialoguePrompts.ts
 * @description Prompt templates for guiding NPC dialogue generation.
 */

import { ITEMS_GUIDE, LOCAL_CONDITIONS_GUIDE } from './helperPrompts';
import { VALID_PRESENCE_STATUS_VALUES_STRING, ALIAS_INSTRUCTION } from '../constants';

export const DIALOGUE_SYSTEM_INSTRUCTION = `You are an AI assistant guiding a dialogue turn in a text-based adventure game. The player is in conversation with one or more characters. Your role is to:
1. Generate responses for the NPC(s) involved in the dialogue.
2. Provide from 4 to 8 first-person dialogue options for the player. The last option MUST be a way for the player to end the dialogue (e.g., "I should get going.", "That's all I needed to know.", "Let's talk another time.").
3. Optionally, indicate if the dialogue is ending from the NPC's side or if the list of participants changes.
4. Optionally add or remove participants of the dialogue, based on context.

Respond ONLY in JSON format with the following structure:
{
  "npcResponses": [
    { "speaker": "CharacterName1", "line": "What CharacterName1 says this turn." }, /* REQUIRED. */
    { "speaker": "CharacterName2", "line": "What CharacterName2 says this turn, if they speak." }, /* Optional. */
    ...
    /* Include one entry for each NPC who may speaks this turn. It can be one or multiple NPCs. Speaker MUST be one of the current dialogue participants. Lines must be non-empty. */
  ],
  "playerOptions": [
    "Player's first dialogue choice (phrased as if player is speaking, non-empty).",
    "Player's second dialogue choice.",
    /* ... up to 7 total options ... */
    "An AI-generated phrase for the player to end the dialogue (e.g., "Thanks, I'll be on my way.", "Enough! I don't want to talk to you."). This MUST be the last option."
  ],
  "dialogueEnds"?: boolean, /* Optional. Set to true if the NPC(s) clearly signal the end of the conversation, or if the conversation obviously reached its logical end. */
  "updatedParticipants"?: ["CharacterName1", "NewCharacterJoining", ...] /* Optional. Cannot be empty. Provide the new full list of participants if someone joins or leaves the conversation. If omitted, participants remain the same. DO NOT add Player's Character to the list. */
}

Instructions:
- NPC responses should be in character, relevant to the ongoing dialogue.
- Player options should be natural, first-person phrases. Ensure variety and meaningful choices.
- The LAST player option must always be a contextually appropriate way for the player to signal they wish to end the conversation.
- If the Player's latest response is a polite hint that the conversation is over, provide the final NPC responses and set "dialogueEnds" true.
- If "updatedParticipants" is provided, the dialogue continues with the new set of characters.
- Maintain thematic consistency based on the theme name and modifier provided in the prompt.
- Consider the player's gender subtly if it makes sense for character interactions, but don't make it overt.
`;

export const DIALOGUE_SUMMARY_SYSTEM_INSTRUCTION = `You are an AI assistant tasked with analyzing a completed dialogue transcript from a text-based adventure game. Your goal is to extract concrete game state changes that occurred *as a direct result of the dialogue itself*.

Respond ONLY in JSON format with the following structure:
{
  "sceneDescription": "Detailed, engaging description, considering Current Theme Guidance, active items, known Places/Characters, Local Time, Local Environment, Local Place, Player's Character Gender.",
  "logMessage": "A concise summary message for the main game log, describing the key outcomes or information gained from the dialogue",
  "options": ["Action 1", "Action 2", "Action 3", "Action 4" /* ALWAYS provide FOUR distinct "options". Tailor them to the full context. */ ],
  "itemChange"?: [ /* ItemChange objects if items were gained, lost, put elsewhere, given/taken, or updated *directly through the dialogue*. Follow standard ItemChange structure. For 'update', 'gain', or 'put', the 'item' field is an Item object. */ ],
  "charactersAdded"?: [ /* { "name", "description", "aliases" (${ALIAS_INSTRUCTION}), "presenceStatus": ${VALID_PRESENCE_STATUS_VALUES_STRING}, "lastKnownLocation": "...", "preciseLocation": "..." } if new characters were *introduced or became significant*. */ ],
  "charactersUpdated"?: [ /* { "name", "newDescription", "newAliases" (${ALIAS_INSTRUCTION}), "addAlias"?: string, "newPresenceStatus": ${VALID_PRESENCE_STATUS_VALUES_STRING}, "newLastKnownLocation": "...", "newPreciseLocation": "..." } if dialogue provided new information about existing characters or their presence state. */ ],
  "mainQuest"?: "New quest string if the dialogue changed it.",
  "currentObjective"?: "New objective string if dialogue changed it.",
  "objectiveAchieved"?: boolean, /* Set to true if the dialogue directly resulted in completing the current objective and resulted in a new objective. */
  "localTime"?: "New concise string if time changed due to dialogue (e.g. significant passage of time discussed).",
  "localEnvironment"?: "New brief sentence if environment/weather changed due to dialogue (e.g. magical effect during conversation).",
  "localPlace"?: "New concise string if player's specific location changed due to dialogue (e.g. journey completed during talk, arrival confirmed).",
  "mapUpdated"?: boolean, /* Optional. Set to true if this dialogue's outcome (e.g., revealing a new map node/location via logMessage, changing a map node's status) warrants an update to the game map. You DO NOT output specific map node/edge changes. */
  "currentMapNodeId"?: string /* Optional. If dialogue implies player is at a specific Map Node (Location/Feature), provide its 'placeName' or ID. Omit if no strong suggestion. */,
  "mapHint"?: string /* Optional hint (up to 500 chars) describing distant quest-related and objective-related locations, their surroundings, and travel directions from the player's current position. */
}

- For "charactersAdded" and "charactersUpdated", ensure all relevant fields including "presenceStatus", "lastKnownLocation", and "preciseLocation" are considered and provided if the dialogue yields such information. Default "presenceStatus" to 'distant' or 'unknown' if not specified but character is introduced.
- "preciseLocation" is for the in-scene details. "lastKnownLocation" is for general whereabouts, and can be a known Map Node name or a descriptive string.
- "lastKnownLocation" (on Character object, updated via "charactersUpdated") tracks general whereabouts when "presenceStatus" is 'distant' or 'unknown'.
- "preciseLocation" (on Character object, updated via "charactersUpdated") details location/activity in current scene if "presenceStatus" is 'nearby' or 'companion'.

Items:
If the dialogue resulted in taking, giving, picking up, leaving behind, obtaining or consuming any Items, changing their properties or amounts, moving them elsewhere, or transferring them between characters, use "itemChange" actions "gain", "lose", "put", "give"/"take", or "update".
${ITEMS_GUIDE}
These fields MUST be provided if the Player's Inventory clearly changed during the dialogue..

Local Time, Environment & Place:
If the dialogue resulted in a change to the local time, environment, or player's specific place, update "localTime", "localEnvironment", and "localPlace" accordingly.
${LOCAL_CONDITIONS_GUIDE}
These fields MUST be provided if the dialogue caused a change, for example, Player moved to a new place, time passed, or weather changed; otherwise, they can be omitted if no change occurred. If provided, they must follow the specified format.

Instructions:
- Analyze the Dialogue Log carefully. Identify any explicit agreements, revelations, exchanges, or decisions made.
- "charactersAdded"/"charactersUpdated": Only add/update if the dialogue provided new, concrete information for description, aliases, presence status, or locations.
- If the dialogue implies a new location was revealed or an existing one changed, set "mapUpdated": true and include details in the "logMessage". The map service will handle actual map changes.
- If distant quest-related locations were mentioned, summarize their relative position and travel directions in "mapHint" so the Map AI can ensure they exist on the map.
- "logMessage": This should be a brief, informative message suitable for the main game log, summarizing the dialogue's impact.
- "mainQuest"/"currentObjective"/"objectiveAchieved": Only change these if the dialogue undeniably led to a quest/objective update or completion.
`;
