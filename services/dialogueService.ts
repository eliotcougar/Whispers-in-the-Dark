
/**
 * @file dialogueService.ts
 * @description AI interaction helpers for managing game dialogues.
 */
import { GenerateContentResponse } from "@google/genai";
import {
  DialogueAIResponse, DialogueHistoryEntry, DialogueSummaryContext, DialogueSummaryResponse,
  Item, Character, GameStateFromAI, MapNode, MapData, DialogueMemorySummaryContext, AdventureTheme // Added AdventureTheme
} from '../types';
import { GEMINI_MODEL_NAME, AUXILIARY_MODEL_NAME, MINIMAL_MODEL_NAME, MAX_RETRIES, MAX_DIALOGUE_SUMMARIES_IN_PROMPT } from '../constants';
import { 
    DIALOGUE_SYSTEM_INSTRUCTION, 
    DIALOGUE_SUMMARY_SYSTEM_INSTRUCTION
} from '../prompts/dialoguePrompts';
import { ai } from './geminiClient';
import { formatKnownPlacesForPrompt } from '../utils/promptFormatters/map';

const callDialogueGeminiAPI = async (
  prompt: string,
  systemInstruction: string,
  disableThinking: boolean = false // Added parameter
): Promise<GenerateContentResponse> => {
  const config: any = { // Use 'any' for config to dynamically add thinkingConfig
    systemInstruction: systemInstruction,
    responseMimeType: "application/json",
    temperature: 0.8,
  };
  if (disableThinking) {
    config.thinkingConfig = { thinkingBudget: 0 };
  }
  return ai.models.generateContent({
    model: GEMINI_MODEL_NAME, // Will use gemini-2.5-flash-preview-04-17
    contents: prompt,
    config: config
  });
};

const parseDialogueAIResponse = (responseText: string): DialogueAIResponse | null => {
  let jsonStr = responseText.trim();
  const fenceRegex = /^```(?:json)?\s*\n?(.*?)\n?\s*```$/s;
  const fenceMatch = jsonStr.match(fenceRegex);
  if (fenceMatch && fenceMatch[1]) {
    jsonStr = fenceMatch[1].trim();
  }

  try {
    const parsed = JSON.parse(jsonStr) as Partial<DialogueAIResponse>;
    if (
      !parsed ||
      !Array.isArray(parsed.npcResponses) || !parsed.npcResponses.every(r => r && typeof r.speaker === 'string' && typeof r.line === 'string') ||
      !Array.isArray(parsed.playerOptions) || !parsed.playerOptions.every(o => typeof o === 'string') ||
      (parsed.dialogueEnds !== undefined && typeof parsed.dialogueEnds !== 'boolean') ||
      (parsed.updatedParticipants !== undefined && (!Array.isArray(parsed.updatedParticipants) || !parsed.updatedParticipants.every(p => typeof p === 'string')))
    ) {
      console.warn("Parsed dialogue JSON does not match DialogueAIResponse structure:", parsed);
      return null;
    }
    if (parsed.playerOptions.length === 0) {
        parsed.playerOptions = ["End Conversation."];
    }
    return parsed as DialogueAIResponse;
  } catch (e) {
    console.warn("Failed to parse dialogue JSON response from AI:", e);
    console.debug("Original dialogue response text:", responseText);
    return null;
  }
};

const parseDialogueSummaryResponse = (responseText: string): DialogueSummaryResponse | null => {
    let jsonStr = responseText.trim();
    const fenceRegex = /^```(?:json)?\s*\n?(.*?)\n?\s*```$/s;
    const fenceMatch = jsonStr.match(fenceRegex);
    if (fenceMatch && fenceMatch[1]) {
      jsonStr = fenceMatch[1].trim();
    }

    try {
      const parsed = JSON.parse(jsonStr) as DialogueSummaryResponse;
      return parsed;
    } catch (e) {
      console.warn("Failed to parse dialogue summary JSON response from AI:", e);
      console.debug("Original dialogue summary response text:", responseText);
      return null;
    }
  };


