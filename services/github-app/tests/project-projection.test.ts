import { describe, expect, test } from 'bun:test';
import type { Project } from '@scs/schemas';

import {
  buildProjectByPersonIndex,
  normalizeProjectSlug,
  upsertProjectAggregate,
  usernamesForProject,
} from '@/domains/projects/project.projection';

function project(input: {
  slug: string;
  title: string;
  username?: string;
}): Project {
  return {
    id: `project-${input.slug}`,
    slug: input.slug,
    title: input.title,
    shortDescription: `${input.title} description`,
    description: `${input.title} long description`,
    projectType: 'OPEN_SOURCE',
    status: 'ACTIVE',
    categories: ['software'],
    tags: [],
    departments: ['STATISTICS_AND_COMPUTER_SCIENCE'],
    people: [
      {
        name: 'Maintainer',
        role: 'maintainer',
        ...(input.username ? { username: input.username } : {}),
      },
    ],
    source: { kind: 'MANUAL', curator: 'SCS' },
    media: { icon: 'FolderKanban' },
    dates: { lastUpdatedAt: '2026-10-20' },
    links: {},
  };
}

describe('project projections', () => {
  test('normalizes identity before deriving membership', () => {
    const record = project({
      slug: 'example',
      title: 'Example',
      username: ' Student-One ',
    });

    expect(normalizeProjectSlug(' Example ')).toBe('example');
    expect([...usernamesForProject(record)]).toEqual(['student-one']);
    expect(buildProjectByPersonIndex([record], 'STUDENT-ONE')).toHaveLength(1);
  });

  test('replaces an entity and sorts the resulting aggregate by title', () => {
    const next = upsertProjectAggregate(
      [
        project({ slug: 'example', title: 'Old title' }),
        project({ slug: 'zulu', title: 'Zulu' }),
      ],
      project({ slug: 'example', title: 'Alpha' })
    );

    expect(next.map(({ slug, title }) => ({ slug, title }))).toEqual([
      { slug: 'example', title: 'Alpha' },
      { slug: 'zulu', title: 'Zulu' },
    ]);
  });

  test('ignores malformed aggregate entries during projection', () => {
    const valid = project({
      slug: 'valid',
      title: 'Valid',
      username: 'student-one',
    });
    expect(buildProjectByPersonIndex([{}, null, valid], 'student-one')).toEqual(
      [expect.objectContaining({ slug: 'valid', role: 'maintainer' })]
    );
  });
});
