import { AdminAvatarReviewPageSchema } from '@scs/schemas';

import ManageAvatarReviewsPage from '@/app/admin/avatar-reviews/_components/manage-avatar-reviews-page';
import { adminAvatarReviewsPageApiUrl } from '@/lib/api';
import { getPageNavigation, type PageSearchParams } from '@/lib/pagination';
import { serverApiJson } from '@/lib/server/api-client';

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<PageSearchParams>;
}) {
  const resolvedSearchParams = await searchParams;
  const { cursor } = getPageNavigation({
    pathname: '/admin/avatar-reviews',
    searchParams: resolvedSearchParams,
    nextCursor: null,
  });
  const data = await serverApiJson(
    adminAvatarReviewsPageApiUrl(cursor),
    AdminAvatarReviewPageSchema
  );
  const navigation = getPageNavigation({
    pathname: '/admin/avatar-reviews',
    searchParams: resolvedSearchParams,
    nextCursor: data.page.nextCursor,
  });

  return (
    <ManageAvatarReviewsPage
      items={data.items}
      previousHref={navigation.previousHref}
      nextHref={navigation.nextHref}
    />
  );
}
