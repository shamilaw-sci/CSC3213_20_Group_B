import { describe, expect, test } from 'bun:test';

import {
  decodePaginationCursor,
  encodePaginationCursor,
  InvalidPaginationCursorError,
  paginateByKey,
  parsePaginationRequest,
} from '@/pagination/cursor';

describe('pagination cursors', () => {
  test('round-trips a scoped opaque cursor', () => {
    const cursor = encodePaginationCursor('admin-users', 'provider-cursor');
    expect(cursor).not.toContain('provider-cursor');
    expect(decodePaginationCursor('admin-users', cursor)).toBe(
      'provider-cursor'
    );
  });

  test('rejects malformed and cross-endpoint cursors', () => {
    const cursor = encodePaginationCursor('admin-users', 'provider-cursor');
    expect(() => decodePaginationCursor('admin-proxies', cursor)).toThrow(
      InvalidPaginationCursorError
    );
    expect(() => decodePaginationCursor('admin-users', 'v1.invalid')).toThrow(
      InvalidPaginationCursorError
    );
  });

  test('applies defaults and enforces the shared maximum page size', () => {
    expect(parsePaginationRequest(new URL('https://example.test'))).toEqual({
      limit: 25,
    });
    expect(() =>
      parsePaginationRequest(new URL('https://example.test?limit=101'))
    ).toThrow(InvalidPaginationCursorError);
  });

  test('returns stable key-ordered pages when the cursor item was removed', () => {
    const first = paginateByKey({
      items: ['delta', 'alpha', 'charlie', 'bravo'],
      key: (item) => item,
      scope: 'letters',
      request: { limit: 2 },
    });
    expect(first.items).toEqual(['alpha', 'bravo']);
    expect(first.page).toMatchObject({ hasMore: true, total: 4 });

    const second = paginateByKey({
      items: ['delta', 'alpha', 'charlie'],
      key: (item) => item,
      scope: 'letters',
      request: { limit: 2, cursor: first.page.nextCursor! },
    });
    expect(second.items).toEqual(['charlie', 'delta']);
    expect(second.page).toEqual({
      nextCursor: null,
      hasMore: false,
      total: 3,
    });
  });
});
