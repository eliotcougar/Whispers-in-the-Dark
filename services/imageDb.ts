import { openDB, DBSchema } from 'idb';
import type { FullGameState } from '../types';
import { PLAYER_JOURNAL_ID } from '../constants';
import { structuredCloneGameState } from '../utils/cloneUtils';

export const IMAGE_REF_PREFIX = 'idb:';

export const getChapterImageKey = (
  itemId: string,
  chapterIndex: number,
): string => `${itemId}_${String(chapterIndex)}`;

export const makeImageRef = (
  itemId: string,
  chapterIndex: number,
): string => `${IMAGE_REF_PREFIX}${getChapterImageKey(itemId, chapterIndex)}`;

export const isImageRef = (data?: string): boolean =>
  typeof data === 'string' && data.startsWith(IMAGE_REF_PREFIX);

interface ImageDB extends DBSchema {
  chapterImages: {
    key: string;
    value: string;
  };
}

const dbPromise = openDB<ImageDB>('whispers-images', 1, {
  upgrade(db) {
    db.createObjectStore('chapterImages');
  },
});

export const clearAllImages = async (): Promise<void> => {
  const db = await dbPromise;
  const tx = db.transaction('chapterImages', 'readwrite');
  await tx.store.clear();
  await tx.done;
};

export const saveChapterImage = async (
  itemId: string,
  chapterIndex: number,
  imageData: string,
): Promise<void> => {
  const db = await dbPromise;
  const key = getChapterImageKey(itemId, chapterIndex);
  await db.put('chapterImages', imageData, key);
};

export const loadChapterImage = async (
  itemId: string,
  chapterIndex: number,
): Promise<string | null> => {
  const db = await dbPromise;
  const key = getChapterImageKey(itemId, chapterIndex);
  return (await db.get('chapterImages', key)) ?? null;
};

export const storeImagesAndReturnRefs = async (
  state: FullGameState,
): Promise<FullGameState> => {
  const cloned = structuredCloneGameState(state);
  await Promise.all(
    cloned.inventory.map(async item => {
      await Promise.all(
        item.chapters?.map(async (ch, idx) => {
          if (ch.imageData && !isImageRef(ch.imageData)) {
            await saveChapterImage(item.id, idx, ch.imageData);
            ch.imageData = makeImageRef(item.id, idx);
          }
        }) ?? [],
      );
    }),
  );
  await Promise.all(
    cloned.playerJournal.map(async (ch, idx) => {
      if (ch.imageData && !isImageRef(ch.imageData)) {
        await saveChapterImage(PLAYER_JOURNAL_ID, idx, ch.imageData);
        ch.imageData = makeImageRef(PLAYER_JOURNAL_ID, idx);
      }
    }),
  );
  return cloned;
};

export const expandRefsToImages = async (
  state: FullGameState,
): Promise<FullGameState> => {
  const cloned = structuredCloneGameState(state);
  await Promise.all(
    cloned.inventory.map(async item => {
      await Promise.all(
        item.chapters?.map(async (ch, idx) => {
          if (isImageRef(ch.imageData)) {
            const img = await loadChapterImage(item.id, idx);
            ch.imageData = img ?? undefined;
          }
        }) ?? [],
      );
    }),
  );
  await Promise.all(
    cloned.playerJournal.map(async (ch, idx) => {
      if (isImageRef(ch.imageData)) {
        const img = await loadChapterImage(PLAYER_JOURNAL_ID, idx);
        ch.imageData = img ?? undefined;
      }
    }),
  );
  return cloned;
};
