import type { Student } from '@scs/schemas';

export type ProfileKind =
  'academic' | 'academic-support' | 'non-academic' | 'student';

export type ProfileRecord = Record<string, unknown>;

export type PostgraduateProgramme =
  | 'POSTGRADUATE_CERTIFICATE'
  | 'POSTGRADUATE_DIPLOMA'
  | 'MASTERS_COURSEWORK'
  | 'MSC'
  | 'MPHIL'
  | 'MPHIL_UPGRADE_FROM_MSC'
  | 'PHD'
  | 'PHD_UPGRADE_FROM_MSC'
  | 'PHD_UPGRADE_FROM_MPHIL';

type SlqfLevel = 'L7' | 'L8' | 'L9' | 'L10' | 'L11' | 'L12';

export interface StudentPlacementResponse {
  level?: Student['level'];
  lockedFields: string[];
  postgraduateProgramme?: PostgraduateProgramme;
  registrationNo: string;
  slqfLevel?: SlqfLevel;
  status: Student['status'];
  studentTrack?: Student['studentTrack'];
  studentType: 'UNDERGRADUATE' | 'POSTGRADUATE';
}

export interface ProfileSchemaResponse {
  allowedKinds: ProfileKind[];
  identity?: {
    email: string;
    studentPlacement?: StudentPlacementResponse;
    username: string;
  };
  lockedFields?: string[];
  note: string;
}

export interface PublicProfilePr {
  branch?: string;
  canEdit: boolean;
  currentUserFileSha?: string | null;
  draftProfile?: ProfileRecord | null;
  headSha?: string;
  number?: number;
  profileKind?: ProfileKind;
  revision?: string;
  status:
    | 'none'
    | 'open'
    | 'merged'
    | 'closed'
    | 'checks_pending'
    | 'checks_failed'
    | 'auto_merge_queued';
  targetAggregateFiles?: string[];
  targetUserFile?: string;
  updatedAt?: string;
  url?: string;
}

export interface PublicProfileResponse {
  profile: ProfileRecord | null;
  profileKind?: ProfileKind;
  targetAggregateFiles?: string[];
  targetUserFile?: string;
}

export interface PublicProfileInitialData {
  pr: PublicProfilePr;
  profile: PublicProfileResponse;
  schema: ProfileSchemaResponse;
}
