
/**
 * @file api.ts
 * @description Wrapper functions for the main storytelling AI interactions.
 */
import { GenerateContentResponse } from "@google/genai";
import { AdventureTheme } from '../../types';
import { GEMINI_MODEL_NAME, AUXILIARY_MODEL_NAME, MAX_RETRIES, LOADING_REASON_UI_MAP } from '../../constants';
import { SYSTEM_INSTRUCTION } from './systemPrompt';
import { dispatchAIRequest } from '../modelDispatcher';
import { isApiConfigured } from '../apiClient';
import { isServerOrClientError } from '../../utils/aiErrorUtils';
import { addProgressSymbol } from '../../utils/loadingProgress';

// This function is now the primary way gameAIService interacts with Gemini for main game turns. It takes a fully constructed prompt.
export const executeAIMainTurn = async (
    fullPrompt: string,
    themeSystemInstructionModifier: string | undefined // Retain as string for direct use
): Promise<{ response: GenerateContentResponse; thoughts: Array<string> }> => {
    addProgressSymbol(LOADING_REASON_UI_MAP.storyteller.icon);
    if (!isApiConfigured()) {
      console.error("API Key not configured for Gemini Service.");
      return Promise.reject(new Error("API Key not configured."));
    }

    let systemInstructionForCall = SYSTEM_INSTRUCTION;
    if (themeSystemInstructionModifier) {
        systemInstructionForCall += `\n\nCURRENT THEME GUIDANCE:\n${themeSystemInstructionModifier}`;
    }

    for (let attempt = 1; attempt <= MAX_RETRIES; ) {
        try {
            const { response } = await dispatchAIRequest({
                modelNames: [GEMINI_MODEL_NAME],
                prompt: fullPrompt,
                systemInstruction: systemInstructionForCall,
                temperature: 1.0,
                thinkingBudget: 4096,
                includeThoughts: true,
                responseMimeType: "application/json",
                label: "Storyteller"
            });
            const parts = (response.candidates?.[0]?.content?.parts ?? []) as Array<{ text?: string; thought?: boolean }>;
            const thoughts = parts
              .filter((p): p is { text: string; thought?: boolean } => p.thought === true && typeof p.text === 'string')
              .map(p => p.text);
            return { response, thoughts };
        } catch (error) {
            console.error(`Error executing AI Main Turn (Attempt ${String(attempt)}/${String(MAX_RETRIES)}):`, error);
            if (!isServerOrClientError(error)) {
                throw error;
            }
            if (attempt === MAX_RETRIES) {
                return Promise.reject(new Error(`Failed to execute AI Main Turn after maximum retries: ${error instanceof Error ? error.message : String(error)}`));
            }
            await new Promise(resolve => setTimeout(resolve, 500));
            continue; // retry same attempt
        }
        attempt++;
    }
    // Should not be reached if MAX_RETRIES > 0, as the loop will either return or throw.
    // Added for type safety / exhaustive paths.
    return Promise.reject(new Error("Failed to execute AI Main Turn: Max retries exhausted (unexpectedly)."));
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

  for (let attempt = 1; attempt <= MAX_RETRIES + 1; ) { // Extra retry for summarization
    try {
      console.log(`Summarizing adventure for theme "${themeToSummarize.name}" (Attempt ${String(attempt)}/${String(MAX_RETRIES +1)})`);
      const { response } = await dispatchAIRequest({
          modelNames: [AUXILIARY_MODEL_NAME, GEMINI_MODEL_NAME],
          prompt: summarizationPrompt,
          temperature: 0.8,
          label: 'Summarize',
      });
      const text = (response.text ?? '').trim();
      if (text && text.length > 0) {
        return text;
      }
        console.warn(`Attempt ${String(attempt)} failed to yield non-empty summary for theme "${themeToSummarize.name}". Text was: '${String(response.text)}'`);
      if (attempt === MAX_RETRIES +1 && (!text || text.length === 0)) return null;
    } catch (error) {
      console.error(`Error summarizing adventure for theme "${themeToSummarize.name}" (Attempt ${String(attempt)}/${String(MAX_RETRIES +1)}):`, error);
      if (!isServerOrClientError(error)) {
        throw error;
      }
      if (attempt === MAX_RETRIES +1) {
        return null;
      }
      await new Promise(resolve => setTimeout(resolve, 500));
      continue;
    }
    attempt++;
  }
  return null;
};
