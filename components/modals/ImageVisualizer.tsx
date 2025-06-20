

/**
 * @file ImageVisualizer.tsx
 * @description Requests and displays AI generated images.
 */
import { useState, useEffect, useCallback, useRef } from 'react';

import { geminiClient as ai, isApiConfigured } from '../../services/apiClient';
import type { Part } from '@google/genai';
import { AdventureTheme, Character, MapNode } from '../../types';
import LoadingSpinner from '../LoadingSpinner';
import { extractStatusFromError } from '../../utils/aiErrorUtils';
import { dispatchAIRequest } from '../../services/modelDispatcher';
import { MINIMAL_MODEL_NAME, AUXILIARY_MODEL_NAME } from '../../constants';
import Button from '../elements/Button';
import { Icon } from '../elements/icons';

const THEME_STYLE_PROMPTS: Record<string, string> = {
  dungeon: 'a dark, gritty medieval fantasy style, dungeons and dragons concept art',
  cyberpunk: 'a neon-drenched, futuristic cyberpunk cityscape style, Blade Runner aesthetic',
  eldritch: 'a Lovecraftian horror style, cosmic dread, 1920s period',
  'post-apocalyptic': 'a desolate, rusty post-apocalyptic wasteland style, Mad Max aesthetic',
  steampunk: 'a steampunk style with clockwork machines and airships, Victorian era',
  'victorian mansion': 'a haunted Victorian mansion style, gothic horror, moody and atmospheric',
  'deep space': 'a deep space sci-fi style, cosmic anomaly, advanced technology',
  'lost world': 'a prehistoric lost world style, lush jungles, dinosaurs, ancient ruins',
  'greek hero': 'a mythic Greek hero style, classical art, epic battles',
  'wild west': 'a Wild West outlaw style, dusty frontier, cinematic western',
};

if (!isApiConfigured()) {
  console.error("GEMINI_API_KEY for GoogleGenAI is not set. Image visualization will not work.");
}

