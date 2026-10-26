import { createPageMetadata } from '@/lib/metadata';

describe('createPageMetadata', () => {
  test('gives an editorial route its own canonical and social metadata', () => {
    const metadata = createPageMetadata({
      title: 'About the department',
      description: 'Department history and academic contribution.',
      path: '/about-us',
    });

    expect(metadata).toMatchObject({
      title: 'About the department',
      description: 'Department history and academic contribution.',
      alternates: {
        canonical: 'https://scs.pdn.ac.lk/about-us',
        languages: { en: 'https://scs.pdn.ac.lk/about-us' },
      },
      openGraph: {
        title: 'About the department',
        description: 'Department history and academic contribution.',
        url: 'https://scs.pdn.ac.lk/about-us',
      },
      twitter: {
        title: 'About the department',
        description: 'Department history and academic contribution.',
      },
    });
  });
});
