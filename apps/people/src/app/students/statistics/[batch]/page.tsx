import StudentSubjectBatchPage from '@/views/students/StudentSubjectBatchPage';

export default async function Page({
  params,
}: {
  params: Promise<{ batch: string }>;
}) {
  const { batch } = await params;
  return <StudentSubjectBatchPage subject="statistics" batch={batch} />;
}