export const fetchDialogueTurn = async (
  currentTheme: AdventureTheme, // Changed to AdventureTheme object
  currentQuest: string | null,
  currentObjective: string | null,
  currentScene: string,
  localTime: string | null,
  localEnvironment: string | null,
  localPlace: string | null,
  knownMainMapNodesInTheme: MapNode[], 
  knownCharactersInTheme: Character[], 
  inventory: Item[],
  playerGender: string,
  dialogueHistory: DialogueHistoryEntry[],
  playerLastUtterance: string,
  dialogueParticipants: string[]
): Promise<DialogueAIResponse | null> => {
  if (!process.env.API_KEY) {
    console.error("API Key not configured for Dialogue Service.");
    return Promise.reject(new Error("API Key not configured."));
  }

  let historyToUseInPrompt = [...dialogueHistory];
  if (
    historyToUseInPrompt.length > 0 &&
    historyToUseInPrompt[historyToUseInPrompt.length - 1].speaker.toLowerCase() === 'player' &&
    historyToUseInPrompt[historyToUseInPrompt.length - 1].line === playerLastUtterance
  ) {
    historyToUseInPrompt = historyToUseInPrompt.slice(0, -1);
  }

  const historyString = historyToUseInPrompt.map(entry => `${entry.speaker}: "${entry.line}"`).join('\n');
  const inventoryString = inventory.map(item => `${item.name} (Type: ${item.type}, Active: ${!!item.isActive})`).join(', ') || "Empty";
  const knownPlacesString = formatKnownPlacesForPrompt(knownMainMapNodesInTheme, true);
  
  let characterContextString = "Known Characters: ";
  if (knownCharactersInTheme.length > 0) {
    characterContextString += knownCharactersInTheme.map(c => {
      let charStr = `"${c.name}" (Description: ${c.description.substring(0, 70)}...; Presence: ${c.presenceStatus}`;
      if (c.presenceStatus === 'nearby' || c.presenceStatus === 'companion') {
        charStr += ` at ${c.preciseLocation || 'around'}`;
      } else {
        charStr += `, last seen: ${c.lastKnownLocation || 'Unknown'}`;
      }
      charStr += ")";
      return charStr;
    }).join('; ') + ".";
  } else {
    characterContextString += "None specifically known.";
  }

  let pastDialogueSummariesContext = "";
  dialogueParticipants.forEach(participantName => {
    const participantChar = knownCharactersInTheme.find(char => char.name === participantName);
    if (participantChar && participantChar.dialogueSummaries && participantChar.dialogueSummaries.length > 0) {
      pastDialogueSummariesContext += `\nRecent Past Conversations involving ${participantName}:\n`;
      const summariesToShow = participantChar.dialogueSummaries.slice(-MAX_DIALOGUE_SUMMARIES_IN_PROMPT);
      summariesToShow.forEach(summary => {
        pastDialogueSummariesContext += `- Summary: "${summary.summaryText}" (Participants: ${summary.participants.join(', ')}; Time: ${summary.timestamp}; Location: ${summary.location})\n`;
      });
    }
  });


  const prompt = `
Context for Dialogue Turn:
- Current Theme: "${currentTheme.name}"
- System Instruction Modifier for Theme: "${currentTheme.systemInstructionModifier}"
- Current Main Quest: "${currentQuest || "Not set"}"
- Current Objective: "${currentObjective || "Not set"}"
- Scene Description (for environmental context): "${currentScene}"
- Local Time: "${localTime || "Unknown"}", Environment: "${localEnvironment || "Undetermined"}", Place: "${localPlace || "Undetermined"}"
- Player's Character Gender: ${playerGender}
- Player's Inventory: ${inventoryString}
- Known Locations: ${knownPlacesString}
- ${characterContextString}
- Current Dialogue Participants: ${dialogueParticipants.join(', ')}
${pastDialogueSummariesContext.trim() ? pastDialogueSummariesContext : "\n- No specific past dialogue summaries available for current participants."}
- Dialogue History (most recent last):
${historyString}
- Player's Last Utterance/Choice: "${playerLastUtterance}"

Based on this context, provide the next part of the dialogue according to the DIALOGUE_SYSTEM_INSTRUCTION.
The NPC(s) should respond to the player's last utterance, taking into account any relevant past conversation summaries.
Provide new dialogue options, ensuring the last one is a way to end the dialogue.
`;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`Fetching dialogue turn (Participants: ${dialogueParticipants.join(', ')}, Attempt ${attempt}/${MAX_RETRIES})`);
      const response = await callDialogueGeminiAPI(prompt, DIALOGUE_SYSTEM_INSTRUCTION, true); // Disable thinking for dialogue
      const parsed = parseDialogueAIResponse(response.text ?? '');
      if (parsed) return parsed;
      console.warn(`Attempt ${attempt} failed to yield valid JSON for dialogue turn. Retrying if attempts remain.`);
    } catch (error) {
      console.error(`Error fetching dialogue turn (Attempt ${attempt}/${MAX_RETRIES}):`, error);
      if (attempt === MAX_RETRIES) throw error;
    }
  }
  throw new Error("Failed to fetch dialogue turn after maximum retries.");
};


