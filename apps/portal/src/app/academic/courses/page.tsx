import CourseManagementPage from '@/components/custom/course-management-page/CourseManagementPage';
import { meApiUrl, publicCoursesPageApiUrl } from '@/lib/api';
import { getPageNavigation, type PageSearchParams } from '@/lib/pagination';
import { serverApiJson } from '@/lib/server/api-client';

interface CoursePageResponse {
  version: 1;
  items: unknown[];
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
    pathname: '/academic/courses',
    searchParams: resolvedSearchParams,
    nextCursor: null,
  });
  const [user, data] = await Promise.all([
    serverApiJson<Record<string, unknown>>(meApiUrl()),
    serverApiJson<CoursePageResponse>(publicCoursesPageApiUrl(cursor)),
  ]);
  const navigation = getPageNavigation({
    pathname: '/academic/courses',
    searchParams: resolvedSearchParams,
    nextCursor: data.page.nextCursor,
  });

  return (
    <CourseManagementPage
      initialUser={user}
      initialCourses={data.items}
      previousHref={navigation.previousHref}
      nextHref={navigation.nextHref}
    />
  );
}
