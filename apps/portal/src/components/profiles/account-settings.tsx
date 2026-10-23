'use client';

import { useEffect, useState } from 'react';

import { PageLoading } from '@/components/feedback/page-loading';
import { PageHeader, PageShell } from '@/components/layout/page-shell';
import { BackButton } from '@/components/navigation/back-button';
import ProfileContent from '@/components/profiles/account-content';
import { apiHeaders, meApiUrl } from '@/lib/api';

interface ProfileData {
  id: string;
  email: string;
  picture: string;
  googleOAuth: boolean;
  githubOAuth: boolean;
  isEmailNotificationEnabled: boolean;
  isPushNotificationEnabled: boolean;
}

interface SettingsProps {
  from: 'dashboard' | 'profile';
}

export default function Settings({ from }: SettingsProps) {
  const [user, setUser] = useState<ProfileData | null>(null);
  const fallbackHref = from === 'profile' ? '/user/me' : '/dashboard';
  const label = from === 'profile' ? 'Back to Info' : 'Back to Dashboard';

  useEffect(() => {
    let mounted = true;

    async function loadUser() {
      const res = await fetch(meApiUrl(), {
        credentials: 'include',
        cache: 'no-store',
        headers: apiHeaders(),
      });

      if (!res.ok) {
        window.location.href = '/logout';
        return;
      }

      const data: ProfileData | null = await res.json().catch(() => null);
      if (!data) {
        window.location.href = '/?error=fetch_failed';
        return;
      }

      if (mounted) {
        setUser(data);
      }
    }

    loadUser().catch(() => {
      window.location.href = '/?error=fetch_failed';
    });

    return () => {
      mounted = false;
    };
  }, []);

  if (!user) {
    return <PageLoading variant="detail" />;
  }

  return (
    <PageShell>
      <BackButton fallbackHref={fallbackHref} label={label} preferFallback />
      <PageHeader
        title="Settings"
        description="Manage sign-in providers and notification preferences."
      />
      <ProfileContent
        id={user.id}
        googleOAuth={user.googleOAuth}
        githubOAuth={user.githubOAuth}
        isEmailNotificationEnabled={user.isEmailNotificationEnabled}
        isPushNotificationEnabled={user.isPushNotificationEnabled}
      />
    </PageShell>
  );
}
