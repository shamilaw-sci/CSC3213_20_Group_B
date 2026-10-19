import { describe, expect, test } from 'bun:test';

import {
  createProjectOperationCommand,
  createProjectOperationHandlers,
  type ProjectOperationRequest,
} from '@/domains/projects/project.operation';
import type { ProjectDraftRepository } from '@/domains/projects/project.repository';
import { ProjectRevisionConflictError } from '@/domains/projects/project.repository';
import { InMemoryOperationStore } from '@/operations/in-memory-operation.store';
import { InMemoryMutationCoordinator } from '@/operations/mutation-coordinator';
import { OperationExecutor } from '@/operations/operation.executor';

const request = {
  action: 'upsert',
  slug: 'example-project',
  updatedBy: 'owner@pdn.ac.lk',
  projectPath: 'public/projects/v2/projects/example-project.json',
  expectedRevision: 'old-project-blob',
  project: { id: 'project-1', slug: 'example-project', title: 'Example' },
} satisfies ProjectOperationRequest;

describe('project operations', () => {
  test('serializes only mutations for the same project slug', () => {
    const command = createProjectOperationCommand({
      request,
      actorSubjectId: 'user_1234567890123456',
      idempotencyKey: 'request-key-00000001',
      correlationId: 'correlation-0001',
    });

    expect(command).toMatchObject({
      action: 'project.upsert',
      resource: { type: 'project', id: 'example-project' },
    });
    expect(
      createProjectOperationCommand({
        request: { ...request, slug: 'another-project' },
        actorSubjectId: 'user_1234567890123456',
        idempotencyKey: 'request-key-00000002',
        correlationId: 'correlation-0002',
      }).resource
    ).toEqual({ type: 'project', id: 'another-project' });
  });

  test('executes duplicate project submissions once', async () => {
    let writes = 0;
    const repository: ProjectDraftRepository = {
      saveDraft: () => {
        writes += 1;
        return Promise.resolve({
          revision: 'new-project-blob',
          pullRequest: { number: 12, url: 'https://github.test/pull/12' },
        });
      },
    };
    const executor = new OperationExecutor({
      store: new InMemoryOperationStore(),
      coordinator: new InMemoryMutationCoordinator(),
      handlers: createProjectOperationHandlers(repository),
      log: () => {},
    });
    const command = createProjectOperationCommand({
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
      revision: 'new-project-blob',
      pullRequest: { number: 12, url: 'https://github.test/pull/12' },
    });
    expect(writes).toBe(1);
  });

  test('reports authoritative project blob conflicts', async () => {
    const executor = new OperationExecutor({
      store: new InMemoryOperationStore(),
      coordinator: new InMemoryMutationCoordinator(),
      handlers: createProjectOperationHandlers({
        saveDraft: () =>
          Promise.reject(
            new ProjectRevisionConflictError(
              'old-project-blob',
              'current-project-blob'
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
      createProjectOperationCommand({
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
          resourceType: 'project',
          resourceId: 'example-project',
          expectedRevision: 'old-project-blob',
          actualRevision: 'current-project-blob',
        },
      },
    });
  });
});
