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
  IdentityReviewStatusSchema,
  IdentitySuggestionResponseSchema,
} from '@scs/schemas';
import { Badge } from '@scs/ui/components/badge';
import { Button, buttonVariants } from '@scs/ui/components/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@scs/ui/components/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@scs/ui/components/dialog';
import { Input } from '@scs/ui/components/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@scs/ui/components/popover';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@scs/ui/components/select';
import { Skeleton } from '@scs/ui/components/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@scs/ui/components/table';
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
const statuses = IdentityReviewStatusSchema.options;
const decisionStatuses = statuses.filter((value) => value !== 'NOT_REQUIRED');
const labels: Record<ReviewStatus, string> = {
  PENDING: 'Pending review',
  NEEDS_EVIDENCE: 'Needs evidence',
  APPROVED: 'Approved',
  RETAINED_OTHER: 'Reviewed and retained as OTHER',
  CONFLICT: 'Conflict',
  NOT_REQUIRED: 'No review needed',
};
const roleLabels: Record<AppRole, string> = {
  USER: 'User',
  STUDENT: 'Student',
  ACADEMIC: 'Academic staff',
  NON_ACADEMIC: 'Non-academic staff',
  ACADEMIC_SUPPORT: 'Academic support staff',
  OTHER: 'Unclassified',
};
const sourceLabels: Record<Account['source'], string> = {
  STUDENT_PATTERN: 'Student email rule',
  AUTOMATIC: 'Default classification',
  EXISTING: 'Existing role',
  MANUAL: 'Admin change',
  REVIEW: 'Identity review',
  MIGRATION: 'Earlier migration',
};
const roleColors: Record<AppRole, string> = {
  USER: 'border-slate-300 bg-slate-100 text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100',
  STUDENT:
    'border-blue-300 bg-blue-100 text-blue-900 dark:border-blue-700 dark:bg-blue-950 dark:text-blue-100',
  ACADEMIC:
    'border-violet-300 bg-violet-100 text-violet-900 dark:border-violet-700 dark:bg-violet-950 dark:text-violet-100',
  NON_ACADEMIC:
    'border-cyan-300 bg-cyan-100 text-cyan-900 dark:border-cyan-700 dark:bg-cyan-950 dark:text-cyan-100',
  ACADEMIC_SUPPORT:
    'border-indigo-300 bg-indigo-100 text-indigo-900 dark:border-indigo-700 dark:bg-indigo-950 dark:text-indigo-100',
  OTHER:
    'border-amber-300 bg-amber-100 text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100',
};
const statusColors: Record<ReviewStatus, string> = {
  PENDING:
    'border-amber-300 bg-amber-100 text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100',
  NEEDS_EVIDENCE:
    'border-orange-300 bg-orange-100 text-orange-900 dark:border-orange-700 dark:bg-orange-950 dark:text-orange-100',
  APPROVED:
    'border-emerald-300 bg-emerald-100 text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-100',
  RETAINED_OTHER:
    'border-slate-300 bg-slate-100 text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100',
  CONFLICT:
    'border-red-300 bg-red-100 text-red-900 dark:border-red-700 dark:bg-red-950 dark:text-red-100',
  NOT_REQUIRED:
    'border-blue-300 bg-blue-100 text-blue-900 dark:border-blue-700 dark:bg-blue-950 dark:text-blue-100',
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
  const [statusFilter, setStatusFilter] = useState(
    mode === 'review' ? 'PENDING' : ''
  );
  const [verifiedFilter, setVerifiedFilter] = useState(
    mode === 'review' ? 'verified' : 'all'
  );
  const [cursor, setCursor] = useState('');
  const [previousCursors, setPreviousCursors] = useState<string[]>([]);
  const [items, setItems] = useState<Account[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [selected, setSelected] = useState<Account | null>(null);
  const [role, setRole] = useState<AppRole>('OTHER');
  const [status, setStatus] = useState<ReviewStatus>('PENDING');
  const [note, setNote] = useState('');
  const [history, setHistory] = useState<Audit[]>([]);
  const [historyError, setHistoryError] = useState('');
  const [evidence, setEvidence] = useState('');
  const [suggestion, setSuggestion] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
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
        setItems([]);
        setNextCursor(null);
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
    setStatus(account.status === 'NOT_REQUIRED' ? 'APPROVED' : account.status);
    setNote(account.note);
    setHistory([]);
    setHistoryError('');
    setEvidence('');
    setSuggestion('');
    const url = apiUrl('/api/admin/identity/history');
    url.searchParams.set('email', account.email);
    try {
      const response = await fetch(url, {
        credentials: 'include',
        cache: 'no-store',
        headers: apiHeaders(),
      });
      if (!response.ok) throw new Error((await readApiError(response)).message);
      const data = IdentityHistoryResponseSchema.parse(await response.json());
      setHistory(data.items);
    } catch (error) {
      setHistoryError(
        error instanceof Error ? error.message : 'History unavailable'
      );
    }
  }

  async function save() {
    if (!selected || saving) return;
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
    if (analyzing || evidence.trim().length < 50) return;
    setAnalyzing(true);
    setSuggestion('Analyzing supplied evidence…');
    try {
      const response = await fetch(apiUrl('/api/admin/identity/suggestion'), {
        method: 'POST',
        credentials: 'include',
        headers: apiHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ evidence }),
      });
      if (!response.ok) throw new Error((await readApiError(response)).message);
      const result = IdentitySuggestionResponseSchema.parse(
        await response.json()
      );
      setSuggestion(
        result.kind === 'suggested'
          ? `Jev suggests ${result.role} (${Math.round(result.confidence * 100)}% confidence). Review the evidence yourself before saving.`
          : result.kind === 'unavailable'
            ? 'Jev is unavailable; manual review remains available.'
            : result.kind.replaceAll('_', ' ')
      );
    } catch (error) {
      setSuggestion(error instanceof Error ? error.message : 'Analysis failed');
    } finally {
      setAnalyzing(false);
    }
  }

  return (
    <PageShell width="wide">
      <BackButton fallbackHref="/admin" label="Back to Admin" preferFallback />
      <PageHeader
        title={
          mode === 'review'
            ? 'Accounts needing review'
            : 'Account classifications'
        }
        description={
          mode === 'review'
            ? 'Check verified accounts whose university email did not identify a student. Use institutional evidence to classify staff or record why a decision is still open.'
            : 'Find registered university accounts, see how their role was assigned, and review or correct staff classifications.'
        }
      />
      <div className="flex flex-wrap gap-2">
        <Link
          className={buttonVariants({
            variant: mode === 'mappings' ? 'default' : 'outline',
          })}
          href="/admin/identity/mappings"
        >
          All account classifications
        </Link>
        <Link
          className={buttonVariants({
            variant: mode === 'review' ? 'default' : 'outline',
          })}
          href="/admin/identity/review"
        >
          Needs review
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
      <p className="text-muted-foreground text-sm">
        A student email such as S21513@sci.pdn.ac.lk is classified
        automatically. “Pending” means a role decision is still needed; it does
        not mean an account, student record, or admission is awaiting approval.
        This list contains registered Portal accounts, not every student in the
        public directory. Email verification only confirms control of the email
        address.
      </p>
      <Card>
        <CardHeader>
          <CardTitle>
            {mode === 'review' ? 'Review queue' : 'Find an account'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <form
            className="flex flex-wrap gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              setCursor('');
              setPreviousCursors([]);
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
            <div className="flex flex-col gap-1 text-sm">
              <span id="role-filter-label">Role</span>
              <Select
                value={roleFilter || 'all'}
                onValueChange={(value) => {
                  if (value === null) return;
                  setCursor('');
                  setPreviousCursors([]);
                  setRoleFilter(value === 'all' ? '' : value);
                }}
              >
                <SelectTrigger aria-labelledby="role-filter-label">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="all">All roles</SelectItem>
                    {APP_ROLES.map((value) => (
                      <SelectItem key={value} value={value}>
                        {roleLabels[value]}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1 text-sm">
              <span id="status-filter-label">Review status</span>
              <Select
                value={statusFilter || 'all'}
                onValueChange={(value) => {
                  if (value === null) return;
                  setCursor('');
                  setPreviousCursors([]);
                  setStatusFilter(value === 'all' ? '' : value);
                }}
              >
                <SelectTrigger aria-labelledby="status-filter-label">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="all">All statuses</SelectItem>
                    {statuses.map((value) => (
                      <SelectItem key={value} value={value}>
                        {labels[value]}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1 text-sm">
              <span id="verified-filter-label">Verification</span>
              <Select
                value={verifiedFilter}
                onValueChange={(value) => {
                  if (value === null) return;
                  setCursor('');
                  setPreviousCursors([]);
                  setVerifiedFilter(value);
                }}
              >
                <SelectTrigger aria-labelledby="verified-filter-label">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="verified">Verified</SelectItem>
                    <SelectItem value="unverified">Unverified</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          </div>
          {loading ? (
            <div
              role="status"
              aria-label="Loading accounts"
              className="space-y-3"
              aria-busy="true"
            >
              {Array.from({ length: 5 }, (_, index) => (
                <Skeleton key={index} className="h-14 w-full" />
              ))}
            </div>
          ) : failure ? (
            <div
              role="alert"
              className="text-destructive flex flex-wrap items-center gap-2"
            >
              <p>{failure}</p>
              <Button
                type="button"
                variant="outline"
                onClick={() => setRevision((value) => value + 1)}
              >
                Retry
              </Button>
            </div>
          ) : items.length === 0 ? (
            <p>
              {mode === 'review' && !search
                ? 'No accounts match this review queue. Try another review status to see earlier decisions.'
                : 'No registered accounts match these filters. Try a name or university email.'}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Account</TableHead>
                  <TableHead>Email verification</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>
                    <span className="sr-only">Action</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((account) => (
                  <TableRow key={account.email}>
                    <TableCell>
                      <span className="block font-medium">
                        {account.name || account.email}
                      </span>
                      <span className="text-muted-foreground">
                        {account.email}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          account.emailVerified
                            ? statusColors.APPROVED
                            : statusColors.PENDING
                        }
                      >
                        {account.emailVerified
                          ? 'Email verified'
                          : 'Email not verified'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={roleColors[account.role]}
                      >
                        {roleLabels[account.role]}
                      </Badge>
                    </TableCell>
                    <TableCell>{sourceLabels[account.source]}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={statusColors[account.status]}
                      >
                        {labels[account.status]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => void inspect(account)}
                      >
                        {account.role === 'STUDENT'
                          ? 'View classification'
                          : mode === 'review'
                            ? 'Review account'
                            : 'View or edit'}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          <nav
            aria-label="Account pages"
            className="flex flex-wrap items-center gap-2"
          >
            <span className="text-muted-foreground mr-auto text-sm">
              Page {previousCursors.length + 1} · {items.length} accounts on
              this page
            </span>
            {previousCursors.length > 0 && (
              <Button
                type="button"
                variant="outline"
                disabled={loading}
                onClick={() => {
                  setCursor(previousCursors.at(-1) ?? '');
                  setPreviousCursors((values) => values.slice(0, -1));
                }}
              >
                Previous page
              </Button>
            )}
            {nextCursor && (
              <Button
                type="button"
                variant="outline"
                disabled={loading}
                onClick={() => {
                  setPreviousCursors((values) => [...values, cursor]);
                  setCursor(nextCursor);
                }}
              >
                Next page
              </Button>
            )}
          </nav>
        </CardContent>
      </Card>
      <Dialog
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open && !saving) setSelected(null);
        }}
      >
        {selected && (
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>{selected.name || selected.email}</DialogTitle>
              <DialogDescription>
                See the current classification and decision history. Save only a
                change supported by institutional evidence.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-4">
              <p className="text-muted-foreground text-sm">
                {selected.email} · Registered{' '}
                {selected.createdAt
                  ? new Date(selected.createdAt).toLocaleString()
                  : 'date unavailable'}{' '}
                · Access: {selected.accessLevel} · Source:{' '}
                {sourceLabels[selected.source]}
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
              <div className="flex flex-col gap-1 text-sm font-medium">
                <span id="decision-status-label">Review status</span>
                <Select
                  value={status}
                  onValueChange={(value) =>
                    setStatus(IdentityReviewStatusSchema.parse(value))
                  }
                >
                  <SelectTrigger
                    aria-labelledby="decision-status-label"
                    className="w-full"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {decisionStatuses.map((value) => (
                        <SelectItem key={value} value={value}>
                          {labels[value]}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
              <label className="block text-sm font-medium">
                Reviewer note{' '}
                <textarea
                  name="reviewer-note"
                  className="bg-background mt-2 min-h-24 w-full rounded-md
                    border p-2"
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
                      Paste only evidence you are authorized to share
                      externally, such as a public appointment notice. A
                      suggestion never changes roles automatically.
                    </Help>
                  </div>
                  <textarea
                    name="evidence"
                    className="bg-background min-h-24 w-full rounded-md border
                      p-2 text-sm"
                    value={evidence}
                    maxLength={4000}
                    placeholder="Official appointment notice or other explicit institutional evidence"
                    onChange={(event) => setEvidence(event.target.value)}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    disabled={analyzing || evidence.trim().length < 50}
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
              <DialogFooter>
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
                <Button
                  variant="outline"
                  disabled={saving}
                  onClick={() => setSelected(null)}
                >
                  Cancel
                </Button>
              </DialogFooter>
              <details>
                <summary className="cursor-pointer font-medium">
                  Decision history ({history.length})
                </summary>
                <div className="mt-2 space-y-2">
                  {historyError ? (
                    <p role="alert" className="text-destructive text-sm">
                      {historyError}
                    </p>
                  ) : history.length === 0 ? (
                    <p className="text-muted-foreground text-sm">
                      No decisions recorded.
                    </p>
                  ) : (
                    history.map((item) => (
                      <p
                        key={item.id}
                        className="rounded-md border p-2 text-sm"
                      >
                        {new Date(item.reviewedAt).toLocaleString()} ·{' '}
                        {item.reviewedBy}: {item.oldRole} → {item.newRole} (
                        {labels[item.status]})
                        {item.note ? ` · ${item.note}` : ''}
                      </p>
                    ))
                  )}
                </div>
              </details>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </PageShell>
  );
}
