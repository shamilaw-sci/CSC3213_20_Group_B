import type { Student } from '@scs/schemas';

import {
  getAcademicSubjectLabel,
  getHonoursProgrammeLabel,
  getPostgraduateProgrammeLabel,
} from '@/lib/types';

type StudentAcademicDetails = Pick<
  Student,
  'honoursProgramme' | 'postgraduateProgramme' | 'subjects'
>;

export interface StudentProgrammeField {
  label: 'Honours Programme' | 'Postgraduate Programme';
  value: string;
}

export function getStudentProgrammeField(
  student: StudentAcademicDetails
): StudentProgrammeField | undefined {
  if (student.postgraduateProgramme) {
    return {
      label: 'Postgraduate Programme',
      value: getPostgraduateProgrammeLabel(student.postgraduateProgramme),
    };
  }

  if (student.honoursProgramme) {
    return {
      label: 'Honours Programme',
      value: getHonoursProgrammeLabel(student.honoursProgramme),
    };
  }

  return undefined;
}

export function getStudentSubjectLabels(
  student: StudentAcademicDetails
): string[] {
  return student.subjects?.map(getAcademicSubjectLabel) ?? [];
}
