import { ProjectRouteNotFound } from '@/components/projects/project-route-not-found';

export default function BrowsePageNotFound() {
  return (
    <ProjectRouteNotFound
      title="Project page not found"
      description="That page is beyond the available published project results."
    />
  );
}
