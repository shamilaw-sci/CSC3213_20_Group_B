import { getOctokit } from '@/config/client.config';
import { getRuntimeConfig } from '@/config/runtime.config';
import type { OperationStore } from '@/operations/operation.store';
import type { OperationRecord } from '@/operations/operation.types';
import { inspectPublication, repositoryFor } from '@/operations/publication';

export class OperationCleanupConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OperationCleanupConflictError';
  }
}

function isMissingRef(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    error.status === 404
  );
}

export async function cleanupFailedPullRequest(
  operation: OperationRecord,
  store: OperationStore,
  octokit = getOctokit()
): Promise<OperationRecord> {
  if (operation.cleanup?.status === 'complete') return operation;
  const snapshot = await inspectPublication(operation, octokit);
  if (!snapshot.cleanupEligible || !snapshot.branch || !snapshot.headSha) {
    throw new OperationCleanupConflictError(
      'This operation has no eligible failed automation PR'
    );
  }

  const config = getRuntimeConfig();
  const coordinates = {
    owner: config.GITHUB_OWNER,
    repo: repositoryFor(operation),
  };
  const pullNumber =
    operation.outcome?.status === 'succeeded'
      ? operation.outcome.pullRequest?.number
      : undefined;
  if (!pullNumber) throw new OperationCleanupConflictError('PR is missing');

  const pull = (
    await octokit.pulls.get({ ...coordinates, pull_number: pullNumber })
  ).data;
  if (
    pull.merged_at ||
    pull.head.ref !== snapshot.branch ||
    pull.head.sha !== snapshot.headSha
  ) {
    throw new OperationCleanupConflictError('The PR changed or was merged');
  }

  const started: OperationRecord = {
    ...operation,
    cleanup: {
      status: 'started',
      branch: snapshot.branch,
      headSha: snapshot.headSha,
      updatedAt: new Date().toISOString(),
    },
  };
  await store.save(started);
  console.info(
    JSON.stringify({
      event: 'operation_cleanup_started',
      operationId: operation.operationId,
      correlationId: operation.correlationId,
      pullNumber,
    })
  );

  try {
    const ref = `heads/${snapshot.branch}`;
    try {
      const currentRef = await octokit.git.getRef({ ...coordinates, ref });
      if (currentRef.data.object.sha !== snapshot.headSha) {
        throw new OperationCleanupConflictError('Automation branch changed');
      }
    } catch (error) {
      if (!isMissingRef(error) || pull.state === 'open') throw error;
      const complete: OperationRecord = {
        ...started,
        cleanup: {
          ...started.cleanup!,
          status: 'complete',
          updatedAt: new Date().toISOString(),
        },
      };
      await store.save(complete);
      console.info(
        JSON.stringify({
          event: 'operation_cleanup_completed',
          operationId: operation.operationId,
          correlationId: operation.correlationId,
        })
      );
      return complete;
    }

    if (pull.state === 'open') {
      await octokit.pulls.update({
        ...coordinates,
        pull_number: pullNumber,
        state: 'closed',
      });
    }
    const closed = (
      await octokit.pulls.get({ ...coordinates, pull_number: pullNumber })
    ).data;
    if (closed.merged_at || closed.state !== 'closed') {
      throw new OperationCleanupConflictError('The PR was merged or reopened');
    }
    try {
      const currentRef = await octokit.git.getRef({ ...coordinates, ref });
      if (currentRef.data.object.sha !== snapshot.headSha) {
        throw new OperationCleanupConflictError('Automation branch changed');
      }
      await octokit.git.deleteRef({ ...coordinates, ref });
    } catch (error) {
      if (!isMissingRef(error)) throw error;
    }
    const complete: OperationRecord = {
      ...started,
      cleanup: {
        ...started.cleanup!,
        status: 'complete',
        updatedAt: new Date().toISOString(),
      },
    };
    await store.save(complete);
    console.info(
      JSON.stringify({
        event: 'operation_cleanup_completed',
        operationId: operation.operationId,
        correlationId: operation.correlationId,
      })
    );
    return complete;
  } catch (error) {
    await store.save({
      ...started,
      cleanup: {
        ...started.cleanup!,
        status: 'partial',
        updatedAt: new Date().toISOString(),
      },
    });
    console.error(
      JSON.stringify({
        event: 'operation_cleanup_partial',
        operationId: operation.operationId,
        correlationId: operation.correlationId,
        errorCategory: error instanceof Error ? error.name : 'unknown',
      })
    );
    throw error;
  }
}
