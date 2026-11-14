import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';

import { DetailedPersonCard } from '@/components/people/people-card';

test('shows additional known profiles and saved custom icons on a public profile', () => {
  const markup = renderToStaticMarkup(
    <DetailedPersonCard
      person={{
        title: 'Mr',
        fullName: 'Example Student',
        registrationNo: 'S21513',
        studentType: 'UNDERGRADUATE',
        studentTrack: 'GENERAL',
        level: '1000',
        status: 'CURRENT',
        socialLinks: {
          urls: { facebook: 'https://www.facebook.com/first.user' },
          profiles: [
            {
              platform: 'facebook',
              url: 'https://www.facebook.com/second.user',
            },
          ],
          otherPlatforms: [
            {
              platformName: 'Portfolio',
              url: 'https://example.com/portfolio',
              icon: { type: 'url', url: 'https://example.com/icon.svg' },
            },
          ],
        },
      }}
    />
  );

  expect(markup).toContain('https://www.facebook.com/first.user');
  expect(markup).toContain('https://www.facebook.com/second.user');
  expect(markup).toContain('https://example.com/portfolio');
  expect(markup).toContain('https://example.com/icon.svg');
});

test('does not present legacy social ORCID links as verified identities', () => {
  const markup = renderToStaticMarkup(
    <DetailedPersonCard
      person={{
        title: 'Mr',
        fullName: 'Example Student',
        registrationNo: 'S21513',
        studentType: 'UNDERGRADUATE',
        studentTrack: 'GENERAL',
        level: '1000',
        status: 'CURRENT',
        socialLinks: {
          urls: { orcid: 'https://orcid.org/0000-0002-1825-0097' },
          profiles: [
            { platform: 'orcid', url: 'https://orcid.org/0000-0002-1694-233X' },
          ],
          otherPlatforms: [
            {
              platformName: 'ORCID',
              url: 'https://orcid.org/0000-0002-1825-0097',
            },
          ],
        },
      }}
    />
  );
  expect(markup).not.toContain('orcid.org/');
  expect(markup).not.toContain('Research Outputs');
});
