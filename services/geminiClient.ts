
import { GoogleGenAI } from "@google/genai";

if (!process.env.API_KEY) {
  console.error("API_KEY environment variable is not set. The application will not be able to connect to the Gemini API.");
  // Potentially throw an error or have a fallback if critical for app initialization
}

// Initialize the GoogleGenAI client
// The exclamation mark asserts that API_KEY is non-null, 
// assuming process.env.API_KEY is properly configured in the environment.
export const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
