/**
 * @file services/geminiClient.ts
 * @description Consolidated Gemini client and API key management.
 */
import { GoogleGenAI } from '@google/genai';
import { LOCAL_STORAGE_GEMINI_KEY } from '../constants';

declare global {
  interface Window {
    GEMINI_API_KEY?: string;
  }
}

let geminiApiKey: string | null = null;
let geminiKeyFromEnv = false;

// Load API key from localStorage (preferred for the app), then window, then env
try {
  if (typeof localStorage !== 'undefined') {
    geminiApiKey = localStorage.getItem(LOCAL_STORAGE_GEMINI_KEY);
  }
} catch {
  // Ignore storage access errors (SSR or privacy modes)
}

if (!geminiApiKey) {
  if (typeof window !== 'undefined' && window.GEMINI_API_KEY) {
    geminiApiKey = window.GEMINI_API_KEY;
    geminiKeyFromEnv = true;
  } else {
    // Vite exposes import.meta.env; also support process.env for tests/tools
    const readFromImportMeta = (): string | undefined => {
      try {
        const meta = import.meta as unknown as { env?: Record<string, string | undefined> };
        return meta.env?.GEMINI_API_KEY ?? meta.env?.API_KEY;
      } catch {
        return undefined;
      }
    };
    const readFromProcess = (): string | undefined => {
      try {
        const p = (globalThis as unknown as { process?: { env?: Record<string, string | undefined> } }).process;
        if (!p) return undefined;
        return p.env?.GEMINI_API_KEY ?? p.env?.API_KEY;
      } catch {
        return undefined;
      }
    };
    const envKey = readFromImportMeta() ?? readFromProcess();
    if (typeof envKey === 'string' && envKey.length > 0) {
      geminiApiKey = envKey;
      geminiKeyFromEnv = true;
    }
  }
}

if (!geminiApiKey) {
  console.error('Gemini API key is not set. Gemini services will be unavailable.');
}

export let geminiClient: GoogleGenAI | null = geminiApiKey
  ? new GoogleGenAI({ apiKey: geminiApiKey })
  : null;

export const isApiConfigured = (): boolean => !!geminiApiKey;

export const isApiKeyFromEnv = (): boolean => geminiKeyFromEnv;

export const getApiKey = (): string | null => geminiApiKey;

export const setApiKey = (key: string): void => {
  geminiApiKey = key;
  geminiKeyFromEnv = false;
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(LOCAL_STORAGE_GEMINI_KEY, key);
    }
  } catch {
    // Ignore storage access errors
  }
  geminiClient = new GoogleGenAI({ apiKey: key });
};

/** Back-compat alias used across services. Note: this is a snapshot reference. */
export const ai: GoogleGenAI | null = geminiClient;
