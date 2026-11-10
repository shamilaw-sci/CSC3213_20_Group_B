import { expect, test } from 'bun:test';

import { JsonRecordSchema } from '@/utils/json-record';

test('keeps legacy fields while rejecting nonrecord GitHub JSON', () => {
  const record = { id: 'project-one', legacy: { owner: 'student-01' } };
  expect(JsonRecordSchema.parse(record)).toEqual(record);
  expect(JsonRecordSchema.safeParse([record]).success).toBe(false);
  expect(JsonRecordSchema.safeParse(null).success).toBe(false);
});
