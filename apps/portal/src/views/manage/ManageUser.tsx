'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { PageLoading } from '@/components/custom/loading/PageLoading';
import ManageUserPage from '@/components/custom/manage-user-page/ManageUserPage';
import { adminUserApiUrl, apiHeaders } from '@/lib/api';
import { AdminUserData } from '@/types/user';

type AdminUserResponse = Partial<AdminUserData>;

function normalizeAdminUser(data: AdminUserResponse, email: string) {
  return {
    ...data,
    id: data.id ?? email,
    email: data.email ?? email,
    name: data.name ?? '',
    picture: data.picture ?? '',
    googleOAuth: data.googleOAuth ?? false,
    githubOAuth: data.githubOAuth ?? false,
    githubUserID: data.githubUserID ?? null,
  } as AdminUserData;
}

export default function ManageUser({ email }: { email: string }) {
  const router = useRouter();
  const [user, setUser] = useState<AdminUserData | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadUser() {
      const res = await fetch(adminUserApiUrl(email), {
        credentials: 'include',
        cache: 'no-store',
        headers: apiHeaders(),
      });

      if (res.status === 401) {
        window.location.href = '/logout';
        return;
      }

      if (res.status === 403) {
        router.replace('/dashboard');
        return;
      }

      if (res.status === 404) {
        router.replace('/admin/users');
        return;
      }

      if (!res.ok) {
        console.error(
          `Failed to fetch user: HTTP ${res.status} ${res.statusText}`
        );
        window.location.href = '/?error=fetch_failed';
        return;
      }

      const data = await res.json().catch(() => null);
      if (!data) {
        window.location.href = '/?error=fetch_failed';
        return;
      }

      if (mounted) {
        setUser(normalizeAdminUser(data, email));
      }
    }

    loadUser().catch(() => {
      window.location.href = '/?error=fetch_failed';
    });

    return () => {
      mounted = false;
    };
  }, [email, router]);

  if (!user) {
    return <PageLoading variant="detail" />;
  }

  return <ManageUserPage user={user} />;
}
