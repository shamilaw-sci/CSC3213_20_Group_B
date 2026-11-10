import 'server-only';

import {
  PublicProfilePrSchema,
  PublicProfileSchemaResponseSchema,
} from '@scs/schemas';

import type { PublicProfileInitialData } from '@/components/profiles/profile-types';
import { normalizePublicProfileResponse } from '@/components/profiles/profile-types';
import {
  adminPublicProfileApiUrl,
  adminPublicProfilePrApiUrl,
  adminPublicProfileSchemaApiUrl,
  publicProfileApiUrl,
  publicProfilePrApiUrl,
  publicProfileSchemaApiUrl,
} from '@/lib/api';
import { serverApiJson, serverApiJsonOrNull } from '@/lib/server/api-client';

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
    serverApiJson(schemaUrl, PublicProfileSchemaResponseSchema),
    serverApiJsonOrNull(profileUrl),
    serverApiJson(prUrl, PublicProfilePrSchema),
  ]);

  return {
    schema,
    profile: normalizePublicProfileResponse(profile),
    pr,
  };
}
