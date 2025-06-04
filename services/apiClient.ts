/**
 * @file services/apiClient.ts
 * @description Centralized Gemini API key handling and client exposure.
 */
import { GoogleGenAI } from '@google/genai';

/** Cached API key read from environment variables. */
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.API_KEY;

if (!GEMINI_API_KEY) {
  console.error('GEMINI_API_KEY environment variable is not set. Gemini services will be unavailable.');
}

/** Shared GoogleGenAI client instance, or null if API key is missing. */
export const geminiClient: GoogleGenAI | null = GEMINI_API_KEY
  ? new GoogleGenAI({ apiKey: GEMINI_API_KEY })
  : null;

/** Returns whether the Gemini API key is configured. */
export const isApiConfigured = (): boolean => !!GEMINI_API_KEY;

/** Returns the configured API key, or null when absent. */
export const getApiKey = (): string | null => GEMINI_API_KEY || null;
