'use client';

import { useEffect, useState } from 'react';

import { PageLoading } from '@/components/custom/loading/PageLoading';
import ProfileEditPage from '@/components/custom/profile-edit-page/ProfileEditPage';
import { apiHeaders, meApiUrl } from '@/lib/api';
import type { ProfilePictureMode } from '@/types/user';

interface ProfileData {
  email: string;
  name: string;
  picture: string;
  pictureMode?: ProfilePictureMode | null;
  gravatarMail?: string | null;
  googleOAuth?: boolean;
  githubOAuth?: boolean;
  githubUserID?: number | null;
}

export default function Page() {
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
    return <PageLoading variant="detail" />;
  }

  return (
    <ProfileEditPage
      email={user.email}
      name={user.name}
      picture={user.picture}
      pictureMode={user.pictureMode}
      gravatarMail={user.gravatarMail}
      googleOAuth={user.googleOAuth}
      githubOAuth={user.githubOAuth}
      githubUserID={user.githubUserID}
    />
  );
}