export const summarizeDialogueForUpdates = async (
  summaryContext: DialogueSummaryContext 
): Promise<DialogueSummaryResponse | null> => {
  if (!process.env.API_KEY) {
    console.error("API Key not configured for Dialogue Summary Service.");
    return Promise.reject(new Error("API Key not configured."));
  }
  
  if (!summaryContext.currentThemeObject) {
    console.error("DialogueSummaryContext missing currentThemeObject. Cannot summarize dialogue.");
    return Promise.reject(new Error("DialogueSummaryContext missing currentThemeObject."));
  }

  const dialogueLogString = summaryContext.dialogueLog.map(entry => `${entry.speaker}: "${entry.line}"`).join('\n');
  const inventoryString = summaryContext.inventory.map(item => `${item.name} (Type: ${item.type})`).join(', ') || "Empty";
  const knownPlacesString = formatKnownPlacesForPrompt(summaryContext.mapDataForTheme.nodes.filter(n => !n.data.isLeaf), true);
  
  let knownCharactersString = "Known Characters: ";
  if (summaryContext.knownCharactersInTheme.length > 0) {
    knownCharactersString += summaryContext.knownCharactersInTheme.map(c => {
      let charStr = `"${c.name}" (Description: ${c.description.substring(0, 70)}...; Presence: ${c.presenceStatus}`;
      if (c.presenceStatus === 'nearby' || c.presenceStatus === 'companion') {
        charStr += ` at ${c.preciseLocation || 'around'}`;
      } else {
        charStr += `, last seen: ${c.lastKnownLocation || 'Unknown'}`;
      }
      charStr += ")";
      return charStr;
    }).join('; ') + ".";
  } else {
    knownCharactersString += "None specifically known.";
  }


  const prompt = `
Context for Dialogue Summary:
- Current Theme: "${summaryContext.currentThemeObject.name}"
- System Instruction Modifier for Theme: "${summaryContext.currentThemeObject.systemInstructionModifier}"
- Current Main Quest (before dialogue): "${summaryContext.mainQuest || "Not set"}"
- Current Objective (before dialogue): "${summaryContext.currentObjective || "Not set"}"
- Scene Description (when dialogue started): "${summaryContext.currentScene}"
- Local Time: "${summaryContext.localTime || "Unknown"}", Environment: "${summaryContext.localEnvironment || "Undetermined"}", Place: "${summaryContext.localPlace || "Undetermined"}"
- Player's Character Gender: "${summaryContext.playerGender}"
- Player's Inventory (before dialogue): ${inventoryString}
- Known Locations (before dialogue): ${knownPlacesString}
- ${knownCharactersString}
- Dialogue Participants: ${summaryContext.dialogueParticipants.join(', ')}

Full Dialogue Transcript:
${dialogueLogString}

Based *only* on the Dialogue Transcript and the provided context, determine what concrete game state changes (items, characters, quest/objective updates, log message, map updates) resulted *directly* from this dialogue.
The "logMessage" field in your response should be a concise summary suitable for the main game log.
If the dialogue revealed a new alias for an existing character, use "charactersUpdated" with "addAlias".
If the dialogue changed some character's general whereabouts, use "newLastKnownLocation" in "charactersUpdated".
If the dialogue revealed new map information (new locations, changed accessibility, etc.), or if Player's own location changed over the course of the dialogue, then set "mapUpdated": true.
`;

  for (let attempt = 1; attempt <= MAX_RETRIES + 2; attempt++) {
    try {
      console.log(`Summarizing dialogue with ${summaryContext.dialogueParticipants.join(', ')}, Attempt ${attempt}/${MAX_RETRIES + 2})`);
      const response = await callDialogueGeminiAPI(prompt, DIALOGUE_SUMMARY_SYSTEM_INSTRUCTION, false); // Default (enabled) thinking
      const parsed = parseDialogueSummaryResponse(response.text ?? '');
      if (parsed) return parsed;
      console.warn(`Attempt ${attempt} failed to yield valid JSON for dialogue summary. Retrying if attempts remain.`);
    } catch (error) {
      console.error(`Error summarizing dialogue (Attempt ${attempt}/${MAX_RETRIES + 2}):`, error);
      if (attempt === MAX_RETRIES + 2) throw error; 
    }
  }
  return { logMessage: "The conversation concluded without notable changes." };
};

