import { describe, expect, test } from 'bun:test';
import sharp from 'sharp';

import { createCloudflareAvatarImageProcessor } from '@/services/avatar-image-processor';
import { createSharpAvatarImageProcessor } from '@/services/avatar-image-processor-sharp';

async function sourceImage(): Promise<Uint8Array> {
  return new Uint8Array(
    await sharp({
      create: { width: 800, height: 400, channels: 3, background: '#2480ad' },
    })
      .png()
      .toBuffer()
  );
}

function cloudflareImagesMock(): ImagesBinding {
  return {
    async info(body: ReadableStream<Uint8Array>) {
      const bytes = new Uint8Array(await new Response(body).arrayBuffer());
      const metadata = await sharp(bytes).metadata();
      return {
        format: `image/${metadata.format}`,
        width: metadata.width,
        height: metadata.height,
        fileSize: bytes.length,
      };
    },
    input(body: ReadableStream<Uint8Array>) {
      return {
        transform(options: { width: number; height: number; fit: string }) {
          expect(options).toEqual({ width: 512, height: 512, fit: 'cover' });
          return {
            async output(options: { format: string; anim: boolean }) {
              expect(options.anim).toBe(false);
              const bytes = new Uint8Array(
                await new Response(body).arrayBuffer()
              );
              const result = sharp(bytes).resize(512, 512, { fit: 'cover' });
              const encoded =
                options.format === 'image/webp'
                  ? await result.webp().toBuffer()
                  : await result.jpeg().toBuffer();
              return { response: () => new Response(encoded) };
            },
          };
        },
      };
    },
  } as unknown as ImagesBinding;
}

describe('avatar image processor contract', () => {
  for (const [name, create] of [
    [
      'Cloudflare Images',
      () => createCloudflareAvatarImageProcessor(cloudflareImagesMock()),
    ],
    ['Sharp', createSharpAvatarImageProcessor],
  ] as const) {
    test(`${name} inspects and center crops into WebP and JPEG`, async () => {
      const processor = create();
      const input = await sourceImage();
      expect(await processor.inspect(input)).toEqual({
        format: 'image/png',
        width: 800,
        height: 400,
      });
      const { webp, jpeg } = await processor.normalize(input);
      expect(await sharp(webp).metadata()).toMatchObject({
        format: 'webp',
        width: 512,
        height: 512,
      });
      expect(await sharp(jpeg).metadata()).toMatchObject({
        format: 'jpeg',
        width: 512,
        height: 512,
      });
    });
  }

  test('Sharp rejects malformed input', async () => {
    const processor = createSharpAvatarImageProcessor();
    await expect(
      processor.inspect(new Uint8Array([1, 2, 3]))
    ).rejects.toThrow();
  });
});
