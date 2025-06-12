/**
 * @file api.ts
 * @description Wrapper functions for dialogue-related AI interactions.
 */
import { GenerateContentResponse } from '@google/genai';
import {
  DialogueAIResponse,
  DialogueHistoryEntry,
  DialogueSummaryContext,
  DialogueSummaryResponse,
  Item,
  Character,
  MapNode,
  DialogueMemorySummaryContext,
  AdventureTheme,
} from '../../types';
import { GEMINI_MODEL_NAME, MAX_RETRIES } from '../../constants';
import { DIALOGUE_SYSTEM_INSTRUCTION, DIALOGUE_SUMMARY_SYSTEM_INSTRUCTION } from './systemPrompt';
import { dispatchAIRequest } from '../modelDispatcher';
import { isServerOrClientError } from '../../utils/aiErrorUtils';
import { callMinimalCorrectionAI } from '../corrections/base';
import { isApiConfigured } from '../apiClient';
import { buildDialogueTurnPrompt, buildDialogueSummaryPrompt, buildDialogueMemorySummaryPrompts } from './promptBuilder';
import {
  parseDialogueTurnResponse,
  parseDialogueSummaryResponse,
} from './responseParser';

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
  disableThinking: boolean = false,
): Promise<GenerateContentResponse> => {
  const config: GeminiRequestConfig = {
    systemInstruction,
    responseMimeType: 'application/json',
    temperature: 0.8,
  };
  if (disableThinking) {
    config.thinkingConfig = { thinkingBudget: 0 };
  }

  const { response } = await dispatchAIRequest({
    modelNames: [GEMINI_MODEL_NAME],
    prompt,
    systemInstruction,
    temperature: config.temperature,
    responseMimeType: config.responseMimeType,
    thinkingBudget: config.thinkingConfig?.thinkingBudget,
    label: 'Dialogue',
  });
  return response;
};

/**
 * Fetches the next dialogue turn from the AI based on the current game state.
 */
export const executeDialogueTurn = async (
  currentTheme: AdventureTheme,
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
  dialogueParticipants: string[],
): Promise<DialogueAIResponse | null> => {
  if (!isApiConfigured()) {
    console.error('API Key not configured for Dialogue Service.');
    return Promise.reject(new Error('API Key not configured.'));
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

  for (let attempt = 1; attempt <= MAX_RETRIES; ) {
    try {
      console.log(`Fetching dialogue turn (Participants: ${dialogueParticipants.join(', ')}, Attempt ${attempt}/${MAX_RETRIES})`);
      const response = await callDialogueGeminiAPI(prompt, DIALOGUE_SYSTEM_INSTRUCTION, true);
      const parsed = parseDialogueTurnResponse(response.text ?? '');
      if (parsed) return parsed;
      console.warn(`Attempt ${attempt} failed to yield valid JSON for dialogue turn. Retrying if attempts remain.`);
      attempt++;
    } catch (error) {
      console.error(`Error fetching dialogue turn (Attempt ${attempt}/${MAX_RETRIES}):`, error);
      if (!isServerOrClientError(error)) throw error;
      if (attempt === MAX_RETRIES) throw error;
      await new Promise(resolve => setTimeout(resolve, 500));
      continue;
    }
  }
  throw new Error('Failed to fetch dialogue turn after maximum retries.');
};

/**
 * Summarizes a completed dialogue to derive game state updates.
 */
export const executeDialogueSummary = async (
  summaryContext: DialogueSummaryContext,
): Promise<DialogueSummaryResponse | null> => {
  if (!isApiConfigured()) {
    console.error('API Key not configured for Dialogue Summary Service.');
    return Promise.reject(new Error('API Key not configured.'));
  }

  if (!summaryContext.currentThemeObject) {
    console.error('DialogueSummaryContext missing currentThemeObject. Cannot summarize dialogue.');
    return Promise.reject(new Error('DialogueSummaryContext missing currentThemeObject.'));
  }

  const prompt = buildDialogueSummaryPrompt(summaryContext);

  for (let attempt = 1; attempt <= MAX_RETRIES + 2; ) {
    try {
      console.log(`Summarizing dialogue with ${summaryContext.dialogueParticipants.join(', ')}, Attempt ${attempt}/${MAX_RETRIES + 2})`);
      const response = await callDialogueGeminiAPI(prompt, DIALOGUE_SUMMARY_SYSTEM_INSTRUCTION, false);
      const parsed = parseDialogueSummaryResponse(response.text ?? '');
      if (parsed) return parsed;
      console.warn(`Attempt ${attempt} failed to yield valid JSON for dialogue summary. Retrying if attempts remain.`);
      attempt++;
    } catch (error) {
      console.error(`Error summarizing dialogue (Attempt ${attempt}/${MAX_RETRIES + 2}):`, error);
      if (!isServerOrClientError(error)) throw error;
      if (attempt === MAX_RETRIES + 2) throw error;
      await new Promise(resolve => setTimeout(resolve, 500));
      continue;
    }
  }
  return { logMessage: 'The conversation concluded without notable changes.' };
};

/**
 * Generates a detailed narrative summary of a dialogue for character memory.
 */
export const executeMemorySummary = async (
  context: DialogueMemorySummaryContext,
): Promise<string | null> => {
  if (!isApiConfigured()) {
    console.error('API Key not configured for Dialogue Memory Summary Service.');
    return null;
  }
  if (!context.currentThemeObject) {
    console.error('DialogueMemorySummaryContext missing currentThemeObject. Cannot summarize memory.');
    return null;
  }

  const { systemInstructionPart, userPromptPart } = buildDialogueMemorySummaryPrompts(context);

  for (let attempt = 1; attempt <= MAX_RETRIES + 1; ) {
    try {
      console.log(`Generating memory summary for dialogue with ${context.dialogueParticipants.join(', ')}, Attempt ${attempt}/${MAX_RETRIES + 1})`);
      const memoryText = await callMinimalCorrectionAI(userPromptPart, systemInstructionPart);
      if (memoryText && memoryText.length > 0) {
        console.log(`summarizeDialogueForMemory: ${context.dialogueParticipants.join(', ')} will remember ${memoryText}`);
        return memoryText;
      }
      console.warn(`Attempt ${attempt} for memory summary yielded empty text after trim: '${memoryText}'`);
      if (attempt === MAX_RETRIES + 1) return null;
      attempt++;
    } catch (error) {
      console.error(`Error generating memory summary (Attempt ${attempt}/${MAX_RETRIES + 1}):`, error);
      if (!isServerOrClientError(error)) return null;
      if (attempt === MAX_RETRIES + 1) return null;
      await new Promise(resolve => setTimeout(resolve, 500));
      continue;
    }
  }
  return null;
};
