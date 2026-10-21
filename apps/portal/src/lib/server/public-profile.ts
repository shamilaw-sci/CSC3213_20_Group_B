import 'server-only';

import type {
  ProfileRecord,
  ProfileSchemaResponse,
  PublicProfileInitialData,
  PublicProfilePr,
  PublicProfileResponse,
} from '@/components/custom/public-profile-page/PublicProfilePage';
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
    serverApiJson<ProfileSchemaResponse>(schemaUrl),
    serverApiJsonOrNull<ProfileRecord | PublicProfileResponse>(profileUrl),
    serverApiJson<PublicProfilePr>(prUrl),
  ]);

  return {
    schema,
    profile: normalizePublicProfileResponse(profile),
    pr,
  };
}
