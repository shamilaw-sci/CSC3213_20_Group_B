import { DirectoryRouteNotFound } from '@/components/feedback/directory-route-not-found';

export default function ComputerScienceBatchNotFound() {
  return (
    <DirectoryRouteNotFound
      title="Computer Science batch not found"
      description="This batch is not published for the Computer Science programme."
      href="/students/computer-science"
      actionLabel="View Computer Science batches"
    />
  );
}
