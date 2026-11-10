import {
  type PublicProfilePr,
  type PublicProfileResponse,
  PublicProfileResponseSchema,
  type PublicProfileSchemaResponse,
} from '@scs/schemas';

export type ProfileRecord = Record<string, unknown>;

function isRecord(value: unknown): value is ProfileRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** Accept the legacy bare profile response at the HTTP boundary. */
export function normalizePublicProfileResponse(
  value: unknown
): PublicProfileResponse {
  if (isRecord(value)) {
    if ('profile' in value) return PublicProfileResponseSchema.parse(value);
    return { profile: value };
  }
  return { profile: null };
}

/** Page-composition data assembled by the Portal server component. */
export interface PublicProfileInitialData {
  pr: PublicProfilePr;
  profile: PublicProfileResponse;
  schema: PublicProfileSchemaResponse;
}
