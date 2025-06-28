import { geminiClient as ai, isApiConfigured } from '../apiClient';
import type { Part } from '@google/genai';
import { AdventureTheme, Item } from '../../types';
import {
  GEMINI_LITE_MODEL_NAME,
  LOADING_REASON_UI_MAP,
  MINIMAL_MODEL_NAME,
} from '../../constants';
import { dispatchAIRequest } from '../modelDispatcher';
import { retryAiCall } from '../../utils/retry';
import { addProgressSymbol } from '../../utils/loadingProgress';
import { extractStatusFromError } from '../../utils/aiErrorUtils';

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
  if (!isApiConfigured() || !ai) {
    console.error('generateChapterImage: API key not configured.');
    return '';
  }

  const chapterData = item.chapters?.[chapter];
  if (!chapterData) {
    console.warn(`generateChapterImage: invalid chapter index ${String(chapter)}`);
    return '';
  }

  const baseDescription = `${chapterData.description} ${chapterData.actualContent ?? ''}`.trim();
  const prefix = `A detailed, ${item.type} in ${getThemeStylePrompt(theme)} without ANY text on it.`;
  const rawPrompt = `${prefix} ${baseDescription}`;

  let safePrompt = rawPrompt;
  try {
    const { response: safeResp } = await dispatchAIRequest({
      modelNames: [MINIMAL_MODEL_NAME, GEMINI_LITE_MODEL_NAME],
      prompt: `Rewrite the following description into a safe visual depiction suitable for highly censored image generation. Avoid any unsafe elements.\n\nDescription:\n${rawPrompt}`,
      systemInstruction: 'Respond ONLY with the visual description.',
      temperature: 1,
      label: 'ImagePromptSanitizer',
    });
    safePrompt = `${prefix} ${safeResp.text?.trim() ?? baseDescription}`;
  } catch (err: unknown) {
    console.warn('Prompt sanitization failed, using raw prompt.', err);
  }

  const client = ai;
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
        return { result: `data:image/jpeg;base64,${bytes}` };
      }
    } catch (err: unknown) {
      console.error(`generateChapterImage error (Attempt ${String(attempt + 1)}):`, err);
      const status = extractStatusFromError(err);
      if (status === 400) {
        try {
          const fallbackResp = await client.models.generateContentStream({
            model: 'gemini-2.0-flash-preview-image-generation',
            contents: [
              { role: 'user', parts: [{ text: safePrompt }] },
            ],
            config: { responseModalities: ['IMAGE', 'TEXT'], responseMimeType: 'text/plain' },
          });
          const isInlinePart = (part: unknown): part is Part => typeof part === 'object' && part !== null && 'inlineData' in part;
          for await (const chunk of fallbackResp) {
            const candidate = chunk.candidates?.[0];
            const inlinePart = candidate?.content?.parts?.find(isInlinePart);
            const inlineData = inlinePart?.inlineData;
            if (inlineData?.data) {
              return { result: `data:${inlineData.mimeType ?? 'image/png'};base64,${inlineData.data}` };
            }
          }
        } catch (fallbackErr: unknown) {
          console.error('Fallback image generation failed:', fallbackErr);
        }
      }
      throw err;
    }
    return { result: '' };
  });
  return result ?? '';
};

export default generateChapterImage;
