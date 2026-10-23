import StudentSubjectBatchPage from '@/components/students/student-subject-batch-page';

export default async function Page({
  params,
}: {
  params: Promise<{ batch: string }>;
}) {
  const { batch } = await params;
  return <StudentSubjectBatchPage subject="statistics" batch={batch} />;
}
