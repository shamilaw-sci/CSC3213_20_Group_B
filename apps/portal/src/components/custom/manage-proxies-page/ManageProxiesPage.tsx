'use client';

import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Edit,
  Globe,
  RefreshCw,
  Save,
  Search,
  X,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

import { BackButton } from '@/components/custom/back-button/back-button';
import {
  PageHeader,
  PageShell,
} from '@/components/custom/page-shell/page-shell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import publicEnvConfig from '@/config/public.env.config';
import {
  adminProxyResetAttemptsApiUrl,
  apiHeaders,
  readApiError,
  userProxyApiUrl,
} from '@/lib/api';
import { getProxyUrlError, proxyUrlSchema } from '@/lib/proxy-url';
import { AdminProxyEntry } from '@/types/proxy';

interface ManageProxiesPageProps {
  proxies: AdminProxyEntry[];
  page: number;
  totalPages: number;
  total: number;
}

async function updateProxy(payload: {
  email: string;
  active: boolean;
  url: string;
}) {
  const res = await fetch(userProxyApiUrl(), {
    method: 'POST',
    credentials: 'include',
    headers: apiHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  return res;
}

async function resetAttempts(email: string) {
  const res = await fetch(adminProxyResetAttemptsApiUrl(), {
    method: 'POST',
    credentials: 'include',
    headers: apiHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ email }),
  });
  return res;
}

interface EditState {
  email: string;
  active: boolean;
  proxyUrl: string;
}

async function toastApiError(response: Response, fallback: string) {
  const body = await readApiError(response);
  toast.error(body.message ?? fallback);
}

