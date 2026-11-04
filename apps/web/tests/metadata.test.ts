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
        canonical: 'https://scs-pdn.space/about-us',
        languages: { en: 'https://scs-pdn.space/about-us' },
      },
      openGraph: {
        title: 'About the department',
        description: 'Department history and academic contribution.',
        url: 'https://scs-pdn.space/about-us',
        images: [
          {
            url: 'https://scs-pdn.space/favicon/android-chrome-512x512.png',
            width: 512,
            height: 512,
          },
        ],
      },
      twitter: {
        card: 'summary',
        title: 'About the department',
        description: 'Department history and academic contribution.',
      },
    });
  });
});
