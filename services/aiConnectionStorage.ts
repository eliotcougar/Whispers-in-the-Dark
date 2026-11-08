import { type ImageProvider, type ImageQuality, type OpenAIImageModel, type GeminiImageModel, isImageQuality, isOpenAIImageModel, isGeminiImageModel, DEFAULT_OPENAI_IMAGE_MODEL, DEFAULT_GEMINI_IMAGE_MODEL } from '../shared/images';
import { safeParseJson } from '../utils/jsonUtils';
import { DEFAULT_GEMINI_TEXT_MODEL, isGeminiTextModel, type GeminiTextModel } from '../shared/gemini';

export interface AIConnectionSettings {
  readonly provider: 'gemini' | 'chatgpt';
  readonly model: string;
  readonly geminiModel: GeminiTextModel;
}

const AI_CONNECTION_KEY = 'whispersInTheDark-ai-connection';

export function loadAIConnectionSettings(): AIConnectionSettings {
  try {
    const data = safeParseJson<{ provider?: unknown; model?: unknown; geminiModel?: unknown }>(localStorage.getItem(AI_CONNECTION_KEY) ?? 'null');
    return {
      provider: data?.provider === 'chatgpt' ? 'chatgpt' : 'gemini',
      model: typeof data?.model === 'string' ? data.model : '',
      geminiModel: isGeminiTextModel(data?.geminiModel) ? data.geminiModel : DEFAULT_GEMINI_TEXT_MODEL,
    };
  } catch { return { provider: 'gemini', model: '', geminiModel: DEFAULT_GEMINI_TEXT_MODEL }; }
}

export function saveAIConnectionSettings(settings: AIConnectionSettings): void {
  try { localStorage.setItem(AI_CONNECTION_KEY, JSON.stringify({ provider: settings.provider, model: settings.model, geminiModel: settings.geminiModel })); } catch { /* Storage can be unavailable in private sessions. */ }
}

export interface ImageConnectionSettings {
  readonly provider: ImageProvider;
  readonly quality: ImageQuality;
  readonly openaiModel: OpenAIImageModel;
  readonly geminiModel: GeminiImageModel;
}

const IMAGE_CONNECTION_KEY = 'whispersInTheDark-image-connection';

export function loadImageConnectionSettings(): ImageConnectionSettings {
  const defaults: ImageConnectionSettings = {
    provider: loadAIConnectionSettings().provider === 'chatgpt' ? 'disabled' : 'gemini', quality: 'medium',
    openaiModel: DEFAULT_OPENAI_IMAGE_MODEL, geminiModel: DEFAULT_GEMINI_IMAGE_MODEL,
  };
  try {
    const data = safeParseJson<{ provider?: unknown; quality?: unknown; openaiModel?: unknown; geminiModel?: unknown }>(localStorage.getItem(IMAGE_CONNECTION_KEY) ?? 'null');
    return {
      provider: data?.provider === 'openai' || data?.provider === 'gemini' || data?.provider === 'disabled' ? data.provider : defaults.provider,
      quality: isImageQuality(data?.quality) ? data.quality : defaults.quality,
      openaiModel: isOpenAIImageModel(data?.openaiModel) ? data.openaiModel : defaults.openaiModel,
      geminiModel: isGeminiImageModel(data?.geminiModel) ? data.geminiModel : defaults.geminiModel,
    };
  } catch { return defaults; }
}

export function saveImageConnectionSettings(settings: ImageConnectionSettings): void {
  try { localStorage.setItem(IMAGE_CONNECTION_KEY, JSON.stringify({ provider: settings.provider, quality: settings.quality, openaiModel: settings.openaiModel, geminiModel: settings.geminiModel })); } catch { /* Optional browser preferences. */ }
}
