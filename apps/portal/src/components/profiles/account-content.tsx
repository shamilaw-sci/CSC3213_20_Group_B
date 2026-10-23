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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@scs/ui/components/tabs';
import { Fingerprint, Mail } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { authConfig } from '@/config/auth.config';
import publicEnvConfig from '@/config/public.env.config';
import { auth_error_messages } from '@/lib/auth/auth-errors';
import { authClient } from '@/lib/auth-client';
import {
  deletePasskeyCredential,
  isPasskeyApiError,
  listPasskeyCredentials,
  type PasskeyCredential,
  passkeysAreSupported,
  registerPasskey,
  updatePasskeyCredential,
} from '@/lib/passkeys';

export interface ProfileContentProps {
  id: string;
  googleOAuth: boolean;
  githubOAuth: boolean;
  isEmailNotificationEnabled: boolean;
  isPushNotificationEnabled: boolean;
}

const settingsTabTriggerClass =
  'box-border h-9 min-w-0 place-self-center overflow-hidden rounded-sm px-1.5 py-0 text-xs leading-none text-ellipsis text-foreground/80 shadow-none hover:bg-background hover:text-foreground focus-visible:ring-0 focus-visible:outline-none data-[state=active]:border-transparent data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-none dark:text-foreground/75 dark:hover:bg-input/40 dark:data-[state=active]:border-transparent dark:data-[state=active]:bg-primary dark:data-[state=active]:text-primary-foreground sm:px-3 sm:text-sm';

function getPasskeyLabel(transports?: string[]) {
  if (!transports?.length) return 'Passkey';

  if (
    transports.some((transport) =>
      ['usb', 'nfc', 'ble', 'cable'].includes(transport)
    )
  ) {
    return 'Security key';
  }

  if (transports.includes('internal')) {
    return 'Device passkey';
  }

  return 'Passkey';
}

function formatPasskeyDate(createdAt: number) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(createdAt));
}

function getPasskeyDisplayName(credential: PasskeyCredential, index: number) {
  return credential.name?.trim() || `Passkey ${index + 1}`;
}

function normalizePasskeyName(name: string) {
  const trimmed = name.trim();

  if (!trimmed) {
    return '';
  }

  if (trimmed.length > authConfig.passkey.maxNameLength) {
    return null;
  }

  if (/[-]/.test(trimmed)) {
    return null;
  }

  return trimmed;
}

function buildPasskeyDrafts(credentials: PasskeyCredential[]) {
  return credentials.reduce<Record<string, string>>((drafts, credential) => {
    drafts[credential.id] = credential.name?.trim() ?? '';
    return drafts;
  }, {});
}

