import { describe, expect, test } from 'bun:test';

import { getPageNavigation } from '@/lib/pagination';

describe('cursor page navigation', () => {
  test('creates a next-page link that can return to the first page', () => {
    const firstPage = getPageNavigation({
      pathname: '/admin/users',
      searchParams: { filter: 'active' },
      nextCursor: 'cursor-2',
    });

    expect(firstPage.previousHref).toBeUndefined();
    expect(firstPage.nextHref).toContain('cursor=cursor-2');
    expect(firstPage.nextHref).toContain('filter=active');

    const secondPageUrl = new URL(firstPage.nextHref!, 'https://portal.test');
    const secondPage = getPageNavigation({
      pathname: '/admin/users',
      searchParams: Object.fromEntries(secondPageUrl.searchParams),
      nextCursor: 'cursor-3',
    });

    expect(secondPage.previousHref).toBe('/admin/users?filter=active');
    expect(secondPage.nextHref).toContain('cursor=cursor-3');
  });

  test('ignores malformed cursor history', () => {
    const navigation = getPageNavigation({
      pathname: '/admin/users',
      searchParams: { cursor: 'cursor-2', pageHistory: 'not-json' },
      nextCursor: null,
    });

    expect(navigation.previousHref).toBeUndefined();
    expect(navigation.nextHref).toBeUndefined();
  });
});
