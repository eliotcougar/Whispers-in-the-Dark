/**
 * @file fileOps.ts
 * @description Helpers for saving to and loading from external files.
 */
import { GameStateStack, DebugPacketStack, DebugPacket } from '../../types';
import { CURRENT_SAVE_GAME_VERSION, PLAYER_JOURNAL_ID } from '../../constants';
import { safeParseJson } from '../../utils/jsonUtils';
import {
  prepareGameStateStackForSavingWithoutImages,
  expandSavedStackToFullStates,
  normalizeLoadedSaveDataStack,
} from './migrations';
import {
  expandRefsToImages,
  storeImagesAndReturnRefs,
  getChapterImageKey,
  saveChapterImage,
  makeImageRef,
} from '../imageDb';
import { structuredCloneGameState } from '../../utils/cloneUtils';

const triggerDownload = (data: string, filename: string, type: string): void => {
  const blob = new Blob([data], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const saveGameStateToFile = async (
  stack: GameStateStack,
  debugStack: DebugPacketStack,
  onError?: (message: string) => void,
): Promise<boolean> => {
  try {
    const currentExpanded = await expandRefsToImages(stack[0]);
    const previousExpanded = stack[1] ? await expandRefsToImages(stack[1]) : undefined;
    const images: Record<string, string> = {};
    const collectImages = (state: typeof currentExpanded): void => {
      state.inventory.forEach(item => {
        item.chapters?.forEach((ch, idx) => {
          if (ch.imageData) {
            images[getChapterImageKey(item.id, idx)] = ch.imageData;
          }
        });
      });
      state.playerJournal.forEach((ch, idx) => {
        if (ch.imageData) {
          images[getChapterImageKey(PLAYER_JOURNAL_ID, idx)] = ch.imageData;
        }
      });
    };
    collectImages(currentExpanded);
    if (previousExpanded) collectImages(previousExpanded);

    const dataToSave = prepareGameStateStackForSavingWithoutImages(stack);
    const jsonString = JSON.stringify(
      { game: dataToSave, debug: debugStack, images },
      null,
      2,
    );
    triggerDownload(
      jsonString,
      `WhispersInTheDark_Save_V${CURRENT_SAVE_GAME_VERSION}_${new Date().toISOString().slice(0, 10)}.json`,
      'application/json',
    );
    return true;
  } catch (error: unknown) {
    console.error('Error saving game state to file:', error);
    if (onError) onError('An error occurred while preparing your game data for download.');
    return false;
  }
};

export const loadGameStateFromFile = async (
  file: File,
): Promise<{ gameStateStack: GameStateStack; debugPacketStack: DebugPacketStack } | null> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        if (event.target && typeof event.target.result === 'string') {
          const parsedData: unknown = safeParseJson(event.target.result);
          if (parsedData === null) {
            resolve(null);
            return;
          }
          const { game: gameRaw = parsedData, debug: debugData, images } = parsedData as {
            game?: unknown;
            debug?: unknown;
            images?: Record<string, string>;
          };
          const processed = normalizeLoadedSaveDataStack(
            gameRaw as Record<string, unknown>,
            'file',
          );
          if (processed) {
            void (async () => {
              try {
                const loadedStack = expandSavedStackToFullStates(processed);

                const applyImages = async (
                  state: typeof loadedStack[0],
                ): Promise<typeof loadedStack[0]> => {
                  const cloned = structuredCloneGameState(state);
                  if (images) {
                    await Promise.all(
                      cloned.inventory.map(async item => {
                        await Promise.all(
                          item.chapters?.map(async (ch, idx) => {
                            const key = getChapterImageKey(item.id, idx);
                            const data = images[key];
                            if (data) {
                              await saveChapterImage(item.id, idx, data);
                              ch.imageData = makeImageRef(item.id, idx);
                            }
                          }) ?? [],
                        );
                      }),
                    );
                    await Promise.all(
                      cloned.playerJournal.map(async (ch, idx) => {
                        const key = getChapterImageKey(PLAYER_JOURNAL_ID, idx);
                        const data = images[key];
                        if (data) {
                          await saveChapterImage(PLAYER_JOURNAL_ID, idx, data);
                          ch.imageData = makeImageRef(PLAYER_JOURNAL_ID, idx);
                        }
                      }),
                    );
                  }
                  return storeImagesAndReturnRefs(cloned);
                };

                const current = await applyImages(loadedStack[0]);
                const previous = loadedStack[1] ? await applyImages(loadedStack[1]) : undefined;
                const debugStack: DebugPacketStack = Array.isArray(debugData)
                  ? [debugData[0] ?? null, debugData[1] ?? null]
                  : [debugData as DebugPacket | null ?? null, null];
                resolve({ gameStateStack: [current, previous], debugPacketStack: debugStack });
              } catch {
                resolve(null);
              }
            })();
            return;
          }
        }
        console.warn('File save data is invalid or version mismatch for V3. Not loading.');
        resolve(null);
      } catch (error: unknown) {
        console.error('Error loading game state from file:', error);
        resolve(null);
      }
    };
    reader.onerror = () => {
      console.error('Error reading file.');
      resolve(null);
    };
    reader.readAsText(file);
  });
};
