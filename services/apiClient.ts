/**
 * @file services/apiClient.ts
 * @description Centralized Gemini API key handling and client exposure.
 */
import { GoogleGenAI } from '@google/genai';
import { LOCAL_STORAGE_GEMINI_KEY } from '../constants';

let geminiApiKey: string | null = null;

if (typeof localStorage !== 'undefined') {
  geminiApiKey = localStorage.getItem(LOCAL_STORAGE_GEMINI_KEY);
}

geminiApiKey ??= process.env.GEMINI_API_KEY ?? process.env.API_KEY ?? null;

if (!geminiApiKey) {
  console.error('GEMINI_API_KEY environment variable is not set. Gemini services will be unavailable.');
}

export let geminiClient: GoogleGenAI | null = geminiApiKey
  ? new GoogleGenAI({ apiKey: geminiApiKey })
  : null;

export const isApiConfigured = (): boolean => !!geminiApiKey;

export const getApiKey = (): string | null => geminiApiKey;

export const setApiKey = (key: string): void => {
  geminiApiKey = key;
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(LOCAL_STORAGE_GEMINI_KEY, key);
  }
  geminiClient = new GoogleGenAI({ apiKey: key });
};
