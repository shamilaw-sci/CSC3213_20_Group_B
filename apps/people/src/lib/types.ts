import {
  type AcademicDepartmentCode,
  AcademicRankSchema,
  type AcademicSubjectCode,
  AcademicSupportPositionSchema,
  type AcademicUnitCode,
  type HonoursProgrammeCode as HonoursProgramme,
  NonAcademicPositionSchema,
  type PostgraduateProgramme,
  ScienceAcademicDepartments,
  ScienceAcademicSubjects,
  ScienceAcademicUnits,
  type SlqfLevel,
  type Staff,
  type Student,
} from '@scs/schemas';

export type StudentLevel = Student['level'];
function formatDomainValue(value: string): string {
  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function createLabels<T extends string>(
  values: readonly T[]
): Record<T, string> {
  return Object.fromEntries(
    values.map((value) => [value, formatDomainValue(value)])
  ) as Record<T, string>;
}

export const ACADEMIC_RANK_LABELS = createLabels(AcademicRankSchema.options);
export const ACADEMIC_SUPPORT_POSITION_LABELS = createLabels(
  AcademicSupportPositionSchema.options
);
export const NON_ACADEMIC_POSITION_LABELS = createLabels(
  NonAcademicPositionSchema.options
);
const ACADEMIC_SUBJECT_LABELS = Object.fromEntries(
  ScienceAcademicSubjects.map((subject) => [subject.code, subject.name])
) as Partial<Record<AcademicSubjectCode, string>>;
const ACADEMIC_DEPARTMENT_LABELS = Object.fromEntries(
  ScienceAcademicDepartments.map((department) => [
    department.code,
    department.name,
  ])
) as Partial<Record<AcademicDepartmentCode, string>>;
const ACADEMIC_UNIT_LABELS = Object.fromEntries(
  ScienceAcademicUnits.map((unit) => [unit.code, unit.name])
) as Partial<Record<AcademicUnitCode, string>>;
const STUDENT_LEVEL_LABELS = {
  '1000': '1000 Level',
  '2000': '2000 Level',
  '3000': '3000 Level',
  '4000': '4000 Level',
} satisfies Record<NonNullable<StudentLevel>, string>;
const POSTGRADUATE_PROGRAMME_LABELS = {
  POSTGRADUATE_CERTIFICATE: 'Postgraduate Certificate',
  POSTGRADUATE_DIPLOMA: 'Postgraduate Diploma',
  MASTERS_COURSEWORK: 'Masters by Coursework',
  MSC: 'MSc',
  MPHIL: 'MPhil',
  MPHIL_UPGRADE_FROM_MSC: 'MPhil Upgrade from MSc',
  PHD: 'PhD',
  PHD_UPGRADE_FROM_MSC: 'PhD Upgrade from MSc',
  PHD_UPGRADE_FROM_MPHIL: 'PhD Upgrade from MPhil',
} satisfies Record<PostgraduateProgramme, string>;
const STAFF_TYPE_LABELS = {
  ACADEMIC_TEACHING: 'Academic Teaching Staff',
  ACADEMIC_SUPPORT: 'Academic Support Staff',
  NON_ACADEMIC: 'Non-Academic Staff',
} satisfies Record<Staff['staffType'], string>;

export function getStaffTypeLabel(staffType: Staff['staffType']): string {
  return STAFF_TYPE_LABELS[staffType];
}

export function getStudentRoleLabel(student: Student) {
  if (student.status === 'ALUMNI') return 'Alumni';
  if (student.studentType === 'POSTGRADUATE') return 'Postgraduate';
  if (student.studentTrack === 'HONOURS') return 'Honours Undergraduate';
  return 'General Undergraduate';
}

export function getStudentLevelLabel(level: StudentLevel) {
  return level ? STUDENT_LEVEL_LABELS[level] : undefined;
}

export function getAcademicSubjectLabel(subject: AcademicSubjectCode): string {
  return ACADEMIC_SUBJECT_LABELS[subject] ?? formatDomainValue(subject);
}

export function getHonoursProgrammeLabel(programme: HonoursProgramme): string {
  return formatDomainValue(programme);
}

export function getPostgraduateProgrammeLabel(
  programme: PostgraduateProgramme
): string {
  return POSTGRADUATE_PROGRAMME_LABELS[programme];
}

export function getSlqfLevelLabel(level: SlqfLevel): string {
  return `SLQF Level ${level.replace(/^L/, '')}`;
}

export function getAcademicDepartmentLabel(
  department: AcademicDepartmentCode
): string {
  return (
    ACADEMIC_DEPARTMENT_LABELS[department] ?? formatDomainValue(department)
  );
}

export function getAcademicUnitLabel(unit: AcademicUnitCode): string {
  return ACADEMIC_UNIT_LABELS[unit] ?? formatDomainValue(unit);
}
