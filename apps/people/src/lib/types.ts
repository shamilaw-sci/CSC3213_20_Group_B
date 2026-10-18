import {
  type AcademicDepartmentCode,
  type AcademicRank,
  AcademicRankSchema,
  type AcademicSubjectCode,
  type AcademicSupportPosition,
  AcademicSupportPositionSchema,
  type AcademicSupportStaff,
  type AcademicTeachingStaff,
  type AcademicUnitCode,
  type Conference,
  type NonAcademicPosition,
  NonAcademicPositionSchema,
  type NonAcademicStaff,
  type Person,
  type Publication,
  type Research,
  ScienceAcademicDepartments,
  ScienceAcademicSubjects,
  ScienceAcademicUnits,
  type SocialIcon,
  type SocialLinks,
  type Staff,
  type Student,
} from '@scs/schemas';

export type {
  AcademicDepartmentCode,
  AcademicRank,
  AcademicSubjectCode,
  AcademicSupportPosition,
  AcademicSupportStaff,
  AcademicTeachingStaff,
  AcademicUnitCode,
  Conference,
  NonAcademicPosition,
  NonAcademicStaff,
  Person,
  Publication,
  Research,
  SocialIcon,
  SocialLinks,
  Staff,
  Student,
};

export type Title = Person['title'];
export type StudentLevel = Student['level'];
export type StudentStatus = Student['status'];
export type StudentTrack = Student['studentTrack'];
export type StudentType = Student['studentType'];
export type HonoursProgramme = NonNullable<Student['honoursProgramme']>;
export type PostgraduateProgramme = NonNullable<
  Student['postgraduateProgramme']
>;
export type SlqfLevel = NonNullable<Student['slqfLevel']>;
export type Position = NonNullable<Student['positions']>[number];
export type Qualification = NonNullable<
  AcademicTeachingStaff['qualifications']
>[number];
export type Award = NonNullable<AcademicTeachingStaff['awards']>[number];

export function formatDomainValue(value: string): string {
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
export const ACADEMIC_SUBJECT_LABELS = Object.fromEntries(
  ScienceAcademicSubjects.map((subject) => [subject.code, subject.name])
) as Partial<Record<AcademicSubjectCode, string>>;
export const ACADEMIC_DEPARTMENT_LABELS = Object.fromEntries(
  ScienceAcademicDepartments.map((department) => [
    department.code,
    department.name,
  ])
) as Partial<Record<AcademicDepartmentCode, string>>;
export const ACADEMIC_UNIT_LABELS = Object.fromEntries(
  ScienceAcademicUnits.map((unit) => [unit.code, unit.name])
) as Partial<Record<AcademicUnitCode, string>>;
export const STUDENT_LEVEL_LABELS = {
  '1000': '1000 Level',
  '2000': '2000 Level',
  '3000': '3000 Level',
  '4000': '4000 Level',
} satisfies Record<NonNullable<StudentLevel>, string>;
export const POSTGRADUATE_PROGRAMME_LABELS = {
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
