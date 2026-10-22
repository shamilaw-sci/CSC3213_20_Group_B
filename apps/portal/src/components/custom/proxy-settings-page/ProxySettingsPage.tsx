'use client';

import { Badge } from '@scs/ui/components/badge';
import { Button } from '@scs/ui/components/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@scs/ui/components/card';
import { Input } from '@scs/ui/components/input';
import { Label } from '@scs/ui/components/label';
import { Separator } from '@scs/ui/components/separator';
import { Switch } from '@scs/ui/components/switch';
import { AlertCircle, Edit, Save } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

import { BackButton } from '@/components/custom/back-button/back-button';
import { PageHeader, PageShell } from '@/components/layout/page-shell';
import { apiHeaders, readApiError, userProxyApiUrl } from '@/lib/api';
import { getProxyUrlError, proxyUrlSchema } from '@/lib/proxy-url';

interface ProxySettingsPageProps {
  active: boolean;
  url: string;
  availableAttempts: number;
}

async function saveProxySettings(payload: { active: boolean; url: string }) {
  const res = await fetch(userProxyApiUrl(), {
    method: 'POST',
    credentials: 'include',
    headers: apiHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  return res;
}

export default function ProxySettingsPage({
  active: initialActive,
  url: initialUrl,
  availableAttempts,
}: ProxySettingsPageProps) {
  const router = useRouter();
  const [active, setActive] = useState(initialActive);
  const [proxyUrl, setProxyUrl] = useState(initialUrl);
  const [savedActive, setSavedActive] = useState(initialActive);
  const [savedProxyUrl, setSavedProxyUrl] = useState(initialUrl);
  const [attemptsRemaining, setAttemptsRemaining] = useState(availableAttempts);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [proxyUrlError, setProxyUrlError] = useState<string | null>(null);

  const canEdit = attemptsRemaining > 0;
  const isProxyUrlValid = getProxyUrlError(proxyUrl) === null;
  const attemptsTone =
    attemptsRemaining <= 0
      ? {
          label: 'No attempts left',
          className:
            'border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400',
        }
      : attemptsRemaining <= 1
        ? {
            label: 'Last attempt',
            className:
              'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-400',
          }
        : {
            label: 'Edits available',
            className:
              'border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950/30 dark:text-green-400',
          };

  async function handleSave() {
    if (saving || !canEdit) return;
    const parsedProxyUrl = proxyUrlSchema.safeParse(proxyUrl);
    if (!parsedProxyUrl.success) {
      setProxyUrlError(parsedProxyUrl.error.issues[0]?.message);
      return;
    }

    setSaving(true);
    try {
      const res = await saveProxySettings({
        active,
        url: parsedProxyUrl.data,
      });
      if (res.status === 401) {
        setSaving(false);
        router.replace('/logout');
        return;
      }
      if (!res.ok) {
        const body = await readApiError(res);
        setActive(savedActive);
        setProxyUrl(savedProxyUrl);
        toast.error(body.message ?? 'Failed to update proxy settings');
        return;
      }
      const result = (await res.json()) as {
        proxy: { availableAttempts: number };
      };
      setSavedActive(active);
      setProxyUrl(parsedProxyUrl.data);
      setSavedProxyUrl(parsedProxyUrl.data);
      setAttemptsRemaining(result.proxy.availableAttempts);
      toast.success('Proxy settings updated successfully');
      setIsEditing(false);
      router.refresh();
    } catch {
      setActive(savedActive);
      setProxyUrl(savedProxyUrl);
      toast.error('Failed to update proxy settings');
    } finally {
      setSaving(false);
    }
  }

  function handleStartEdit() {
    if (!canEdit || saving) return;
    setActive(savedActive);
    setProxyUrl(savedProxyUrl);
    setProxyUrlError(null);
    setIsEditing(true);
  }

  function handleCancelEdit() {
    setActive(savedActive);
    setProxyUrl(savedProxyUrl);
    setProxyUrlError(null);
    setIsEditing(false);
  }

  return (
    <PageShell>
      <BackButton
        fallbackHref="/dashboard"
        label="Back to Dashboard"
        preferFallback
      />

      <PageHeader
        title="Proxy Settings"
        description="Configure your proxy connection and track today's edit allowance."
      />

      <div
        className={`flex flex-col gap-3 rounded-md border px-4 py-3 sm:flex-row sm:items-center sm:justify-between ${attemptsTone.className}`}
      >
        <div className="space-y-1">
          <p className="text-sm font-medium">Edit Attempts Remaining</p>
          <p className="text-sm">
            {attemptsRemaining} attempt{attemptsRemaining !== 1 ? 's' : ''}{' '}
            remaining today.
          </p>
        </div>
        <Badge variant="outline" className={attemptsTone.className}>
          {attemptsTone.label}
        </Badge>
      </div>

      {!canEdit && (
        <div className="flex items-center gap-3 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-400">
          <AlertCircle className="size-4 shrink-0" />
          <p className="text-sm">
            You have used all your editing attempts for today. Contact an admin
            to reset your attempts.
          </p>
        </div>
      )}

      {canEdit && attemptsRemaining <= 1 && (
        <div className="flex items-center gap-3 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-400">
          <AlertCircle className="size-4 shrink-0" />
          <p className="text-sm">
            You have{' '}
            <strong>
              {attemptsRemaining} attempt
              {attemptsRemaining !== 1 ? 's' : ''}
            </strong>{' '}
            remaining today.
          </p>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Connection</CardTitle>
          <CardDescription>
            Configure your proxy connection settings.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {isEditing ? (
            <>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <Label className="text-base">Enable Proxy</Label>
                  <p className="text-muted-foreground text-sm">
                    Toggle your proxy connection on or off
                  </p>
                </div>
                <Switch
                  checked={active}
                  onCheckedChange={setActive}
                  disabled={saving || !canEdit}
                />
              </div>

              <Separator />

              <div className="space-y-2">
                <Label htmlFor="proxyUrl" className="text-base">
                  Proxy URL
                </Label>
                <p
                  id="proxyUrl-description"
                  className="text-muted-foreground text-sm"
                >
                  Enter the URL of your proxy server
                </p>
                <Input
                  id="proxyUrl"
                  type="url"
                  value={proxyUrl}
                  onChange={(e) => {
                    const value = e.target.value;
                    setProxyUrl(value);
                    setProxyUrlError(getProxyUrlError(value));
                  }}
                  placeholder="https://example.com:8080"
                  disabled={saving || !canEdit}
                  aria-invalid={!!proxyUrlError}
                  aria-describedby={
                    proxyUrlError
                      ? 'proxyUrl-description proxyUrl-error'
                      : 'proxyUrl-description'
                  }
                />
                {proxyUrlError && (
                  <p id="proxyUrl-error" className="text-destructive text-sm">
                    {proxyUrlError}
                  </p>
                )}
              </div>
            </>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <Label className="text-base">Enable Proxy</Label>
                  <p className="text-muted-foreground text-sm">
                    {savedActive
                      ? 'Proxy connection is enabled'
                      : 'Proxy connection is disabled'}
                  </p>
                </div>
                <div className="text-sm font-medium">
                  {savedActive ? 'Enabled' : 'Disabled'}
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label className="text-base">Proxy URL</Label>
                <p className="break-all text-sm text-muted-foreground">
                  {savedProxyUrl || 'No proxy URL configured'}
                </p>
              </div>

              <Button
                onClick={handleStartEdit}
                disabled={!canEdit || saving}
                className="w-full sm:w-auto"
              >
                <Edit className="mr-2 size-4" />
                Edit Proxy Settings
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {isEditing && (
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button
            variant="outline"
            size="default"
            onClick={handleCancelEdit}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || !canEdit || !isProxyUrlValid}
          >
            <Save className="mr-2 size-4" />
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      )}
    </PageShell>
  );
}
