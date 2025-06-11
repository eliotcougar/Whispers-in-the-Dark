
/**
 * @file dialogueService.ts
 * @description AI interaction helpers for managing game dialogues.
 */
import { GenerateContentResponse } from "@google/genai";
import {
  DialogueAIResponse, DialogueHistoryEntry, DialogueSummaryContext, DialogueSummaryResponse,
  Item, Character, MapNode, DialogueMemorySummaryContext, AdventureTheme
} from '../types';
import { GEMINI_MODEL_NAME, MAX_RETRIES } from '../constants';
import {
  DIALOGUE_SYSTEM_INSTRUCTION,
  DIALOGUE_SUMMARY_SYSTEM_INSTRUCTION,
} from './dialogue/systemPrompt';
import { ai } from './geminiClient';
import { recordModelCall } from '../utils/modelUsageTracker';
import { callMinimalCorrectionAI } from './corrections/base';
import { isApiConfigured } from './apiClient';
import { buildDialogueTurnPrompt, buildDialogueSummaryPrompt, buildDialogueMemorySummaryPrompts } from './dialogue/promptBuilder';

import { extractJsonFromFence, safeParseJson } from '../utils/jsonUtils';
interface GeminiRequestConfig {
  systemInstruction: string;
  responseMimeType: string;
  temperature: number;
  thinkingConfig?: { thinkingBudget: number };
}

/**
 * Executes a Gemini API call for dialogue related prompts.
 * Allows optional disabling of model "thinking" for faster responses.
 */
const callDialogueGeminiAPI = async (
  prompt: string,
  systemInstruction: string,
  disableThinking: boolean = false
): Promise<GenerateContentResponse> => {
  const config: GeminiRequestConfig = {
    systemInstruction,
    responseMimeType: "application/json",
    temperature: 0.8,
  };
  if (disableThinking) {
    config.thinkingConfig = { thinkingBudget: 0 };
  }
  recordModelCall(GEMINI_MODEL_NAME);
  return ai!.models.generateContent({
    model: GEMINI_MODEL_NAME, // Will use gemini-2.5-flash-preview-04-17
    contents: prompt,
    config: config
  });
};

const parseDialogueAIResponse = (
  responseText: string
): DialogueAIResponse | null => {
  const jsonStr = extractJsonFromFence(responseText);
  const parsed = safeParseJson<Partial<DialogueAIResponse>>(jsonStr);
  try {
    if (!parsed) throw new Error('JSON parse failed');
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

const parseDialogueSummaryResponse = (
  responseText: string
): DialogueSummaryResponse | null => {
    const jsonStr = extractJsonFromFence(responseText);
    const parsed = safeParseJson<DialogueSummaryResponse>(jsonStr);
    try {
      if (!parsed) throw new Error('JSON parse failed');
      return parsed;
    } catch (e) {
      console.warn("Failed to parse dialogue summary JSON response from AI:", e);
      console.debug("Original dialogue summary response text:", responseText);
      return null;
    }
  };


/**
 * Fetches the next dialogue turn from the AI based on the current game state.
 */
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
  if (!isApiConfigured()) {
    console.error("API Key not configured for Dialogue Service.");
    return Promise.reject(new Error("API Key not configured."));
  }
  const prompt = buildDialogueTurnPrompt({
    currentTheme,
    currentQuest,
    currentObjective,
    currentScene,
    localTime,
    localEnvironment,
    localPlace,
    knownMainMapNodesInTheme,
    knownCharactersInTheme,
    inventory,
    playerGender,
    dialogueHistory,
    playerLastUtterance,
    dialogueParticipants,
  });

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


/**
 * Summarizes a completed dialogue to derive game state updates.
 */
export const summarizeDialogueForUpdates = async (
  summaryContext: DialogueSummaryContext
): Promise<DialogueSummaryResponse | null> => {
  if (!isApiConfigured()) {
    console.error("API Key not configured for Dialogue Summary Service.");
    return Promise.reject(new Error("API Key not configured."));
  }
  
  if (!summaryContext.currentThemeObject) {
    console.error("DialogueSummaryContext missing currentThemeObject. Cannot summarize dialogue.");
    return Promise.reject(new Error("DialogueSummaryContext missing currentThemeObject."));
  }

  const prompt = buildDialogueSummaryPrompt(summaryContext);

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
  if (!isApiConfigured()) {
    console.error("API Key not configured for Dialogue Memory Summary Service.");
    return null;
  }
  if (!context.currentThemeObject) {
    console.error("DialogueMemorySummaryContext missing currentThemeObject. Cannot summarize memory.");
    return null;
  }
  const { systemInstructionPart, userPromptPart } = buildDialogueMemorySummaryPrompts(context);
  
  for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) { // Extra retry for this
    try {
      console.log(`Generating memory summary for dialogue with ${context.dialogueParticipants.join(', ')}, Attempt ${attempt}/${MAX_RETRIES + 1})`);
      const memoryText = await callMinimalCorrectionAI(
        userPromptPart,
        systemInstructionPart
      );
      if (memoryText && memoryText.length > 0) { // Only log and return if memoryText is actually non-empty
        console.log(`summarizeDialogueForMemory: ${context.dialogueParticipants.join(', ')} will remember ${memoryText}`);
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
