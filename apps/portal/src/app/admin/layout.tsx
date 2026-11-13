import {
  ACCESS_LEVEL,
  APP_ROLE,
  CurrentUserResponseSchema,
} from '@scs/schemas';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ReactNode } from 'react';

import { apiHeaders, meApiUrl } from '@/lib/api';

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

  const user = CurrentUserResponseSchema.safeParse(
    await response.json().catch(() => null)
  );
  if (
    !user.success ||
    !(
      user.data.accessLevel === ACCESS_LEVEL.SUPER_ADMIN ||
      user.data.accessLevel === ACCESS_LEVEL.ADMIN ||
      (user.data.role === APP_ROLE.ACADEMIC &&
        (user.data.honoursDepartments?.length ?? 0) > 0)
    )
  ) {
    redirect('/dashboard');
  }

  return children;
}
