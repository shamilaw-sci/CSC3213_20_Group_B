import type {
  AcademicSupportStaff,
  AcademicTeachingStaff,
  NonAcademicStaff,
  PublicProfileKind,
  Student,
} from '@scs/schemas';

type ProfileByKind = {
  academic: AcademicTeachingStaff;
  'academic-support': AcademicSupportStaff;
  'non-academic': NonAcademicStaff;
  student: Student;
};

export type PublicProfile = ProfileByKind[PublicProfileKind];

export interface ProfileDraftRequest {
  username: string;
  updatedBy: string;
  updatedByType?: 'self' | 'admin';
  profileKind: PublicProfileKind;
  userPath: string;
  aggregatePaths: string[];
  expectedRevision?: string;
  profile: PublicProfile;
}

export interface ProfileOperationPayload {
  request: ProfileDraftRequest;
}
