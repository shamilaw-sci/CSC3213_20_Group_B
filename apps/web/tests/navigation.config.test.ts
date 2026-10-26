import {
  type NavigationItem,
  primaryNavigation,
  secondaryNavigation,
} from '@/config/navigation.config';

const navigationItems: NavigationItem[] = [
  ...primaryNavigation,
  ...secondaryNavigation,
];

describe('Web navigation contract', () => {
  test('keeps local department destinations unique in primary navigation', () => {
    const localDestinations = primaryNavigation
      .filter((item) => item.destination === 'local')
      .map((item) => item.href);

    expect(new Set(localDestinations).size).toBe(localDestinations.length);
  });

  test('marks People and e-learning as external products', () => {
    expect(navigationItems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          href: '/people',
          destination: 'external-product',
        }),
        expect.objectContaining({
          href: '/e-learning',
          destination: 'external-product',
        }),
      ])
    );
  });

  test('does not expose Portal routes', () => {
    expect(navigationItems.some((item) => item.href.includes('portal'))).toBe(
      false
    );
  });
});
