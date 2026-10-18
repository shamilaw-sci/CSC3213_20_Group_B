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

describe('project editor loading characterization', () => {
  test('the list loader requests all three complete registries together', () => {
    const loader = source.slice(
      source.indexOf('async function loadProjectList'),
      source.indexOf('async function load()', source.indexOf('loadProjectList'))
    );

    expect(loader).toContain('Promise.all([');
    expect(loader).toContain('fetch(publicProjectsApiUrl()');
    expect(loader).toContain('fetch(publicCoursesApiUrl()');
    expect(loader).toContain('fetch(publicOfferingsApiUrl()');
    expect(loader).not.toMatch(/[?&](?:limit|cursor)=/);
  });
});
