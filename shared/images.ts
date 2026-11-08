export type ImageProvider = 'disabled' | 'gemini' | 'openai';
export type ImageQuality = 'low' | 'medium' | 'high';
export type ImageAspectRatio = '4:3' | '16:9' | '1:1';

export const OPENAI_IMAGE_MODELS = [
  { id: 'gpt-image-2.6-flare', label: 'GPT Image 2.6 Flare' },
  { id: 'gpt-image-2.6-sunburst', label: 'GPT Image 2.6 Sunburst' },
  { id: 'gpt-image-2.5-flare', label: 'GPT Image 2.5 Flare' },
  { id: 'gpt-image-2.5-sunburst', label: 'GPT Image 2.5 Sunburst' },
  { id: 'gpt-image-2', label: 'GPT Image 2' },
  { id: 'gpt-image-1.5', label: 'GPT Image 1.5' },
  { id: 'gpt-image-1-mini', label: 'GPT Image 1 Mini' },
  { id: 'chatgpt-image-latest', label: 'ChatGPT Image' },
] as const;

export const GEMINI_IMAGE_MODELS = [
  { id: 'gemini-3.1-flash-image', label: 'Gemini 3.1 Flash Image' },
  { id: 'gemini-3-pro-image', label: 'Gemini 3 Pro Image' },
  { id: 'gemini-2.5-flash-image', label: 'Gemini 2.5 Flash Image' },
] as const;

export type OpenAIImageModel = (typeof OPENAI_IMAGE_MODELS)[number]['id'];
export type GeminiImageModel = (typeof GEMINI_IMAGE_MODELS)[number]['id'];
export const DEFAULT_OPENAI_IMAGE_MODEL: OpenAIImageModel = 'gpt-image-2.5-flare';
export const DEFAULT_GEMINI_IMAGE_MODEL: GeminiImageModel = 'gemini-2.5-flash-image';

export const isOpenAIImageModel = (value: unknown): value is OpenAIImageModel =>
  OPENAI_IMAGE_MODELS.some(model => model.id === value);

export const isGeminiImageModel = (value: unknown): value is GeminiImageModel =>
  GEMINI_IMAGE_MODELS.some(model => model.id === value);

export interface OpenAIImageStatus {
  readonly keyConfigured: boolean;
}

export interface OpenAIImageRequest {
  readonly model: OpenAIImageModel;
  readonly prompt: string;
  readonly quality: ImageQuality;
  readonly aspectRatio: ImageAspectRatio;
}

export interface OpenAIImageResult {
  readonly base64: string;
  readonly mimeType: 'image/jpeg';
}

export const isImageQuality = (value: unknown): value is ImageQuality =>
  value === 'low' || value === 'medium' || value === 'high';

export const isImageAspectRatio = (value: unknown): value is ImageAspectRatio =>
  value === '4:3' || value === '16:9' || value === '1:1';
