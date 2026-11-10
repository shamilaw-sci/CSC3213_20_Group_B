import type { Page as PageResponse } from '@scs/schemas';
import { redirect } from 'next/navigation';

import ProjectEditor from '@/components/projects/project-editor';
import { meApiUrl, publicProjectsPageApiUrl } from '@/lib/api';
import { getPageNavigation, type PageSearchParams } from '@/lib/pagination';
import { serverApiJson } from '@/lib/server/api-client';
import { isSuperAdminRole } from '@/types/role';

interface UserContext {
  email: string;
  name?: string;
  role?: string;
  accessLevel?: unknown;
}

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
    serverApiJson<UserContext>(meApiUrl()),
    serverApiJson<PageResponse<Record<string, unknown>>>(
      publicProjectsPageApiUrl(cursor)
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
