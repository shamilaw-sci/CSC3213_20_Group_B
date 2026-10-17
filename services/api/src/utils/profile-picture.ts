import {
  PROFILE_PICTURE_MAX_LENGTH,
  PROFILE_NAME_MAX_LENGTH,
} from '@/config/client.config';
import {
  isProfilePictureMode,
  type Permission,
  type ProfilePictureMode,
} from '@/repositories/permissions.repo';

const ALLOWED_IMAGE_CONTENT_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
] as const;

export type ProfilePictureUpdateInput = {
  pictureMode?: unknown;
  picture?: unknown;
  gravatarMail?: unknown;
};

export type ProfilePictureUpdateResult =
  | {
      ok: true;
      patch: Pick<Permission, 'picture' | 'pictureMode' | 'gravatarMail'>;
    }
  | { ok: false; message: string };

export function buildGithubAvatarUrl(githubUserID: number): string {
  return `https://avatars.githubusercontent.com/u/${githubUserID}?v=4`;
}

export async function buildGravatarAvatarUrl(email: string): Promise<string> {
  const normalizedEmail = email.trim().toLowerCase();
  const bytes = new TextEncoder().encode(normalizedEmail);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const hash = [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');

  return `https://www.gravatar.com/avatar/${hash}`;
}

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isAllowedContentType(contentType: string): boolean {
  const mediaType = contentType.split(';')[0]?.trim().toLowerCase();
  return ALLOWED_IMAGE_CONTENT_TYPES.includes(
    mediaType as (typeof ALLOWED_IMAGE_CONTENT_TYPES)[number]
  );
}

function getContentType(response: Response): string {
  return response.headers.get('content-type') ?? '';
}

async function fetchProfilePictureMetadata(
  url: string,
  init: RequestInit
): Promise<Response | null> {
  try {
    return await fetch(url, init);
  } catch {
    return null;
  }
}

export async function validateManualProfilePictureUrl(
  value: unknown
): Promise<{ ok: true; url: string } | { ok: false; message: string }> {
  if (typeof value !== 'string') {
    return { ok: false, message: 'Picture URL must be a string' };
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return { ok: false, message: 'Picture URL is required' };
  }

  if (trimmed.length > PROFILE_PICTURE_MAX_LENGTH) {
    return { ok: false, message: 'Picture URL is too long' };
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return { ok: false, message: 'Picture URL must be valid' };
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return { ok: false, message: 'Picture URL must use HTTP or HTTPS' };
  }

  if (!url.hostname) {
    return { ok: false, message: 'Picture URL must include a host' };
  }

  const normalizedUrl = url.toString();
  const headResponse = await fetchProfilePictureMetadata(normalizedUrl, {
    method: 'HEAD',
  });
  const headContentType = headResponse ? getContentType(headResponse) : '';

  if (
    headResponse?.ok &&
    headContentType &&
    isAllowedContentType(headContentType)
  ) {
    return { ok: true, url: normalizedUrl };
  }

  const shouldTryGet =
    !headResponse ||
    !headResponse.ok ||
    headResponse.status === 405 ||
    !headContentType;
  let getResponse: Response | null = null;
  let fallbackContentType = '';
  if (shouldTryGet) {
    getResponse = await fetchProfilePictureMetadata(normalizedUrl, {
      method: 'GET',
      headers: { Range: 'bytes=0-2048' },
    });
    fallbackContentType = getResponse ? getContentType(getResponse) : '';

    if (
      getResponse?.ok &&
      fallbackContentType &&
      isAllowedContentType(fallbackContentType)
    ) {
      return { ok: true, url: normalizedUrl };
    }
  }

  if (
    (!headResponse || !headResponse.ok) &&
    (!getResponse || !getResponse.ok)
  ) {
    return { ok: false, message: 'Picture URL could not be reached' };
  }

  if (
    headResponse &&
    headResponse.ok &&
    headContentType &&
    !isAllowedContentType(headContentType)
  ) {
    return {
      ok: false,
      message: 'Picture URL must point to a PNG, JPEG, or WebP image',
    };
  }

  return {
    ok: false,
    message: 'Picture URL must point to a PNG, JPEG, or WebP image',
  };
}

export async function resolveProfilePictureUpdate(
  input: ProfilePictureUpdateInput,
  permission: Permission,
  email: string
): Promise<ProfilePictureUpdateResult> {
  if (!isProfilePictureMode(input.pictureMode)) {
    return { ok: false, message: 'Invalid picture mode' };
  }

  const pictureMode: ProfilePictureMode = input.pictureMode;

  if (pictureMode === 'google') {
    if (!permission.oAuthProviders?.google) {
      return { ok: false, message: 'Google OAuth is not connected' };
    }

    return {
      ok: true,
      patch: {
        picture: permission.picture,
        pictureMode,
        gravatarMail: undefined,
      },
    };
  }

  if (pictureMode === 'github') {
    if (!permission.githubUserID) {
      return { ok: false, message: 'GitHub OAuth is not connected' };
    }

    return {
      ok: true,
      patch: {
        picture: buildGithubAvatarUrl(permission.githubUserID),
        pictureMode,
        gravatarMail: undefined,
      },
    };
  }

  if (pictureMode === 'manual') {
    const validated = await validateManualProfilePictureUrl(input.picture);
    if (!validated.ok) return validated;

    return {
      ok: true,
      patch: {
        picture: validated.url,
        pictureMode,
        gravatarMail: undefined,
      },
    };
  }

  const rawGravatarMail =
    typeof input.gravatarMail === 'string' ? input.gravatarMail.trim() : '';
  const gravatarEmail = rawGravatarMail || email;
  if (!isValidEmail(gravatarEmail)) {
    return { ok: false, message: 'Gravatar email must be valid' };
  }

  return {
    ok: true,
    patch: {
      picture: await buildGravatarAvatarUrl(gravatarEmail),
      pictureMode,
      gravatarMail: rawGravatarMail || undefined,
    },
  };
}

export function sanitizeProfileName(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;

  const trimmed = value.trim();
  if (trimmed.length === 0) return undefined;

  return trimmed.slice(0, PROFILE_NAME_MAX_LENGTH);
}
