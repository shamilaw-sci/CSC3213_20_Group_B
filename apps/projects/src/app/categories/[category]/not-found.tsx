import { ProjectRouteNotFound } from '@/components/projects/project-route-not-found';

export default function CategoryNotFound() {
  return (
    <ProjectRouteNotFound
      title="Category not found"
      description="This category is not present in the published project data, or the requested page is unavailable."
    />
  );
}
