'use client';

import {
  type OperationStatusResponse,
  OperationStatusResponseSchema,
} from '@scs/schemas';
import { Button } from '@scs/ui/components/button';
import { Info } from 'lucide-react';
import { useEffect, useState } from 'react';

import { apiHeaders, apiUrl, readApiError } from '@/lib/api';
import {
  clearStableMutationKey,
  isOperationPollingAbort,
  MUTATION_ACCEPTED_EVENT,
  readAcceptedMutation,
  type RememberedMutation,
  waitForMutationOperation,
} from '@/lib/mutation-operation';

function operationMessage(
  operation: OperationStatusResponse | null,
  pendingDeletionResourceId?: string
): string {
  if (
    pendingDeletionResourceId &&
    operation?.status === 'succeeded' &&
    operation.publication === 'published'
  ) {
    return `Deletion of ${pendingDeletionResourceId} was published.`;
  }
  const deletionPrefix = pendingDeletionResourceId
    ? `Deletion requested for ${pendingDeletionResourceId}. `
    : '';
  if (!operation || operation.status === 'queued')
    return `${deletionPrefix}Submitted. You can close this page while we process your changes.`;
  if (operation.status === 'running')
    return `${deletionPrefix}Your changes are being processed.`;
  if (operation.status === 'succeeded')
    return (
      deletionPrefix +
      (operation.publication === 'published'
        ? 'Your changes are published.'
        : operation.publication === 'merged'
          ? 'Changes approved. Waiting for them to appear publicly.'
          : operation.publication === 'checks_pending'
            ? 'Your changes are being checked.'
            : operation.publication === 'checks_passed'
              ? 'Checks passed. Waiting for approval.'
              : operation.publication === 'auto_merge_queued'
                ? 'Checks passed. Your changes are waiting to be approved.'
                : operation.publication === 'checks_failed'
                  ? 'Checks failed. Review the GitHub request before discarding it.'
                  : operation.publication === 'cleaned_up'
                    ? 'The failed submission was discarded.'
                    : operation.publication === 'cleanup_partial'
                      ? 'The failed submission was only partly discarded. Try again.'
                      : operation.publication === 'superseded'
                        ? 'A newer submission replaced this one. Check the public page.'
                        : operation.publication === 'closed'
                          ? 'This submission was closed without being published.'
                          : operation.publication === 'unknown'
                            ? 'Submitted. Publication status is temporarily unavailable.'
                            : operation.outcome.pullRequest
                              ? `GitHub request #${operation.outcome.pullRequest.number} was created. Publication is still pending.`
                              : 'Processing finished. Check the public page to see whether your changes are published.')
    );
  if (operation.status === 'cancelled') return 'The submission was cancelled.';
  return `Publication could not proceed: ${operation.outcome.error.message}`;
}

export function PublicationNotice({ scope }: { scope: string }) {
  const [remembered, setRemembered] = useState<RememberedMutation | null>(null);
  const accepted = remembered?.accepted ?? null;
  const [operation, setOperation] = useState<OperationStatusResponse | null>(
    null
  );
  const [pollError, setPollError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const currentOperation =
    accepted && operation?.operationId === accepted.operationId
      ? operation
      : null;

  async function checkStatus() {
    if (!accepted || busy) return;
    setBusy(true);
    setActionError(null);
    try {
      const response = await fetch(apiUrl(accepted.statusUrl), {
        credentials: 'include',
        cache: 'no-store',
        headers: apiHeaders(),
      });
      if (!response.ok) throw new Error((await readApiError(response)).message);
      setOperation(OperationStatusResponseSchema.parse(await response.json()));
      setPollError(false);
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : 'Status unavailable'
      );
    } finally {
      setBusy(false);
    }
  }

  async function cleanup() {
    if (
      !accepted ||
      busy ||
      currentOperation?.status !== 'succeeded' ||
      !currentOperation.cleanupEligible
    )
      return;
    if (
      !window.confirm(
        'Close the failed GitHub request and remove its working copy? This cannot be undone.'
      )
    )
      return;
    setBusy(true);
    setActionError(null);
    try {
      const response = await fetch(apiUrl(`${accepted.statusUrl}/cleanup`), {
        method: 'POST',
        credentials: 'include',
        headers: apiHeaders(),
      });
      if (!response.ok) throw new Error((await readApiError(response)).message);
      setOperation(OperationStatusResponseSchema.parse(await response.json()));
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Cleanup failed');
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    const refresh = () => setRemembered(readAcceptedMutation(scope));
    const onAccepted = (event: Event) => {
      const detail = (
        event as CustomEvent<{
          scope: string;
          remembered: RememberedMutation;
        }>
      ).detail;
      if (detail.scope === scope) setRemembered(detail.remembered);
      if (detail.scope === scope) {
        setOperation(null);
        setPollError(false);
      }
    };
    refresh();
    window.addEventListener(MUTATION_ACCEPTED_EVENT, onAccepted);
    return () =>
      window.removeEventListener(MUTATION_ACCEPTED_EVENT, onAccepted);
  }, [scope]);

  useEffect(() => {
    if (!accepted) return;
    const controller = new AbortController();
    void waitForMutationOperation(accepted, 'Processing is still underway.', {
      signal: controller.signal,
    })
      .then((result) => {
        setOperation(result);
        clearStableMutationKey(scope);
      })
      .catch((error: unknown) => {
        if (!isOperationPollingAbort(error)) setPollError(true);
      });
    return () => controller.abort();
  }, [accepted, scope]);

  return (
    <div
      className="border-border bg-muted/40 text-muted-foreground flex
        items-start gap-3 rounded-lg border px-4 py-3 text-sm"
    >
      <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <div className="space-y-1">
        <p>
          After submitting, you can close this page. Your changes will continue
          through review and publication, which may take a few minutes.
        </p>
        {accepted ? (
          <div className="space-y-2">
            <p
              role="status"
              aria-live="polite"
              className="text-foreground font-medium"
            >
              {pollError
                ? 'Status is temporarily unavailable. Check again.'
                : operationMessage(
                    currentOperation,
                    remembered?.pendingDeletionResourceId
                  )}
            </p>
            {actionError ? (
              <p role="alert" className="text-destructive">
                {actionError}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => void checkStatus()}
              >
                Check status
              </Button>
              {currentOperation?.status === 'succeeded' &&
              currentOperation.cleanupEligible ? (
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={busy}
                  onClick={() => void cleanup()}
                >
                  Discard failed submission
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
