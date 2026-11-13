'use client';

import { parseStudentIdentifier } from '@scs/identity';
import {
  APP_ROLES,
  type AppRole,
  type IdentityAccount,
  IdentityAccountsResponseSchema,
  type IdentityAudit,
  IdentityHistoryResponseSchema,
  type IdentityReviewStatus,
  IdentitySuggestionResponseSchema,
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
import { Info, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

import { PageHeader, PageShell } from '@/components/layout/page-shell';
import { BackButton } from '@/components/navigation/back-button';
import { apiHeaders, apiUrl, readApiError } from '@/lib/api';

type ReviewStatus = IdentityReviewStatus;
type Account = IdentityAccount;
type Audit = IdentityAudit;
const statuses: ReviewStatus[] = [
  'PENDING',
  'NEEDS_EVIDENCE',
  'APPROVED',
  'RETAINED_OTHER',
  'CONFLICT',
];
const labels: Record<ReviewStatus, string> = {
  PENDING: 'Pending',
  NEEDS_EVIDENCE: 'Needs evidence',
  APPROVED: 'Approved',
  RETAINED_OTHER: 'Reviewed and retained as OTHER',
  CONFLICT: 'Conflict',
};

function Help({
  title,
  children,
}: {
  title: string;
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
            aria-label={`About ${title}`}
          />
        }
      >
        <Info className="size-4" />
      </PopoverTrigger>
      <PopoverContent className="space-y-2 text-sm">
        <p className="font-semibold">{title}</p>
        <div className="text-muted-foreground">{children}</div>
      </PopoverContent>
    </Popover>
  );
}

export default function IdentityAdminPage({
  mode,
}: {
  mode: 'mappings' | 'review';
}) {
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState(
    mode === 'review' ? 'OTHER' : ''
  );
  const [statusFilter, setStatusFilter] = useState('');
  const [verifiedFilter, setVerifiedFilter] = useState('all');
  const [cursor, setCursor] = useState('');
  const [items, setItems] = useState<Account[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [selected, setSelected] = useState<Account | null>(null);
  const [role, setRole] = useState<AppRole>('OTHER');
  const [status, setStatus] = useState<ReviewStatus>('PENDING');
  const [note, setNote] = useState('');
  const [history, setHistory] = useState<Audit[]>([]);
  const [evidence, setEvidence] = useState('');
  const [suggestion, setSuggestion] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState('');
  const [revision, setRevision] = useState(0);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setFailure('');
      try {
        const url = apiUrl('/api/admin/identity/accounts');
        if (search) url.searchParams.set('query', search);
        if (roleFilter) url.searchParams.set('role', roleFilter);
        if (statusFilter) url.searchParams.set('status', statusFilter);
        if (verifiedFilter !== 'all')
          url.searchParams.set('verified', verifiedFilter);
        if (cursor) url.searchParams.set('cursor', cursor);
        const response = await fetch(url, {
          credentials: 'include',
          cache: 'no-store',
          headers: apiHeaders(),
          signal,
        });
        if (!response.ok)
          throw new Error((await readApiError(response)).message);
        const data = IdentityAccountsResponseSchema.parse(
          await response.json()
        );
        setItems(data.items);
        setNextCursor(data.nextCursor);
      } catch (error) {
        if (signal?.aborted) return;
        setFailure(
          error instanceof Error ? error.message : 'Unable to load accounts'
        );
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [search, roleFilter, statusFilter, verifiedFilter, cursor]
  );

  useEffect(() => {
    const controller = new AbortController();
    void Promise.resolve().then(() => load(controller.signal));
    return () => controller.abort();
  }, [load, revision]);

  async function inspect(account: Account) {
    setSelected(account);
    setRole(account.role);
    setStatus(account.status);
    setNote(account.note);
    setHistory([]);
    setEvidence('');
    setSuggestion('');
    const url = apiUrl('/api/admin/identity/history');
    url.searchParams.set('email', account.email);
    const response = await fetch(url, {
      credentials: 'include',
      cache: 'no-store',
      headers: apiHeaders(),
    });
    if (response.ok) {
      const data = IdentityHistoryResponseSchema.parse(await response.json());
      setHistory(data.items);
    }
  }

  async function save() {
    if (!selected) return;
    setSaving(true);
    try {
      const response = await fetch(apiUrl('/api/admin/identity/decisions'), {
        method: 'POST',
        credentials: 'include',
        headers: apiHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          email: selected.email,
          expectedRole: selected.role,
          role,
          status,
          source: mode === 'review' ? 'REVIEW' : 'MANUAL',
          note,
        }),
      });
      if (!response.ok) throw new Error((await readApiError(response)).message);
      toast.success('Identity decision saved');
      setSelected(null);
      setRevision((value) => value + 1);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Unable to save decision'
      );
    } finally {
      setSaving(false);
    }
  }

  async function analyzeEvidence() {
    setSuggestion('Analyzing supplied evidence…');
    const response = await fetch(apiUrl('/api/admin/identity/suggestion'), {
      method: 'POST',
      credentials: 'include',
      headers: apiHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ evidence }),
    });
    if (!response.ok) {
      setSuggestion(
        (await readApiError(response)).message ?? 'Analysis failed'
      );
      return;
    }
    const result = IdentitySuggestionResponseSchema.parse(
      await response.json()
    );
    setSuggestion(
      result.kind === 'suggested'
        ? `Jev suggests ${result.role} (${Math.round((result.confidence ?? 0) * 100)}% confidence). Review the evidence yourself before saving.`
        : result.kind === 'unavailable'
          ? 'Jev is unavailable; manual review remains available.'
          : result.kind.replaceAll('_', ' ')
    );
  }

  return (
    <PageShell width="wide">
      <BackButton fallbackHref="/admin" label="Back to Admin" preferFallback />
      <PageHeader
        title={mode === 'review' ? 'Identity Review' : 'Role Mappings'}
        description={
          mode === 'review'
            ? 'Review registered OTHER accounts and record an academic category or a deliberate unresolved decision.'
            : 'Manage academic roles for verified registered university accounts.'
        }
      />
      <div className="flex flex-wrap gap-2">
        <Link
          className={buttonVariants({
            variant: mode === 'mappings' ? 'default' : 'outline',
          })}
          href="/admin/identity/mappings"
        >
          Role mappings
        </Link>
        <Link
          className={buttonVariants({
            variant: mode === 'review' ? 'default' : 'outline',
          })}
          href="/admin/identity/review"
        >
          Review OTHER
        </Link>
        <Help title="Automatic student classification">
          S21513@sci.pdn.ac.lk is always STUDENT. The same rule covers S21SP345.
          Administrators cannot change this role.
        </Help>
        <Help title="Role versus access level">
          Changing a registered staff account from OTHER to ACADEMIC enables its
          public profile category. It does not grant ADMIN access.
        </Help>
        <Help title="Review decisions">
          A staff-format university email starts as OTHER. Approve a supported
          category, or retain OTHER when evidence is insufficient. Private
          Portal editing stays available.
        </Help>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Find an account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <form
            className="flex flex-wrap gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              setCursor('');
              setSearch(query.trim());
            }}
          >
            <Input
              aria-label="Search name or university email"
              placeholder="Name or staff@sci.pdn.ac.lk"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="min-w-64 flex-1"
            />
            <Button type="submit">Search</Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setRevision((value) => value + 1)}
              disabled={loading}
            >
              <RefreshCw className="size-4" /> Refresh
            </Button>
          </form>
          <div className="flex flex-wrap gap-2">
            <label className="text-sm">
              Role{' '}
              <select
                name="role-filter"
                className="bg-background ml-2 rounded-md border p-2"
                value={roleFilter}
                onChange={(event) => {
                  setCursor('');
                  setRoleFilter(event.target.value);
                }}
              >
                <option value="">All roles</option>
                {APP_ROLES.map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              Review status{' '}
              <select
                name="review-status-filter"
                className="bg-background ml-2 rounded-md border p-2"
                value={statusFilter}
                onChange={(event) => {
                  setCursor('');
                  setStatusFilter(event.target.value);
                }}
              >
                <option value="">All statuses</option>
                {statuses.map((value) => (
                  <option key={value} value={value}>
                    {labels[value]}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              Verification{' '}
              <select
                name="verification-filter"
                className="bg-background ml-2 rounded-md border p-2"
                value={verifiedFilter}
                onChange={(event) => {
                  setCursor('');
                  setVerifiedFilter(event.target.value);
                }}
              >
                <option value="all">All</option>
                <option value="verified">Verified</option>
                <option value="unverified">Unverified</option>
              </select>
            </label>
          </div>
          {loading ? (
            <p role="status">Loading accounts…</p>
          ) : failure ? (
            <p role="alert" className="text-destructive">
              {failure}
            </p>
          ) : items.length === 0 ? (
            <p>No matching registered accounts.</p>
          ) : (
            <div className="space-y-2">
              {items.map((account) => (
                <div
                  key={account.email}
                  className="flex flex-wrap items-center justify-between gap-2
                    rounded-md border p-3"
                >
                  <div>
                    <p className="font-medium">
                      {account.name || account.email}
                    </p>
                    <p className="text-muted-foreground text-sm">
                      {account.email} · {account.role} ·{' '}
                      {labels[account.status]} ·{' '}
                      {account.emailVerified ? 'Verified' : 'Unverified'}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void inspect(account)}
                  >
                    Review
                  </Button>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            {cursor && (
              <Button variant="outline" onClick={() => setCursor('')}>
                First page
              </Button>
            )}
            {nextCursor && (
              <Button variant="outline" onClick={() => setCursor(nextCursor)}>
                Next page
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
      {selected && (
        <Card>
          <CardHeader>
            <CardTitle>{selected.name || selected.email}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground text-sm">
              {selected.email} · Registered{' '}
              {selected.createdAt
                ? new Date(selected.createdAt).toLocaleString()
                : 'date unavailable'}{' '}
              · Access: {selected.accessLevel} · Source: {selected.source}
            </p>
            <p className="text-sm">
              {selected.reviewedBy
                ? `Last reviewed by ${selected.reviewedBy} on ${new Date(selected.reviewedAt ?? 0).toLocaleString()}`
                : 'No review recorded yet.'}
            </p>
            {parseStudentIdentifier(selected.email) ? (
              <p className="rounded-md border p-3 text-sm">
                Student role locked by the institutional identifier.
              </p>
            ) : (
              <div className="space-y-2">
                <p className="text-sm font-medium">Academic role</p>
                <div className="flex flex-wrap gap-2">
                  {APP_ROLES.filter(
                    (value) => value !== 'USER' && value !== 'STUDENT'
                  ).map((value) => (
                    <Button
                      key={value}
                      type="button"
                      variant={role === value ? 'default' : 'outline'}
                      onClick={() => {
                        setRole(value);
                        setStatus(
                          value === 'OTHER' ? 'RETAINED_OTHER' : 'APPROVED'
                        );
                      }}
                    >
                      {value}
                    </Button>
                  ))}
                </div>
              </div>
            )}
            <label className="block text-sm font-medium">
              Review status{' '}
              <select
                name="decision-status"
                className="bg-background mt-2 block w-full rounded-md border
                  p-2"
                value={status}
                onChange={(event) =>
                  setStatus(event.target.value as ReviewStatus)
                }
              >
                {statuses.map((value) => (
                  <option key={value} value={value}>
                    {labels[value]}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-medium">
              Reviewer note{' '}
              <textarea
                name="reviewer-note"
                className="bg-background mt-2 min-h-24 w-full rounded-md border
                  p-2"
                value={note}
                maxLength={1000}
                placeholder="Evidence, decision, or reason to retain OTHER"
                onChange={(event) => setNote(event.target.value)}
              />
            </label>
            {mode === 'review' && (
              <div className="space-y-2 rounded-md border p-3">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">
                    Optional Jev evidence analysis
                  </p>
                  <Help title="Jev assistance">
                    Paste only evidence you are authorized to share externally,
                    such as a public appointment notice. A suggestion never
                    changes roles automatically.
                  </Help>
                </div>
                <textarea
                  name="evidence"
                  className="bg-background min-h-24 w-full rounded-md border p-2
                    text-sm"
                  value={evidence}
                  maxLength={4000}
                  placeholder="Official appointment notice or other explicit institutional evidence"
                  onChange={(event) => setEvidence(event.target.value)}
                />
                <Button
                  type="button"
                  variant="outline"
                  disabled={evidence.trim().length < 50}
                  onClick={() => void analyzeEvidence()}
                >
                  Analyze evidence
                </Button>
                {suggestion && (
                  <p role="status" className="text-sm">
                    {suggestion}
                  </p>
                )}
              </div>
            )}
            <div className="flex gap-2">
              <Button
                onClick={() => void save()}
                disabled={
                  saving ||
                  !selected.emailVerified ||
                  Boolean(parseStudentIdentifier(selected.email))
                }
              >
                {saving ? 'Saving…' : 'Save decision'}
              </Button>
              <Button variant="outline" onClick={() => setSelected(null)}>
                Cancel
              </Button>
            </div>
            <details>
              <summary className="cursor-pointer font-medium">
                Decision history ({history.length})
              </summary>
              <div className="mt-2 space-y-2">
                {history.length === 0 ? (
                  <p className="text-muted-foreground text-sm">
                    No decisions recorded.
                  </p>
                ) : (
                  history.map((item) => (
                    <p key={item.id} className="rounded-md border p-2 text-sm">
                      {new Date(item.reviewedAt).toLocaleString()} ·{' '}
                      {item.reviewedBy}: {item.oldRole} → {item.newRole} (
                      {labels[item.status]}){item.note ? ` · ${item.note}` : ''}
                    </p>
                  ))
                )}
              </div>
            </details>
          </CardContent>
        </Card>
      )}
    </PageShell>
  );
}
