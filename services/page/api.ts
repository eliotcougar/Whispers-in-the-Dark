import { GEMINI_LITE_MODEL_NAME, GEMINI_MODEL_NAME, LOADING_REASON_UI_MAP } from '../../constants';
import { dispatchAIRequest } from '../modelDispatcher';
import { getThinkingBudget } from '../thinkingConfig';
import { retryAiCall } from '../../utils/retry';
import { addProgressSymbol } from '../../utils/loadingProgress';
import { isApiConfigured } from '../geminiClient';
import type { MapNode, NPC } from '../../types';
import { formatKnownPlacesForPrompt } from '../../utils/promptFormatters/map';
import { npcsToString } from '../../utils/promptFormatters';

const PAGE_KNOWN_NPC_TEMPLATE = '<ID: {id}> - {name}\n';

export const generatePageText = async (
  itemName: string,
  itemDescription: string,
  length: number,
  themeName: string,
  themeDescription: string,
  sceneDescription: string,
  storytellerThoughts: string,
  mapNodes: Array<MapNode>,
  npcs: Array<NPC>,
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
  const knownPlaces = formatKnownPlacesForPrompt(mapNodes, true);
  const knownNpcSection = npcsToString(
    npcs,
    PAGE_KNOWN_NPC_TEMPLATE,
    '## Known NPCs:\n',
    '\n',
  );
  const prompt = `**Context:**
Theme Name: "${themeName}";
Theme Description: "${themeDescription}";
Scene Description: "${sceneDescription}";
Current Quest: ${questLine}
Storyteller's thoughts for the last turn: "${thoughtsLine}" (use these as your background knowledge and possible adventure guidance);

## Known Locations:
${knownPlaces}
${knownNpcSection}

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
      addProgressSymbol(LOADING_REASON_UI_MAP.read_page.icon);
      const thinkingBudget = getThinkingBudget(1024);
      const { response } = await dispatchAIRequest({
        modelNames: [GEMINI_LITE_MODEL_NAME, GEMINI_MODEL_NAME],
        prompt,
        systemInstruction,
        thinkingBudget,
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
