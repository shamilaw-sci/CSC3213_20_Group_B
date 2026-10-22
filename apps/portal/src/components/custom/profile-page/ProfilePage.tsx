import { Badge } from '@scs/ui/components/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@scs/ui/components/card';
import { Mail } from 'lucide-react';

import { BackButton } from '@/components/custom/back-button/back-button';
import ProfileHeader from '@/components/custom/profile-page/components/profile-header';
import { ProfileHeaderProps } from '@/components/custom/profile-page/components/profile-header';
import { PageHeader, PageShell } from '@/components/layout/page-shell';

type ProfilePageProps = Omit<
  ProfileHeaderProps,
  'editHref' | 'publicProfileHref' | 'settingsHref'
> & {
  googleOAuth: boolean;
};

function StatusBadge({
  className,
  children,
}: {
  className: string;
  children: React.ReactNode;
}) {
  return (
    <Badge variant="outline" className={className}>
      {children}
    </Badge>
  );
}

function GoogleLogo() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 48 48"
      width="16"
      height="16"
      aria-hidden="true"
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
  );
}

export default function ProfilePage({
  picture,
  name,
  email,
  role,
  googleOAuth,
}: ProfilePageProps) {
  return (
    <PageShell>
      <BackButton
        fallbackHref="/dashboard"
        label="Back to Dashboard"
        preferFallback
      />
      <PageHeader
        title="Profile"
        description="Review your identity and account sign-in options."
      />
      <ProfileHeader
        picture={picture}
        name={name}
        email={email}
        role={role}
        editHref="/user/me/edit"
        publicProfileHref="/user/me/public-profile"
        settingsHref="/user/me/settings"
      />

      <Card>
        <CardHeader>
          <CardTitle>Account Details</CardTitle>
          <CardDescription>
            Static sign-in capability flags for this account.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <div className="flex items-center justify-between rounded-md border p-4">
            <div className="space-y-1">
              <p className="text-sm font-medium">Google Auth</p>
              <p className="text-muted-foreground flex items-center gap-1 text-sm">
                <GoogleLogo />
                {googleOAuth ? 'Linked to Google sign-in' : 'Not linked'}
              </p>
            </div>
            {googleOAuth ? (
              <StatusBadge className="border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-300">
                Enabled
              </StatusBadge>
            ) : (
              <StatusBadge className="border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-950/30 dark:text-slate-300">
                Disabled
              </StatusBadge>
            )}
          </div>

          <div className="flex items-center justify-between rounded-md border p-4">
            <div className="space-y-1">
              <p className="text-sm font-medium">Email (Magic Code)</p>
              <p className="text-muted-foreground flex items-center gap-1 text-sm">
                <Mail className="size-4" />
                Sign in using a one-time code sent to your email
              </p>
            </div>
            <StatusBadge className="border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-300">
              Enabled
            </StatusBadge>
          </div>
        </CardContent>
      </Card>
    </PageShell>
  );
}
