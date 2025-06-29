import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { LOCAL_STORAGE_SAVE_KEY } from '../constants';
import { saveGameStateToLocalStorage } from '../services/storage';
import { saveChapterImage, loadChapterImage } from '../services/imageDb';
import { getInitialGameStates } from '../utils/initialStates';
import type { FullGameState } from '../types';

describe('image storage', () => {
  let mockStorage: Record<string, string>;

  beforeEach(() => {
    mockStorage = {};
    globalThis.localStorage = {
      getItem(key: string): string | null {
        return key in mockStorage ? mockStorage[key] : null;
      },
      setItem(key: string, value: string): void {
        mockStorage[key] = value;
      },
      removeItem(key: string): void {
        const { [key]: removed, ...rest } = mockStorage;
        void removed;
        mockStorage = rest;
      },
      clear(): void {
        mockStorage = {};
      },
      key(): string | null {
        return null;
      },
      length: 0,
    } as unknown as Storage;
  });

  it('saves game state to localStorage without imageData', () => {
    const state: FullGameState = getInitialGameStates();
    state.inventory.push({
      id: 'i1',
      name: 'Pic',
      type: 'picture',
      description: 'd',
      holderId: 'player',
      chapters: [
        {
          heading: 'h',
          description: 'd',
          contentLength: 1,
          imageData: 'abc',
        },
      ],
    });

    const result = saveGameStateToLocalStorage([state, undefined]);
    expect(result).toBe(true);
    const saved = JSON.parse(mockStorage[LOCAL_STORAGE_SAVE_KEY]) as {
      current: {
        inventory: Array<{ chapters: Array<{ imageData?: string }> }>;
      };
    };
    const savedItem = saved.current.inventory[0];
    expect(savedItem.chapters[0].imageData).toBeUndefined();
  });

  it('stores and retrieves images from indexedDB', async () => {
    await saveChapterImage('itemX', 0, 'imgdata');
    const data = await loadChapterImage('itemX', 0);
    expect(data).toBe('imgdata');
  });
});
