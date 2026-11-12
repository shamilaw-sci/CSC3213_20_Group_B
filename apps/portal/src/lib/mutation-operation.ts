import {
  type MutationAccepted,
  MutationAcceptedSchema,
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
const MUTATION_STORAGE_PREFIX = 'scs-public-mutation:';
const IDEMPOTENCY_STORAGE_PREFIX = 'scs-public-idempotency:';
export const MUTATION_ACCEPTED_EVENT = 'scs-public-mutation-accepted';

export interface RememberedMutation {
  accepted: MutationAccepted;
  pendingDeletionResourceId?: string;
}

export async function stableMutationKey(
  scope: string,
  payload: unknown
): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const fingerprint = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0')
  ).join('');
  const storageKey = `${IDEMPOTENCY_STORAGE_PREFIX}${scope}`;
  try {
    const previous = JSON.parse(
      window.localStorage.getItem(storageKey) ?? 'null'
    );
    if (
      previous?.fingerprint === fingerprint &&
      typeof previous.key === 'string'
    ) {
      return previous.key;
    }
  } catch {
    // Invalid local state is replaced with a fresh idempotency key.
  }
  const key = crypto.randomUUID();
  try {
    window.localStorage.setItem(
      storageKey,
      JSON.stringify({ fingerprint, key })
    );
  } catch {
    // Submission still works when browser storage is unavailable.
  }
  return key;
}

export function clearStableMutationKey(scope: string): void {
  try {
    window.localStorage.removeItem(`${IDEMPOTENCY_STORAGE_PREFIX}${scope}`);
  } catch {
    // Storage can become unavailable after submission.
  }
}

export function rememberAcceptedMutation(
  scope: string,
  accepted: MutationAccepted,
  pendingDeletionResourceId?: string
): void {
  if (typeof window === 'undefined') return;
  const remembered: RememberedMutation = {
    accepted,
    ...(pendingDeletionResourceId ? { pendingDeletionResourceId } : {}),
  };
  try {
    window.localStorage.setItem(
      `${MUTATION_STORAGE_PREFIX}${scope}`,
      JSON.stringify(remembered)
    );
  } catch {
    // The acknowledgement remains visible for this page session.
  }
  window.dispatchEvent(
    new CustomEvent(MUTATION_ACCEPTED_EVENT, { detail: { scope, remembered } })
  );
}

export function readAcceptedMutation(scope: string): RememberedMutation | null {
  if (typeof window === 'undefined') return null;
  let stored: string | null;
  try {
    stored = window.localStorage.getItem(`${MUTATION_STORAGE_PREFIX}${scope}`);
  } catch {
    return null;
  }
  if (!stored) return null;
  try {
    const value: unknown = JSON.parse(stored);
    if (value && typeof value === 'object' && 'accepted' in value) {
      const record = value as Record<string, unknown>;
      return {
        accepted: MutationAcceptedSchema.parse(record.accepted),
        ...(typeof record.pendingDeletionResourceId === 'string'
          ? { pendingDeletionResourceId: record.pendingDeletionResourceId }
          : {}),
      };
    }
    return { accepted: MutationAcceptedSchema.parse(value) };
  } catch {
    try {
      window.localStorage.removeItem(`${MUTATION_STORAGE_PREFIX}${scope}`);
    } catch {
      // Ignore unavailable browser storage.
    }
    return null;
  }
}

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

function waitForVisible(signal?: AbortSignal): Promise<void> {
  signal?.throwIfAborted();
  if (typeof document === 'undefined' || !document.hidden) {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const finish = () => {
      document.removeEventListener('visibilitychange', onVisible);
      signal?.removeEventListener('abort', onAbort);
    };
    const onVisible = () => {
      if (!document.hidden) {
        finish();
        resolve();
      }
    };
    const onAbort = () => {
      finish();
      reject(signal?.reason);
    };
    document.addEventListener('visibilitychange', onVisible);
    signal?.addEventListener('abort', onAbort, { once: true });
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
    await waitForVisible(options.signal);
    const delayMs = Math.min(
      accepted.retryAfterMs * 2 ** Math.min(attempt, 4),
      MAX_POLL_DELAY_MS
    );
    await wait(delayMs, options.signal);
    await waitForVisible(options.signal);
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
