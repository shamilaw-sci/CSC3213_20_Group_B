import { PortalRouteNotFound } from '@/components/feedback/portal-route-not-found';

export default function AdminProjectNotFound() {
  return (
    <PortalRouteNotFound
      title="Project not found"
      description="This project is not present in the published project registry."
      href="/admin/projects"
      actionLabel="Browse projects"
    />
  );
}
