import {
  PROFILE_NAME_MAX_LENGTH,
  PROFILE_PICTURE_MAX_LENGTH,
} from '@/config/client.config';

export function sanitizeProfile(
  name: unknown,
  picture: unknown
): { name?: string; picture?: string } {
  let safeName: string | undefined;
  if (typeof name === 'string') {
    const trimmed = name.trim();
    if (trimmed.length > 0) {
      safeName = trimmed.slice(0, PROFILE_NAME_MAX_LENGTH);
    }
  }

  let safePicture: string | undefined;
  if (typeof picture === 'string') {
    const trimmed = picture.trim();
    if (trimmed.length > 0 && trimmed.length <= PROFILE_PICTURE_MAX_LENGTH) {
      try {
        const url = new URL(trimmed);
        if (
          (url.protocol === 'http:' || url.protocol === 'https:') &&
          url.hostname
        ) {
          safePicture = url.toString();
        }
      } catch {
        // Invalid URL - leave safePicture as undefined.
      }
    }
  }

  return { name: safeName, picture: safePicture };
}
