import { classifyGithubError } from '@/github/github.errors';
import { CloudflareOperationStore } from '@/operations/cloudflare-operation.store';
import type { OperationQueueBatch } from '@/operations/cloudflare.types';
import { localOperationStore } from '@/operations/in-memory-operation.store';
import {
  CloudflareMutationCoordinator,
  localMutationCoordinator,
  MutationResourceBusyError,
} from '@/operations/mutation-coordinator';
import { OperationExecutor } from '@/operations/operation.executor';
import type { OperationHandler } from '@/operations/operation.types';
import type { GithubAppEnv } from '@/types/env';

export function createCloudflareOperationExecutor(
  env: GithubAppEnv,
  handlers: Record<string, OperationHandler>
): OperationExecutor {
  if (!env.OPERATION_STATE || !env.MUTATION_COORDINATOR) {
    throw new Error('Durable operation bindings are unavailable');
  }
  return new OperationExecutor({
    store: new CloudflareOperationStore(env.OPERATION_STATE),
    coordinator: new CloudflareMutationCoordinator(env.MUTATION_COORDINATOR),
    handlers,
    classifyError: classifyGithubError,
    dispatch: env.OPERATION_QUEUE
      ? async (operationId) => {
          await env.OPERATION_QUEUE!.send({ operationId });
        }
      : undefined,
  });
}

export function createOperationExecutor(
  env: GithubAppEnv,
  handlers: Record<string, OperationHandler>
): OperationExecutor {
  if (env.OPERATION_STATE && env.MUTATION_COORDINATOR) {
    return createCloudflareOperationExecutor(env, handlers);
  }

  const executor = new OperationExecutor({
    store: localOperationStore,
    coordinator: localMutationCoordinator,
    handlers,
    classifyError: classifyGithubError,
    dispatch: (operationId) => {
      queueMicrotask(() => {
        void executor.execute(operationId).catch((error: unknown) => {
          console.error(
            JSON.stringify({
              event: 'local_operation_failed',
              operationId,
              errorCategory: classifyGithubError(error).category,
            })
          );
        });
      });
      return Promise.resolve();
    },
  });
  return executor;
}

export async function consumeOperationBatch(
  batch: OperationQueueBatch,
  env: GithubAppEnv,
  handlers: Record<string, OperationHandler>
): Promise<void> {
  const executor = createCloudflareOperationExecutor(env, handlers);
  await Promise.all(
    batch.messages.map(async (message) => {
      try {
        await executor.execute(message.body.operationId);
        message.ack();
      } catch (error) {
        if (error instanceof MutationResourceBusyError) {
          message.retry({ delaySeconds: 1 });
          return;
        }
        console.error(
          JSON.stringify({
            event: 'operation_consumer_failed',
            operationId: message.body.operationId,
            errorCategory: classifyGithubError(error).category,
          })
        );
        message.retry();
      }
    })
  );
}
