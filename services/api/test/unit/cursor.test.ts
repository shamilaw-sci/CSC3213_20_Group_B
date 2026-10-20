import { describe, expect, test } from 'bun:test';

import {
  decodePaginationCursor,
  encodePaginationCursor,
  InvalidPaginationCursorError,
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
});
