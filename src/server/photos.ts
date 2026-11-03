import { randomUUID } from 'node:crypto';
import { unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';

/** Largest side, in pixels, of a stored photo. */
export const MAX_PHOTO_SIZE = 512;

/** Thrown when the data is not an image the server can read. */
export class InvalidImageError extends Error {
  constructor() {
    super('Unreadable image');
  }
}

/**
 * Resizes an image to at most 512 px (never enlarged, orientation applied),
 * saves it as JPEG in `uploadDir` and returns the file name.
 */
export async function savePhoto(uploadDir: string, data: Buffer): Promise<string> {
  let resized: Buffer;
  try {
    resized = await sharp(data)
      .rotate()
      .resize({
        width: MAX_PHOTO_SIZE,
        height: MAX_PHOTO_SIZE,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .jpeg({ quality: 85 })
      .toBuffer();
  } catch {
    throw new InvalidImageError();
  }
  const name = `${randomUUID()}.jpg`;
  await writeFile(join(uploadDir, name), resized);
  return name;
}

/** Removes a stored photo; a missing file is not an error. */
export async function deletePhoto(uploadDir: string, name: string | null): Promise<void> {
  if (!name) return;
  await unlink(join(uploadDir, name)).catch(() => {});
}
