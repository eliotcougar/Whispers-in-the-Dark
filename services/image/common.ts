/**
 * @file services/image/common.ts
 * @description Shared helpers for building safe visual prompts and generating images.
 */

import { geminiClient as ai, isApiConfigured } from '../apiClient';
import { AdventureTheme } from '../../types';
import { GEMINI_LITE_MODEL_NAME, LOADING_REASON_UI_MAP, MINIMAL_MODEL_NAME } from '../../constants';
import { dispatchAIRequest } from '../modelDispatcher';
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

export const getThemeStylePrompt = (theme: AdventureTheme | null): string => {
  if (!theme) return 'a general fantasy style';
  const lowerName = theme.name.toLowerCase();
  for (const keyword in THEME_STYLE_PROMPTS) {
    if (lowerName.includes(keyword)) return THEME_STYLE_PROMPTS[keyword];
  }
  return `a style fitting for ${theme.name}`;
};

export const sanitizeVisualPrompt = async (
  rawPrompt: string,
  prefix: string,
  systemInstruction = 'Respond ONLY with the visual description.',
  label = 'ImagePromptSanitizer',
): Promise<string> => {
  try {
    const { response } = await dispatchAIRequest({
      modelNames: [MINIMAL_MODEL_NAME, GEMINI_LITE_MODEL_NAME],
      prompt: rawPrompt,
      systemInstruction,
      temperature: 1,
      label,
    });
    const body = response.text?.trim();
    return body && body.length > 0 ? `${prefix} ${body}` : `${prefix} ${rawPrompt}`;
  } catch (err: unknown) {
    console.warn('sanitizeVisualPrompt: prompt sanitization failed, using raw prompt.', err);
    return `${prefix} ${rawPrompt}`;
  }
};

export const detectMimeType = (data: string): string => {
  if (data.startsWith('/9j')) return 'image/jpeg';
  if (data.startsWith('iVBORw0')) return 'image/png';
  return 'image/png';
};

export const convertToJpeg = async (base64: string): Promise<string> =>
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

export const generateImageWithFallback = async (
  prompt: string,
  aspectRatio: '4:3' | '16:9' | '1:1' = '4:3',
): Promise<string> => {
  if (!isApiConfigured() || !ai) {
    console.error('generateImageWithFallback: API key not configured.');
    return '';
  }
  addProgressSymbol(LOADING_REASON_UI_MAP.visualize.icon);
  try {
    const response = await ai.models.generateImages({
      model: 'imagen-4.0-generate-001',
      prompt,
      config: { aspectRatio, imageSize: '1K', numberOfImages: 1, outputMimeType: 'image/jpeg' },
    });
    const bytes = response.generatedImages?.[0]?.image?.imageBytes;
    if (bytes) return bytes;
    throw new Error('No image data received from API.');
  } catch (err: unknown) {
    // Try Gemini image generation fallback (streaming inline image data)
    try {
      const stream = await ai.models.generateContentStream({
        model: 'gemini-2.0-flash-preview-image-generation',
        contents: [
          {
            role: 'user',
            parts: [{ text: prompt }],
          },
        ],
        config: {
          responseModalities: ['IMAGE', 'TEXT'],
          responseMimeType: 'text/plain',
        },
      });

      interface InlineData { data?: string; mimeType?: string }
      interface InlinePart { inlineData?: InlineData }
      interface CandidateContent { parts?: Array<InlinePart> }
      interface Candidate { finishReason?: string; content?: CandidateContent }
      interface StreamChunk { candidates?: Array<Candidate> }

      const gotBytes = async (): Promise<string> => {
        for await (const chunk of stream as AsyncIterable<StreamChunk>) {
          const candidate = chunk.candidates?.[0];
          const parts = candidate?.content?.parts;
          if (Array.isArray(parts)) {
            const inline = parts.find(p => !!p.inlineData);
            const data = inline?.inlineData?.data;
            if (data) {
              // Return raw base64 bytes. Caller prefixes data URL if needed.
              return data;
            }
          }
        }
        return '';
      };
      const bytes = await gotBytes();
      return bytes;
    } catch (fallbackErr: unknown) {
      console.error('generateImageWithFallback: Gemini fallback failed:', fallbackErr);
      const status = extractStatusFromError(err);
      if (status === 400) {
        // Maintain previous semantics: treat 400 specially but still end gracefully
        return '';
      }
      return '';
    }
  }
};