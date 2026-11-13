export { type HonoursSelection, parseHonoursSelection } from '#identity/ranges';

import {
  type AcademicDepartmentCode,
  AcademicSubjectDepartmentMap,
  APP_ROLE,
  type AppRole,
  AppRoleSchema,
  type HonoursProgrammeCode,
  HonoursProgrammeDepartmentMap,
  type IdentityReviewStatus,
  IdentityReviewStatusSchema,
  type Student,
} from '@scs/schemas';

export function canManageStudentHonours(input: {
  departments: readonly AcademicDepartmentCode[];
  programme: HonoursProgrammeCode;
  student: Pick<Student, 'subjects' | 'honoursProgramme'>;
}): boolean {
  const targetDepartment = HonoursProgrammeDepartmentMap[input.programme];
  if (!input.departments.includes(targetDepartment)) return false;
  if (input.student.honoursProgramme) {
    return input.departments.includes(
      HonoursProgrammeDepartmentMap[input.student.honoursProgramme]
    );
  }
  return (
    input.student.subjects?.some((subject) =>
      AcademicSubjectDepartmentMap[subject].some(
        (department) => department === targetDepartment
      )
    ) ?? false
  );
}

export interface StudentIdentifier {
  batch: string;
  index: number;
  permanent: boolean;
  registrationNo: string;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function parseStudentIdentifier(
  email: string
): StudentIdentifier | null {
  const match = /^s(\d{2})(sp)?(\d{3})@sci\.pdn\.ac\.lk$/i.exec(
    normalizeEmail(email)
  );
  if (!match) return null;
  return {
    batch: `s${match[1]}`,
    index: Number(match[3]),
    permanent: Boolean(match[2]),
    registrationNo: `S${match[1]}${match[2] ? 'SP' : ''}${match[3]}`,
  };
}

export function defaultRoleForEmail(email: string): AppRole {
  return parseStudentIdentifier(email) ? APP_ROLE.STUDENT : APP_ROLE.OTHER;
}

export function validateRoleAssignment(email: string, role: unknown): AppRole {
  const parsed = AppRoleSchema.parse(role);
  if (parseStudentIdentifier(email) && parsed !== APP_ROLE.STUDENT) {
    throw new Error('Student-pattern accounts must retain the STUDENT role');
  }
  return parsed;
}

export type ReviewStatus = IdentityReviewStatus;

export function normalizeReviewStatus(value: unknown): ReviewStatus {
  const parsed = IdentityReviewStatusSchema.safeParse(value);
  return parsed.success ? parsed.data : 'PENDING';
}

export function resolveRole(input: {
  email: string;
  currentRole?: AppRole;
  approvedMapping?: AppRole | null;
}): {
  role: AppRole;
  source: 'STUDENT_PATTERN' | 'APPROVED_MAPPING' | 'EXISTING' | 'DEFAULT';
} {
  if (parseStudentIdentifier(input.email)) {
    return { role: APP_ROLE.STUDENT, source: 'STUDENT_PATTERN' };
  }
  if (input.approvedMapping) {
    return { role: input.approvedMapping, source: 'APPROVED_MAPPING' };
  }
  if (input.currentRole) {
    return { role: input.currentRole, source: 'EXISTING' };
  }
  return { role: APP_ROLE.OTHER, source: 'DEFAULT' };
}

export type IdentitySuggestion =
  | { kind: 'suggested'; role: AppRole; confidence: number }
  | {
      kind:
        | 'insufficient_evidence'
        | 'conflicting_evidence'
        | 'unsupported_classification';
    };

export function interpretJevSuggestion(value: unknown): IdentitySuggestion {
  if (!value || typeof value !== 'object' || !('choice' in value)) {
    return { kind: 'unsupported_classification' };
  }
  const answer = value as { choice: unknown; confidence?: unknown };
  if (answer.choice === 'insufficient')
    return { kind: 'insufficient_evidence' };
  if (answer.choice === 'conflicting') return { kind: 'conflicting_evidence' };
  const parsed = AppRoleSchema.safeParse(answer.choice);
  if (
    !parsed.success ||
    !['ACADEMIC', 'NON_ACADEMIC', 'ACADEMIC_SUPPORT'].includes(parsed.data) ||
    typeof answer.confidence !== 'number' ||
    !Number.isFinite(answer.confidence) ||
    answer.confidence < 0 ||
    answer.confidence > 1
  ) {
    return { kind: 'unsupported_classification' };
  }
  return {
    kind: 'suggested',
    role: parsed.data,
    confidence: answer.confidence,
  };
}
