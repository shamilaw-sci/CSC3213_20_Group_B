import { describe, expect, test } from 'bun:test';

import {
  createAcademicOperationCommand,
  createAcademicOperationHandlers,
  type AcademicOperationRequest,
} from '@/domains/academics/academic.operation';
import type { AcademicDraftRepository } from '@/domains/academics/academic.repository';
import { AcademicRevisionConflictError } from '@/domains/academics/academic.repository';
import { InMemoryOperationStore } from '@/operations/in-memory-operation.store';
import { InMemoryMutationCoordinator } from '@/operations/mutation-coordinator';
import { OperationExecutor } from '@/operations/operation.executor';

const request = {
  action: 'upsert',
  kind: 'course',
  id: 'co321',
  updatedBy: 'academic@pdn.ac.lk',
  recordPath: 'public/academic/v2/courses/co321.json',
  expectedRevision: 'old-course-blob',
  record: { id: 'co321', title: 'Software Engineering' },
} satisfies AcademicOperationRequest;

describe('academic operations', () => {
  test('uses the course or offering identity as its serialized resource', () => {
    const course = createAcademicOperationCommand({
      request,
      actorSubjectId: 'user_1234567890123456',
      idempotencyKey: 'request-key-00000001',
      correlationId: 'correlation-0001',
    });
    const offering = createAcademicOperationCommand({
      request: {
        ...request,
        kind: 'offering',
        id: 'co321-2026',
        recordPath: 'public/academic/v2/offerings/co321-2026.json',
      },
      actorSubjectId: 'user_1234567890123456',
      idempotencyKey: 'request-key-00000002',
      correlationId: 'correlation-0002',
    });

    expect(course.resource).toEqual({ type: 'course', id: 'co321' });
    expect(offering.resource).toEqual({
      type: 'offering',
      id: 'co321-2026',
    });
  });

  test('executes a duplicate academic submission once', async () => {
    let writes = 0;
    const repository: AcademicDraftRepository = {
      saveDraft: () => {
        writes += 1;
        return Promise.resolve({
          revision: 'new-course-blob',
          pullRequest: { number: 21, url: 'https://github.test/pull/21' },
        });
      },
    };
    const executor = new OperationExecutor({
      store: new InMemoryOperationStore(),
      coordinator: new InMemoryMutationCoordinator(),
      handlers: createAcademicOperationHandlers(repository),
      log: () => {},
    });
    const command = createAcademicOperationCommand({
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
    expect((await executor.execute(first.operationId)).outcome).toEqual({
      status: 'succeeded',
      revision: 'new-course-blob',
      pullRequest: { number: 21, url: 'https://github.test/pull/21' },
    });
    expect(writes).toBe(1);
  });

  test('reports authoritative academic record conflicts', async () => {
    const executor = new OperationExecutor({
      store: new InMemoryOperationStore(),
      coordinator: new InMemoryMutationCoordinator(),
      handlers: createAcademicOperationHandlers({
        saveDraft: () =>
          Promise.reject(
            new AcademicRevisionConflictError(
              'old-course-blob',
              'current-course-blob'
            )
          ),
      }),
      classifyError: () => ({
        category: 'compare_conflict',
        retryable: false,
      }),
      log: () => {},
    });
    const operation = await executor.submit(
      createAcademicOperationCommand({
        request,
        actorSubjectId: 'user_1234567890123456',
        idempotencyKey: 'request-key-00000003',
        correlationId: 'correlation-0003',
      })
    );

    expect((await executor.execute(operation.operationId)).outcome).toEqual({
      status: 'conflicted',
      error: {
        code: 'repository_conflict',
        message: 'The repository changed; refresh and retry',
        correlationId: 'correlation-0003',
        conflict: {
          resourceType: 'course',
          resourceId: 'co321',
          expectedRevision: 'old-course-blob',
          actualRevision: 'current-course-blob',
        },
      },
    });
  });
});
