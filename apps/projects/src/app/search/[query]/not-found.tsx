import { ProjectRouteNotFound } from '@/components/projects/project-route-not-found';

export default function ProjectSearchNotFound() {
  return (
    <ProjectRouteNotFound
      title="Search page not found"
      description="The search address is invalid or the requested result page is unavailable."
    />
  );
}
