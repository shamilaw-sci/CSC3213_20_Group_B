import type { OperationHandler } from '@/operations/operation.types';
import {
  createHonoursBulkHandler,
  HONOURS_BULK_ACTION,
} from '@/domains/honours/honours.operation';
import { createHonoursBulkRepository } from '@/domains/honours/honours.repository';
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
    [HONOURS_BULK_ACTION]: createHonoursBulkHandler(
      createHonoursBulkRepository()
    ),
  };
}
