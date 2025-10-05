import { Dispatch, SetStateAction } from 'react';

import {
  AdventureTheme,
  FullGameState,
  GameStateFromAI,
  HeroSheet,
  Item,
  MapData,
  NPC,
} from '../types';
import { executeAIMainTurn, parseAIResponse } from '../services/storyteller';
import { ParseFailureReason } from '../services/storyteller/responseParser';
import { MAX_RETRIES } from '../constants';

interface StorytellerParseContext {
  logMessageFromPayload?: string;
  sceneDescriptionFromPayload?: string;
  npcs: Array<NPC>;
  mapDataForResponse: MapData;
  inventoryForCorrection: Array<Item>;
}

export interface StorytellerParseRetryOptions {
  prompt: string;
  draftState: FullGameState;
  theme: AdventureTheme;
  heroSheet: HeroSheet | null;
  parseContext: StorytellerParseContext;
  setParseErrorCounter: Dispatch<SetStateAction<number>>;
  maxAttempts?: number;
  executeOptions?: {
    maxOutputTokensOverride?: number;
    systemInstructionOverride?: string;
  };
}

export interface StorytellerParseRetryResult {
  parsedData: GameStateFromAI | null;
  parseErrors: number;
  lastErrorMessage: string | null;
  lastErrorReason: ParseFailureReason | null;
}

/**
 * Executes the storyteller call and retries when JSON parsing fails, tracking the
 * number of consecutive parse errors via the provided state setter.
 */
export const runStorytellerTurnWithParseRetries = async (
  options: StorytellerParseRetryOptions,
): Promise<StorytellerParseRetryResult> => {
  const {
    prompt,
    draftState,
    theme,
    heroSheet,
    parseContext,
    setParseErrorCounter,
    maxAttempts = MAX_RETRIES + 1,
    executeOptions,
  } = options;

  let parsedData: GameStateFromAI | null = null;
  let parseErrors = 0;
  let lastErrorMessage: string | null = null;
  let lastErrorReason: ParseFailureReason | null = null;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    if (attempt > 0) {
      console.warn(
        `Storyteller parse retry ${String(attempt + 1)}/${String(maxAttempts)}...`,
      );
    }

    const attemptPrompt = attempt === 0
      ? prompt
      : `${prompt}\n\n[Parser Feedback]\n${lastErrorMessage ?? 'The previous response could not be parsed. Return strictly valid JSON that matches the provided schema without extra commentary.'}`;

    const {
      response,
      thoughts,
      systemInstructionUsed,
      jsonSchemaUsed,
      promptUsed,
    } = await executeAIMainTurn(attemptPrompt, executeOptions);

    const previousDebug = draftState.lastDebugPacket ?? {
      prompt: attemptPrompt,
      rawResponseText: null,
      parsedResponse: null,
      timestamp: new Date().toISOString(),
      storytellerThoughts: null,
      mapUpdateDebugInfo: null,
      inventoryDebugInfo: null,
      librarianDebugInfo: null,
      loremasterDebugInfo: null,
      dialogueDebugInfo: null,
    };

    draftState.lastDebugPacket = {
      ...previousDebug,
      prompt: promptUsed,
      rawResponseText: response.text ?? null,
      storytellerThoughts: thoughts,
      systemInstruction: systemInstructionUsed,
      jsonSchema: jsonSchemaUsed,
      timestamp: new Date().toISOString(),
    };

    const parseResult = await parseAIResponse(
      response.text ?? '',
      theme,
      heroSheet,
      undefined,
      parseContext.logMessageFromPayload,
      parseContext.sceneDescriptionFromPayload,
      parseContext.npcs,
      parseContext.mapDataForResponse,
      parseContext.inventoryForCorrection,
    );

    if (parseResult.data) {
      parsedData = parseResult.data;
      draftState.lastDebugPacket.parsedResponse = parseResult.data;
      draftState.lastDebugPacket.error = undefined;
      if (parseErrors > 0) {
        setParseErrorCounter(0);
      }
      break;
    }

    draftState.lastDebugPacket.parsedResponse = null;
    parseErrors += 1;
    lastErrorMessage = parseResult.error;
    lastErrorReason = parseResult.reason;
    if (parseResult.error) {
      draftState.lastDebugPacket.error = parseResult.error;
    }
    setParseErrorCounter(parseErrors);

    if (parseErrors >= maxAttempts) {
      break;
    }
  }

  if (!parsedData && draftState.lastDebugPacket) {
    draftState.lastDebugPacket.error = lastErrorMessage
      ?? `Storyteller JSON invalid after ${String(Math.max(parseErrors, 1))} attempt${parseErrors === 1 ? '' : 's'}.`;
  }

  return { parsedData, parseErrors, lastErrorMessage, lastErrorReason };
};
