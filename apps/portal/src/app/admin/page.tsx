import { CurrentUserResponseSchema } from '@scs/schemas';
import { cookies } from 'next/headers';

import AdminOverview from '@/app/admin/_components/admin-overview';
import { apiHeaders, meApiUrl } from '@/lib/api';

export default async function Page() {
  const cookieStore = await cookies();
  const response = await fetch(meApiUrl(), {
    credentials: 'include',
    cache: 'no-store',
    headers: apiHeaders({ Cookie: cookieStore.toString() }),
  });
  const user = CurrentUserResponseSchema.safeParse(
    await response.json().catch(() => null)
  );
  return (
    <AdminOverview
      fullAdmin={user.success && user.data.accessLevel === 'SUPER_ADMIN'}
    />
  );
}
