import type {
  AcademicDepartmentCode,
  AccessLevel,
  AppRole,
  ProfilePictureMode,
} from '@scs/schemas';

export interface AdminUserData {
  id: string;
  email: string;
  name: string;
  picture: string;
  pictureMode?: ProfilePictureMode | null;
  gravatarMail?: string | null;
  githubUserID?: number | null;
  role: AppRole;
  accessLevel: AccessLevel;
  honoursDepartments?: AcademicDepartmentCode[];
  blacklisted: boolean;
  createdAt?: number;
  googleOAuth?: boolean;
  githubOAuth?: boolean;
}

export interface CurrentUserProfile {
  email: string;
  name?: string;
  picture?: string;
  pictureMode?: ProfilePictureMode | null;
  gravatarMail?: string | null;
  googleOAuth?: boolean;
  githubOAuth?: boolean;
  githubUserID?: number | null;
}
