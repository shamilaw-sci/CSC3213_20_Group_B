import {
  CourseSchema,
  createPageSchema,
  CurrentUserResponseSchema,
} from '@scs/schemas';

import CourseEditor from '@/components/courses/course-editor';
import { meApiUrl, publicCoursesPageApiUrl } from '@/lib/api';
import { getPageNavigation, type PageSearchParams } from '@/lib/pagination';
import { serverApiJson } from '@/lib/server/api-client';

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
    serverApiJson(meApiUrl(), CurrentUserResponseSchema),
    serverApiJson(
      publicCoursesPageApiUrl(cursor),
      createPageSchema(CourseSchema)
    ),
  ]);
  const navigation = getPageNavigation({
    pathname: '/academic/courses',
    searchParams: resolvedSearchParams,
    nextCursor: data.page.nextCursor,
  });

  return (
    <CourseEditor
      initialUser={user}
      initialCourses={data.items}
      previousHref={navigation.previousHref}
      nextHref={navigation.nextHref}
    />
  );
}
