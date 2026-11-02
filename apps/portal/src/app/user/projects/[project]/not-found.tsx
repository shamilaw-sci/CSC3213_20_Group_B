import { PortalRouteNotFound } from '@/components/feedback/portal-route-not-found';

export default function UserProjectNotFound() {
  return (
    <PortalRouteNotFound
      title="Project not found"
      description="This project is not available in your published project registry."
      href="/user/projects"
      actionLabel="Browse your projects"
    />
  );
}
