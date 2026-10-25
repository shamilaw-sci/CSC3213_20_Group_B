import { permanentRedirect } from 'next/navigation';

import ShortProjectPage from '@/app/p/[project_slug]/page';

vi.mock('next/navigation', () => ({
  permanentRedirect: vi.fn(),
}));

const permanentRedirectMock = vi.mocked(permanentRedirect);

describe('short project route', () => {
  beforeEach(() => permanentRedirectMock.mockReset());

  test('permanently redirects to the canonical project route', async () => {
    await ShortProjectPage({
      params: Promise.resolve({ project_slug: 'scs-pdn-portal' }),
    });

    expect(permanentRedirectMock).toHaveBeenCalledWith(
      '/projects/scs-pdn-portal'
    );
  });

  test('encodes decoded route input before building the destination', async () => {
    await ShortProjectPage({
      params: Promise.resolve({ project_slug: '../search?status=ACTIVE' }),
    });

    expect(permanentRedirectMock).toHaveBeenCalledWith(
      '/projects/..%2Fsearch%3Fstatus%3DACTIVE'
    );
  });
});
