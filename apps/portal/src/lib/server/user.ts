import 'server-only';

import {
  AdminUserDetailResponseSchema,
  CurrentUserResponseSchema,
} from '@scs/schemas';
import { notFound } from 'next/navigation';

import { adminUserApiUrl, meApiUrl } from '@/lib/api';
import { serverApiJson, serverApiJsonOrNull } from '@/lib/server/api-client';
import type { AdminUserData, CurrentUserProfile } from '@/types/user';

export async function loadAdminUser(email: string): Promise<AdminUserData> {
  const data = await serverApiJsonOrNull(
    adminUserApiUrl(email),
    AdminUserDetailResponseSchema
  );
  if (!data) notFound();

  return {
    ...data,
    id: data.id ?? email,
    email: data.email ?? email,
    name: data.name ?? '',
    picture: data.picture ?? '',
    googleOAuth: data.googleOAuth ?? false,
    githubOAuth: data.githubOAuth ?? false,
    githubUserID: data.githubUserID ?? null,
    blacklisted: data.blacklisted ?? false,
  };
}

export function loadCurrentUserProfile(): Promise<CurrentUserProfile> {
  return serverApiJson(meApiUrl(), CurrentUserResponseSchema);
}
