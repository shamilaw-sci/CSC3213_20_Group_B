import {
  AcademicSupportStaffSchema,
  AcademicTeachingStaffSchema,
  NonAcademicStaffSchema,
  PublicProfileKindSchema,
  StudentSchema,
} from '@scs/schemas';
import { z } from 'zod';

import type { ProfileDraftRepository } from '@/domains/profiles/profile.repository';
import type {
  ProfileDraftRequest,
  ProfileOperationPayload,
  PublicProfile,
} from '@/domains/profiles/profile.types';
import type {
  OperationCommand,
  OperationHandler,
} from '@/operations/operation.types';

export const PROFILE_UPSERT_ACTION = 'profile.upsert';

const ProfileOperationPayloadSchema = z.object({
  request: z
    .object({
      username: z.string(),
      updatedBy: z.string(),
      updatedByType: z.enum(['self', 'admin']).optional(),
      profileKind: PublicProfileKindSchema,
      userPath: z.string(),
      aggregatePaths: z.array(z.string()),
      expectedRevision: z.string().optional(),
      // Validate the known profile contract without stripping legacy student fields.
      profile: z.custom<PublicProfile>(
        (value) =>
          AcademicTeachingStaffSchema.safeParse(value).success ||
          AcademicSupportStaffSchema.safeParse(value).success ||
          NonAcademicStaffSchema.safeParse(value).success ||
          StudentSchema.safeParse(value).success
      ),
    })
    .refine(
      ({ profileKind, profile }) => {
        switch (profileKind) {
          case 'academic':
            return AcademicTeachingStaffSchema.safeParse(profile).success;
          case 'academic-support':
            return AcademicSupportStaffSchema.safeParse(profile).success;
          case 'non-academic':
            return NonAcademicStaffSchema.safeParse(profile).success;
          case 'student':
            return StudentSchema.safeParse(profile).success;
        }
      },
      { message: 'Profile kind does not match the submitted profile' }
    ),
});

export function createProfileOperationCommand(input: {
  request: ProfileDraftRequest;
  actorSubjectId: string;
  idempotencyKey: string;
  correlationId: string;
}): OperationCommand<ProfileOperationPayload> {
  return {
    idempotencyKey: input.idempotencyKey,
    actor: { type: 'user', subjectId: input.actorSubjectId },
    resource: { type: 'profile', id: input.request.username },
    action: PROFILE_UPSERT_ACTION,
    payload: { request: input.request },
    correlationId: input.correlationId,
  };
}

export function createProfileOperationHandler(
  repository: ProfileDraftRepository
): OperationHandler {
  return async (command, operation) => {
    const payload = ProfileOperationPayloadSchema.parse(command.payload);
    const result = await repository.saveDraft(payload.request, {
      operationId: operation.operationId,
    });
    return {
      status: 'succeeded',
      revision: result.revision,
      pullRequest: result.pullRequest,
    };
  };
}
