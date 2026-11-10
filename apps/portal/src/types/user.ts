import type {
  AccessLevel,
  AppRole,
  Page,
  ProfilePictureMode,
} from '@scs/schemas';

export type { ProfilePictureMode };

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
  blacklisted: boolean;
  createdAt?: number;
  googleOAuth?: boolean;
  githubOAuth?: boolean;
}

export type AdminUserPageResponse = Page<AdminUserData>;

export interface CurrentUserProfile {
  email: string;
  name: string;
  picture: string;
  pictureMode?: ProfilePictureMode | null;
  gravatarMail?: string | null;
  googleOAuth?: boolean;
  githubOAuth?: boolean;
  githubUserID?: number | null;
}
