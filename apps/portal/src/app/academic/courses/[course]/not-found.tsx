import { PortalRouteNotFound } from '@/components/feedback/portal-route-not-found';

export default function CourseNotFound() {
  return (
    <PortalRouteNotFound
      title="Course not found"
      description="This course is not present in the published academic registry."
      href="/academic/courses"
      actionLabel="Browse courses"
    />
  );
}
