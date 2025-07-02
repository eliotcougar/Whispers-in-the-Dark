/**
 * @file services/apiClient.ts
 * @description Centralized Gemini API key handling and client exposure.
 */
import { GoogleGenAI } from '@google/genai';
import { LOCAL_STORAGE_API_KEY } from '../constants';

let geminiApiKey: string | null = null;

try {
  geminiApiKey = localStorage.getItem(LOCAL_STORAGE_API_KEY);
} catch {
  geminiApiKey = null;
}

geminiApiKey ??=
  process.env.GEMINI_API_KEY ?? process.env.API_KEY ?? null;

if (!geminiApiKey) {
  console.error(
    'GEMINI_API_KEY environment variable is not set. Gemini services will be unavailable.',
  );
}

/** Shared GoogleGenAI client instance, or null if API key is missing. */
export let geminiClient: GoogleGenAI | null = geminiApiKey
  ? new GoogleGenAI({ apiKey: geminiApiKey })
  : null;

/** Returns whether the Gemini API key is configured. */
export const isApiConfigured = (): boolean => geminiApiKey !== null;

/** Returns the configured API key, or null when absent. */
export const getApiKey = (): string | null => geminiApiKey;

/** Sets the API key and updates the shared client instance. */
export const setApiKey = (key: string): void => {
  geminiApiKey = key;
  try {
    localStorage.setItem(LOCAL_STORAGE_API_KEY, key);
  } catch {
    // ignore storage errors
  }
  geminiClient = new GoogleGenAI({ apiKey: key });
};
