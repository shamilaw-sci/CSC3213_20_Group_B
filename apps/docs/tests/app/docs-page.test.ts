import { describe, expect, test } from 'vitest';

import { source } from '@/lib/source';

describe('documentation source routing', () => {
  test('resolves the handbook index at the docs root', () => {
    const page = source.getPage([]);

    expect(page?.url).toBe('/docs');
  });

  test('does not resolve an unknown documentation slug', () => {
    expect(source.getPage(['not-a-real-page'])).toBeUndefined();
  });
});
