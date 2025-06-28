import {
  GEMINI_LITE_MODEL_NAME,
  GEMINI_MODEL_NAME,
  LOADING_REASON_UI_MAP,
  MINIMAL_MODEL_NAME,
} from '../../constants';
import { dispatchAIRequest } from '../modelDispatcher';
import { retryAiCall } from '../../utils/retry';
import { addProgressSymbol } from '../../utils/loadingProgress';
import { isApiConfigured } from '../apiClient';
import { formatRecentEventsForPrompt } from '../../utils/promptFormatters';
import { extractJsonFromFence, safeParseJson } from '../../utils/jsonUtils';
import type { LoremasterModeDebugInfo, GeneratedJournalEntry } from '../../types';

export interface GeneratedJournalEntryResult {
  entry: GeneratedJournalEntry | null;
  debugInfo: LoremasterModeDebugInfo | null;
}

const buildJournalEntrySchema = (length: number) => ({
  type: 'object',
  properties: {
    heading: {
      type: 'string',
      description: 'Short plain text heading for the journal entry.',
    },
    text: {
      type: 'string',
      minLength: length - 10,
      description: `Exactly ${String(length)} words describing the journal entry, starting with a Markup-formatted heading. Basic Markup syntax is allowed, such as **bold** and *italic*.`,
    },
  },
  required: ['heading', 'text'],
  additionalProperties: false,
} as const);

const parseJournalEntry = (raw: string): GeneratedJournalEntry | null => {
  const jsonStr = extractJsonFromFence(raw);
  return safeParseJson<GeneratedJournalEntry>(jsonStr, (data): data is GeneratedJournalEntry =>
    !!data && typeof data === 'object' && typeof (data as GeneratedJournalEntry).heading === 'string' && typeof (data as GeneratedJournalEntry).text === 'string');
};

export const generateJournalEntry = async (
  length: number,
  itemName: string,
  itemDescription: string,
  previousEntry: string,
  themeName: string,
  themeDescription: string,
  sceneDescription: string,
  storytellerThoughts: string,
  knownPlaces: string,
  knownNPCs: string,
  recentLogEntries: Array<string>,
  currentQuest: string | null,
): Promise<GeneratedJournalEntryResult | null> => {
  if (!isApiConfigured()) {
    console.error('generateJournalEntry: API key not configured.');
    return null;
  }

  const questLine = currentQuest ? `Current Quest: "${currentQuest}"` : 'Current Quest: Not set';
  const recentEventsContext = formatRecentEventsForPrompt(recentLogEntries);
  const prompt = `**Context:**
Theme Name: "${themeName}";
Theme Description: "${themeDescription}";
${questLine};

## Known Locations:
${knownPlaces}
## Known NPCs:
${knownNPCs}
## Previous Journal Entry:
${previousEntry}

## Last events:
${recentEventsContext}

## Scene Description:
${sceneDescription};

------
`;
  const systemInstruction = `You are the main protagonist writing a new entry in your personal journal, focusing primarily on Last events and Scene description, logically continuing from the Previous Journal Entry. Always write in-character. NEVER include any ID strings. Provide only the JSON for the new journal entry.`;
  const schema = buildJournalEntrySchema(length);

  return retryAiCall<GeneratedJournalEntryResult>(async attempt => {
    try {
      addProgressSymbol(LOADING_REASON_UI_MAP.journal.icon);
      const {
        response,
        systemInstructionUsed,
        jsonSchemaUsed,
        promptUsed,
      } = await dispatchAIRequest({
        modelNames: [GEMINI_LITE_MODEL_NAME, MINIMAL_MODEL_NAME, GEMINI_MODEL_NAME],
        prompt,
        systemInstruction,
        temperature: 1.0,
        thinkingBudget: 1024,
        includeThoughts: true,
        responseMimeType: 'application/json',
        jsonSchema: schema,
        label: 'Journal',
      });
      const text = response.text?.trim() ?? '';
      const parsed = text ? parseJournalEntry(text) : null;
      return {
        result: {
          entry: parsed,
          debugInfo: {
            prompt: promptUsed,
            systemInstruction: systemInstructionUsed,
            jsonSchema: jsonSchemaUsed ?? schema,
            rawResponse: text,
            parsedPayload: parsed ?? undefined,
          },
        },
      };
    } catch (err: unknown) {
      console.error(`generateJournalEntry error (Attempt ${String(attempt + 1)}):`, err);
      throw err;
    }
    return { result: { entry: null, debugInfo: null } };
  });
};

export default generateJournalEntry;
