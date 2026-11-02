import { DirectoryRouteNotFound } from '@/components/feedback/directory-route-not-found';

export default function DataScienceBatchNotFound() {
  return (
    <DirectoryRouteNotFound
      title="Data Science batch not found"
      description="This batch is not published for the Data Science programme."
      href="/students/data-science"
      actionLabel="View Data Science batches"
    />
  );
}
