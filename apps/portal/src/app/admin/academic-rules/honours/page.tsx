'use client';

import { parseHonoursSelection, parseStudentIdentifier } from '@scs/identity';
import {
  CurrentUserResponseSchema,
  HonoursApplyResponseSchema,
  HonoursBulkApplyRequestSchema,
  type HonoursHistoryStatus,
  type HonoursOperationHistoryEntry,
  HonoursOperationHistoryResponseSchema,
  type HonoursPreviewResponse,
  HonoursPreviewResponseSchema,
  HonoursProgrammeCodeSchema,
  type OperationStatusResponse,
  OperationStatusResponseSchema,
} from '@scs/schemas';
import { Button, buttonVariants } from '@scs/ui/components/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@scs/ui/components/card';
import { Input } from '@scs/ui/components/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@scs/ui/components/popover';
import { Info } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { PageHeader, PageShell } from '@/components/layout/page-shell';
import { BackButton } from '@/components/navigation/back-button';
import { apiHeaders, apiUrl, meApiUrl, readApiError } from '@/lib/api';

function Help({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`About ${label}`}
          />
        }
      >
        <Info className="size-4" />
      </PopoverTrigger>
      <PopoverContent className="space-y-1 text-sm">
        <p className="font-semibold">{label}</p>
        <p className="text-muted-foreground">{children}</p>
      </PopoverContent>
    </Popover>
  );
}

function historyMessage(status: HonoursHistoryStatus): string {
  switch (status) {
    case 'pending_acceptance':
      return 'Pending acceptance · Retrying safely';
    case 'accepted':
      return 'Accepted · Queued for processing';
    case 'processing':
      return 'Processing · GitHub update in progress';
    case 'awaiting_publication':
      return 'Awaiting publication · Review the pull request';
    case 'published':
      return 'Published';
    case 'failed':
      return 'Failed · Review and submit a new preview';
  }
}

function operationMessage(
  status: OperationStatusResponse | null,
  intentStatus: HonoursHistoryStatus
): string {
  if (!status) return historyMessage(intentStatus);
  if (status.status === 'queued') return 'Accepted · Queued for processing';
  if (status.status === 'running')
    return 'Processing · GitHub update in progress';
  if (status.status === 'failed')
    return 'Failed · Review the error and submit a new preview to retry';
  if (status.status === 'conflicted')
    return 'Failed · The student record changed; preview again before retrying';
  if (status.status === 'cancelled') return 'Cancelled';
  if (status.publication === 'published') return 'Published';
  if (status.publication === 'merged')
    return 'Awaiting publication · Pull request merged';
  if (status.publication === 'checks_failed')
    return 'Awaiting merge · Checks failed; review the pull request and rerun checks';
  if (status.publication === 'closed' || status.publication === 'superseded')
    return 'Failed · Pull request did not publish; preview again before retrying';
  return 'Awaiting merge · GitHub pull request created';
}

