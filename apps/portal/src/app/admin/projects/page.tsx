import {
  createPageSchema,
  CurrentUserResponseSchema,
  ProjectSummarySchema,
} from '@scs/schemas';
import { redirect } from 'next/navigation';

import ProjectEditor from '@/components/projects/project-editor';
import { meApiUrl, publicProjectsPageApiUrl } from '@/lib/api';
import { getPageNavigation, type PageSearchParams } from '@/lib/pagination';
import { serverApiJson } from '@/lib/server/api-client';
import { isSuperAdminRole } from '@/types/role';

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<PageSearchParams>;
}) {
  const resolvedSearchParams = await searchParams;
  const { cursor } = getPageNavigation({
    pathname: '/admin/projects',
    searchParams: resolvedSearchParams,
    nextCursor: null,
  });
  const [user, data] = await Promise.all([
    serverApiJson(meApiUrl(), CurrentUserResponseSchema),
    serverApiJson(
      publicProjectsPageApiUrl(cursor),
      createPageSchema(ProjectSummarySchema)
    ),
  ]);
  if (!isSuperAdminRole(user)) redirect('/dashboard');

  const navigation = getPageNavigation({
    pathname: '/admin/projects',
    searchParams: resolvedSearchParams,
    nextCursor: data.page.nextCursor,
  });

  return (
    <ProjectEditor
      admin
      initialUser={user}
      initialProjects={data.items}
      previousHref={navigation.previousHref}
      nextHref={navigation.nextHref}
    />
  );
}
