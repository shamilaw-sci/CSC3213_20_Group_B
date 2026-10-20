import { describe, expect, test } from 'bun:test';

import {
  normalizeAcademicId,
  removeAcademicRecord,
  upsertAcademicRecord,
} from '@/domains/academics/academic.projection';

describe('academic projections', () => {
  test('normalizes academic entity identifiers', () => {
    expect(normalizeAcademicId(' CSC3213 ')).toBe('csc3213');
  });

  test('replaces an entity and sorts records by display title', () => {
    expect(
      upsertAcademicRecord(
        [
          { id: 'csc3213', title: 'Old title' },
          { id: 'csc9999', title: 'Zulu' },
          null,
        ],
        { id: 'csc3213', title: 'Alpha' }
      )
    ).toEqual([
      { id: 'csc3213', title: 'Alpha' },
      { id: 'csc9999', title: 'Zulu' },
    ]);
  });

  test('removes a normalized entity and preserves a sorted aggregate', () => {
    expect(
      removeAcademicRecord(
        [
          { id: 'csc9999', title: 'Zulu' },
          { id: 'csc3213', title: 'Alpha' },
        ],
        ' CSC3213 '
      )
    ).toEqual([{ id: 'csc9999', title: 'Zulu' }]);
  });
});
