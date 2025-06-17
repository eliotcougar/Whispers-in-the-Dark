

/**
 * @file ImageVisualizer.tsx
 * @description Requests and displays AI generated images.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { geminiClient as ai, isApiConfigured } from '../services/apiClient';
import type { Part } from '@google/genai';
import { AdventureTheme, Character, MapNode } from '../types';
import LoadingSpinner from './LoadingSpinner';
import { extractStatusFromError } from '../utils/aiErrorUtils';
import { dispatchAIRequest } from '../services/modelDispatcher';
import { MINIMAL_MODEL_NAME, AUXILIARY_MODEL_NAME } from '../constants';

if (!isApiConfigured()) {
  console.error("GEMINI_API_KEY for GoogleGenAI is not set. Image visualization will not work.");
}

interface ImageVisualizerProps {
  readonly currentSceneDescription: string;
  readonly currentTheme: AdventureTheme | null;
  readonly mapData: MapNode[]; 
  readonly allCharacters: Character[];
  readonly localTime: string | null; 
  readonly localEnvironment: string | null; 
  readonly localPlace: string | null;
  readonly isVisible: boolean;
  readonly onClose: () => void;
  readonly setGeneratedImage: (url: string, scene: string) => void; 
  readonly cachedImageUrl: string | null;
  readonly cachedImageScene: string | null;
}

/**
 * Requests and displays AI-generated imagery for the current scene.
 */
