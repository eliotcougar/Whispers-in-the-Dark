

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

if (!isApiConfigured()) {
  console.error("GEMINI_API_KEY for GoogleGenAI is not set. Image visualization will not work.");
}

interface ImageVisualizerProps {
  currentSceneDescription: string;
  currentTheme: AdventureTheme | null;
  mapData: MapNode[]; 
  allCharacters: Character[];
  localTime: string | null; 
  localEnvironment: string | null; 
  localPlace: string | null;
  isVisible: boolean;
  onClose: () => void;
  setGeneratedImage: (url: string, scene: string) => void; 
  cachedImageUrl: string | null;
  cachedImageScene: string | null;
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

    let prompt = `A detailed, digital painting in ${getThemeStylePrompt(currentTheme)} without ANY text on it.
    Aspect ratio 4:3.
    It is ${localTime || 'now'}. ${localEnvironment || 'The air is okay'}. ${localPlace || 'Location is unimportant'}. ${currentSceneDescription}`;
    prompt += ``;

    const mentionedPlaces: string[] = [];
    // Derive places from mapData (main nodes)
    mapData
      .filter(node => node.themeName === currentTheme.name)
      .forEach(node => {
        if (currentSceneDescription.toLowerCase().includes(node.placeName.toLowerCase())) {
          prompt += ` The ${node.placeName} is prominent, described as: ${node.data.description || 'A notable location.'}.`; 
          mentionedPlaces.push(node.placeName);
        }
      });

    const mentionedCharacters: string[] = [];
    allCharacters.forEach(character => {
      if (character.themeName === currentTheme.name && currentSceneDescription.toLowerCase().includes(character.name.toLowerCase())) {
        prompt += ` ${character.name} here, appearing as: ${character.description}.`;
        mentionedCharacters.push(character.name);
      }
    });
    
    prompt += " Focus on creating a faithful representation based on this description. Do not generate any text on the image.";
    console.log("Imagen Prompt: ", prompt);

    try {
      const response = await ai.models.generateImages({
        model: 'imagen-3.0-generate-002',
        prompt: prompt,
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
      console.log('Debug Imagen error details', {
        extractedStatus: status,
        rawError: err,
        errorMessage,
      });

      const isStatus400 = status === 400;
      console.log('Imagen error status check', { status, isStatus400 });

      // The Imagen API may respond with HTTP 400 when the request is not allowed
      // for the current project. Treat it similarly to the explicit billing
      // error so the Gemini fallback is attempted.

      
      if (isStatus400) {
        console.log('Attempting Gemini fallback due to Imagen 400');
        try {
          const fallbackResp = await ai.models.generateContentStream({
            model: 'gemini-2.0-flash-preview-image-generation',
            contents: [
              {
                role: 'user',
                parts: [{ text: prompt }],
              },
            ],
            config: {
              responseModalities: ['IMAGE', 'TEXT'],
              responseMimeType: 'text/plain',
            },
          });

          for await (const chunk of fallbackResp) {
            const isInlinePart = (part: unknown): part is Part =>
              typeof part === 'object' && part !== null && 'inlineData' in part;
            const inlinePart = chunk.candidates?.[0]?.content?.parts?.find(
              isInlinePart,
            );
            const inlineData = inlinePart?.inlineData;
            if (inlineData?.data) {
              const imageUrl = `data:${inlineData.mimeType || 'image/jpeg'};base64,${inlineData.data}`;
              setInternalImageUrl(imageUrl);
              setGeneratedImage(imageUrl, currentSceneDescription);
              return;
            }
          }
        } catch (fallbackErr) {
          console.error('Fallback image generation failed:', fallbackErr);
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
    <div className={`animated-frame ${isVisible ? 'open' : ''}`} role="dialog" aria-modal="true" aria-labelledby="visualizer-title">
      <div className="animated-frame-content visualizer-content-area"> 
        <button
          onClick={onClose}
          className="animated-frame-close-button"
          aria-label="Close visualizer"
        >
          &times;
        </button>
        
        {isLoading && (
          <div className="visualizer-spinner-container">
            <LoadingSpinner />
            <p id="visualizer-title" className="mt-2 text-lg">Conjuring vision...</p>
          </div>
        )}

        {!isLoading && error && (
          <div className="visualizer-error-container">
            <h2 id="visualizer-title" className="text-xl font-semibold text-red-400 mb-2">Vision Failed</h2>
            <p>{error}</p>
            <button
              onClick={() => { void generateImage(); }}
              className="mt-4 px-6 py-2 bg-sky-600 hover:bg-sky-500 text-white font-semibold rounded-md shadow transition-colors"
            >
              Retry Visualization
            </button>
          </div>
        )}

        {!isLoading && !error && internalImageUrl && (
          <div className="visualizer-image-container">
            <img src={internalImageUrl} alt="Scene visualization" className="visualizer-image" />
            <h2 id="visualizer-title" className="sr-only">Scene Visualization</h2>
          </div>
        )}
         {!isLoading && !error && !internalImageUrl && isVisible && ( 
          <div className="visualizer-spinner-container">
            <p id="visualizer-title" className="mt-2 text-lg text-slate-400">Preparing to visualize...</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ImageVisualizer;
