import type {
  PublicProfilePr,
  PublicProfileResponse,
  PublicProfileSchemaResponse,
} from '@scs/schemas';

export type ProfileRecord = Record<string, unknown>;

/** Page-composition data assembled by the Portal server component. */
export interface PublicProfileInitialData {
  pr: PublicProfilePr;
  profile: PublicProfileResponse;
  schema: PublicProfileSchemaResponse;
}
