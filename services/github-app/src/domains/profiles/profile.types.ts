import type {
  AcademicSupportStaff,
  AcademicTeachingStaff,
  NonAcademicStaff,
  PublicProfileKind as ProfileKind,
  Student,
} from '@scs/schemas';

export type { ProfileKind };

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
