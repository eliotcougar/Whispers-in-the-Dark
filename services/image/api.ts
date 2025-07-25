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
import { extractStatusFromError } from '../../utils/aiErrorUtils';

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

const detectMimeType = (data: string): string => {
  if (data.startsWith('/9j')) return 'image/jpeg';
  if (data.startsWith('iVBORw0')) return 'image/png';
  return 'image/png';
};

const convertToJpeg = async (base64: string): Promise<string> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('No canvas context'));
        return;
      }
      ctx.drawImage(img, 0, 0);
      const jpeg = canvas
        .toDataURL('image/jpeg', 0.7)
        .replace('data:image/jpeg;base64,', '');
      resolve(jpeg);
    };
    img.onerror = reject;
    img.src = `data:${detectMimeType(base64)};base64,${base64}`;
  });

const THEME_STYLE_PROMPTS: Record<string, string> = {
  dungeon: 'a dark, gritty medieval fantasy style, dungeons and dragons concept art',
  cyberpunk: 'a neon-drenched, futuristic cyberpunk cityscape style, Blade Runner aesthetic',
  eldritch: 'a Lovecraftian horror style, cosmic dread, 1920s period',
  'post-apocalyptic': 'a desolate, rusty post-apocalyptic wasteland style, Mad Max aesthetic',
  steampunk: 'a steampunk style with clockwork machines and airships, Victorian era',
  'victorian mansion': 'a haunted Victorian mansion style, gothic horror, moody and atmospheric',
  'deep space': 'a deep space sci-fi style, cosmic anomaly, advanced technology',
  'lost world': 'a prehistoric lost world style, lush jungles, dinosaurs, ancient ruins',
  'greek hero': 'a mythic Greek hero style, classical art, epic battles',
  'wild west': 'a Wild West outlaw style, dusty frontier, cinematic western',
};

const getThemeStylePrompt = (theme: AdventureTheme | null): string => {
  if (!theme) return 'a general fantasy style';
  const lowerName = theme.name.toLowerCase();
  for (const keyword in THEME_STYLE_PROMPTS) {
    if (lowerName.includes(keyword)) {
      return THEME_STYLE_PROMPTS[keyword];
    }
  }
  return `a style fitting for ${theme.name}`;
};

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

  const client = ai;
  const generationPromise = (async () => {
    const result = await retryAiCall<string>(async attempt => {
      try {
        addProgressSymbol(LOADING_REASON_UI_MAP.visualize.icon);
        const response = await client.models.generateImages({
          model: 'imagen-4.0-generate-preview-06-06',
          prompt: safePrompt,
          config: { numberOfImages: 1, outputMimeType: 'image/jpeg', aspectRatio: '4:3' },
        });
        const bytes = response.generatedImages?.[0]?.image?.imageBytes;
        if (bytes) {
          return { result: bytes };
        }
      } catch (err: unknown) {
        console.error(`generateChapterImage error (Attempt ${String(attempt + 1)}):`, err);
        const status = extractStatusFromError(err);
        if (status === 400) {
          try {
            const fallbackResp = await client.models.generateImages({
            model: 'imagen-3.0-generate-002',
            prompt: safePrompt,
            config: { numberOfImages: 1, outputMimeType: 'image/jpeg', aspectRatio: '4:3' },
          });
          const bytes = fallbackResp.generatedImages?.[0]?.image?.imageBytes;
          if (bytes) {
            return { result: bytes };
          }
          } catch (fallbackErr: unknown) {
            console.error('Fallback image generation failed:', fallbackErr);
          }
        }
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
