
/**
 * @file gameAIService.ts
 * @description Wrapper functions for the main storytelling AI interactions.
 */
import { GenerateContentResponse } from "@google/genai";
import { AdventureTheme } from '../types';
import { GEMINI_MODEL_NAME, AUXILIARY_MODEL_NAME, MAX_RETRIES } from '../constants';
import { SYSTEM_INSTRUCTION } from '../prompts/mainPrompts';
import { ai } from './geminiClient';
import { dispatchAIRequest } from './modelDispatcher';
import { isApiConfigured } from './apiClient';
import { isServerOrClientError } from '../utils/aiErrorUtils';
import { addProgressSymbol } from '../utils/loadingProgress';
import { recordModelCall } from '../utils/modelUsageTracker';

// This function is now the primary way gameAIService interacts with Gemini for main game turns. It takes a fully constructed prompt.
export const executeAIMainTurn = async (
    fullPrompt: string,
    themeSystemInstructionModifier: string | undefined // Retain as string for direct use
): Promise<GenerateContentResponse> => {
    addProgressSymbol('██');
    if (!isApiConfigured()) {
      console.error("API Key not configured for Gemini Service.");
      return Promise.reject(new Error("API Key not configured."));
    }

    let systemInstructionForCall = SYSTEM_INSTRUCTION;
    if (themeSystemInstructionModifier) {
        systemInstructionForCall += `\n\nCURRENT THEME GUIDANCE:\n${themeSystemInstructionModifier}`;
    }

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            recordModelCall(GEMINI_MODEL_NAME);
            const response = await ai!.models.generateContent({
                model: GEMINI_MODEL_NAME,
                contents: fullPrompt,
                config: {
                    systemInstruction: systemInstructionForCall,
                    responseMimeType: "application/json",
                    temperature: 1.0,
                    thinkingConfig: { thinkingBudget: 4096 } // Disable thinking for lower latency
                }
            });
            // Return the raw response. Parsing and processing happen in useGameLogic.
            console.log(
                "Executing AI Main Turn. Total tokens: ",
                response.usageMetadata?.totalTokenCount ?? 'N/A',
                ", Thought Tokens:", response.usageMetadata?.thoughtsTokenCount ?? 'N/A',
                ", Prompt Tokens: ", response.usageMetadata?.promptTokenCount ?? 'N/A'
            );
            return response;
        } catch (error) {
            console.error(`Error executing AI Main Turn (Attempt ${attempt}/${MAX_RETRIES}):`, error);
            if (isServerOrClientError(error)) {
                const err = error instanceof Error ? error : new Error(String(error));
                return Promise.reject(err);
            }
            if (attempt === MAX_RETRIES) {
                return Promise.reject(new Error(`Failed to execute AI Main Turn after maximum retries: ${error instanceof Error ? error.message : String(error)}`));
            }
            await new Promise(resolve => setTimeout(resolve, 500 * attempt));
        }
    }
    // Should not be reached if MAX_RETRIES > 0, as the loop will either return or throw.
    // Added for type safety / exhaustive paths.
    return Promise.reject(new Error("Failed to execute AI Main Turn: Max retries exhausted (unexpectedly)."));
};


// Summarization service remains largely the same as its prompting needs are different.
export const summarizeThemeAdventure_Service = async (
  themeToSummarize: AdventureTheme, // Changed to AdventureTheme object
  lastSceneDescription: string,
  actionLog: string[]
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

  for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) { // Extra retry for summarization
    try {
      console.log(`Summarizing adventure for theme "${themeToSummarize.name}" (Attempt ${attempt}/${MAX_RETRIES +1})`);
      const response = await dispatchAIRequest(
          [AUXILIARY_MODEL_NAME, GEMINI_MODEL_NAME],
          summarizationPrompt,
          undefined,
          {
              temperature: 0.8,
          }
      );
      const text = (response.text ?? '').trim();
      if (text && text.length > 0) {
        return text;
      }
      console.warn(`Attempt ${attempt} failed to yield non-empty summary for theme "${themeToSummarize.name}". Text was: '${response.text}'`);
      if (attempt === MAX_RETRIES +1 && (!text || text.length === 0)) return null;
    } catch (error) {
      console.error(`Error summarizing adventure for theme "${themeToSummarize.name}" (Attempt ${attempt}/${MAX_RETRIES +1}):`, error);
      if (attempt === MAX_RETRIES +1) {
        return null;
      }
    }
  }
  return null;
};
