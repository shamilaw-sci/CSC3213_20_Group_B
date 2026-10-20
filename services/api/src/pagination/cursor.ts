import {
  type OpaqueCursor,
  PaginationRequestSchema,
  type PaginationRequest,
} from '@scs/schemas';

const CURSOR_VERSION = 1;
const CURSOR_PREFIX = 'v1.';

interface CursorPayload {
  v: typeof CURSOR_VERSION;
  scope: string;
  value: string;
}

export class InvalidPaginationCursorError extends Error {
  constructor() {
    super('Invalid pagination cursor');
    this.name = 'InvalidPaginationCursorError';
  }
}

function encodeBase64Url(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/u, '');
}

function decodeBase64Url(value: string): string {
  if (!/^[A-Za-z0-9_-]+$/u.test(value)) {
    throw new InvalidPaginationCursorError();
  }
  const base64 = value.replaceAll('-', '+').replaceAll('_', '/');
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
  try {
    const binary = atob(padded);
    return new TextDecoder().decode(
      Uint8Array.from(binary, (character) => character.charCodeAt(0))
    );
  } catch {
    throw new InvalidPaginationCursorError();
  }
}

export function encodePaginationCursor(
  scope: string,
  value: string
): OpaqueCursor {
  const payload: CursorPayload = { v: CURSOR_VERSION, scope, value };
  return `${CURSOR_PREFIX}${encodeBase64Url(JSON.stringify(payload))}`;
}

export function decodePaginationCursor(
  scope: string,
  cursor: OpaqueCursor
): string {
  if (!cursor.startsWith(CURSOR_PREFIX)) {
    throw new InvalidPaginationCursorError();
  }

  try {
    const payload = JSON.parse(
      decodeBase64Url(cursor.slice(CURSOR_PREFIX.length))
    ) as Partial<CursorPayload>;
    if (
      payload.v !== CURSOR_VERSION ||
      payload.scope !== scope ||
      typeof payload.value !== 'string' ||
      payload.value.length === 0
    ) {
      throw new InvalidPaginationCursorError();
    }
    return payload.value;
  } catch (error) {
    if (error instanceof InvalidPaginationCursorError) throw error;
    throw new InvalidPaginationCursorError();
  }
}

export function parsePaginationRequest(url: URL): PaginationRequest {
  const result = PaginationRequestSchema.safeParse({
    cursor: url.searchParams.get('cursor') ?? undefined,
    limit: url.searchParams.get('limit') ?? undefined,
  });
  if (!result.success) throw new InvalidPaginationCursorError();
  return result.data;
}
