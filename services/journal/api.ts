import {
  GEMINI_LITE_MODEL_NAME,
  GEMINI_MODEL_NAME,
  LOADING_REASON_UI_MAP,
  MINIMAL_MODEL_NAME,
} from '../../constants';
import { dispatchAIRequest } from '../modelDispatcher';
import { getThinkingBudget } from '../thinkingConfig';
import { retryAiCall } from '../../utils/retry';
import { addProgressSymbol } from '../../utils/loadingProgress';
import { isApiConfigured } from '../geminiClient';
import { formatRecentEventsForPrompt, npcsToString } from '../../utils/promptFormatters';
import { formatKnownPlacesForPrompt } from '../../utils/promptFormatters/map';
import { safeParseJson } from '../../utils/jsonUtils';
import type { LoremasterModeDebugInfo, GeneratedJournalEntry, MapNode, NPC } from '../../types';

const JOURNAL_KNOWN_NPC_TEMPLATE = '<ID: {id}> - {name}\n';

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
      minLength: 100,
      description: `Approximately ${String(length)} words of the journal entry, starting with a Markup-formatted heading. Basic Markup syntax is allowed, such as **bold** and *italic*.`,
    },
  },
  required: ['heading', 'text'],
  additionalProperties: false,
} as const);

const parseJournalEntry = (raw: string): GeneratedJournalEntry | null => {
  return safeParseJson<GeneratedJournalEntry>(raw, (data): data is GeneratedJournalEntry =>
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
  mapNodes: Array<MapNode>,
  npcs: Array<NPC>,
  recentLogEntries: Array<string>,
  currentQuest: string | null,
): Promise<GeneratedJournalEntryResult | null> => {
  if (!isApiConfigured()) {
    console.error('generateJournalEntry: API key not configured.');
    return null;
  }

  const questLine = currentQuest ? `Current Quest: "${currentQuest}"` : 'Current Quest: Not set';
  const recentEventsContext = formatRecentEventsForPrompt(recentLogEntries);
  const knownPlaces = formatKnownPlacesForPrompt(mapNodes, true);
  const knownNpcSection = npcsToString(
    npcs,
    JOURNAL_KNOWN_NPC_TEMPLATE,
    '## Known NPCs:\n',
    '\n',
  );
  const prompt = `**Context:**
Theme Name: "${themeName}";
Theme Description: "${themeDescription}";
${questLine};

## Known Locations:
${knownPlaces}
${knownNpcSection}
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
      addProgressSymbol(LOADING_REASON_UI_MAP.write_journal.icon);
      const thinkingBudget = getThinkingBudget(1024);
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
        thinkingBudget,
        includeThoughts: true,
        responseMimeType: 'application/json',
        jsonSchema: schema,
        label: 'Journal',
      });
      const parts = (response.candidates?.[0]?.content?.parts ?? []) as Array<{
        text?: string;
        thought?: boolean;
      }>;
      const thoughtParts = parts
        .filter((p): p is { text: string; thought?: boolean } =>
          p.thought === true && typeof p.text === 'string')
        .map(p => p.text);
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
            thoughts: thoughtParts,
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
