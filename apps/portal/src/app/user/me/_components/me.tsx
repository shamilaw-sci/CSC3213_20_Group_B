'use client';

import { useEffect, useState } from 'react';

import { ProfilePageLoading } from '@/components/feedback/page-loading';
import ProfilePage from '@/components/profiles/profile-overview';
import { apiHeaders, meApiUrl } from '@/lib/api';
import { AppRole } from '@/types/role';

interface ProfileData {
  id: string;
  email: string;
  name: string;
  picture: string;
  role: AppRole;
  blacklisted: boolean;
  googleOAuth: boolean;
  isEmailNotificationEnabled: boolean;
  isPushNotificationEnabled: boolean;
}

export default function Me() {
  const [user, setUser] = useState<ProfileData | null>(null);

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
    return <ProfilePageLoading />;
  }

  return <ProfilePage {...user} />;
}
