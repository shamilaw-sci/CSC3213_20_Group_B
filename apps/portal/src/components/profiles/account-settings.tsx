'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { SettingsPageLoading } from '@/components/feedback/page-loading';
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
  const router = useRouter();
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
        router.replace('/logout');
        return;
      }

      const data: ProfileData | null = await res.json().catch(() => null);
      if (!data) {
        router.replace('/?error=fetch_failed');
        return;
      }

      if (mounted) {
        setUser(data);
      }
    }

    loadUser().catch(() => {
      router.replace('/?error=fetch_failed');
    });

    return () => {
      mounted = false;
    };
  }, [router]);

  if (!user) {
    return <SettingsPageLoading />;
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
