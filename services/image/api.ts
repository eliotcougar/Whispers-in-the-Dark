import { canGenerateImages, getImageConnection, getImageModel } from '../imageProvider';
import { AdventureTheme, Item } from '../../types';
import { LOADING_REASON_UI_MAP } from '../../constants';
import { retryAiCall } from '../../utils/retry';
import { addProgressSymbol } from '../../utils/loadingProgress';
import { convertToJpeg, generateConfiguredImage, getThemeStylePrompt, sanitizeVisualPrompt } from './common';
import { getChapter as getNormalizedChapter } from '../../utils/writtenItemChapters';

const inFlightGenerations: Record<string, Promise<string> | undefined> = {};

const getChapterData = (item: Item, index: number) => getNormalizedChapter(item, index);

// theme style selection is provided by common.getThemeStylePrompt

export const generateChapterImage = async (
  item: Item,
  theme: AdventureTheme,
  chapter: number,
): Promise<string> => {
  if (!canGenerateImages()) return '';
  const selection = getImageConnection();
  const key = `${selection.provider}-${getImageModel(selection)}-${selection.quality}-${item.id}-${String(chapter)}`;
  const existing = inFlightGenerations[key];
  if (existing) {
    return existing;
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

  const generationPromise = (async () => {
    const safePrompt = await sanitizeVisualPrompt(
      `Rewrite this item depiction into a safe visual description. Prioritize the item, preserving relevant chapter details. Theme: ${theme.name}\n\n${rawPrompt}`,
      prefix,
    );
    const result = await retryAiCall<string>(async attempt => {
      try {
        addProgressSymbol(LOADING_REASON_UI_MAP.visualize_scene.icon);
        const bytes = await generateConfiguredImage(safePrompt, '4:3', selection);
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
