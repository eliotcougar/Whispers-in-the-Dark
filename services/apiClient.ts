/**
 * @file services/apiClient.ts
 * @description Centralized Gemini API key handling and client exposure.
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

if (typeof localStorage !== 'undefined') {
  geminiApiKey = localStorage.getItem(LOCAL_STORAGE_GEMINI_KEY);
}

if (!geminiApiKey) {
  if (typeof window !== 'undefined' && window.GEMINI_API_KEY) {
    geminiApiKey = window.GEMINI_API_KEY;
    geminiKeyFromEnv = true;
  } else {
    geminiApiKey = process.env.GEMINI_API_KEY ?? process.env.API_KEY ?? null;
    if (geminiApiKey) {
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
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(LOCAL_STORAGE_GEMINI_KEY, key);
  }
  geminiClient = new GoogleGenAI({ apiKey: key });
};
