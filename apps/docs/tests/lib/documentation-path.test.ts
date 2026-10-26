import { describe, expect, test } from 'vitest';

import {
  rewriteDocumentationHref,
  toDocumentationSlugs,
  toDocumentationUrl,
} from '@/lib/documentation-path';

describe('documentation paths', () => {
  test('maps repository filenames to stable public slugs', () => {
    expect(toDocumentationSlugs('API_CONTRACTS.md')).toEqual(['api-contracts']);
    expect(toDocumentationSlugs('OPERATIONS/FAILURE_MODES.md')).toEqual([
      'operations',
      'failure-modes',
    ]);
    expect(toDocumentationSlugs('INDEX.md')).toEqual([]);
    expect(toDocumentationUrl('API_CONTRACTS.md')).toBe('/docs/api-contracts');
  });

  test('rewrites local Markdown links and preserves their fragments', () => {
    expect(rewriteDocumentationHref('API_CONTRACTS.md#pagination')).toBe(
      '/docs/api-contracts#pagination'
    );
    expect(rewriteDocumentationHref('./SCHEMAS.md')).toBe('/docs/schemas');
  });

  test('leaves web URLs and same-page anchors unchanged', () => {
    expect(rewriteDocumentationHref('https://example.com/docs.md')).toBe(
      'https://example.com/docs.md'
    );
    expect(rewriteDocumentationHref('#architecture')).toBe('#architecture');
  });
});