export default function ProfileContent({
  googleOAuth,
  githubOAuth: initialGithubOAuth,
  isEmailNotificationEnabled,
  isPushNotificationEnabled,
}: ProfileContentProps) {
  const [githubOAuth, setGithubOAuth] = useState(initialGithubOAuth);
  const [oauthActionLoading, setOauthActionLoading] = useState(false);
  const [passkeyLoading, setPasskeyLoading] = useState(false);
  const [passkeySupported, setPasskeySupported] = useState(false);
  const [passkeyCredentials, setPasskeyCredentials] = useState<
    PasskeyCredential[]
  >([]);
  const [passkeyCredentialsLoading, setPasskeyCredentialsLoading] =
    useState(false);
  const [passkeyName, setPasskeyName] = useState('');
  const [passkeyNameError, setPasskeyNameError] = useState('');
  const [passkeyRenameDrafts, setPasskeyRenameDrafts] = useState<
    Record<string, string>
  >({});
  const [passkeyRenameErrors, setPasskeyRenameErrors] = useState<
    Record<string, string>
  >({});
  const [passkeyEditingId, setPasskeyEditingId] = useState('');
  const [passkeyRenamingId, setPasskeyRenamingId] = useState('');
  const [passkeyDeletingId, setPasskeyDeletingId] = useState('');

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPasskeySupported(passkeysAreSupported());
  }, []);

  useEffect(() => {
    if (!passkeySupported) return;

    let mounted = true;

    async function loadPasskeys() {
      setPasskeyCredentialsLoading(true);

      try {
        const credentials = await listPasskeyCredentials();
        if (mounted) {
          setPasskeyCredentials(credentials);
          setPasskeyRenameDrafts(buildPasskeyDrafts(credentials));
          setPasskeyRenameErrors({});
          setPasskeyEditingId('');
        }
      } catch (error) {
        if (isPasskeyApiError(error) && error.status === 401) {
          window.location.href = '/logout';
          return;
        }

        if (mounted) {
          toast.error('Failed to load passkeys');
        }
      } finally {
        if (mounted) {
          setPasskeyCredentialsLoading(false);
        }
      }
    }

    loadPasskeys();

    return () => {
      mounted = false;
    };
  }, [passkeySupported]);

  async function connectGithub() {
    const { error } = await authClient.linkSocial({
      provider: 'github',
      callbackURL: new URL(
        '/user/me',
        publicEnvConfig.NEXT_PUBLIC_SITE_URL
      ).toString(),
      errorCallbackURL: new URL(
        '/user/me',
        publicEnvConfig.NEXT_PUBLIC_SITE_URL
      ).toString(),
    });
    if (error) toast.error(error.message ?? 'Failed to connect GitHub');
  }

  async function handleDisconnectGithub() {
    if (oauthActionLoading) return;
    setOauthActionLoading(true);
    try {
      const accountsResult = await authClient.listAccounts();
      if (accountsResult.error?.status === 401) {
        window.location.href = '/logout';
        return;
      }
      const githubAccount = accountsResult.data?.find(
        (account) => account.providerId === 'github'
      );
      if (!githubAccount) {
        setGithubOAuth(false);
        return;
      }
      const { error } = await authClient.unlinkAccount({
        accountId: githubAccount.id,
      });
      if (error) {
        toast.error('Failed to disconnect GitHub');
        return;
      }
      setGithubOAuth(false);
      toast.success('GitHub disconnected successfully');
    } catch {
      toast.error('Failed to disconnect GitHub');
    } finally {
      setOauthActionLoading(false);
    }
  }

  async function handleRegisterPasskey() {
    if (!passkeySupported || passkeyLoading) return;

    if (passkeyCredentials.length >= authConfig.passkey.maxCredentials) {
      toast.error(
        `You can save up to ${authConfig.passkey.maxCredentials} passkeys for this account.`
      );
      return;
    }

    const normalizedName = normalizePasskeyName(passkeyName);

    if (normalizedName === null) {
      setPasskeyNameError(
        'Passkey names must be 1-64 characters and cannot include control characters.'
      );
      return;
    }

    setPasskeyNameError('');
    setPasskeyLoading(true);

    try {
      await registerPasskey(normalizedName || undefined);
      const credentials = await listPasskeyCredentials();
      setPasskeyCredentials(credentials);
      setPasskeyRenameDrafts(buildPasskeyDrafts(credentials));
      setPasskeyRenameErrors({});
      setPasskeyEditingId('');
      setPasskeyName('');
      toast.success('Passkey added successfully');
    } catch (error) {
      if (isPasskeyApiError(error) && error.status === 401) {
        window.location.href = '/logout';
        return;
      }

      if (isPasskeyApiError(error) && error.code === 'passkey_name_conflict') {
        setPasskeyNameError(
          auth_error_messages.passkey_name_conflict ??
            'Passkey name already in use. Try another name or leave it blank to use a default name.'
        );
        toast.error(
          auth_error_messages.passkey_name_conflict ??
            'Passkey name already in use. Try another name or leave it blank to use a default name.'
        );
        return;
      }

      if (isPasskeyApiError(error) && error.status === 409) {
        toast.error(
          auth_error_messages.passkey_limit_reached ??
            'You can save up to 4 passkeys for this account.'
        );
        return;
      }

      toast.error(
        error instanceof Error
          ? error.message
          : 'Failed to add passkey. Please try again.'
      );
    } finally {
      setPasskeyLoading(false);
    }
  }

  const hasReachedPasskeyLimit =
    passkeyCredentials.length >= authConfig.passkey.maxCredentials;

  async function handleDeletePasskey(credentialId: string) {
    if (passkeyDeletingId) return;

    setPasskeyDeletingId(credentialId);

    try {
      await deletePasskeyCredential(credentialId);
      setPasskeyCredentials((current) =>
        current.filter((credential) => credential.id !== credentialId)
      );
      setPasskeyRenameDrafts((current) => {
        const next = { ...current };
        delete next[credentialId];
        return next;
      });
      setPasskeyRenameErrors((current) => {
        const next = { ...current };
        delete next[credentialId];
        return next;
      });
      setPasskeyEditingId((current) =>
        current === credentialId ? '' : current
      );
      toast.success('Passkey removed successfully');
    } catch (error) {
      if (isPasskeyApiError(error) && error.status === 401) {
        window.location.href = '/logout';
        return;
      }

      toast.error(
        error instanceof Error
          ? error.message
          : 'Failed to remove passkey. Please try again.'
      );
    } finally {
      setPasskeyDeletingId('');
    }
  }

  async function handleRenamePasskey(credentialId: string) {
    if (passkeyRenamingId || passkeyDeletingId) return;

    const normalizedName = normalizePasskeyName(
      passkeyRenameDrafts[credentialId] ?? ''
    );

    if (normalizedName === null) {
      setPasskeyRenameErrors((current) => ({
        ...current,
        [credentialId]:
          'Passkey names must be 1-64 characters and cannot include control characters.',
      }));
      return;
    }

    setPasskeyRenameErrors((current) => ({
      ...current,
      [credentialId]: '',
    }));
    setPasskeyRenamingId(credentialId);

    try {
      await updatePasskeyCredential(credentialId, normalizedName);
      const credentials = await listPasskeyCredentials();
      setPasskeyCredentials(credentials);
      setPasskeyRenameDrafts(buildPasskeyDrafts(credentials));
      setPasskeyRenameErrors({});
      setPasskeyEditingId('');
      toast.success(
        normalizedName
          ? 'Passkey renamed successfully'
          : 'Passkey name reset successfully'
      );
    } catch (error) {
      if (isPasskeyApiError(error) && error.status === 401) {
        window.location.href = '/logout';
        return;
      }

      if (isPasskeyApiError(error) && error.code === 'passkey_name_conflict') {
        setPasskeyRenameErrors((current) => ({
          ...current,
          [credentialId]:
            auth_error_messages.passkey_name_conflict ??
            'Passkey name already in use. Try another name or leave it blank to use a default name.',
        }));
        toast.error(
          auth_error_messages.passkey_name_conflict ??
            'Passkey name already in use. Try another name or leave it blank to use a default name.'
        );
        return;
      }

      toast.error(
        error instanceof Error
          ? error.message
          : 'Failed to update passkey. Please try again.'
      );
    } finally {
      setPasskeyRenamingId('');
    }
  }

  function handleStartRenamePasskey(credential: PasskeyCredential) {
    if (passkeyRenamingId || passkeyDeletingId) return;

    setPasskeyEditingId(credential.id);
    setPasskeyRenameDrafts((current) => ({
      ...current,
      [credential.id]: credential.name?.trim() ?? '',
    }));
    setPasskeyRenameErrors((current) => ({
      ...current,
      [credential.id]: '',
    }));
  }

  function handleCancelRenamePasskey(credential: PasskeyCredential) {
    if (
      passkeyRenamingId === credential.id ||
      passkeyDeletingId === credential.id
    )
      return;

    setPasskeyEditingId((current) =>
      current === credential.id ? '' : current
    );
    setPasskeyRenameDrafts((current) => ({
      ...current,
      [credential.id]: credential.name?.trim() ?? '',
    }));
    setPasskeyRenameErrors((current) => ({
      ...current,
      [credential.id]: '',
    }));
  }

  const [emailNotificationState, setEmailNotificationState] = useState<boolean>(
    isEmailNotificationEnabled
  );
  const [pushNotificationState, setPushNotificationState] = useState<boolean>(
    isPushNotificationEnabled
  );
  const [notificationSaving, setNotificationSaving] = useState(false);

  async function updateNotificationSettings(
    nextEmailEnabled: boolean,
    nextPushEnabled: boolean
  ) {
    const url = new URL(
      '/api/me/notifications',
      publicEnvConfig.NEXT_PUBLIC_BASE_API_URL
    );
    const res = await fetch(url.toString(), {
      method: 'PATCH',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-Client-Id': 'portal',
      },
      body: JSON.stringify({
        notifications: {
          email: nextEmailEnabled,
          push: nextPushEnabled,
        },
      }),
    });

    if (!res.ok) {
      throw new Error('Failed to save notification settings');
    }
  }

  return (
    <Tabs defaultValue="sign-in" className="min-w-0 space-y-6">
      <TabsList
        className="bg-muted dark:bg-muted/30 grid min-h-11 w-full min-w-0
          grid-cols-3 items-center gap-1 overflow-hidden rounded-md border p-1
          shadow-sm"
      >
        <TabsTrigger value="sign-in" className={settingsTabTriggerClass}>
          Sign-In
        </TabsTrigger>
        <TabsTrigger value="passkeys" className={settingsTabTriggerClass}>
          Passkeys
        </TabsTrigger>
        <TabsTrigger value="notifications" className={settingsTabTriggerClass}>
          Notifications
        </TabsTrigger>
      </TabsList>

      <TabsContent value="sign-in" className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Sign-In Methods</CardTitle>
            <CardDescription>
              Manage linked authentication providers and sign-in alerts.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div
                className="flex flex-col gap-3 rounded-md border p-3 sm:flex-row
                  sm:items-center sm:justify-between"
              >
                <div className="flex items-center gap-3">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 48 48"
                    width="20"
                    height="20"
                  >
                    <path
                      fill="#FFC107"
                      d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C12.955 4 4 12.955 4 24s8.955 20 20 20s20-8.955 20-20c0-1.341-.138-2.65-.389-3.917"
                    />
                    <path
                      fill="#FF3D00"
                      d="m6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C16.318 4 9.656 8.337 6.306 14.691"
                    />
                    <path
                      fill="#4CAF50"
                      d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.9 11.9 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44"
                    />
                    <path
                      fill="#1976D2"
                      d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917"
                    />
                  </svg>
                  <div>
                    <p className="text-sm font-medium">Google</p>
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className={
                    googleOAuth
                      ? 'border-green-200 bg-green-50 text-green-700'
                      : 'border-gray-200 bg-gray-50 text-gray-600'
                  }
                >
                  {googleOAuth ? 'Connected' : 'Not connected'}
                </Badge>
              </div>

              <div
                className="flex flex-col gap-3 rounded-md border p-3 sm:flex-row
                  sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    width="20"
                    height="20"
                  >
                    <path
                      d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"
                      fill="currentColor"
                    />
                  </svg>
                  <div>
                    <p className="text-sm font-medium">GitHub</p>
                  </div>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Badge
                    variant="outline"
                    className={
                      githubOAuth
                        ? 'border-green-200 bg-green-50 text-green-700'
                        : 'border-gray-200 bg-gray-50 text-gray-600'
                    }
                  >
                    {githubOAuth ? 'Connected' : 'Not connected'}
                  </Badge>
                  {githubOAuth ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleDisconnectGithub}
                      disabled={oauthActionLoading}
                      className="text-red-600 hover:text-red-700"
                    >
                      {oauthActionLoading ? 'Disconnecting...' : 'Disconnect'}
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={connectGithub}
                      disabled={oauthActionLoading}
                      className="w-full sm:w-auto"
                    >
                      Connect
                    </Button>
                  )}
                </div>
              </div>

              <div
                className="flex flex-col gap-3 rounded-md border p-3 sm:flex-row
                  sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <Mail className="size-5" />
                  <div>
                    <p className="text-sm font-medium">Email (Magic Code)</p>
                    <p className="text-muted-foreground text-xs">
                      Sign in using a one-time code sent to your email
                    </p>
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className="w-fit border-blue-200 bg-blue-50 text-blue-700"
                >
                  Enabled
                </Badge>
              </div>
            </div>

            <Separator />
            <div
              className="flex flex-col gap-3 sm:flex-row sm:items-center
                sm:justify-between"
            >
              <div className="space-y-1">
                <Label className="text-base">Login Notifications</Label>
                <p className="text-muted-foreground text-sm">
                  Get notified when someone logs into your account
                </p>
              </div>
              <Switch checked={false} disabled />
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="passkeys" className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Passkeys</CardTitle>
            <CardDescription>
              Manage device passkeys and security keys for faster sign-in.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div
                className="flex flex-col gap-3 sm:flex-row sm:items-start
                  sm:justify-between"
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Fingerprint className="size-5 shrink-0" />
                    <Label className="text-base">Passkeys</Label>
                    <Badge
                      variant="outline"
                      className={
                        passkeyCredentials.length > 0
                          ? 'border-green-200 bg-green-50 text-green-700'
                          : passkeySupported
                            ? 'border-blue-200 bg-blue-50 text-blue-700'
                            : 'border-gray-200 bg-gray-50 text-gray-600'
                      }
                    >
                      {passkeyCredentials.length > 0
                        ? `${passkeyCredentials.length} saved`
                        : passkeySupported
                          ? 'Ready'
                          : 'Unsupported'}
                    </Badge>
                  </div>
                  <p className="text-muted-foreground text-sm">
                    Use your device unlock, fingerprint, or security key to sign
                    in.
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <div className="w-full space-y-2 md:min-w-0 md:flex-1">
                  <Label htmlFor="passkey-name" className="text-sm">
                    Passkey name (optional)
                  </Label>
                  <Input
                    id="passkey-name"
                    value={passkeyName}
                    onChange={(event) => {
                      setPasskeyName(event.target.value);
                      if (passkeyNameError) setPasskeyNameError('');
                    }}
                    placeholder="Office key"
                    maxLength={authConfig.passkey.maxNameLength}
                    className="w-full md:w-[18rem]"
                  />
                  {passkeyNameError ? (
                    <p className="text-destructive text-sm">
                      {passkeyNameError}
                    </p>
                  ) : (
                    <p className="text-muted-foreground text-xs">
                      Leave blank to let the server assign a unique default
                      name.
                    </p>
                  )}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRegisterPasskey}
                  disabled={
                    !passkeySupported ||
                    passkeyLoading ||
                    hasReachedPasskeyLimit
                  }
                  title={
                    !passkeySupported
                      ? 'Passkeys are not supported in this browser.'
                      : hasReachedPasskeyLimit
                        ? `You can save up to ${authConfig.passkey.maxCredentials} passkeys for this account.`
                        : undefined
                  }
                  className="w-fit self-start"
                >
                  {passkeyLoading
                    ? 'Adding...'
                    : hasReachedPasskeyLimit
                      ? 'Limit reached'
                      : 'Add passkey'}
                </Button>
              </div>

              <Separator />

              <div className="space-y-4">
                <div className="space-y-1">
                  <p className="text-sm font-medium">Saved passkeys</p>
                  <p className="text-muted-foreground text-xs">
                    Manage the devices and security keys you use for sign-in.
                  </p>
                </div>

                <div className="space-y-3 rounded-md border p-3">
                  {passkeyCredentialsLoading ? (
                    <p className="text-muted-foreground text-sm">
                      Loading passkeys...
                    </p>
                  ) : passkeyCredentials.length === 0 ? (
                    <p className="text-muted-foreground text-sm">
                      No passkeys saved yet. Add one to sign in faster next
                      time.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {passkeyCredentials.map((credential, index) => (
                        <div
                          key={credential.id}
                          className="bg-muted/20 rounded-md border p-3"
                        >
                          <div className="space-y-3">
                            <div className="min-w-0 space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-sm font-medium">
                                  {getPasskeyDisplayName(credential, index)}
                                </p>
                                <Badge variant="outline" className="text-xs">
                                  {getPasskeyLabel(credential.transports)}
                                </Badge>
                              </div>
                              <p className="text-muted-foreground text-xs">
                                Added {formatPasskeyDate(credential.createdAt)}
                              </p>
                              <p className="text-muted-foreground text-xs">
                                Credential ID is hidden
                              </p>
                            </div>

                            <div className="space-y-2">
                              <div
                                className="flex flex-col gap-2 md:flex-row
                                  md:items-center"
                              >
                                {passkeyEditingId === credential.id ? (
                                  <>
                                    <Input
                                      value={
                                        passkeyRenameDrafts[credential.id] ?? ''
                                      }
                                      onChange={(event) => {
                                        const value = event.target.value;
                                        setPasskeyRenameDrafts((current) => ({
                                          ...current,
                                          [credential.id]: value,
                                        }));
                                        if (
                                          passkeyRenameErrors[credential.id]
                                        ) {
                                          setPasskeyRenameErrors((current) => ({
                                            ...current,
                                            [credential.id]: '',
                                          }));
                                        }
                                      }}
                                      placeholder={getPasskeyDisplayName(
                                        credential,
                                        index
                                      )}
                                      maxLength={
                                        authConfig.passkey.maxNameLength
                                      }
                                      disabled={
                                        passkeyRenamingId === credential.id ||
                                        passkeyDeletingId === credential.id
                                      }
                                      className="sm:max-w-xs"
                                    />
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() =>
                                        handleCancelRenamePasskey(credential)
                                      }
                                      disabled={
                                        passkeyRenamingId === credential.id ||
                                        passkeyDeletingId === credential.id
                                      }
                                    >
                                      Cancel
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() =>
                                        handleRenamePasskey(credential.id)
                                      }
                                      disabled={
                                        passkeyRenamingId === credential.id ||
                                        passkeyDeletingId === credential.id
                                      }
                                    >
                                      {passkeyRenamingId === credential.id
                                        ? 'Saving...'
                                        : 'Save'}
                                    </Button>
                                  </>
                                ) : (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                      handleStartRenamePasskey(credential)
                                    }
                                    disabled={
                                      !!passkeyRenamingId || !!passkeyDeletingId
                                    }
                                  >
                                    Edit
                                  </Button>
                                )}
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() =>
                                    handleDeletePasskey(credential.id)
                                  }
                                  disabled={
                                    passkeyDeletingId === credential.id ||
                                    passkeyRenamingId === credential.id
                                  }
                                >
                                  {passkeyDeletingId === credential.id
                                    ? 'Removing...'
                                    : 'Delete'}
                                </Button>
                              </div>

                              {passkeyEditingId === credential.id ? (
                                <p className="text-muted-foreground text-xs">
                                  Clear the field and save to request a new
                                  server-generated default name.
                                </p>
                              ) : null}

                              {passkeyRenameErrors[credential.id] ? (
                                <p className="text-destructive text-xs">
                                  {passkeyRenameErrors[credential.id]}
                                </p>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {hasReachedPasskeyLimit && (
                  <p className="text-muted-foreground text-sm">
                    You have reached the maximum of{' '}
                    {authConfig.passkey.maxCredentials} saved passkeys.
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="notifications" className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Notification Preferences</CardTitle>
            <CardDescription>
              Choose what notifications you want to receive.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div
              className="flex flex-col gap-3 rounded-md border p-3 sm:flex-row
                sm:items-center sm:justify-between"
            >
              <div className="space-y-1">
                <Label className="text-base">Email Notifications</Label>
                <p className="text-muted-foreground text-sm">
                  Receive notifications via email
                </p>
              </div>
              <Switch
                checked={emailNotificationState}
                disabled={notificationSaving}
                onCheckedChange={async (checked) => {
                  if (notificationSaving) return;

                  const previousEmailEnabled = emailNotificationState;

                  setNotificationSaving(true);
                  setEmailNotificationState(checked);

                  try {
                    await updateNotificationSettings(
                      checked,
                      pushNotificationState
                    );
                    toast.success('Notification settings updated');
                  } catch (error) {
                    setEmailNotificationState(previousEmailEnabled);
                    toast.error(
                      error instanceof Error
                        ? error.message
                        : 'Failed to save notification settings'
                    );
                  } finally {
                    setNotificationSaving(false);
                  }
                }}
              />
            </div>

            <div
              className="flex flex-col gap-3 rounded-md border p-3 sm:flex-row
                sm:items-center sm:justify-between"
            >
              <div className="space-y-1">
                <Label className="text-base">Push Notifications</Label>
                <p className="text-muted-foreground text-sm">
                  Receive push notifications in your browser
                </p>
              </div>
              <Switch
                checked={pushNotificationState}
                disabled={notificationSaving}
                onCheckedChange={async (checked) => {
                  if (notificationSaving) return;

                  const previousPushEnabled = pushNotificationState;

                  setNotificationSaving(true);
                  setPushNotificationState(checked);

                  try {
                    await updateNotificationSettings(
                      emailNotificationState,
                      checked
                    );
                    toast.success('Notification settings updated');
                  } catch (error) {
                    setPushNotificationState(previousPushEnabled);
                    toast.error(
                      error instanceof Error
                        ? error.message
                        : 'Failed to save notification settings'
                    );
                  } finally {
                    setNotificationSaving(false);
                  }
                }}
              />
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
