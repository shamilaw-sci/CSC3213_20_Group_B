import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(
  resolve(
    import.meta.dir,
    '../src/components/custom/project-management-page/ProjectManagementPage.tsx'
  ),
  'utf8'
);

describe('project editor loading', () => {
  test('the list loader requests only one bounded project page', () => {
    const loader = source.slice(
      source.indexOf('async function loadProjectList'),
      source.indexOf(
        'async function loadProjectReferences',
        source.indexOf('loadProjectList')
      )
    );

    expect(loader).toContain('fetch(publicProjectsPageApiUrl()');
    expect(loader).not.toContain('publicCoursesApiUrl');
    expect(loader).not.toContain('publicOfferingsApiUrl');
  });

  test('loads course references only for an opened editor', () => {
    const loader = source.slice(
      source.indexOf('async function loadProjectReferences'),
      source.indexOf(
        'async function load()',
        source.indexOf('loadProjectReferences')
      )
    );

    expect(loader).toContain('fetch(publicCoursesApiUrl()');
    expect(loader).toContain('fetch(publicOfferingsApiUrl()');
  });
});
