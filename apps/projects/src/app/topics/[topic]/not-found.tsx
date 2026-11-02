import { ProjectRouteNotFound } from '@/components/projects/project-route-not-found';

export default function TopicNotFound() {
  return (
    <ProjectRouteNotFound
      title="Topic not found"
      description="This topic is not present in the published project data, or the requested page is unavailable."
    />
  );
}
