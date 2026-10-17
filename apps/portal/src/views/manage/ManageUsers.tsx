'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { PageLoading } from '@/components/custom/loading/PageLoading';
import ManageUsersPage from '@/components/custom/manage-users-page/ManageUsersPage';
import { adminUsersApiUrl, apiHeaders } from '@/lib/api';
import { AccessLevel, AppRole } from '@/types/role';

export interface UserData {
  id: string;
  email: string;
  name: string;
  picture: string;
  role: AppRole;
  accessLevel: AccessLevel;
  blacklisted: boolean;
  createdAt?: number;
}

export default function ManageUsers() {
  const router = useRouter();
  const [users, setUsers] = useState<UserData[] | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadUsers() {
      const res = await fetch(adminUsersApiUrl(), {
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

      if (!res.ok) {
        console.error(
          `Failed to fetch users: HTTP ${res.status} ${res.statusText}`
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
        setUsers(Array.isArray(data) ? data : (data.users ?? []));
      }
    }

    loadUsers().catch(() => {
      window.location.href = '/?error=fetch_failed';
    });

    return () => {
      mounted = false;
    };
  }, [router]);

  if (!users) {
    return <PageLoading variant="table" />;
  }

  return <ManageUsersPage users={users} />;
}
