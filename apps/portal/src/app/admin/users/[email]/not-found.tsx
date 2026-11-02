import { PortalRouteNotFound } from '@/components/feedback/portal-route-not-found';

export default function AdminUserNotFound() {
  return (
    <PortalRouteNotFound
      title="User not found"
      description="No Portal account matches this email address."
      href="/admin/users"
      actionLabel="Browse users"
    />
  );
}
