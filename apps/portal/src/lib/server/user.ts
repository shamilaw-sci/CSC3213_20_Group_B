import 'server-only';

import { notFound } from 'next/navigation';

import { adminUserApiUrl, meApiUrl } from '@/lib/api';
import { serverApiJson, serverApiJsonOrNull } from '@/lib/server/api-client';
import type { AdminUserData, CurrentUserProfile } from '@/types/user';

type AdminUserResponse = Partial<AdminUserData>;

export async function loadAdminUser(email: string): Promise<AdminUserData> {
  const data = await serverApiJsonOrNull<AdminUserResponse>(
    adminUserApiUrl(email)
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
  } as AdminUserData;
}

export function loadCurrentUserProfile(): Promise<CurrentUserProfile> {
  return serverApiJson<CurrentUserProfile>(meApiUrl());
}
