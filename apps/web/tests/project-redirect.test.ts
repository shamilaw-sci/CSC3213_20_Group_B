// @vitest-environment node

describe('project showcase redirect', () => {
  test('redirects the Web boundary to the Projects application', async () => {
    vi.stubEnv('BASE_DOMAIN', 'example.test');
    vi.resetModules();

    const { GET } = await import('@/app/projects/route');
    const response = await GET();

    expect(response.status).toBe(308);
    expect(response.headers.get('location')).toBe(
      'https://projects.example.test/'
    );
  });
});
