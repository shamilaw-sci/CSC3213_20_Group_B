import {
  createPageSchema,
  CurrentUserResponseSchema,
  ProjectSummarySchema,
} from '@scs/schemas';

import ProjectEditor from '@/components/projects/project-editor';
import { meApiUrl, publicProjectsPageApiUrl } from '@/lib/api';
import { getPageNavigation, type PageSearchParams } from '@/lib/pagination';
import { serverApiJson } from '@/lib/server/api-client';

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<PageSearchParams>;
}) {
  const resolvedSearchParams = await searchParams;
  const { cursor } = getPageNavigation({
    pathname: '/user/projects',
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
  const navigation = getPageNavigation({
    pathname: '/user/projects',
    searchParams: resolvedSearchParams,
    nextCursor: data.page.nextCursor,
  });

  return (
    <ProjectEditor
      initialUser={user}
      initialProjects={data.items}
      previousHref={navigation.previousHref}
      nextHref={navigation.nextHref}
    />
  );
}
