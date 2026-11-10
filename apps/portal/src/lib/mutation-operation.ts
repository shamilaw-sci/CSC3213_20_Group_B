import {
  type MutationAccepted,
  type OperationStatusResponse,
  OperationStatusResponseSchema,
} from '@scs/schemas';

import { apiHeaders, apiUrl, readApiError } from '@/lib/api';

export type TerminalOperationStatus = Exclude<
  OperationStatusResponse,
  { status: 'queued' | 'running' }
>;

interface MutationPollingOptions {
  signal?: AbortSignal;
  maxAttempts?: number;
  fetcher?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  wait?: (delayMs: number, signal?: AbortSignal) => Promise<void>;
}

const MAX_POLL_DELAY_MS = 10_000;

function waitForDelay(delayMs: number, signal?: AbortSignal): Promise<void> {
  signal?.throwIfAborted();

  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(resolve, delayMs);
    signal?.addEventListener(
      'abort',
      () => {
        window.clearTimeout(timeout);
        reject(signal.reason);
      },
      { once: true }
    );
  });
}

export async function waitForMutationOperation(
  accepted: MutationAccepted,
  pendingMessage: string,
  options: MutationPollingOptions = {}
): Promise<TerminalOperationStatus> {
  const maxAttempts = options.maxAttempts ?? 40;
  const fetcher = options.fetcher ?? fetch;
  const wait = options.wait ?? waitForDelay;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const delayMs = Math.min(
      accepted.retryAfterMs * 2 ** Math.min(attempt, 4),
      MAX_POLL_DELAY_MS
    );
    await wait(delayMs, options.signal);
    options.signal?.throwIfAborted();

    const response = await fetcher(apiUrl(accepted.statusUrl), {
      credentials: 'include',
      cache: 'no-store',
      headers: apiHeaders(),
      signal: options.signal,
    });
    if (!response.ok) throw new Error((await readApiError(response)).message);
    const operation = OperationStatusResponseSchema.parse(
      await response.json()
    );
    if (operation.status !== 'queued' && operation.status !== 'running') {
      return operation;
    }
  }
  throw new Error(pendingMessage);
}

export function isOperationPollingAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
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
