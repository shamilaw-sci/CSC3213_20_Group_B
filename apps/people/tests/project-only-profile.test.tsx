import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';

import { MinimalProjectPersonProfile } from '@/app/people/[identity]/_components/person-profile-page';

test('keeps roles attached to projects instead of assigning one global role', () => {
  const markup = renderToStaticMarkup(
    <MinimalProjectPersonProfile
      identity="shamilaw"
      projects={[
        {
          id: 'project-1',
          slug: 'project-1',
          title: 'First Project',
          shortDescription: 'First project description',
          status: 'ACTIVE',
          role: 'Supervisor',
        },
        {
          id: 'project-2',
          slug: 'project-2',
          title: 'Second Project',
          shortDescription: 'Second project description',
          status: 'ACTIVE',
          role: 'Contributor',
        },
      ]}
    />
  );

  expect(markup).toContain('Project-Only Profile');
  expect(markup).not.toContain('Project contributor');
  expect(markup).toContain('Supervisor');
  expect(markup).toContain('Contributor');
});
