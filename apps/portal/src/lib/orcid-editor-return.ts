import type { PublicProfileKind } from '@scs/schemas';

const STORAGE_KEY = 'scs:orcid-editor-return';
const MAX_AGE_MS = 15 * 60 * 1000;
const EDITOR_PATHS = new Set([
  '/account/public-profile',
  '/user/me/public-profile',
]);

export interface OrcidEditorReturn {
  path: string;
  profileKind: PublicProfileKind;
  draft: Record<string, unknown>;
  surface: 'edit' | 'review' | 'advanced';
  json: { text: string; dirty: boolean; error: string | null };
  savedAt: number;
}

export function saveOrcidEditorReturn(
  storage: Storage,
  value: Omit<OrcidEditorReturn, 'savedAt'>
) {
  if (!EDITOR_PATHS.has(value.path)) throw new Error('Invalid profile path');
  storage.setItem(
    STORAGE_KEY,
    JSON.stringify({ ...value, savedAt: Date.now() })
  );
}

export function readOrcidEditorReturn(
  storage: Storage
): OrcidEditorReturn | null {
  const raw = storage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (
      !value ||
      typeof value !== 'object' ||
      !('path' in value) ||
      typeof value.path !== 'string' ||
      !EDITOR_PATHS.has(value.path) ||
      !('savedAt' in value) ||
      typeof value.savedAt !== 'number' ||
      Date.now() - value.savedAt > MAX_AGE_MS ||
      !('profileKind' in value) ||
      typeof value.profileKind !== 'string' ||
      !('draft' in value) ||
      !value.draft ||
      typeof value.draft !== 'object' ||
      Array.isArray(value.draft) ||
      !('surface' in value) ||
      !['edit', 'review', 'advanced'].includes(String(value.surface)) ||
      !('json' in value) ||
      !value.json ||
      typeof value.json !== 'object' ||
      !('text' in value.json) ||
      typeof value.json.text !== 'string' ||
      !('dirty' in value.json) ||
      typeof value.json.dirty !== 'boolean'
    ) {
      storage.removeItem(STORAGE_KEY);
      return null;
    }
    return value as OrcidEditorReturn;
  } catch {
    storage.removeItem(STORAGE_KEY);
    return null;
  }
}

export function consumeOrcidEditorReturn(
  storage: Storage
): OrcidEditorReturn | null {
  const value = readOrcidEditorReturn(storage);
  storage.removeItem(STORAGE_KEY);
  return value;
}
