export const GEMINI_TEXT_MODELS = [
  { id: 'gemini-flash-lite-latest', label: 'Gemini Flash-Lite' },
  { id: 'gemini-flash-latest', label: 'Gemini Flash' },
  { id: 'gemini-pro-latest', label: 'Gemini Pro' },
] as const;

export type GeminiTextModel = (typeof GEMINI_TEXT_MODELS)[number]['id'] | 'auto';
export const DEFAULT_GEMINI_TEXT_MODEL: GeminiTextModel = 'gemini-flash-lite-latest';

export const isGeminiTextModel = (value: unknown): value is GeminiTextModel =>
  value === 'auto' || GEMINI_TEXT_MODELS.some(model => model.id === value);
