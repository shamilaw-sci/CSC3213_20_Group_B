// @vitest-environment node

describe('Web sitemap', () => {
  test('publishes department-owned content and excludes product redirects', async () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://www.example.test');
    vi.resetModules();

    const { default: sitemap } = await import('@/app/sitemap');
    const paths = sitemap().map((entry) => new URL(entry.url).pathname);

    expect(paths).toEqual([
      '/',
      '/about-us',
      '/contact',
      '/undergraduate-courses',
      '/postgraduate-courses',
      '/prizes-scholarships',
      '/resources',
      '/research',
      '/services',
      '/societies',
    ]);
    expect(paths).not.toContain('/people');
    expect(paths).not.toContain('/projects');
    expect(paths).not.toContain('/e-learning');
  });
});
