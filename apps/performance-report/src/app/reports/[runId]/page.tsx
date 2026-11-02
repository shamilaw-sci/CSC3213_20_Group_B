import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { ReportApp } from '@/components/report-view';
import { loadReport } from '@/lib/reports';

type PageProps = { params: Promise<{ runId: string }> };

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { runId } = await params;
  return { title: `${runId} | Performance Reports` };
}

export default async function ReportPage({ params }: PageProps) {
  const { runId } = await params;
  const report = await loadReport(runId);
  if (!report) notFound();
  return <ReportApp report={report} />;
}