const ImageVisualizer: React.FC<ImageVisualizerProps> = ({
  currentSceneDescription,
  currentTheme, // This is now AdventureTheme | null
  mapData, 
  allCharacters,
  localTime,
  localEnvironment,
  localPlace,
  isVisible,
  onClose,
  setGeneratedImage,
  cachedImageUrl,
  cachedImageScene,
}) => {
  const [internalImageUrl, setInternalImageUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Maps the current theme to a concise style string for the prompt.
   */
  const getThemeStylePrompt = (theme: AdventureTheme | null): string => {
    if (!theme) return "a general fantasy style";
    // Simple mapping for style, can be expanded
    if (theme.name.toLowerCase().includes("dungeon")) return "a dark, gritty medieval fantasy style, dungeons and dragons concept art";
    if (theme.name.toLowerCase().includes("cyberpunk")) return "a neon-drenched, futuristic cyberpunk cityscape style, Blade Runner aesthetic";
    if (theme.name.toLowerCase().includes("eldritch")) return "a Lovecraftian horror style, cosmic dread, 1920s period";
    if (theme.name.toLowerCase().includes("post-apocalyptic")) return "a desolate, rusty post-apocalyptic wasteland style, Mad Max aesthetic";
    if (theme.name.toLowerCase().includes("steampunk")) return "a steampunk style with clockwork machines and airships, Victorian era";
    if (theme.name.toLowerCase().includes("victorian mansion")) return "a haunted Victorian mansion style, gothic horror, moody and atmospheric";
    if (theme.name.toLowerCase().includes("deep space")) return "a deep space sci-fi style, cosmic anomaly, advanced technology";
    if (theme.name.toLowerCase().includes("lost world")) return "a prehistoric lost world style, lush jungles, dinosaurs, ancient ruins";
    if (theme.name.toLowerCase().includes("greek hero")) return "a mythic Greek hero style, classical art, epic battles";
    if (theme.name.toLowerCase().includes("wild west")) return "a Wild West outlaw style, dusty frontier, cinematic western";
    return `a style fitting for ${theme.name}`;
  };
  
  /**
   * Calls the AI service to generate an image of the current scene.
   */
  const generateImage = useCallback(async () => {
    if (!ai || !currentTheme) {
      setError("Image generation service or theme is not available.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    setInternalImageUrl(null);

    const prefix = `A detailed, digital painting in ${getThemeStylePrompt(currentTheme)} without ANY text on it.
    Aspect ratio 4:3.
    It is ${localTime || 'now'}. ${localEnvironment || 'The air is okay'}. ${localPlace || 'Location is unimportant'}. ${currentSceneDescription}`;
    let rawPrompt = prefix;

    const mentionedPlaces: string[] = [];
    // Derive places from mapData (main nodes)
    mapData
      .filter(node => node.themeName === currentTheme.name)
      .forEach(node => {
        if (currentSceneDescription.toLowerCase().includes(node.placeName.toLowerCase())) {
          rawPrompt += ` The ${node.placeName} is prominent, described as: ${node.data.description || 'A notable location.'}.`;
          mentionedPlaces.push(node.placeName);
        }
      });

    const mentionedCharacters: string[] = [];
    allCharacters.forEach(character => {
      if (character.themeName === currentTheme.name && currentSceneDescription.toLowerCase().includes(character.name.toLowerCase())) {
        rawPrompt += ` ${character.name} here, appearing as: ${character.description}.`;
        mentionedCharacters.push(character.name);
      }
    });
    
    rawPrompt += " Focus on creating a faithful representation based on this description. Do not generate any text on the image.";

    console.log("Original Scene: ", rawPrompt);
    // Ask a minimal model to rewrite the prompt to avoid unsafe elements
    let safePrompt = rawPrompt;
    try {
      const { response: safeResp } = await dispatchAIRequest({
        modelNames: [MINIMAL_MODEL_NAME, AUXILIARY_MODEL_NAME],
        prompt: `Rewrite the following scene description into a safe and aestetic visual depiction suitable for highly censored image generation. Only include the elements that are definitely present in the scene and omit anything non-visual, that is mentioned only for unrelated context. Preserve all details of the landscape or environment. Mention time, weather, mood of the environment. Preserve small details. Avoid any depressing, explicit or unsafe elements. Absolutely avoid nudity or corpses.\n\nScene:\n${rawPrompt}`,
        systemInstruction: 'Respond ONLY with the visual description of the scene.',
        temperature: 1,
        label: 'ImagePromptSanitizer',
      });
      safePrompt = prefix + safeResp.text?.trim() || rawPrompt;
      console.log("Sanitized prompt: ", safePrompt);
    } catch (safeErr) {
      console.warn('Prompt sanitization failed, using raw prompt.', safeErr);
    }

    try {
      const response = await ai.models.generateImages({
        model: 'imagen-3.0-generate-002',
        prompt: safePrompt,
        config: { numberOfImages: 1, outputMimeType: 'image/jpeg' },
      });

      if (response.generatedImages && response.generatedImages.length > 0 && response.generatedImages[0].image?.imageBytes) {
        const base64ImageBytes = response.generatedImages[0].image.imageBytes;
        const imageUrl = `data:image/jpeg;base64,${base64ImageBytes}`;
        setInternalImageUrl(imageUrl);
        setGeneratedImage(imageUrl, currentSceneDescription); 
      } else {
        throw new Error("No image data received from API.");
      }
    } catch (err) {
      console.error("Error generating image:", err);
      const errorMessage = err instanceof Error ? err.message : "Unknown error during image generation.";

      const status = extractStatusFromError(err);
      const isStatus400 = status === 400;

      // The Imagen API may respond with HTTP 400 when the request is not allowed
      // for the current project. Treat it similarly to the explicit billing
      // error so the Gemini fallback is attempted.

      
      if (isStatus400) {
        try {
          const fallbackResp = await ai.models.generateContentStream({
            model: 'gemini-2.0-flash-preview-image-generation',
            contents: [
              {
                role: 'user',
                parts: [{ text: safePrompt }],
              },
            ],
            config: {
              responseModalities: ['IMAGE', 'TEXT'],
              responseMimeType: 'text/plain',
            },
          });

          const isInlinePart = (part: unknown): part is Part =>
            typeof part === 'object' && part !== null && 'inlineData' in part;

          let finishReason: string | undefined;
          for await (const chunk of fallbackResp) {
            const candidate = chunk.candidates?.[0];
            if (candidate?.finishReason) {
              finishReason = candidate.finishReason;
            }
            const inlinePart = candidate?.content?.parts?.find(isInlinePart);
            const inlineData = inlinePart?.inlineData;
            if (inlineData?.data) {
              const imageUrl = `data:${inlineData.mimeType || 'image/png'};base64,${inlineData.data}`;
              setInternalImageUrl(imageUrl);
              setGeneratedImage(imageUrl, currentSceneDescription);
              setError(null);
              return;
            }
          }

          if (finishReason && finishReason.toUpperCase().includes('SAFETY')) {
            setError(`Image blocked due to safety filter (${finishReason}).`);
          } else {
            setError('Fallback image generation failed to return image data.');
          }

        } catch (fallbackErr) {
          console.error('Fallback image generation failed:', fallbackErr);
          setError('Fallback image generation failed.');
        }
      }

      if (errorMessage.includes("quota") || errorMessage.includes("billing")) {
        setError("Image generation quota exceeded or billing issue. Please check your Google Cloud project.");
      } else if (errorMessage.includes("API key not valid")) {
        setError("Image generation failed: API key is not valid. Please check configuration.");
      } else {
        setError(`Failed to visualize scene: ${errorMessage.substring(0,100)}`);
      }
    } finally {
      setIsLoading(false);
    }
  }, [currentSceneDescription, currentTheme, mapData, allCharacters, localTime, localEnvironment, localPlace, setGeneratedImage]);

  useEffect(() => {
    if (isVisible) {
      if (cachedImageUrl && cachedImageScene === currentSceneDescription) {
        setInternalImageUrl(cachedImageUrl);
        setIsLoading(false);
        setError(null);
      } else {
        void generateImage();
      }
    }
  }, [isVisible, cachedImageUrl, cachedImageScene, currentSceneDescription, generateImage]);

  return (
    <div aria-labelledby="visualizer-title" aria-modal="true" className={`animated-frame ${isVisible ? 'open' : ''}`} role="dialog">
      <div className="animated-frame-content visualizer-content-area"> 
        <button
          aria-label="Close visualizer"
          className="animated-frame-close-button"
          onClick={onClose}
        >
          &times;
        </button>
        
        {isLoading ? <div className="visualizer-spinner-container">
          <LoadingSpinner />

          <p className="mt-2 text-lg" id="visualizer-title">Conjuring vision...</p>
        </div> : null}

        {!isLoading && error ? <div className="visualizer-error-container">
          <h2 className="text-xl font-semibold text-red-400 mb-2" id="visualizer-title">Vision Failed</h2>

          <p>{error}</p>

          <button
            className="mt-4 px-6 py-2 bg-sky-600 hover:bg-sky-500 text-white font-semibold rounded-md shadow transition-colors"
            onClick={() => { void generateImage(); }}
            >
            Retry Visualization
          </button>
        </div> : null}

        {!isLoading && !error && internalImageUrl ? <div className="visualizer-image-container">
          <img alt="Scene visualization" className="visualizer-image" src={internalImageUrl} />

          <h2 className="sr-only" id="visualizer-title">Scene Visualization</h2>
        </div> : null}

        {!isLoading && !error && !internalImageUrl && isVisible ? <div className="visualizer-spinner-container">
          <p className="mt-2 text-lg text-slate-400" id="visualizer-title">Preparing to visualize...</p>
        </div> : null}
      </div>
    </div>
  );
};

export default ImageVisualizer;
