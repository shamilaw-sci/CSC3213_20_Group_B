import type { MutationAccepted, OperationStatusResponse } from '@scs/schemas';

import { apiHeaders, readApiError } from '@/lib/api';

export type TerminalOperationStatus = Exclude<
  OperationStatusResponse,
  { status: 'queued' | 'running' }
>;

export async function waitForMutationOperation(
  accepted: MutationAccepted,
  pendingMessage: string
): Promise<TerminalOperationStatus> {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    await new Promise((resolve) =>
      window.setTimeout(resolve, accepted.retryAfterMs)
    );
    const response = await fetch(accepted.statusUrl, {
      credentials: 'include',
      cache: 'no-store',
      headers: apiHeaders(),
    });
    if (!response.ok) throw new Error((await readApiError(response)).message);
    const operation = (await response.json()) as OperationStatusResponse;
    if (operation.status !== 'queued' && operation.status !== 'running') {
      return operation as TerminalOperationStatus;
    }
  }
  throw new Error(pendingMessage);
}

export function assertMutationSucceeded(
  operation: TerminalOperationStatus
): asserts operation is Extract<
  TerminalOperationStatus,
  { status: 'succeeded' }
> {
  if (operation.status !== 'succeeded') {
    throw new Error(operation.outcome.error.message);
  }
}