/**
 * Generates a detailed narrative summary of a dialogue for character memory.
 * Uses the MINIMAL_MODEL_NAME.
 * @param context - The context for the memory summarization. This now expects currentThemeObject.
 * @returns A promise that resolves to the summary string (500-1000 chars) or null.
 */
export const summarizeDialogueForMemory = async (
  context: DialogueMemorySummaryContext 
): Promise<string | null> => {
  if (!process.env.API_KEY) {
    console.error("API Key not configured for Dialogue Memory Summary Service.");
    return null;
  }
  if (!context.currentThemeObject) {
    console.error("DialogueMemorySummaryContext missing currentThemeObject. Cannot summarize memory.");
    return null;
  }

  const dialogueLogString = context.dialogueLog.map(entry => `  ${entry.speaker}: ${entry.line}`).join('\n');
  
  const systemInstructionPart = `You are an AI assistant creating a detailed memory of a conversation. This memory will be stored by the game characters who participated.
Your task is to write a concise yet detailed summary of the conversation.
The summary should be between 500 and 1500 characters. It should be written from the point of view of the Conversation Participants other than the Player.
The summary should ALWAYS mention all names and the "Player" explicitly without pronouns.
It should capture:
- Key topics discussed.
- Important information revealed or exchanged by any participant.
- Significant decisions made or outcomes reached.
- The overall emotional tone or atmosphere of the conversation.
- Any impressions or key takeaways the characters might have.

Output ONLY the summary text. Do NOT use JSON or formatting. Do NOT include any preamble like "Here is the summary:".`;

  const userPromptPart = `Generate a memory summary for the following conversation:
- Conversation Participants: ${context.dialogueParticipants.join(', ')}
- Theme: "${context.currentThemeObject.name}" (System Modifier: ${context.currentThemeObject.systemInstructionModifier})
- Scene at start of conversation: "${context.currentScene}"
- Context: Time: "${context.localTime || "Unknown"}", Environment: "${context.localEnvironment || "Undetermined"}", Place: "${context.localPlace || "Undetermined"}"
- Full Dialogue Transcript:
${dialogueLogString}

Output ONLY the summary text. Do NOT use JSON or formatting. Do NOT include any preamble like "Here is the summary:".
`;
  
  for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) { // Extra retry for this
    try {
      console.log(`Generating memory summary for dialogue with ${context.dialogueParticipants.join(', ')}, Attempt ${attempt}/${MAX_RETRIES + 1})`);
      const response = await ai.models.generateContent({
        model: MINIMAL_MODEL_NAME, // Will now use gemini-2.5-flash-preview-04-17
        contents: `${systemInstructionPart}\n\n${userPromptPart}`, 
        config: {
            temperature: 1.0, 
            // Omit thinkingConfig for higher quality (default enabled)
        }
      });
      const memoryText = (response.text ?? '').trim();
      if (memoryText.length > 0) { // Only log and return if memoryText is actually non-empty
        console.log (`summarizeDialogueForMemory: ${context.dialogueParticipants.join(', ')} will remember ${memoryText}`)
        return memoryText; 
      }
      // If memoryText is empty, it will fall through and potentially return null after retries.
      // The calling function (useDialogueFlow) has a fallback for null/empty.
      console.warn(`Attempt ${attempt} for memory summary yielded empty text after trim: '${memoryText}'`);
      if (attempt === MAX_RETRIES + 1) return null; 
    } catch (error) {
      console.error(`Error generating memory summary (Attempt ${attempt}/${MAX_RETRIES + 1}):`, error);
      if (attempt === MAX_RETRIES + 1) return null;
    }
  }
  return null;
};
