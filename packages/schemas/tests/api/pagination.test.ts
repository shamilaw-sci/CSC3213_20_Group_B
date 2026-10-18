import { describe, expect, test } from 'bun:test';
import { z } from 'zod';

import {
  createPageSchema,
  OpaqueCursorSchema,
  PaginationRequestSchema,
} from '#index';

describe('bounded cursor pagination contracts', () => {
  test('coerces a bounded page size and keeps cursors opaque', () => {
    expect(
      PaginationRequestSchema.parse({
        limit: '50',
        cursor: 'cur_01JAA2V8M7X4G9NK2QF6D3P1ZT',
      })
    ).toEqual({
      limit: 50,
      cursor: 'cur_01JAA2V8M7X4G9NK2QF6D3P1ZT',
    });
    expect(PaginationRequestSchema.parse({}).limit).toBe(25);
    expect(PaginationRequestSchema.safeParse({ limit: 101 }).success).toBe(
      false
    );
    expect(OpaqueCursorSchema.safeParse('cursor with spaces').success).toBe(
      false
    );
  });

  test('builds versioned pages with consistent continuation metadata', () => {
    const PageSchema = createPageSchema(
      z.object({ id: z.string(), name: z.string() })
    );
    const page = PageSchema.parse({
      version: 1,
      items: [{ id: 'one', name: 'First' }],
      page: {
        nextCursor: 'cur_01JAA2V8M7X4G9NK2QF6D3P1ZT',
        hasMore: true,
      },
    });

    expect(page.items[0]?.name).toBe('First');
    expect(
      PageSchema.safeParse({
        version: 1,
        items: [],
        page: { nextCursor: null, hasMore: true },
      }).success
    ).toBe(false);
  });
});
