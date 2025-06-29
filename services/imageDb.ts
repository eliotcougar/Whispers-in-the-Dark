import { openDB, DBSchema } from 'idb';

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

export const saveChapterImage = async (
  itemId: string,
  chapterIndex: number,
  imageData: string,
): Promise<void> => {
  const db = await dbPromise;
  const key = `${itemId}_${String(chapterIndex)}`;
  await db.put('chapterImages', imageData, key);
};

export const loadChapterImage = async (
  itemId: string,
  chapterIndex: number,
): Promise<string | null> => {
  const db = await dbPromise;
  const key = `${itemId}_${String(chapterIndex)}`;
  return (await db.get('chapterImages', key)) ?? null;
};
