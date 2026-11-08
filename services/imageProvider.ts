import { useSyncExternalStore } from 'react';
import { loadImageConnectionSettings, saveImageConnectionSettings } from './aiConnectionStorage';
import { isGeminiConfigured } from './geminiClient';
import { isLocalGame, localAIRequest, useAIConnection } from './aiProvider';
import { isOpenAIImageModel, isGeminiImageModel, type ImageProvider, type ImageQuality, type ImageAspectRatio, type OpenAIImageStatus } from '../shared/images';

let connection = { ...loadImageConnectionSettings(), available: false, keyConfigured: false };
const listeners = new Set<() => void>();
export const getImageConnection = () => connection;
const notify = (): void => { listeners.forEach(listener => { listener(); }); };
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };

export function useImageConnection() {
  // Gemini-key changes use the text connection's existing notification channel.
  useAIConnection();
  return useSyncExternalStore(subscribe, getImageConnection, getImageConnection);
}

export function setImageProvider(provider: ImageProvider): void {
  connection = { ...connection, provider };
  saveImageConnectionSettings(connection);
  notify();
}

export function setImageQuality(quality: ImageQuality): void {
  connection = { ...connection, quality };
  saveImageConnectionSettings(connection);
  notify();
}

export function setImageModel(model: string): void {
  if (connection.provider === 'openai' && isOpenAIImageModel(model)) {
    connection = { ...connection, openaiModel: model };
  } else if (connection.provider === 'gemini' && isGeminiImageModel(model)) {
    connection = { ...connection, geminiModel: model };
  } else { return; }
  saveImageConnectionSettings(connection);
  notify();
}

export const getImageModel = (settings = connection): string =>
  settings.provider === 'openai' ? settings.openaiModel : settings.geminiModel;

export const canGenerateImages = (): boolean => connection.provider === 'openai'
  ? isLocalGame() && connection.available && connection.keyConfigured
  : connection.provider === 'gemini' && isGeminiConfigured();

export async function refreshOpenAIImageStatus(): Promise<void> {
  if (!isLocalGame()) return;
  try {
    const status = await localAIRequest<OpenAIImageStatus>('image-settings');
    connection = { ...connection, available: true, keyConfigured: status.keyConfigured };
    notify();
  } catch (error: unknown) {
    connection = { ...connection, available: false, keyConfigured: false };
    notify();
    throw error;
  }
}

export async function saveOpenAIImageKey(apiKey: string): Promise<void> {
  const status = await localAIRequest<OpenAIImageStatus>('image-key', { apiKey });
  connection = { ...connection, available: true, keyConfigured: status.keyConfigured };
  notify();
}

export async function generateOpenAIImage(prompt: string, aspectRatio: ImageAspectRatio): Promise<string> {
  if (!canGenerateImages() || connection.provider !== 'openai') throw new Error('Configure an OpenAI image key in AI Connection → Images.');
  const result = await localAIRequest<unknown>('image', { model: connection.openaiModel, prompt, aspectRatio, quality: connection.quality });
  if (!result || typeof result !== 'object' || !('mimeType' in result) || result.mimeType !== 'image/jpeg' || !('base64' in result) || typeof result.base64 !== 'string' || !result.base64) throw new Error('OpenAI returned an invalid image response.');
  return result.base64;
}
