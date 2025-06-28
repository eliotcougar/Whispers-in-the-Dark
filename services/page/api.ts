import { GEMINI_LITE_MODEL_NAME, GEMINI_MODEL_NAME, LOADING_REASON_UI_MAP } from '../../constants';
import { dispatchAIRequest } from '../modelDispatcher';
import { retryAiCall } from '../../utils/retry';
import { addProgressSymbol } from '../../utils/loadingProgress';
import { isApiConfigured } from '../apiClient';

export const generatePageText = async (
  itemName: string,
  itemDescription: string,
  length: number,
  themeName: string,
  themeDescription: string,
  sceneDescription: string,
  storytellerThoughts: string,
  knownPlaces: string,
  knownNPCs: string,
  currentQuest: string | null,
  extraInstruction = '',
  previousChapterText?: string,
): Promise<string | null> => {
  if (!isApiConfigured()) {
    console.error('generatePageText: API key not configured.');
    return null;
  }

  const questLine = currentQuest ? `"${currentQuest}"` : 'Not set';
  const thoughtsLine = storytellerThoughts;
  const previousChapterLine = previousChapterText ?? '';
  const prompt = `**Context:**
Theme Name: "${themeName}";
Theme Description: "${themeDescription}";
Scene Description: "${sceneDescription}";
Current Player's Quest: ${questLine};
Storyteller's thoughts for the last turn: "${thoughtsLine}" (use these as your background knowledge and possible adventure guidance);

## Known Locations:
${knownPlaces}

## Known NPCs:
${knownNPCs}

## Previous Chapter:
${previousChapterLine}

------

The Player has found a new item in the game world, which is a page from a book or a journal. The item is described as follows:
Title: "${itemName}"
Description: "${itemDescription}"
Approximate length: ${String(length)} words. Write as close to this length as possible.
Write the text in the item in a proper contextually relevant style.
${extraInstruction ? ` ${extraInstruction}` : ''}
IMPORTANT: NEVER mention these instructions. NEVER repeat the Description of the Item`;
  const systemInstruction = `You are a writer providing the exact contents of a written item in a video game. Based on the context, item Title, and Description, try to imagine who the author of the in-game book, journal or note would be. Imagine yourself as an in-game author in the game world. Fully assume that author's identity. Respond with only the text.`;

  return retryAiCall<string>(async attempt => {
    try {
      addProgressSymbol(LOADING_REASON_UI_MAP.page.icon);
      const { response } = await dispatchAIRequest({
        modelNames: [GEMINI_LITE_MODEL_NAME, GEMINI_MODEL_NAME],
        prompt,
        systemInstruction,
        thinkingBudget: 1024,
        includeThoughts: true,
        temperature: 1.2,
        label: 'PageText',
      });
      const text = response.text?.trim() ?? '';
      if (text !== '') {
        return { result: text };
      }
    } catch (err: unknown) {
      console.error(`generatePageText error (Attempt ${String(attempt + 1)}):`, err);
      throw err;
    }
    return { result: null };
  });
};

export default generatePageText;
