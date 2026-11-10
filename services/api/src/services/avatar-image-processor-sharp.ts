import sharp from 'sharp';

import type { AvatarImageProcessor } from '@/services/avatar-image-processor';

/** Bun/Node adapter; import only from a self-hosted entry point. */
export function createSharpAvatarImageProcessor(): AvatarImageProcessor {
  return {
    async inspect(bytes) {
      const metadata = await sharp(bytes, { animated: false }).metadata();
      return {
        format: `image/${metadata.format}`,
        width: metadata.width ?? 0,
        height: metadata.height ?? 0,
      };
    },
    async normalize(bytes) {
      const resize = () =>
        sharp(bytes, { animated: false }).resize(512, 512, {
          fit: 'cover',
          position: 'centre',
        });
      const webp = await resize().webp().toBuffer();
      const jpeg = await resize().jpeg().toBuffer();
      return { webp: new Uint8Array(webp), jpeg: new Uint8Array(jpeg) };
    },
  };
}
