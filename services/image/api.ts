import { geminiClient as ai, isApiConfigured } from '../apiClient';
import { AdventureTheme, Item, ItemChapter } from '../../types';
import {
  GEMINI_LITE_MODEL_NAME,
  LOADING_REASON_UI_MAP,
  MINIMAL_MODEL_NAME,
} from '../../constants';
import { dispatchAIRequest } from '../modelDispatcher';
import { retryAiCall } from '../../utils/retry';
import { addProgressSymbol } from '../../utils/loadingProgress';
import { convertToJpeg, generateImageWithFallback, getThemeStylePrompt } from './common';

const inFlightGenerations: Record<string, Promise<string> | undefined> = {};

const getChapterData = (
  item: Item,
  index: number,
): ItemChapter | null => {
  const chapter = item.chapters?.[index];
  if (chapter) return chapter;
  if (index === 0) {
    const legacy = item as Item & {
      contentLength?: number;
      actualContent?: string;
      visibleContent?: string;
    };
    return {
      heading: item.name,
      description: item.description,
      contentLength: legacy.contentLength ?? 30,
      actualContent: legacy.actualContent,
      visibleContent: legacy.visibleContent,
    };
  }
  return null;
};

// theme style selection is provided by common.getThemeStylePrompt

export const generateChapterImage = async (
  item: Item,
  theme: AdventureTheme,
  chapter: number,
): Promise<string> => {
  const key = `${item.id}-${String(chapter)}`;
  const existing = inFlightGenerations[key];
  if (existing) {
    return existing;
  }
  if (!isApiConfigured() || !ai) {
    console.error('generateChapterImage: API key not configured.');
    return '';
  }

  const chapterData = getChapterData(item, chapter);
  if (!chapterData) {
    console.warn(`generateChapterImage: invalid chapter index ${String(chapter)}`);
    return '';
  }

  const chapterDetails = `${chapterData.description} ${chapterData.actualContent ?? ''}`.trim();
  const baseDescription = `${item.name}: ${item.description}. ${chapterDetails}`.trim();
  const prefix = `A detailed, ${item.type} in ${getThemeStylePrompt(theme)} without ANY text on it.`;
  const rawPrompt = `${prefix} ${baseDescription}`;

  let safePrompt = rawPrompt;
  try {
    const { response: safeResp } = await dispatchAIRequest({
      modelNames: [MINIMAL_MODEL_NAME, GEMINI_LITE_MODEL_NAME],
      prompt: `Rewrite the following item depiction so it prioritizes the item's name and description while including any chapter details. Ensure the result is safe for a highly censored image generation system.\n\nDescription:\n${rawPrompt}`,
      systemInstruction: 'Respond ONLY with the visual description.',
      temperature: 1,
      label: 'ImagePromptSanitizer',
    });
    safePrompt = `${prefix} ${safeResp.text?.trim() ?? baseDescription}`;
  } catch (err: unknown) {
    console.warn('Prompt sanitization failed, using raw prompt.', err);
  }

  const generationPromise = (async () => {
    const result = await retryAiCall<string>(async attempt => {
      try {
        addProgressSymbol(LOADING_REASON_UI_MAP.visualize_scene.icon);
        const bytes = await generateImageWithFallback(safePrompt, '4:3');
        if (bytes) return { result: bytes };
      } catch (err: unknown) {
        console.error(`generateChapterImage error (Attempt ${String(attempt + 1)}):`, err);
        // Keep throwing to trigger retryAiCall behaviour
        throw err;
      }
      return { result: '' };
    });
    const raw = result ?? '';
    return raw ? convertToJpeg(raw) : '';
  })();

  inFlightGenerations[key] = generationPromise;
  try {
    return await generationPromise;
  } finally {
    inFlightGenerations[key] = undefined;
  }
};

export default generateChapterImage;
