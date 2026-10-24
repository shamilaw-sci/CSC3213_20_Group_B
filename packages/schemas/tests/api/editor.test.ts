import { describe, expect, test } from 'bun:test';

import { PublicProfilePrSchema, StudentPlacementResponseSchema } from '#index';

describe('editor transport contracts', () => {
  test('accepts an undergraduate placement response', () => {
    expect(
      StudentPlacementResponseSchema.safeParse({
        registrationNo: 'S21513',
        studentType: 'UNDERGRADUATE',
        studentTrack: 'HONOURS',
        level: '4000',
        status: 'CURRENT',
        lockedFields: ['registrationNo', 'level'],
      }).success
    ).toBeTrue();
  });

  test('rejects mixed undergraduate and postgraduate placement fields', () => {
    expect(
      StudentPlacementResponseSchema.safeParse({
        registrationNo: 'S21513',
        studentType: 'UNDERGRADUATE',
        studentTrack: 'HONOURS',
        level: '4000',
        slqfLevel: 'L10',
        status: 'CURRENT',
        lockedFields: [],
      }).success
    ).toBeFalse();
  });

  test('accepts bounded profile pull-request state', () => {
    expect(
      PublicProfilePrSchema.safeParse({
        status: 'open',
        canEdit: true,
        number: 42,
        targetAggregateFiles: ['public/people/v2/students/s21.json'],
      }).success
    ).toBeTrue();
  });
});
