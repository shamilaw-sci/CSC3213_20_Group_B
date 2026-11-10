import type { OperationHandler } from '@/operations/operation.types';
import {
  createProfileOperationHandler,
  PROFILE_UPSERT_ACTION,
} from '@/domains/profiles/profile.operation';
import { createProfileDraftRepository } from '@/domains/profiles/profile.repository';
import { createProjectOperationHandlers } from '@/domains/projects/project.operation';
import { createProjectDraftRepository } from '@/domains/projects/project.repository';
import { createAcademicOperationHandlers } from '@/domains/academics/academic.operation';
import { createAcademicDraftRepository } from '@/domains/academics/academic.repository';

export function operationHandlers(): Record<string, OperationHandler> {
  return {
    ...createAcademicOperationHandlers(createAcademicDraftRepository()),
    ...createProjectOperationHandlers(createProjectDraftRepository()),
    [PROFILE_UPSERT_ACTION]: createProfileOperationHandler(
      createProfileDraftRepository()
    ),
  };
}
