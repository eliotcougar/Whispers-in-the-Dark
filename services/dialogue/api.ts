/**
 * @file api.ts
 * @description Wrapper functions for dialogue-related AI interactions.
 */
import { GenerateContentResponse } from '@google/genai';
import {
  DialogueAIResponse,
  DialogueHistoryEntry,
  DialogueSummaryContext,
  GameStateFromAI,
  Item,
  NPC,
  MapNode,
  DialogueMemorySummaryContext,
  AdventureTheme,
} from '../../types';
import { GEMINI_MODEL_NAME, MAX_RETRIES } from '../../constants';
import { DIALOGUE_SYSTEM_INSTRUCTION } from './systemPrompt';
import { SYSTEM_INSTRUCTION } from '../storyteller/systemPrompt';
import { dispatchAIRequest } from '../modelDispatcher';
import { isServerOrClientError } from '../../utils/aiErrorUtils';
import { fetchCorrectedDialogueTurn_Service } from '../corrections';
import { CORRECTION_TEMPERATURE } from '../../constants';
import { MINIMAL_MODEL_NAME, GEMINI_LITE_MODEL_NAME, LOADING_REASON_UI_MAP } from '../../constants';
import { addProgressSymbol } from '../../utils/loadingProgress';
import { isApiConfigured } from '../apiClient';
import { buildDialogueTurnPrompt, buildDialogueSummaryPrompt, buildDialogueMemorySummaryPrompts } from './promptBuilder';
import {
  parseDialogueTurnResponse,
} from './responseParser';
import { parseAIResponse } from '../storyteller/responseParser';

interface GeminiRequestConfig {
  systemInstruction: string;
  responseMimeType: string;
  temperature: number;
  thinkingConfig?: { thinkingBudget: number; includeThoughts: boolean };
}

/**
 * Executes a Gemini API call for dialogue related prompts.
 * Allows optional disabling of model "thinking" for faster responses.
 */
