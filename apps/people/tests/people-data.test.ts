import { expect, test } from 'bun:test';

import {
  getStudentDirectoryCandidates,
  isPublishedStudentBatch,
  type PeopleManifest,
} from '@/lib/data/people-data';

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
