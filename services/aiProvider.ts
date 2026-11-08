import { useSyncExternalStore } from 'react';
import { loadAIConnectionSettings, saveAIConnectionSettings } from './aiConnectionStorage';
import { safeParseJson } from '../utils/jsonUtils';
import type { ChatGPTModel, ChatGPTStatus, ChatGPTTextRequest, ChatGPTTextResult } from '../shared/chatgpt';
import type { GeminiTextModel } from '../shared/gemini';

export type AIProvider = 'gemini' | 'chatgpt';
const settings = loadAIConnectionSettings();
let connection = {
  provider: settings.provider,
  model: settings.model,
  geminiModel: settings.geminiModel,
  available: false,
  status: null as ChatGPTStatus | null,
  models: [] as Array<ChatGPTModel>,
};
const listeners = new Set<() => void>();
export const getAIConnection = () => connection;
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export const notifyAIConnectionChanged = (): void => {
  connection = { ...connection };
  listeners.forEach(listener => { listener(); });
};
export const useAIConnection = () => useSyncExternalStore(subscribe, getAIConnection, getAIConnection);
export const isLocalGame = (): boolean => typeof location !== 'undefined' && ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
export const isChatGPTConfigured = (): boolean => {
  const profile = connection.status?.profiles.find(item => item.id === connection.status?.activeProfileId);
  return connection.available && !!profile?.sharing && connection.models.some(model => model.slug === connection.model);
};

export function setAIProvider(provider: AIProvider): void {
  connection = { ...connection, provider };
  saveAIConnectionSettings(connection);
  notifyAIConnectionChanged();
}

export function setChatGPTModel(model: string): void {
  connection = { ...connection, model };
  saveAIConnectionSettings(connection);
  notifyAIConnectionChanged();
}

export function setGeminiModel(geminiModel: GeminiTextModel): void {
  connection = { ...connection, geminiModel };
  saveAIConnectionSettings(connection);
  notifyAIConnectionChanged();
}

export async function localAIRequest<T>(route: string, body?: Record<string, unknown> | ChatGPTTextRequest): Promise<T> {
  if (!isLocalGame()) throw new Error('OpenAI connections are available when running the game locally.');
  const base = (import.meta as unknown as { env: { BASE_URL: string } }).env.BASE_URL;
  const response = await fetch(`${base}api/local-ai/${route}`, {
    method: body ? 'POST' : 'GET',
    headers: body ? { 'Content-Type': 'application/json', 'X-Whispers-Local': '1' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const result: unknown = safeParseJson(await response.text());
  if (!response.ok || !result || typeof result !== 'object') {
    const error = result as { error?: unknown } | null;
    throw new Error(typeof error?.error === 'string' ? error.error : 'The local AI service is unavailable. Start the game with npm run dev or npm run preview.');
  }
  return result as T;
}

export async function refreshChatGPTStatus(): Promise<void> {
  if (!isLocalGame()) return;
  try {
    const status = await localAIRequest<ChatGPTStatus>('status');
    connection = { ...connection, available: true, status };
    notifyAIConnectionChanged();
    const active = status.profiles.find(profile => profile.id === status.activeProfileId);
    if (active?.sharing && !status.pending) {
      const models = await localAIRequest<Array<ChatGPTModel>>('models');
      connection = { ...connection, models };
      if (!models.some(model => model.slug === connection.model)) setChatGPTModel(models[0]?.slug ?? '');
    } else { connection = { ...connection, models: [] }; }
    notifyAIConnectionChanged();
  } catch (error: unknown) {
    connection = { ...connection, models: [] };
    notifyAIConnectionChanged();
    throw error;
  }
}

export const generateChatGPTText = (request: ChatGPTTextRequest): Promise<ChatGPTTextResult> =>
  localAIRequest<ChatGPTTextResult>('generate', request);