const callDialogueGeminiAPI = async (
  prompt: string,
  systemInstruction: string,
  thinkingBudgetLimit = 0 // Default to 0 (disabled thinking)
): Promise<GenerateContentResponse> => {
  const config: GeminiRequestConfig = {
    systemInstruction,
    responseMimeType: 'application/json',
    temperature: 0.8,
    thinkingConfig: { thinkingBudget: thinkingBudgetLimit, includeThoughts: true }
  };

  const { response } = await dispatchAIRequest({
    modelNames: [GEMINI_LITE_MODEL_NAME, GEMINI_MODEL_NAME],
    prompt,
    systemInstruction,
    temperature: config.temperature,
    responseMimeType: config.responseMimeType,
    thinkingBudget: config.thinkingConfig?.thinkingBudget,
    includeThoughts: true,
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
  knownMainMapNodesInTheme: Array<MapNode>,
  knownNPCsInTheme: Array<NPC>,
  inventory: Array<Item>,
  playerGender: string,
  dialogueHistory: Array<DialogueHistoryEntry>,
  playerLastUtterance: string,
  dialogueParticipants: Array<string>,
  relevantFacts: Array<string>,
): Promise<{ parsed: DialogueAIResponse | null; prompt: string; rawResponse: string; thoughts: Array<string> }> => {
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
    knownNPCsInTheme: knownNPCsInTheme,
    inventory,
    playerGender,
    dialogueHistory,
    playerLastUtterance,
    dialogueParticipants,
    relevantFacts,
  });

  for (let attempt = 1; attempt <= MAX_RETRIES; ) {
    try {
      console.log(`Fetching dialogue turn (Participants: ${dialogueParticipants.join(', ')}, Attempt ${String(attempt)}/${String(MAX_RETRIES)})`);
      const response = await callDialogueGeminiAPI(prompt, DIALOGUE_SYSTEM_INSTRUCTION, 512);
      const parts =
        (response.candidates?.[0]?.content?.parts ?? []) as Array<{
          text?: string;
          thought?: boolean;
        }>;
      const thoughtParts = parts
        .filter((p): p is { text: string; thought?: boolean } => p.thought === true && typeof p.text === 'string')
        .map(p => p.text);
      let parsed = parseDialogueTurnResponse(response.text ?? '', thoughtParts);
      parsed ??= await fetchCorrectedDialogueTurn_Service(
        response.text ?? '',
        dialogueParticipants,
        currentTheme,
        thoughtParts,
      );
      if (parsed) return { parsed, prompt, rawResponse: response.text ?? '', thoughts: thoughtParts };
      console.warn(`Attempt ${String(attempt)} failed to yield valid dialogue JSON even after correction.`);
      attempt++;
    } catch (error: unknown) {
      console.error(`Error fetching dialogue turn (Attempt ${String(attempt)}/${String(MAX_RETRIES)}):`, error);
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
): Promise<{ parsed: GameStateFromAI | null; prompt: string; rawResponse: string; thoughts: Array<string> }> => {
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
      console.log(`Summarizing dialogue with ${summaryContext.dialogueParticipants.join(', ')}, Attempt ${String(attempt)}/${String(MAX_RETRIES + 2)})`);
      let systemInstructionForCall = SYSTEM_INSTRUCTION;
      if (summaryContext.currentThemeObject.systemInstructionModifier) {
        systemInstructionForCall += `\n\nCURRENT THEME GUIDANCE:\n${summaryContext.currentThemeObject.systemInstructionModifier}`;
      }
      const { response } = await dispatchAIRequest({
        modelNames: [GEMINI_MODEL_NAME],
        prompt,
        systemInstruction: systemInstructionForCall,
        temperature: 1.0,
        responseMimeType: 'application/json',
        thinkingBudget: 4096,
        includeThoughts: true,
        label: 'Storyteller',
      });
      const parts = (response.candidates?.[0]?.content?.parts ?? []) as Array<{ text?: string; thought?: boolean }>;
      const thoughtParts = parts
        .filter((p): p is { text: string; thought?: boolean } => p.thought === true && typeof p.text === 'string')
        .map(p => p.text);
      const parsed = await parseAIResponse(
        response.text ?? '',
        summaryContext.playerGender,
        summaryContext.currentThemeObject,
        undefined,
        undefined,
        undefined,
        summaryContext.knownNPCsInTheme,
        summaryContext.mapDataForTheme,
        summaryContext.inventory,
      );
      if (parsed) return { parsed, prompt, rawResponse: response.text ?? '', thoughts: thoughtParts };
      console.warn(`Attempt ${String(attempt)} failed to yield valid JSON for dialogue summary. Retrying if attempts remain.`);
      attempt++;
    } catch (error: unknown) {
      console.error(`Error summarizing dialogue (Attempt ${String(attempt)}/${String(MAX_RETRIES + 2)}):`, error);
      if (!isServerOrClientError(error)) throw error;
      if (attempt === MAX_RETRIES + 2) throw error;
      await new Promise(resolve => setTimeout(resolve, 500));
      continue;
    }
  }
  return { parsed: null, prompt, rawResponse: '', thoughts: [] };
};

/**
 * Generates a detailed narrative summary of a dialogue for NPC memory.
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
      console.log(`Generating memory summary for dialogue with ${context.dialogueParticipants.join(', ')}, Attempt ${String(attempt)}/${String(MAX_RETRIES + 1)})`);
      addProgressSymbol(LOADING_REASON_UI_MAP.dialogue_memory_creation.icon);
      const { response } = await dispatchAIRequest({
        modelNames: [MINIMAL_MODEL_NAME, GEMINI_LITE_MODEL_NAME],
        prompt: userPromptPart,
        systemInstruction: systemInstructionPart,
        temperature: CORRECTION_TEMPERATURE,
        label: 'Corrections',
      });
      const memoryText = response.text?.trim() ?? null;
      if (memoryText && memoryText.length > 0) {
        console.log(`summarizeDialogueForMemory: ${context.dialogueParticipants.join(', ')} will remember ${memoryText}`);
        return memoryText;
      }
        console.warn(`Attempt ${String(attempt)} for memory summary yielded empty text after trim: '${String(memoryText)}'`);
      if (attempt === MAX_RETRIES + 1) return null;
      attempt++;
    } catch (error: unknown) {
      console.error(`Error generating memory summary (Attempt ${String(attempt)}/${String(MAX_RETRIES + 1)}):`, error);
      if (!isServerOrClientError(error)) return null;
      if (attempt === MAX_RETRIES + 1) return null;
      await new Promise(resolve => setTimeout(resolve, 500));
      continue;
    }
  }
  return null;
};
