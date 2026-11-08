'use client';

import { ProxyUrlSchema } from '@scs/schemas';
import { Badge } from '@scs/ui/components/badge';
import { Button } from '@scs/ui/components/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@scs/ui/components/card';
import { FieldTitle } from '@scs/ui/components/field';
import { Input } from '@scs/ui/components/input';
import { Label } from '@scs/ui/components/label';
import { Separator } from '@scs/ui/components/separator';
import { Switch } from '@scs/ui/components/switch';
import { AlertCircle, Edit, Save } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

import { PageHeader, PageShell } from '@/components/layout/page-shell';
import { BackButton } from '@/components/navigation/back-button';
import { apiHeaders, readApiError, userProxyApiUrl } from '@/lib/api';
import { getProxyUrlError } from '@/lib/proxy-url';

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
            'border-destructive-border bg-destructive-surface text-destructive-surface-foreground',
        }
      : attemptsRemaining <= 1
        ? {
            label: 'Last attempt',
            className:
              'border-warning-border bg-warning-surface text-warning-surface-foreground',
          }
        : {
            label: 'Edits available',
            className:
              'border-success-border bg-success-surface text-success-surface-foreground',
          };

  async function handleSave() {
    if (saving || !canEdit) return;
    const parsedProxyUrl = ProxyUrlSchema.safeParse(proxyUrl);
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
        toast.error(body.message ?? 'Failed to update redirect settings');
        return;
      }
      const result = (await res.json()) as {
        proxy: { availableAttempts: number };
      };
      setSavedActive(active);
      setProxyUrl(parsedProxyUrl.data);
      setSavedProxyUrl(parsedProxyUrl.data);
      setAttemptsRemaining(result.proxy.availableAttempts);
      toast.success('Redirect settings updated successfully');
      setIsEditing(false);
      router.refresh();
    } catch {
      setActive(savedActive);
      setProxyUrl(savedProxyUrl);
      toast.error('Failed to update redirect settings');
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
        title="Personal Site Redirect"
        description="Choose where your /~username address redirects and track today's edit allowance."
      />

      <div
        className={`flex flex-col gap-3 rounded-md border px-4 py-3 sm:flex-row
          sm:items-center sm:justify-between ${attemptsTone.className}`}
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
        <div
          className="border-warning-border bg-warning-surface
            text-warning-surface-foreground flex items-center gap-3 rounded-md
            border px-4 py-3"
        >
          <AlertCircle className="size-4 shrink-0" />
          <p className="text-sm">
            You have used all your editing attempts for today. Contact an admin
            to reset your attempts.
          </p>
        </div>
      )}

      {canEdit && attemptsRemaining <= 1 && (
        <div
          className="border-warning-border bg-warning-surface
            text-warning-surface-foreground flex items-center gap-3 rounded-md
            border px-4 py-3"
        >
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
          <CardTitle>Redirect destination</CardTitle>
          <CardDescription>
            Configure the HTTPS destination for your personal site.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {isEditing ? (
            <>
              <div
                className="flex flex-col gap-4 sm:flex-row sm:items-center
                  sm:justify-between"
              >
                <div className="space-y-1">
                  <Label htmlFor="proxy-redirect-enabled" className="text-base">
                    Enable Redirect
                  </Label>
                  <p className="text-muted-foreground text-sm">
                    Toggle your personal-site redirect on or off
                  </p>
                </div>
                <Switch
                  id="proxy-redirect-enabled"
                  checked={active}
                  onCheckedChange={setActive}
                  disabled={saving || !canEdit}
                />
              </div>

              <Separator />

              <div className="space-y-2">
                <Label htmlFor="proxyUrl" className="text-base">
                  Destination URL
                </Label>
                <p
                  id="proxyUrl-description"
                  className="text-muted-foreground text-sm"
                >
                  Enter the HTTPS URL visitors should be redirected to
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
              <div
                className="flex flex-col gap-4 sm:flex-row sm:items-center
                  sm:justify-between"
              >
                <div className="space-y-1">
                  <FieldTitle className="text-base">Enable Redirect</FieldTitle>
                  <p className="text-muted-foreground text-sm">
                    {savedActive
                      ? 'Personal-site redirect is enabled'
                      : 'Personal-site redirect is disabled'}
                  </p>
                </div>
                <div className="text-sm font-medium">
                  {savedActive ? 'Enabled' : 'Disabled'}
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <FieldTitle className="text-base">Destination URL</FieldTitle>
                <p className="text-muted-foreground text-sm break-all">
                  {savedProxyUrl || 'No destination URL configured'}
                </p>
              </div>

              <Button
                onClick={handleStartEdit}
                disabled={!canEdit || saving}
                className="w-full sm:w-auto"
              >
                <Edit className="mr-2 size-4" />
                Edit Redirect Settings
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