export default function ManageProxiesPage({
  proxies: initialProxies,
  page,
  totalPages,
  total,
}: ManageProxiesPageProps) {
  const router = useRouter();
  const [proxies, setProxies] = useState(initialProxies);
  const [editing, setEditing] = useState<EditState | null>(null);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState<string | null>(null);
  const [proxyUrlError, setProxyUrlError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const filteredProxies = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return proxies;

    return proxies.filter((entry) => {
      const searchable = [
        entry.email,
        entry.username,
        entry.url,
        entry.active ? 'active' : 'inactive',
        `${entry.availableAttempts} attempts`,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return searchable.includes(query);
    });
  }, [proxies, search]);

  function startEdit(entry: AdminProxyEntry) {
    setProxyUrlError(null);
    setEditing({
      email: entry.email,
      active: entry.active,
      proxyUrl: entry.url,
    });
  }

  function cancelEdit() {
    setProxyUrlError(null);
    setEditing(null);
  }

  async function saveEdit() {
    if (!editing || saving) return;
    const parsedProxyUrl = proxyUrlSchema.safeParse(editing.proxyUrl);
    if (!parsedProxyUrl.success) {
      setProxyUrlError(parsedProxyUrl.error.issues[0]?.message);
      return;
    }

    setSaving(true);
    try {
      const res = await updateProxy({
        email: editing.email,
        active: editing.active,
        url: parsedProxyUrl.data,
      });
      if (res.status === 401) {
        router.replace('/logout');
        return;
      }
      if (!res.ok) {
        await toastApiError(res, 'Failed to update proxy settings');
        return;
      }
      setProxies((prev) =>
        prev.map((p) =>
          p.email === editing.email
            ? {
                ...p,
                active: editing.active,
                url: parsedProxyUrl.data,
              }
            : p
        )
      );
      toast.success('Proxy settings updated');
      setEditing(null);
    } catch {
      toast.error('Failed to update proxy settings');
    } finally {
      setSaving(false);
    }
  }

  async function handleResetAttempts(email: string) {
    if (resetting) return;
    setResetting(email);
    try {
      const res = await resetAttempts(email);
      if (res.status === 401) {
        router.replace('/logout');
        return;
      }
      if (!res.ok) {
        await toastApiError(res, 'Failed to reset attempts');
        return;
      }
      setProxies((prev) =>
        prev.map((p) =>
          p.email === email
            ? {
                ...p,
                availableAttempts:
                  publicEnvConfig.NEXT_DEFAULT_AVAILABLE_ATTEMPTS,
              }
            : p
        )
      );
      toast.success('Attempts reset successfully');
    } catch {
      toast.error('Failed to reset attempts');
    } finally {
      setResetting(null);
    }
  }

  return (
    <PageShell width="wide">
      {/* Page header */}
      <BackButton fallbackHref="/admin" label="Back to Admin" preferFallback />

      <PageHeader
        title="Manage Proxies"
        description={`View and manage all users' proxy configurations. Total: ${total}`}
        icon={<Globe className="text-muted-foreground size-6" />}
      />

      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by email, username, URL, status, or attempts..."
              className="pl-9"
            />
          </div>
        </CardContent>
      </Card>

      {/* Proxy list */}
      <div className="space-y-4">
        {filteredProxies.length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
              <AlertCircle className="text-muted-foreground size-10" />
              <p className="text-muted-foreground text-sm">
                {search.trim()
                  ? 'No proxy configurations match your search.'
                  : 'No proxy configurations found.'}
              </p>
            </CardContent>
          </Card>
        )}

        {filteredProxies.map((entry) => {
          const isEditing = editing?.email === entry.email;
          return (
            <Card key={entry.email}>
              <CardHeader className="pb-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <CardTitle className="text-base">{entry.email}</CardTitle>
                    <CardDescription>@{entry.username}</CardDescription>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant="outline"
                      className={
                        entry.active
                          ? 'border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950/30 dark:text-green-400'
                          : 'border-gray-200 bg-gray-50 text-gray-600 dark:border-gray-700 dark:bg-gray-900/30 dark:text-gray-400'
                      }
                    >
                      {entry.active ? 'Active' : 'Inactive'}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={
                        entry.availableAttempts > 0
                          ? 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-400'
                          : 'border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400'
                      }
                    >
                      {entry.availableAttempts} attempt
                      {entry.availableAttempts !== 1 ? 's' : ''} left
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {isEditing ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <Label className="text-sm">Enable Proxy</Label>
                      </div>
                      <Switch
                        checked={editing.active}
                        onCheckedChange={(v) =>
                          setEditing((prev) =>
                            prev ? { ...prev, active: v } : prev
                          )
                        }
                        disabled={saving}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label
                        htmlFor={`proxyUrl-${entry.email}`}
                        className="text-sm"
                      >
                        Proxy URL
                      </Label>
                      <Input
                        id={`proxyUrl-${entry.email}`}
                        type="url"
                        value={editing.proxyUrl}
                        onChange={(e) => {
                          const value = e.target.value;
                          setEditing((prev) =>
                            prev ? { ...prev, proxyUrl: value } : prev
                          );
                          setProxyUrlError(getProxyUrlError(value));
                        }}
                        placeholder="https://example.com:8080"
                        disabled={saving}
                        aria-invalid={!!proxyUrlError}
                        aria-describedby={
                          proxyUrlError
                            ? `proxyUrl-error-${entry.email}`
                            : undefined
                        }
                      />
                      {proxyUrlError && (
                        <p
                          id={`proxyUrl-error-${entry.email}`}
                          className="text-destructive text-sm"
                        >
                          {proxyUrlError}
                        </p>
                      )}
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={cancelEdit}
                        disabled={saving}
                      >
                        <X className="mr-1 size-3" />
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        onClick={saveEdit}
                        disabled={
                          saving || getProxyUrlError(editing.proxyUrl) !== null
                        }
                      >
                        <Save className="mr-1 size-3" />
                        {saving ? 'Saving...' : 'Save'}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="text-muted-foreground space-y-1 text-sm">
                      <p>
                        <span className="font-medium text-foreground">
                          URL:
                        </span>{' '}
                        {entry.url || <span className="italic">Not set</span>}
                      </p>
                      {entry.updatedAt && (
                        <p>
                          <span className="font-medium text-foreground">
                            Last updated:
                          </span>{' '}
                          {new Date(entry.updatedAt).toLocaleString()}
                          {entry.updatedBy && ` by ${entry.updatedBy}`}
                        </p>
                      )}
                    </div>
                    <Separator />
                    <div className="flex flex-wrap justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleResetAttempts(entry.email)}
                        disabled={!!resetting}
                      >
                        <RefreshCw
                          className={`mr-1 size-3 ${resetting === entry.email ? 'animate-spin' : ''}`}
                        />
                        {resetting === entry.email
                          ? 'Resetting...'
                          : 'Reset Attempts'}
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => startEdit(entry)}
                        disabled={!!resetting || saving}
                      >
                        <Edit className="mr-1 size-3" />
                        Edit
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push(`/admin/proxies?page=${page - 1}`)}
            disabled={page <= 1}
          >
            <ChevronLeft className="size-4" />
            Previous
          </Button>
          <span className="text-muted-foreground text-sm">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push(`/admin/proxies?page=${page + 1}`)}
            disabled={page >= totalPages}
          >
            Next
            <ChevronRight className="size-4" />
          </Button>
        </div>
      )}
    </PageShell>
  );
}
