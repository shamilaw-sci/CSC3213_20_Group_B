import ManageProxiesPage from '@/app/admin/proxies/_components/manage-proxies-page';
import { adminProxiesPageApiUrl } from '@/lib/api';
import { getPageNavigation, type PageSearchParams } from '@/lib/pagination';
import { serverApiJson } from '@/lib/server/api-client';
import type { AdminProxyPageResponse } from '@/types/proxy';

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<PageSearchParams>;
}) {
  const resolvedSearchParams = await searchParams;
  const { cursor } = getPageNavigation({
    pathname: '/admin/proxies',
    searchParams: resolvedSearchParams,
    nextCursor: null,
  });
  const data = await serverApiJson<AdminProxyPageResponse>(
    adminProxiesPageApiUrl(cursor)
  );
  const navigation = getPageNavigation({
    pathname: '/admin/proxies',
    searchParams: resolvedSearchParams,
    nextCursor: data.page.nextCursor,
  });

  return (
    <ManageProxiesPage
      proxies={data.items}
      previousHref={navigation.previousHref}
      nextHref={navigation.nextHref}
      total={data.page.total}
    />
  );
}