interface ImageVisualizerProps {
  readonly currentSceneDescription: string;
  readonly currentTheme: AdventureTheme | null;
  readonly mapData: Array<MapNode>; 
  readonly allCharacters: Array<Character>;
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
function ImageVisualizer({
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
}: ImageVisualizerProps) {
  const [internalImageUrl, setInternalImageUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imgScale, setImgScale] = useState(1);
  const [imgOffset, setImgOffset] = useState({ x: 0, y: 0 });
  const [isDraggingImg, setIsDraggingImg] = useState(false);
  const [lastTouchPoint, setLastTouchPoint] = useState<{ x: number; y: number } | null>(null);
  const [lastPinchDistance, setLastPinchDistance] = useState<number | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const clamp = (value: number, min: number, max: number): number => {
    return Math.min(max, Math.max(min, value));
  };

  const handleWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    if (e.cancelable) e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
    setImgScale(prev => clamp(prev * zoomFactor, 1, 4));
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    setIsDraggingImg(true);
    setLastTouchPoint({ x: e.clientX, y: e.clientY });
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDraggingImg || !lastTouchPoint) return;
    const dx = e.clientX - lastTouchPoint.x;
    const dy = e.clientY - lastTouchPoint.y;
    setImgOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }));
    setLastTouchPoint({ x: e.clientX, y: e.clientY });
  }, [isDraggingImg, lastTouchPoint]);

  const endMouseDrag = useCallback(() => {
    setIsDraggingImg(false);
    setLastTouchPoint(null);
  }, []);

  const getTouchDistance = (t1: React.Touch, t2: React.Touch): number => {
    return Math.sqrt((t1.clientX - t2.clientX) ** 2 + (t1.clientY - t2.clientY) ** 2);
  };

  const handleTouchStart = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    if (e.cancelable) e.preventDefault();
    if (e.touches.length === 1) {
      setIsDraggingImg(true);
      setLastTouchPoint({ x: e.touches[0].clientX, y: e.touches[0].clientY });
      setLastPinchDistance(null);
    } else if (e.touches.length === 2) {
      setIsDraggingImg(false);
      setLastTouchPoint(null);
      setLastPinchDistance(getTouchDistance(e.touches[0], e.touches[1]));
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    if (e.cancelable) e.preventDefault();
    if (e.touches.length === 1 && isDraggingImg && lastTouchPoint) {
      const touch = e.touches[0];
      const dx = touch.clientX - lastTouchPoint.x;
      const dy = touch.clientY - lastTouchPoint.y;
      setImgOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }));
      setLastTouchPoint({ x: touch.clientX, y: touch.clientY });
    } else if (e.touches.length === 2 && lastPinchDistance !== null) {
      const currentDistance = getTouchDistance(e.touches[0], e.touches[1]);
      if (currentDistance === 0) return;
      setImgScale(prev => clamp(prev * (currentDistance / lastPinchDistance), 1, 4));
      setLastPinchDistance(currentDistance);
    }
  }, [isDraggingImg, lastTouchPoint, lastPinchDistance]);

  const handleTouchEnd = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length < 2) setLastPinchDistance(null);
    if (e.touches.length < 1) {
      setIsDraggingImg(false);
      setLastTouchPoint(null);
    }
  }, []);

  useEffect(() => {
    setImgScale(1);
    setImgOffset({ x: 0, y: 0 });
  }, [internalImageUrl]);

  /**
   * Maps the current theme to a concise style string for the prompt.
   */
  const getThemeStylePrompt = (theme: AdventureTheme | null): string => {
    if (!theme) return 'a general fantasy style';
    const lowerName = theme.name.toLowerCase();
    for (const keyword in THEME_STYLE_PROMPTS) {
      if (lowerName.includes(keyword)) {
        return THEME_STYLE_PROMPTS[keyword];
      }
    }
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
    It is ${localTime ?? 'now'}. ${localEnvironment ?? 'The air is okay'}. ${localPlace ?? 'Location is unimportant'}. ${currentSceneDescription}`;
    let rawPrompt = prefix;

    const mentionedPlaces: Array<string> = [];
    // Derive places from mapData (main nodes)
    mapData
      .filter(node => node.themeName === currentTheme.name)
      .forEach(node => {
        if (currentSceneDescription.toLowerCase().includes(node.placeName.toLowerCase())) {
          rawPrompt += ` The ${node.placeName} is prominent, described as: ${node.data.description || 'A notable location.'}.`;
          mentionedPlaces.push(node.placeName);
        }
      });

    const mentionedCharacters: Array<string> = [];
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
      safePrompt = prefix + (safeResp.text?.trim() ?? rawPrompt);
      console.log("Sanitized prompt: ", safePrompt);
    } catch (safeErr) {
      console.warn('Prompt sanitization failed, using raw prompt.', safeErr);
    }

    try {
      const response = await ai.models.generateImages({
        model: 'imagen-3.0-generate-002',
        prompt: safePrompt,
        config: { numberOfImages: 1, outputMimeType: 'image/jpeg', aspectRatio: '4:3' },
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
              const imageUrl = `data:${inlineData.mimeType ?? 'image/png'};base64,${inlineData.data}`;
              setInternalImageUrl(imageUrl);
              setGeneratedImage(imageUrl, currentSceneDescription);
              setError(null);
              return;
            }
          }

          if (finishReason?.toUpperCase().includes('SAFETY')) {
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

  const handleRetry = useCallback(() => {
    void generateImage();
  }, [generateImage]);

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
    <div
      aria-labelledby="visualizer-title"
      aria-modal="true"
      className={`animated-frame ${isVisible ? 'open' : ''}`}
      role="dialog"
    >
      <div className="animated-frame-content visualizer-content-area"> 
        <Button
          ariaLabel="Close visualizer"
          icon={<Icon
            name="x"
            size={20}
                />}
          onClick={onClose}
          size="sm"
          variant="close"
        />
        
        {isLoading ? <div className="visualizer-spinner-container">
          <LoadingSpinner loadingReason="visualize" />

        </div> : null}

        {!isLoading && error ? <div className="visualizer-error-container">
          <h2
            className="text-xl font-semibold text-red-400 mb-2"
            id="visualizer-title"
          >
            Vision Failed
          </h2>

          <p>
            {error}
          </p>

          <button
            className="mt-4 px-6 py-2 bg-sky-600 hover:bg-sky-500 text-white font-semibold rounded-md shadow transition-colors"
            onClick={handleRetry}
            type="button"
          >
            Retry Visualization
          </button>
        </div> : null}

        {!isLoading && !error && internalImageUrl ? (
          <div
            className="visualizer-image-container"
            onMouseDown={handleMouseDown}
            onMouseLeave={endMouseDrag}
            onMouseMove={handleMouseMove}
            onMouseUp={endMouseDrag}
            onTouchEnd={handleTouchEnd}
            onTouchMove={handleTouchMove}
            onTouchStart={handleTouchStart}
            onWheel={handleWheel}
            role="presentation"
          >
            <img
              alt="Scene visualization"
              className="visualizer-image"
              ref={imageRef}
              src={internalImageUrl}
              style={{ transform: `translate(${String(imgOffset.x)}px, ${String(imgOffset.y)}px) scale(${String(imgScale)})` }}
            />

            <h2
              className="sr-only"
              id="visualizer-title"
            >
              Scene Visualization
            </h2>
          </div>
        ) : null}

        {!isLoading && !error && !internalImageUrl && isVisible ? <div className="visualizer-spinner-container">
          <p
            className="mt-2 text-lg text-slate-300"
            id="visualizer-title"
          >
            Preparing to visualize...
          </p>
        </div> : null}
      </div>
    </div>
  );
}

export default ImageVisualizer;
