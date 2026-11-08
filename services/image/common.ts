import { canGenerateImages, generateOpenAIImage, getImageConnection, getImageModel } from '../imageProvider';
/**
 * @file services/image/common.ts
 * @description Shared helpers for building safe visual prompts and generating images.
 */

import { geminiClient as ai, isGeminiConfigured as isApiConfigured } from '../geminiClient';
import { AdventureTheme } from '../../types';
import { GEMINI_LITE_MODEL_NAME, LOADING_REASON_UI_MAP, MINIMAL_MODEL_NAME } from '../../constants';
import { dispatchAIRequest } from '../modelDispatcher';
import { addProgressSymbol } from '../../utils/loadingProgress';

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
  return 'an atmospheric illustration matching the setting';
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
    if (!body) throw new Error('The visual prompt was empty.');
    return `${prefix} ${body}`;
  } catch {
    console.warn('sanitizeVisualPrompt: prompt preparation failed.');
    throw new Error('Could not prepare the image prompt. Check the text AI connection and try again.');
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

export const generateConfiguredImage = async (
  prompt: string,
  aspectRatio: '4:3' | '16:9' | '1:1' = '4:3',
  selection = getImageConnection(),
): Promise<string> => {
  const current = getImageConnection();
  if (selection.provider !== current.provider || selection.quality !== current.quality || getImageModel(selection) !== getImageModel(current)) throw new Error('Image settings changed while preparing the picture. Please try again.');
  if (!canGenerateImages()) throw new Error('Choose and configure an image provider in AI Connection → Images.');
  addProgressSymbol(LOADING_REASON_UI_MAP.visualize_scene.icon);
  if (selection.provider === 'openai') return generateOpenAIImage(prompt, aspectRatio);
  if (!isApiConfigured() || !ai) throw new Error('Configure a Gemini API key in AI Connection.');
  const stream = await ai.models.generateContentStream({
    model: selection.geminiModel,
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    config: { responseModalities: ['IMAGE', 'TEXT'], imageConfig: { aspectRatio } },
  });
  for await (const chunk of stream) {
    for (const part of chunk.candidates?.[0]?.content?.parts ?? []) {
      if (part.inlineData?.data) return part.inlineData.data;
    }
  }
  throw new Error('Gemini did not return an image.');
};
