import { describe, expect, test } from 'bun:test';

import {
  getStudentProgrammeField,
  getStudentSubjectLabels,
} from '@/lib/student-academic-details';

describe('getStudentSubjectLabels', () => {
  test('does not repeat an honours programme as an unlabeled subject', () => {
    expect(
      getStudentSubjectLabels({
        honoursProgramme: 'COMPUTER_SCIENCE',
      })
    ).toEqual([]);
  });

  test('labels explicitly published subjects', () => {
    expect(
      getStudentSubjectLabels({
        honoursProgramme: 'COMPUTER_SCIENCE',
        subjects: ['COMPUTER_SCIENCE', 'STATISTICS'],
      })
    ).toEqual(['Computer Science', 'Statistics']);
  });
});

describe('getStudentProgrammeField', () => {
  test('explains an honours programme with a specific field label', () => {
    expect(
      getStudentProgrammeField({
        honoursProgramme: 'COMPUTER_SCIENCE',
      })
    ).toEqual({ label: 'Honours Programme', value: 'Computer Science' });
  });

  test('explains a postgraduate programme with a specific field label', () => {
    expect(
      getStudentProgrammeField({
        postgraduateProgramme: 'MSC',
      })
    ).toEqual({ label: 'Postgraduate Programme', value: 'MSc' });
  });
});
