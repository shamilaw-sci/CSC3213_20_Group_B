import { ProjectRouteNotFound } from '@/components/projects/project-route-not-found';

export default function ProjectTypeNotFound() {
  return (
    <ProjectRouteNotFound
      title="Project type not found"
      description="This project type or result page is not available in the directory."
    />
  );
}
