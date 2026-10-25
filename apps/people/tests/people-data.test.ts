import { expect, test } from 'bun:test';

import {
  getStudentDirectoryCandidates,
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
