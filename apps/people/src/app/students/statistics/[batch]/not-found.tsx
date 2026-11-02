import { DirectoryRouteNotFound } from '@/components/feedback/directory-route-not-found';

export default function StatisticsBatchNotFound() {
  return (
    <DirectoryRouteNotFound
      title="Statistics batch not found"
      description="This batch is not published for the Statistics programme."
      href="/students/statistics"
      actionLabel="View Statistics batches"
    />
  );
}
