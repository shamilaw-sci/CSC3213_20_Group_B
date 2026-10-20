import type {
  AcademicSupportStaff,
  AcademicTeachingStaff,
  NonAcademicStaff,
  Student,
} from '@scs/schemas';

export type ProfileKind =
  'academic' | 'academic-support' | 'non-academic' | 'student';

type ProfileByKind = {
  academic: AcademicTeachingStaff;
  'academic-support': AcademicSupportStaff;
  'non-academic': NonAcademicStaff;
  student: Student;
};

export type PublicProfile = ProfileByKind[ProfileKind];

export interface ProfileDraftRequest {
  username: string;
  updatedBy: string;
  updatedByType?: 'self' | 'admin';
  profileKind: ProfileKind;
  userPath: string;
  aggregatePaths: string[];
  expectedRevision?: string;
  profile: PublicProfile;
}

export interface ProfileOperationPayload {
  request: ProfileDraftRequest;
}
