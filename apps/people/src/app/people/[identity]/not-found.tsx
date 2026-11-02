import { DirectoryRouteNotFound } from '@/components/feedback/directory-route-not-found';

export default function PersonNotFound() {
  return (
    <DirectoryRouteNotFound
      title="Person not found"
      description="No published directory profile or project record matches this identity."
      href="/"
      actionLabel="Browse people"
    />
  );
}
