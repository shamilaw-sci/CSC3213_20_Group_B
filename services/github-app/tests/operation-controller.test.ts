import { describe, expect, test } from 'bun:test';

import {
  handleCancelOperation,
  handleGetOperation,
} from '@/controllers/operation.controller';
import { CloudflareOperationStore } from '@/operations/cloudflare-operation.store';
import type { OperationStateNamespace } from '@/operations/cloudflare.types';
import { InMemoryMutationCoordinator } from '@/operations/mutation-coordinator';
import { OperationExecutor } from '@/operations/operation.executor';
import { requestOperationCancellation } from '@/operations/operation.types';
import type { OperationRecord } from '@/operations/operation.types';
import type { GithubAppEnv } from '@/types/env';

function operationNamespace(): OperationStateNamespace {
  const operations = new Map<string, OperationRecord>();
  return {
    getByName: (operationId) => ({
      create: (operation) => {
        const existing = operations.get(operationId);
        if (existing) {
          return Promise.resolve({ created: false, operation: existing });
        }
        operations.set(operationId, operation);
        return Promise.resolve({ created: true, operation });
      },
      get: () => Promise.resolve(operations.get(operationId) ?? null),
      save: (operation) => {
        const existing = operations.get(operationId);
        operations.set(operationId, {
          ...operation,
          ...(existing?.cancellationRequested
            ? { cancellationRequested: true }
            : {}),
        });
        return Promise.resolve();
      },
      requestCancellation: (timestamp) => {
        const existing = operations.get(operationId);
        if (!existing) return Promise.resolve(null);
        const operation = requestOperationCancellation(existing, timestamp);
        operations.set(operationId, operation);
        return Promise.resolve(operation);
      },
    }),
  };
}

describe('operation status authorization', () => {
  test('limits status and cancellation to the actor or an admin', async () => {
    const namespace = operationNamespace();
    const env = {
      OPERATION_STATE: namespace,
    } as GithubAppEnv;
    const executor = new OperationExecutor({
      store: new CloudflareOperationStore(namespace),
      coordinator: new InMemoryMutationCoordinator(),
      handlers: {},
      log: () => {},
    });
    const operation = await executor.submit({
      idempotencyKey: 'request-key-00000001',
      actor: { type: 'user', subjectId: 'person-0000000001' },
      resource: { type: 'project', id: 'example' },
      action: 'project.upsert',
      payload: {},
      correlationId: 'correlation-0001',
    });
    const url = `https://github-app.test/operations/${operation.operationId}`;

    expect(
      (await handleGetOperation(new Request(url), env, operation.operationId))
        .status
    ).toBe(401);
    expect(
      (
        await handleGetOperation(
          new Request(url, {
            headers: { 'X-Actor-Subject-Id': 'different-0000001' },
          }),
          env,
          operation.operationId
        )
      ).status
    ).toBe(403);
    expect(
      (
        await handleGetOperation(
          new Request(url, {
            headers: { 'X-Actor-Subject-Id': 'person-0000000001' },
          }),
          env,
          operation.operationId
        )
      ).status
    ).toBe(200);

    const cancelled = await handleCancelOperation(
      new Request(url, {
        method: 'DELETE',
        headers: {
          'X-Actor-Subject-Id': 'administrator-0001',
          'X-Actor-Admin': 'true',
        },
      }),
      env,
      operation.operationId
    );
    expect(cancelled.status).toBe(200);
    expect(await cancelled.json()).toMatchObject({ status: 'cancelled' });
  });
});
