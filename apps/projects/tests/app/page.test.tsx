import Page from '@/app/page';

const { redirect } = vi.hoisted(() => ({
  redirect: vi.fn(() => {
    throw new Error('NEXT_REDIRECT');
  }),
}));

vi.mock('next/navigation', () => ({ redirect }));

describe('Projects home legacy discovery parameters', () => {
  beforeEach(() => {
    redirect.mockClear();
  });

  test('removes retired discovery keys while preserving unrelated campaign parameters', async () => {
    await expect(
      Page({
        searchParams: Promise.resolve({
          q: 'neural',
          category: 'research',
          utm_source: 'newsletter',
          ref: ['alumni', 'october'],
        }),
      })
    ).rejects.toThrow('NEXT_REDIRECT');

    expect(redirect).toHaveBeenCalledWith(
      '/?utm_source=newsletter&ref=alumni&ref=october'
    );
  });

  test('redirects a legacy-only request to the clean homepage', async () => {
    await expect(
      Page({ searchParams: Promise.resolve({ page: '2', status: 'ACTIVE' }) })
    ).rejects.toThrow('NEXT_REDIRECT');

    expect(redirect).toHaveBeenCalledWith('/');
  });

  test('renders normally when no retired discovery key is present', async () => {
    const element = await Page({
      searchParams: Promise.resolve({ utm_source: 'newsletter' }),
    });

    expect(element.type).toBeDefined();
    expect(redirect).not.toHaveBeenCalled();
  });
});
