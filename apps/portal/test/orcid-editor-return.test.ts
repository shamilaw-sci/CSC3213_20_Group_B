import { expect, test } from 'bun:test';

import {
  consumeOrcidEditorReturn,
  readOrcidEditorReturn,
  saveOrcidEditorReturn,
} from '@/lib/orcid-editor-return';

function storage(): Storage {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => void values.set(key, value),
    removeItem: (key) => void values.delete(key),
    clear: () => values.clear(),
    key: (index) => [...values.keys()][index] ?? null,
    get length() {
      return values.size;
    },
  };
}

test('preserves guided and advanced unsaved edits across an ORCID redirect', () => {
  const session = storage();
  const pending = {
    path: '/user/me/public-profile',
    profileKind: 'student' as const,
    draft: { fullName: 'Unsaved name' },
    surface: 'advanced' as const,
    json: {
      text: '{ "fullName": "newer unsaved name" }',
      dirty: true,
      error: null,
    },
  };
  saveOrcidEditorReturn(session, pending);
  expect(readOrcidEditorReturn(session)).toMatchObject(pending);
  expect(consumeOrcidEditorReturn(session)).toMatchObject(pending);
  expect(readOrcidEditorReturn(session)).toBeNull();
});

test('rejects a return path outside the two self-service profile routes', () => {
  expect(() =>
    saveOrcidEditorReturn(storage(), {
      path: '/admin/users/someone/public-profile',
      profileKind: 'academic',
      draft: {},
      surface: 'edit',
      json: { text: '{}', dirty: false, error: null },
    })
  ).toThrow();
});
