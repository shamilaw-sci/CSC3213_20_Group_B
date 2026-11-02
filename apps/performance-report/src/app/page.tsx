import Link from 'next/link';

import { listReports } from '@/lib/reports';

export const dynamic = 'force-dynamic';

export default async function ReportsPage() {
  const reports = await listReports();
  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <header className="border-ink border-b-2 pb-5">
        <p className="font-mono text-sm font-semibold">SCS PDN / PERFORMANCE</p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight">
          Local Performance Reports
        </h1>
        <p className="text-subtle mt-2">
          Select a generated run. Reports are read from the local results
          directory.
        </p>
      </header>
      {reports.length ? (
        <ul className="border-line mt-6 border">
          {reports.map((runId) => (
            <li key={runId} className="border-line border-b last:border-b-0">
              <Link
                href={`/reports/${runId}`}
                className="hover:bg-muted block px-4 py-3 font-mono text-sm"
              >
                {runId}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="border-line text-subtle mt-6 border px-4 py-3 text-sm">
          No generated reports were found. Run <code>bun run perf:smoke</code>{' '}
          first.
        </p>
      )}
    </main>
  );
}
