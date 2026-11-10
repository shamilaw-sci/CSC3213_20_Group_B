import { expect, test } from 'bun:test';

import {
  getPersonProjects,
  getSpecialStudents,
  getStudentDirectoryCandidates,
  isPublishedStudentBatch,
  type PeopleManifest,
} from '@/lib/data/people-data';
import { dataConfig } from '@/config/data.config';

const manifest: PeopleManifest = {
  version: 'test',
  batches: [
    {
      id: 's20',
      displayName: 'E20',
      defaultCategory: 'CURRENT',
      intakeYear: 2020,
    },
    {
      id: 's21',
      displayName: 'E21',
      defaultCategory: 'CURRENT',
      intakeYear: 2021,
    },
  ],
  programmes: [
    {
      slug: 'computer-science',
      directory: 'computer-science',
      name: 'Computer Science',
      batches: ['s20', 's21'],
    },
    {
      slug: 'statistics',
      directory: 'statistics',
      name: 'Statistics',
      batches: ['s20'],
    },
  ],
};

test('limits profile directory lookups to the registration batch', () => {
  expect(getStudentDirectoryCandidates(manifest, 'S21513')).toEqual([
    {
      subject: 'computer-science',
      programme: manifest.programmes[0],
      batch: manifest.batches[1],
    },
  ]);
});

test('keeps valid person projects and discards incomplete summaries', async () => {
  const originalFetch = globalThis.fetch;
  const fetchMock = Object.assign(
    async () =>
      Response.json([
        {
          id: 'project-one',
          slug: 'project-one',
          title: 'Project One',
          shortDescription: 'A project',
          status: 'ACTIVE',
          role: 'contributor',
          unpublishedField: 'ignored by the People view',
        },
        {
          id: 'project-two',
          slug: 'project-two',
          title: 'Project Two',
          status: 'ACTIVE',
          role: 'contributor',
        },
      ]),
    { preconnect: () => undefined }
  ) as typeof fetch;
  globalThis.fetch = fetchMock;

  try {
    expect(await getPersonProjects('Student-01')).toEqual([
      {
        id: 'project-one',
        slug: 'project-one',
        title: 'Project One',
        shortDescription: 'A project',
        status: 'ACTIVE',
        role: 'contributor',
      },
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('recognizes only batches published for the requested programme', async () => {
  const originalFetch = globalThis.fetch;
  const fetchMock = Object.assign(async () => Response.json(manifest), {
    preconnect: () => undefined,
  }) as typeof fetch;
  globalThis.fetch = fetchMock;

  try {
    expect(await isPublishedStudentBatch('computer-science', '21')).toBe(true);
    expect(await isPublishedStudentBatch('statistics', '21')).toBe(false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('an expired failed request cannot remove its replacement cache entry', async () => {
  const originalFetch = globalThis.fetch;
  const originalNow = Date.now;
  const start = originalNow();
  let calls = 0;
  let resolveFirst: ((response: Response) => void) | undefined;
  const fetchMock = Object.assign(
    async () => {
      calls += 1;
      if (calls === 1) {
        return new Promise<Response>((resolve) => {
          resolveFirst = resolve;
        });
      }
      return Response.json([]);
    },
    { preconnect: () => undefined }
  ) as typeof fetch;
  globalThis.fetch = fetchMock;
  Date.now = () => start;

  try {
    const programme = { directory: `cache-race-${crypto.randomUUID()}` };
    const first = getSpecialStudents(programme, 's20');
    Date.now = () => start + dataConfig.cacheTtlMs + 1;
    expect(await getSpecialStudents(programme, 's20')).toEqual([]);
    if (!resolveFirst) throw new Error('The first fetch was not started');
    resolveFirst(new Response(null, { status: 500 }));
    await expect(first).rejects.toThrow('Failed to fetch people data');
    expect(await getSpecialStudents(programme, 's20')).toEqual([]);
    expect(calls).toBe(2);
  } finally {
    globalThis.fetch = originalFetch;
    Date.now = originalNow;
  }
});
