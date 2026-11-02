import { notFound } from 'next/navigation';

import StudentSubjectBatchPage from '@/components/students/student-subject-batch-page';
import { isPublishedStudentBatch } from '@/lib/data/people-data';

export const dynamic = 'force-dynamic';

export default async function Page({
  params,
}: {
  params: Promise<{ batch: string }>;
}) {
  const { batch } = await params;
  if (!(await isPublishedStudentBatch('computer-science', batch))) notFound();

  return <StudentSubjectBatchPage subject="computer-science" batch={batch} />;
}
