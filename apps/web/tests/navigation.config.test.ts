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

  test('uses direct origins for external products', () => {
    expect(navigationItems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          href: 'https://people.scs-pdn.space',
          destination: 'external-product',
        }),
        expect.objectContaining({
          href: 'https://projects.scs-pdn.space',
          destination: 'external-product',
        }),
        expect.objectContaining({
          href: 'https://scilms.pdn.ac.lk',
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
