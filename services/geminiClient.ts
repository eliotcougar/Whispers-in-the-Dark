/**
 * @file services/geminiClient.ts
 * @description Provides a shared GoogleGenAI client instance.
 */
import { GoogleGenAI } from "@google/genai";
import { geminiClient, isApiConfigured } from './apiClient';

if (!isApiConfigured()) {
  console.error("GEMINI_API_KEY environment variable is not set. The application will not be able to connect to the Gemini API.");
}

/** Shared Gemini client used across services. */
export const ai: GoogleGenAI | null = geminiClient;
