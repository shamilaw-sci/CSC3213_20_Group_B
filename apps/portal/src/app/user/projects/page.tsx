import ProjectManagementPage from '@/components/custom/project-management-page/ProjectManagementPage';
import { meApiUrl, publicProjectsPageApiUrl } from '@/lib/api';
import { getPageNavigation, type PageSearchParams } from '@/lib/pagination';
import { serverApiJson } from '@/lib/server/api-client';

interface UserContext {
  email: string;
  name?: string;
  role?: string;
  accessLevel?: unknown;
}

interface ProjectPageResponse {
  version: 1;
  items: Array<Record<string, unknown>>;
  page: {
    nextCursor: string | null;
    hasMore: boolean;
    total: number;
  };
}

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
    serverApiJson<UserContext>(meApiUrl()),
    serverApiJson<ProjectPageResponse>(publicProjectsPageApiUrl(cursor)),
  ]);
  const navigation = getPageNavigation({
    pathname: '/user/projects',
    searchParams: resolvedSearchParams,
    nextCursor: data.page.nextCursor,
  });

  return (
    <ProjectManagementPage
      initialUser={user}
      initialProjects={data.items}
      previousHref={navigation.previousHref}
      nextHref={navigation.nextHref}
    />
  );
}
