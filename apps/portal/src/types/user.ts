import { AccessLevel, AppRole } from '@/types/role';

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

export type ProfilePictureMode = 'google' | 'github' | 'manual' | 'gravatar';
