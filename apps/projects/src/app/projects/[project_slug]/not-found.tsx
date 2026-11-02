import { ProjectRouteNotFound } from '@/components/projects/project-route-not-found';

export default function ProjectNotFound() {
  return (
    <ProjectRouteNotFound
      title="Project not found"
      description="This project is not in the published registry. It may have been moved, renamed, or removed."
    />
  );
}
