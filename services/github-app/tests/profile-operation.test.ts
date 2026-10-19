import { describe, expect, test } from 'bun:test';

import {
  createProfileOperationCommand,
  createProfileOperationHandler,
} from '@/domains/profiles/profile.operation';
import type { ProfileDraftRepository } from '@/domains/profiles/profile.repository';
import { ProfileRevisionConflictError } from '@/domains/profiles/profile.repository';
import type { ProfileDraftRequest } from '@/domains/profiles/profile.types';
import { InMemoryOperationStore } from '@/operations/in-memory-operation.store';
import { InMemoryMutationCoordinator } from '@/operations/mutation-coordinator';
import { OperationExecutor } from '@/operations/operation.executor';

const request = {
  username: 's21513',
  updatedBy: 'student@pdn.ac.lk',
  updatedByType: 'self' as const,
  profileKind: 'student' as const,
  userPath: 'public/people/v2/users/s21513.json',
  aggregatePaths: ['public/people/v2/students/s21.json'],
  expectedRevision: 'old-user-blob',
  profile: {
    title: 'Ms',
    fullName: 'Jane Student',
    registrationNo: 'S21513',
    studentType: 'UNDERGRADUATE',
    studentTrack: 'GENERAL',
    level: '3000',
    status: 'CURRENT',
  },
} satisfies ProfileDraftRequest;

describe('profile operations', () => {
  test('uses the profile identity as its serialized resource', () => {
    const command = createProfileOperationCommand({
      request,
      actorSubjectId: 'user_1234567890123456',
      idempotencyKey: 'request-key-00000001',
      correlationId: 'correlation-0001',
    });

    expect(command).toMatchObject({
      action: 'profile.upsert',
      resource: { type: 'profile', id: 's21513' },
      actor: { type: 'user', subjectId: 'user_1234567890123456' },
    });
  });

  test('executes a duplicate submission once and returns the user blob revision', async () => {
    let writes = 0;
    const repository: ProfileDraftRepository = {
      saveDraft: () => {
        writes += 1;
        return Promise.resolve({
          revision: 'new-user-blob',
          pullRequest: { number: 42, url: 'https://github.test/pull/42' },
        });
      },
    };
    const handlers = {
      'profile.upsert': createProfileOperationHandler(repository),
    };
    const executor = new OperationExecutor({
      store: new InMemoryOperationStore(),
      coordinator: new InMemoryMutationCoordinator(),
      handlers,
      log: () => {},
    });
    const command = createProfileOperationCommand({
      request,
      actorSubjectId: 'user_1234567890123456',
      idempotencyKey: 'request-key-00000001',
      correlationId: 'correlation-0001',
    });
    const [first, duplicate] = await Promise.all([
      executor.submit(command),
      executor.submit(command),
    ]);

    expect(duplicate.operationId).toBe(first.operationId);
    const completed = await executor.execute(first.operationId);
    expect(completed.outcome).toEqual({
      status: 'succeeded',
      revision: 'new-user-blob',
      pullRequest: { number: 42, url: 'https://github.test/pull/42' },
    });
    expect(writes).toBe(1);
  });

  test('returns explicit profile revisions when the authoritative blob changed', async () => {
    const executor = new OperationExecutor({
      store: new InMemoryOperationStore(),
      coordinator: new InMemoryMutationCoordinator(),
      handlers: {
        'profile.upsert': createProfileOperationHandler({
          saveDraft: () =>
            Promise.reject(
              new ProfileRevisionConflictError(
                'old-user-blob',
                'current-user-blob'
              )
            ),
        }),
      },
      classifyError: () => ({
        category: 'compare_conflict',
        retryable: false,
      }),
      log: () => {},
    });
    const operation = await executor.submit(
      createProfileOperationCommand({
        request,
        actorSubjectId: 'user_1234567890123456',
        idempotencyKey: 'request-key-00000002',
        correlationId: 'correlation-0002',
      })
    );

    expect((await executor.execute(operation.operationId)).outcome).toEqual({
      status: 'conflicted',
      error: {
        code: 'repository_conflict',
        message: 'The repository changed; refresh and retry',
        correlationId: 'correlation-0002',
        conflict: {
          resourceType: 'profile',
          resourceId: 's21513',
          expectedRevision: 'old-user-blob',
          actualRevision: 'current-user-blob',
        },
      },
    });
  });
});
