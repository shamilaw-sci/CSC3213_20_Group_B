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
          label: 'Moodle',
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

  test('uses the configured Moodle URL for navigation and the /moodle redirect', async () => {
    vi.stubEnv('NEXT_PUBLIC_MOODLE_URL', 'https://moodle.example.test/');
    vi.resetModules();

    try {
      const [{ secondaryNavigation }, { GET }] = await Promise.all([
        import('@/config/navigation.config'),
        import('@/app/moodle/route'),
      ]);

      expect(secondaryNavigation).toContainEqual({
        href: 'https://moodle.example.test/',
        label: 'Moodle',
        destination: 'external-product',
      });
      expect((await GET()).headers.get('location')).toBe(
        'https://moodle.example.test/'
      );
    } finally {
      vi.unstubAllEnvs();
      vi.resetModules();
    }
  });
});
