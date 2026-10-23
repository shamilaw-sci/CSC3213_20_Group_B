'use client';

import { BookOpen } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import PageHeader from '@/components/custom/layout/PageHeader';
import { getSubjectPath } from '@/config/subjects';
import {
  getProgramme,
  getSubjectPublishedBatchDefinitions,
  type PeopleBatch,
  type PeopleProgramme,
  prefetchSpecialStudents,
  prefetchSubject,
  type StudentSubject,
} from '@/lib/data/people-data';

function BatchCardSkeletonGrid() {
  return (
    <div
      aria-hidden="true"
      className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
    >
      {Array.from({ length: 8 }, (_, index) => (
        <div
          key={index}
          className="flex min-h-36 animate-pulse flex-col items-start justify-between rounded-md border bg-card p-4"
        >
          <div className="w-full space-y-2">
            <div className="h-4 w-3/4 rounded bg-muted" />
            <div className="h-3 w-1/2 rounded bg-muted" />
          </div>
          <div className="h-6 w-16 rounded-md bg-muted" />
        </div>
      ))}
    </div>
  );
}

function BatchRows({
  batches,
  programme,
  subject,
  label,
}: {
  batches: PeopleBatch[];
  programme?: PeopleProgramme;
  subject: StudentSubject;
  label: 'Current' | 'Alumni';
}) {
  if (batches.length === 0) return null;

  return (
    <section className="mb-8">
      <div className="mb-3 flex items-end justify-between gap-4">
        <h2 className="text-lg font-semibold text-card-foreground">{label}</h2>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {batches.map((batch) => (
          <Link
            key={batch.id}
            href={`${getSubjectPath(subject)}/${batch.id.replace(/^s/, '')}`}
            onFocus={() => prefetchSpecialStudents(programme, batch.id)}
            onMouseEnter={() => prefetchSpecialStudents(programme, batch.id)}
            className="group flex min-h-36 flex-col items-start justify-between rounded-md border bg-card p-4 text-left transition-colors hover:border-primary/40 hover:bg-muted/50"
          >
            <div>
              <h3 className="font-medium text-card-foreground group-hover:text-primary">
                {batch.displayName} Batch
              </h3>
              <p className="text-sm text-muted-foreground">
                Intake {batch.intakeYear}
              </p>
            </div>
            <span className="rounded-md bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
              {label}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

export default function StudentSubjectPage({
  subject,
}: {
  subject: StudentSubject;
}) {
  const [programme, setProgramme] = useState<PeopleProgramme>();
  const [subjectName, setSubjectName] = useState<string>(subject);
  const [batches, setBatches] = useState<PeopleBatch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadSubject() {
      setIsLoading(true);
      setError(false);

      try {
        const [programme, nextBatches] = await Promise.all([
          getProgramme(subject),
          getSubjectPublishedBatchDefinitions(subject),
        ]);

        if (cancelled) return;

        setProgramme(programme);
        setSubjectName(programme?.name ?? subject);
        setBatches(nextBatches);
        prefetchSubject(subject);
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void loadSubject();

    return () => {
      cancelled = true;
    };
  }, [subject]);

  const currentBatches = batches.filter(
    (batch) => batch.defaultCategory !== 'ALUMNI'
  );
  const alumniBatches = batches.filter(
    (batch) => batch.defaultCategory === 'ALUMNI'
  );
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <PageHeader
        breadcrumbs={[
          { href: '/', label: 'Home' },
          { href: '/students', label: 'Students' },
          { label: subjectName },
        ]}
        title={subjectName}
        description="Current and alumni batches"
      />

      <div className="mb-5 flex items-center gap-2 text-sm font-medium text-primary">
        <BookOpen className="h-5 w-5" strokeWidth={2.5} aria-hidden="true" />
        Batch Directory
      </div>

      {isLoading && <BatchCardSkeletonGrid />}
      {error && (
        <p className="text-muted-foreground">Unable to load student batches.</p>
      )}

      <BatchRows
        batches={currentBatches}
        programme={programme}
        subject={subject}
        label="Current"
      />
      <BatchRows
        batches={alumniBatches}
        programme={programme}
        subject={subject}
        label="Alumni"
      />

      {!isLoading && !error && batches.length === 0 && (
        <div className="mb-6 rounded-md border bg-card p-8 text-center">
          <p className="text-muted-foreground">
            No published student batches found.
          </p>
        </div>
      )}
    </div>
  );
}
