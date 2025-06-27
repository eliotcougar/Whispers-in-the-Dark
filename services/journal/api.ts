import {
  AUXILIARY_MODEL_NAME,
  GEMINI_MODEL_NAME,
  LOADING_REASON_UI_MAP,
} from '../../constants';
import { dispatchAIRequest } from '../modelDispatcher';
import { retryAiCall } from '../../utils/retry';
import { addProgressSymbol } from '../../utils/loadingProgress';
import { isApiConfigured } from '../apiClient';
import { formatRecentEventsForPrompt } from '../../utils/promptFormatters';

export interface GeneratedJournalEntry {
  heading: string;
  text: string;
}

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
): Promise<GeneratedJournalEntry | null> => {
  if (!isApiConfigured()) {
    console.error('generateJournalEntry: API key not configured.');
    return null;
  }

  const questLine = currentQuest ? `Current Quest: "${currentQuest}"` : 'Current Quest: Not set';
  const recentEventsContext = formatRecentEventsForPrompt(recentLogEntries);
  const prompt = `You are writing a new entry in the player's personal journal.
**Context:**
Theme Name: "${themeName}";
Theme Description: "${themeDescription}";
Scene Description: "${sceneDescription}";
${questLine};

## Known Locations:
${knownPlaces}
## Known NPCs:
${knownNPCs}
## Previous Journal Entry:
${previousEntry}

## Last events:
${recentEventsContext}

------

Return a JSON object {"heading": "", "text": ""} describing a new short journal entry of exactly ${String(length)} words. Begin with a Markup-formatted heading.`;
  const systemInstruction = 'Provide only the JSON for the new journal entry.';

  return retryAiCall<GeneratedJournalEntry>(async attempt => {
    try {
      addProgressSymbol(LOADING_REASON_UI_MAP.journal.icon);
      const { response } = await dispatchAIRequest({
        modelNames: [AUXILIARY_MODEL_NAME, GEMINI_MODEL_NAME],
        prompt,
        systemInstruction,
        temperature: 1.0,
        responseMimeType: 'application/json',
        label: 'Journal',
      });
      const text = response.text?.trim() ?? '';
      if (text) {
        const parsed = JSON.parse(text) as Partial<GeneratedJournalEntry>;
        if (typeof parsed.heading === 'string' && typeof parsed.text === 'string') {
          return { result: { heading: parsed.heading, text: parsed.text } };
        }
      }
    } catch (err: unknown) {
      console.error(`generateJournalEntry error (Attempt ${String(attempt + 1)}):`, err);
      throw err;
    }
    return { result: null };
  });
};

export default generateJournalEntry;
