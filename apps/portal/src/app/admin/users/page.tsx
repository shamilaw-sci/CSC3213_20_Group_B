import ManageUsersPage from '@/app/admin/users/_components/manage-users-page';
import { adminUsersPageApiUrl } from '@/lib/api';
import { getPageNavigation, type PageSearchParams } from '@/lib/pagination';
import { serverApiJson } from '@/lib/server/api-client';
import type { AdminUserPageResponse } from '@/types/user';

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<PageSearchParams>;
}) {
  const resolvedSearchParams = await searchParams;
  const { cursor } = getPageNavigation({
    pathname: '/admin/users',
    searchParams: resolvedSearchParams,
    nextCursor: null,
  });
  const data = await serverApiJson<AdminUserPageResponse>(
    adminUsersPageApiUrl(cursor)
  );
  const navigation = getPageNavigation({
    pathname: '/admin/users',
    searchParams: resolvedSearchParams,
    nextCursor: data.page.nextCursor,
  });

  return (
    <ManageUsersPage
      users={data.items}
      previousHref={navigation.previousHref}
      nextHref={navigation.nextHref}
    />
  );
}