export default function HonoursPage() {
  const [historyItems, setHistoryItems] = useState<
    HonoursOperationHistoryEntry[]
  >([]);
  const [historyCursor, setHistoryCursor] = useState<string | null>(null);
  const [historyError, setHistoryError] = useState('');
  const [historyLoading, setHistoryLoading] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [batch, setBatch] = useState('s21');
  const [singleIdentifier, setSingleIdentifier] = useState('');
  const [programme, setProgramme] = useState<string>(
    HonoursProgrammeCodeSchema.options[0]
  );
  const [operation, setOperation] = useState<'assign' | 'change' | 'revoke'>(
    'assign'
  );
  const [include, setInclude] = useState('800-850, 900-950');
  const [exclude, setExclude] = useState('810-815, 922');
  const [additional, setAdditional] = useState('720, 725');
  const [parseError, setParseError] = useState('');
  const [preview, setPreview] = useState<HonoursPreviewResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [reason, setReason] = useState('');
  const [overwriteConflicts, setOverwriteConflicts] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState(crypto.randomUUID());
  const [applying, setApplying] = useState(false);
  const [operationId, setOperationId] = useState('');
  const [operationStatus, setOperationStatus] =
    useState<OperationStatusResponse | null>(null);
  const [intentStatus, setIntentStatus] =
    useState<HonoursHistoryStatus>('pending_acceptance');

  useEffect(() => {
    const controller = new AbortController();
    void fetch(apiUrl('/api/admin/academic-rules/honours/history'), {
      credentials: 'include',
      cache: 'no-store',
      headers: apiHeaders(),
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok)
          throw new Error((await readApiError(response)).message);
        return HonoursOperationHistoryResponseSchema.parse(
          await response.json()
        );
      })
      .then((result) => {
        if (!controller.signal.aborted) {
          setHistoryItems(result.items);
          setHistoryCursor(result.nextCursor);
          setHistoryLoading(false);
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setHistoryError(
            error instanceof Error ? error.message : 'History unavailable'
          );
        if (!controller.signal.aborted) setHistoryLoading(false);
      });
    return () => controller.abort();
  }, []);

  async function loadHistory(cursor?: string) {
    setHistoryLoading(true);
    const url = apiUrl('/api/admin/academic-rules/honours/history');
    if (cursor) url.searchParams.set('cursor', cursor);
    try {
      const response = await fetch(url, {
        credentials: 'include',
        cache: 'no-store',
        headers: apiHeaders(),
      });
      if (!response.ok) throw new Error((await readApiError(response)).message);
      const result = HonoursOperationHistoryResponseSchema.parse(
        await response.json()
      );
      setHistoryItems(
        cursor ? (items) => [...items, ...result.items] : result.items
      );
      setHistoryCursor(result.nextCursor);
      const current = result.items.find(
        (item) => item.operationId === operationId
      );
      if (current) setIntentStatus(current.status);
      setHistoryError('');
    } catch (error) {
      setHistoryError(
        error instanceof Error ? error.message : 'History unavailable'
      );
    } finally {
      setHistoryLoading(false);
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    void fetch(meApiUrl(), {
      credentials: 'include',
      cache: 'no-store',
      headers: apiHeaders(),
      signal: controller.signal,
    })
      .then(async (response) =>
        CurrentUserResponseSchema.safeParse(
          await response.json().catch(() => null)
        )
      )
      .then((parsed) => {
        if (!controller.signal.aborted)
          setIsSuperAdmin(
            parsed.success && parsed.data.accessLevel === 'SUPER_ADMIN'
          );
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);

  async function runPreview() {
    setPreview(null);
    try {
      parseHonoursSelection({ batch, include, exclude, additional });
      setParseError('');
    } catch (error) {
      setParseError(
        error instanceof Error ? error.message : 'Invalid selection'
      );
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(
        apiUrl('/api/admin/academic-rules/honours/preview'),
        {
          method: 'POST',
          credentials: 'include',
          headers: apiHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({
            batch,
            programme,
            include,
            exclude,
            additional,
            operation,
          }),
        }
      );
      if (!response.ok) throw new Error((await readApiError(response)).message);
      setPreview(HonoursPreviewResponseSchema.parse(await response.json()));
      setIdempotencyKey(crypto.randomUUID());
      setOperationId('');
      setOperationStatus(null);
      setIntentStatus('pending_acceptance');
    } catch (error) {
      setParseError(error instanceof Error ? error.message : 'Preview failed');
    } finally {
      setLoading(false);
    }
  }

  async function refreshOperation(id = operationId) {
    if (!id) return;
    try {
      const response = await fetch(
        apiUrl(`/api/operations/${encodeURIComponent(id)}`),
        {
          credentials: 'include',
          cache: 'no-store',
          headers: apiHeaders(),
        }
      );
      if (!response.ok) throw new Error((await readApiError(response)).message);
      setOperationStatus(
        OperationStatusResponseSchema.parse(await response.json())
      );
      setParseError('');
    } catch (error) {
      setParseError(
        error instanceof Error ? error.message : 'Unable to load operation'
      );
    }
  }

  async function applyChanges() {
    if (!preview || applying || operationId) return;
    const planned =
      (preview.counts.planned_assign ?? 0) +
      (preview.counts.planned_revoke ?? 0) +
      (overwriteConflicts ? (preview.counts.conflict ?? 0) : 0);
    if (
      !window.confirm(
        `Submit ${planned} Honours changes in one GitHub pull request?`
      )
    )
      return;
    const parsed = HonoursBulkApplyRequestSchema.safeParse({
      batch,
      programme,
      operation,
      include,
      exclude,
      additional,
      reason,
      idempotencyKey,
      expectedEntries: preview.entries,
      overwriteConflicts,
      confirmation: true,
    });
    if (!parsed.success) {
      setParseError(
        'Give a reason of at least 10 characters and preview again if the selection changed.'
      );
      return;
    }
    setApplying(true);
    setParseError('');
    try {
      const response = await fetch(
        apiUrl('/api/admin/academic-rules/honours/apply'),
        {
          method: 'POST',
          credentials: 'include',
          headers: apiHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify(parsed.data),
        }
      );
      if (!response.ok) throw new Error((await readApiError(response)).message);
      const result = HonoursApplyResponseSchema.parse(await response.json());
      setOperationId(result.operationId);
      setIntentStatus(result.status);
      await loadHistory();
      if (result.status !== 'pending_acceptance' && result.status !== 'failed')
        await refreshOperation(result.operationId);
    } catch (error) {
      setParseError(error instanceof Error ? error.message : 'Apply failed');
    } finally {
      setApplying(false);
    }
  }

  return (
    <PageShell width="wide">
      <BackButton fallbackHref="/admin" label="Back to Admin" preferFallback />
      <PageHeader
        title="Honours Management"
        description="Validate individual and range selections against registered accounts and published student profiles."
      />
      <Card>
        <CardHeader>
          <CardTitle>Build a selection</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2 rounded-md border p-3">
            <div className="flex items-center gap-1">
              <label
                htmlFor="single-identifier"
                className="text-sm font-medium"
              >
                Individual student
              </label>
              <Help label="Individual student">
                Enter S21801 or S21SP345, then preview to see the current
                classification. A single student uses the same confirmation and
                publication workflow as a range.
              </Help>
            </div>
            <div className="flex gap-2">
              <Input
                id="single-identifier"
                value={singleIdentifier}
                placeholder="S21801"
                onChange={(event) => setSingleIdentifier(event.target.value)}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  const student = parseStudentIdentifier(
                    `${singleIdentifier.trim()}@sci.pdn.ac.lk`
                  );
                  if (!student) {
                    setParseError(
                      'Enter a valid registration number such as S21801 or S21SP345'
                    );
                    return;
                  }
                  setBatch(student.batch);
                  setInclude(student.registrationNo);
                  setExclude('');
                  setAdditional('');
                  setPreview(null);
                  setParseError('');
                }}
              >
                Use student
              </Button>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="text-sm font-medium">
              Batch{' '}
              <Input
                className="mt-2"
                value={batch}
                placeholder="s21"
                onChange={(event) => setBatch(event.target.value)}
              />
            </label>
            <label className="text-sm font-medium">
              Programme{' '}
              <select
                name="honours-programme"
                className="bg-background mt-2 block w-full rounded-md border
                  p-2"
                value={programme}
                onChange={(event) => setProgramme(event.target.value)}
              >
                {HonoursProgrammeCodeSchema.options.map((code) => (
                  <option key={code} value={code}>
                    {code.replaceAll('_', ' ')}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-medium">
              Operation{' '}
              <select
                name="honours-operation"
                className="bg-background mt-2 block w-full rounded-md border
                  p-2"
                value={operation}
                onChange={(event) =>
                  setOperation(event.target.value as typeof operation)
                }
              >
                <option value="assign">Assign</option>
                <option value="change">Change programme</option>
                <option value="revoke">Revoke</option>
              </select>
            </label>
          </div>
          <div>
            <div className="flex items-center gap-1">
              <label htmlFor="include" className="text-sm font-medium">
                Include ranges
              </label>
              <Help label="Include ranges">
                Use 800-850, 900-950 or single indices such as 801. Ranges are
                inclusive.
              </Help>
            </div>
            <textarea
              id="include"
              className="bg-background min-h-20 w-full rounded-md border p-2"
              value={include}
              placeholder="800-850, 900-950"
              onChange={(event) => setInclude(event.target.value)}
            />
          </div>
          <div>
            <div className="flex items-center gap-1">
              <label htmlFor="exclude" className="text-sm font-medium">
                Exclude
              </label>
              <Help label="Exclusions">
                Use 810-815, 922. These are removed from the include selection.
              </Help>
            </div>
            <textarea
              id="exclude"
              className="bg-background min-h-16 w-full rounded-md border p-2"
              value={exclude}
              placeholder="810-815, 922"
              onChange={(event) => setExclude(event.target.value)}
            />
          </div>
          <div>
            <div className="flex items-center gap-1">
              <label htmlFor="additional" className="text-sm font-medium">
                Additional inclusions
              </label>
              <Help label="Additional inclusions">
                Use 720, 725, 730-735. These are added after exclusions, so they
                can restore an excluded identifier.
              </Help>
              <Help label="Special identifiers">
                Use sp345 or s21sp345 for the permanent S21SP345 identifier.
              </Help>
            </div>
            <textarea
              id="additional"
              className="bg-background min-h-16 w-full rounded-md border p-2"
              value={additional}
              placeholder="720, 725, sp345"
              onChange={(event) => setAdditional(event.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={() => void runPreview()} disabled={loading}>
              {loading ? 'Validating…' : 'Preview changes'}
            </Button>
            <Help label="Preview changes">
              Preview reads registered accounts and published batch data. It
              makes no changes and does not create a GitHub pull request.
            </Help>
          </div>
          {parseError && (
            <p role="alert" className="text-destructive text-sm">
              {parseError}
            </p>
          )}
        </CardContent>
      </Card>
      {preview && (
        <Card>
          <CardHeader>
            <CardTitle>Preview: {preview.total} selected</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2 text-sm">
              {Object.entries(preview.counts).map(([key, count]) => (
                <span key={key} className="rounded-md border px-2 py-1">
                  {key.replaceAll('_', ' ')}: {count}
                </span>
              ))}
              <span className="rounded-md border px-2 py-1">
                Excluded: {preview.excluded.length}
              </span>
            </div>
            <p className="text-muted-foreground text-sm">
              Eligible changes are submitted as one durable GitHub operation and
              one pull request. Published data changes after that pull request
              merges and deploys.
            </p>
            <details>
              <summary className="cursor-pointer font-medium">
                Detailed results
              </summary>
              <div className="mt-3 max-h-96 space-y-1 overflow-auto">
                {preview.entries.map((entry) => (
                  <div
                    key={entry.identifier}
                    className="flex flex-wrap items-center justify-between gap-2
                      rounded-md border p-2 text-sm"
                  >
                    <span>
                      {entry.identifier} · {entry.outcome.replaceAll('_', ' ')}{' '}
                      · {entry.oldTrack ?? 'No profile'}{' '}
                      {entry.oldProgramme ?? ''} →{' '}
                      {entry.newTrack ?? 'unchanged'} {entry.newProgramme ?? ''}
                    </span>
                    {isSuperAdmin && entry.outcome.startsWith('planned_') && (
                      <Link
                        className={buttonVariants({
                          variant: 'outline',
                          size: 'sm',
                        })}
                        href={`/admin/users/${encodeURIComponent(`${entry.identifier.toLowerCase()}@sci.pdn.ac.lk`)}/public-profile`}
                      >
                        Open profile editor
                      </Link>
                    )}
                  </div>
                ))}
              </div>
            </details>
            <div className="space-y-2 rounded-md border p-3">
              <div className="flex items-center gap-2">
                <label htmlFor="reason" className="text-sm font-medium">
                  Reason for change
                </label>
                <Help label="Apply changes">
                  Submitting creates a durable server-side operation. One GitHub
                  pull request carries the selected profile changes. The batch
                  is atomic: a changed or missing student record stops the
                  operation so you can preview again. Check operation and
                  publication status below before considering it complete.
                </Help>
              </div>
              <Input
                id="reason"
                value={reason}
                maxLength={500}
                placeholder="Approved by the department board on 2026-11-13"
                onChange={(event) => setReason(event.target.value)}
              />
              {(preview.counts.conflict ?? 0) > 0 && (
                <label className="flex items-center gap-2 text-sm">
                  <input
                    name="overwrite-conflicts"
                    type="checkbox"
                    checked={overwriteConflicts}
                    onChange={(event) =>
                      setOverwriteConflicts(event.target.checked)
                    }
                  />{' '}
                  Explicitly replace {preview.counts.conflict} conflicting
                  programme assignments
                </label>
              )}
              <Button
                onClick={() => void applyChanges()}
                disabled={
                  applying ||
                  Boolean(operationId) ||
                  reason.trim().length < 10 ||
                  (preview.counts.planned_assign ?? 0) +
                    (preview.counts.planned_revoke ?? 0) +
                    (overwriteConflicts
                      ? (preview.counts.conflict ?? 0)
                      : 0) ===
                    0
                }
              >
                {applying ? 'Submitting…' : 'Apply confirmed changes'}
              </Button>
            </div>
            {operationId && (
              <div className="space-y-2 rounded-md border p-3 text-sm">
                <p>
                  Operation ID: <code>{operationId}</code>
                </p>
                <Button
                  variant="outline"
                  onClick={() => {
                    if (
                      intentStatus === 'pending_acceptance' ||
                      intentStatus === 'failed'
                    )
                      void loadHistory();
                    else void refreshOperation();
                  }}
                >
                  Refresh status
                </Button>
                <p role="status">
                  {operationMessage(operationStatus, intentStatus)}
                </p>
                {operationStatus?.status === 'succeeded' &&
                  operationStatus.outcome.pullRequest && (
                    <a
                      className="underline"
                      href={operationStatus.outcome.pullRequest.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open GitHub pull request
                    </a>
                  )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
      <Card>
        <CardHeader>
          <CardTitle>Operation history</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {historyError && (
            <div
              role="alert"
              className="text-destructive flex flex-wrap items-center gap-2"
            >
              <p>{historyError}</p>
              <Button
                type="button"
                variant="outline"
                onClick={() => void loadHistory()}
              >
                Retry
              </Button>
            </div>
          )}
          {historyLoading && <p role="status">Loading operations…</p>}
          {historyItems.length === 0 && !historyError && !historyLoading && (
            <p>No Honours operations have been submitted yet.</p>
          )}
          {historyItems.map((entry) => (
            <div key={entry.operationId} className="rounded-md border p-3">
              <p className="font-medium">
                {entry.operation} · {entry.programme.replaceAll('_', ' ')} ·{' '}
                {entry.batch} · {entry.changes.length} changes
              </p>
              <p className="text-muted-foreground">
                {new Date(entry.createdAt).toLocaleString()} ·{' '}
                {entry.actorEmail}
              </p>
              <p role="status">{historyMessage(entry.status)}</p>
              {entry.status === 'failed' && entry.failureReason && (
                <p className="text-destructive">{entry.failureReason}</p>
              )}
              <p>{entry.reason}</p>
              <details>
                <summary className="cursor-pointer">Changes</summary>
                <ul className="mt-2 space-y-1">
                  {entry.changes.map((change) => (
                    <li key={change.identifier}>
                      {change.identifier}: {change.oldTrack ?? 'none'} /{' '}
                      {change.oldProgramme ?? 'none'} → {change.newTrack} /{' '}
                      {change.newProgramme ?? 'none'}
                    </li>
                  ))}
                </ul>
              </details>
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => {
                  setOperationId(entry.operationId);
                  setOperationStatus(null);
                  setIntentStatus(entry.status);
                  if (
                    entry.status === 'pending_acceptance' ||
                    entry.status === 'failed'
                  )
                    void loadHistory();
                  else void refreshOperation(entry.operationId);
                }}
              >
                Check status
              </Button>
            </div>
          ))}
          {historyCursor && (
            <Button
              variant="outline"
              onClick={() => void loadHistory(historyCursor)}
            >
              Load older operations
            </Button>
          )}
          {operationStatus && (
            <p role="status">
              {operationStatus.operationId}:{' '}
              {operationMessage(operationStatus, intentStatus)}
            </p>
          )}
        </CardContent>
      </Card>
    </PageShell>
  );
}
