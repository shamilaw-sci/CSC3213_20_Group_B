import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ReactNode } from 'react';

import { apiHeaders, meApiUrl } from '@/lib/api';
import { isRecord } from '@/lib/is-record';
import { isSuperAdminRole } from '@/types/role';

interface AdminLayoutProps {
  children: ReactNode;
}

export default async function AdminLayout({ children }: AdminLayoutProps) {
  const cookieStore = await cookies();
  const response = await fetch(meApiUrl(), {
    credentials: 'include',
    cache: 'no-store',
    headers: apiHeaders({ Cookie: cookieStore.toString() }),
  });

  if (response.status === 401) {
    redirect('/logout');
  }

  if (!response.ok) {
    redirect('/?error=fetch_failed');
  }

  const user: unknown = await response.json().catch(() => null);

  if (!isRecord(user) || !isSuperAdminRole(user)) {
    redirect('/dashboard');
  }

  return children;
}
