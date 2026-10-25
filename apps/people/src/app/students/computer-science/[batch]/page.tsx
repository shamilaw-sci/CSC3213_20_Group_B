import StudentSubjectBatchPage from '@/components/students/student-subject-batch-page';

export function generateStaticParams(): Array<{ batch: string }> {
  return [];
}

export default async function Page({
  params,
}: {
  params: Promise<{ batch: string }>;
}) {
  const { batch } = await params;
  return <StudentSubjectBatchPage subject="computer-science" batch={batch} />;
}
