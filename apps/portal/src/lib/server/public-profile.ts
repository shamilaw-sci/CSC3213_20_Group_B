import 'server-only';

import type {
  PublicProfilePr,
  PublicProfileResponse,
  PublicProfileSchemaResponse,
} from '@scs/schemas';

import type {
  ProfileRecord,
  PublicProfileInitialData,
} from '@/components/profiles/profile-types';
import {
  adminPublicProfileApiUrl,
  adminPublicProfilePrApiUrl,
  adminPublicProfileSchemaApiUrl,
  publicProfileApiUrl,
  publicProfilePrApiUrl,
  publicProfileSchemaApiUrl,
} from '@/lib/api';
import { serverApiJson, serverApiJsonOrNull } from '@/lib/server/api-client';

function normalizePublicProfileResponse(
  value: ProfileRecord | PublicProfileResponse | null
): PublicProfileResponse {
  if (value && 'profile' in value) return value as PublicProfileResponse;

  return {
    profile: value,
  };
}

export async function loadPublicProfileEditorData(
  targetEmail?: string
): Promise<PublicProfileInitialData> {
  const schemaUrl = targetEmail
    ? adminPublicProfileSchemaApiUrl(targetEmail)
    : publicProfileSchemaApiUrl();
  const profileUrl = targetEmail
    ? adminPublicProfileApiUrl(targetEmail)
    : publicProfileApiUrl();
  const prUrl = targetEmail
    ? adminPublicProfilePrApiUrl(targetEmail)
    : publicProfilePrApiUrl();

  const [schema, profile, pr] = await Promise.all([
    serverApiJson<PublicProfileSchemaResponse>(schemaUrl),
    serverApiJsonOrNull<ProfileRecord | PublicProfileResponse>(profileUrl),
    serverApiJson<PublicProfilePr>(prUrl),
  ]);

  return {
    schema,
    profile: normalizePublicProfileResponse(profile),
    pr,
  };
}
