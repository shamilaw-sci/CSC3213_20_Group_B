interface AvatarImageInfo {
  format: string;
  width: number;
  height: number;
}

export interface AvatarImageProcessor {
  inspect(bytes: Uint8Array): Promise<AvatarImageInfo>;
  normalize(bytes: Uint8Array): Promise<{
    webp: Uint8Array;
    jpeg: Uint8Array;
  }>;
}

function bodyStream(bytes: Uint8Array): ReadableStream<Uint8Array> {
  return new Blob([bytes.slice().buffer]).stream();
}

export function createCloudflareAvatarImageProcessor(
  images: ImagesBinding
): AvatarImageProcessor {
  return {
    async inspect(bytes) {
      const info = await images.info(bodyStream(bytes));
      return {
        format: info.format,
        width: 'width' in info ? info.width : 0,
        height: 'height' in info ? info.height : 0,
      };
    },
    async normalize(bytes) {
      const transform = { width: 512, height: 512, fit: 'cover' as const };
      const webpResponse = (
        await images
          .input(bodyStream(bytes))
          .transform(transform)
          .output({ format: 'image/webp', anim: false })
      ).response();
      const jpegResponse = (
        await images
          .input(bodyStream(bytes))
          .transform(transform)
          .output({ format: 'image/jpeg', anim: false })
      ).response();
      return {
        webp: new Uint8Array(await webpResponse.arrayBuffer()),
        jpeg: new Uint8Array(await jpegResponse.arrayBuffer()),
      };
    },
  };
}
