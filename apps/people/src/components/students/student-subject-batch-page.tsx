'use client';

import { useEffect, useState } from 'react';

import PageHeader from '@/components/layout/page-header';
import {
  PeopleCardSkeletonGrid,
  StudentCard,
} from '@/components/people/people-card';
import { getSubjectPath } from '@/config/subjects';
import {
  getPeopleManifest,
  getSpecialStudents,
  type PeopleBatch,
  type PeopleProgramme,
  prefetchAdjacentSubjectBatches,
  prefetchPeopleProfiles,
  type StudentSubject,
} from '@/lib/data/people-data';
import type { Student } from '@/lib/types';

export default function StudentSubjectBatchPage({
  subject,
  batch: batchSlug,
}: {
  subject: StudentSubject;
  batch: string;
}) {
  const [programme, setProgramme] = useState<PeopleProgramme>();
  const [batchDefinition, setBatchDefinition] = useState<PeopleBatch>();
  const [batchStudents, setBatchStudents] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadBatch() {
      setIsLoading(true);
      setError(false);
      setProgramme(undefined);
      setBatchDefinition(undefined);
      setBatchStudents([]);

      try {
        const manifest = await getPeopleManifest();
        const nextProgramme = manifest.programmes.find(
          (candidate) => candidate.slug === subject
        );

        if (!nextProgramme) {
          if (!cancelled) setError(true);
          return;
        }

        const batchId = `s${batchSlug.replace(/^s/i, '')}`.toLowerCase();
        const nextBatchDefinition = manifest.batches.find(
          (candidate) =>
            candidate.id.toLowerCase() === batchId &&
            nextProgramme.batches.some(
              (batch) => batch.toLowerCase() === batchId
            )
        );

        if (!nextBatchDefinition) {
          if (!cancelled) setError(true);
          return;
        }

        const isAlumniBatch = nextBatchDefinition.defaultCategory === 'ALUMNI';
        const nextStudents = (
          await getSpecialStudents(nextProgramme, batchId)
        ).filter((student) =>
          isAlumniBatch
            ? student.status === 'ALUMNI'
            : student.status !== 'ALUMNI'
        );

        if (cancelled) return;

        setProgramme(nextProgramme);
        setBatchDefinition(nextBatchDefinition);
        setBatchStudents(nextStudents);
        prefetchAdjacentSubjectBatches(subject, batchSlug);
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void loadBatch();

    return () => {
      cancelled = true;
    };
  }, [batchSlug, subject]);

  useEffect(() => {
    if (batchStudents.length === 0) return;

    prefetchPeopleProfiles(
      batchStudents.map((student) => student.registrationNo)
    );
  }, [batchStudents]);

  const isAlumniBatch = batchDefinition?.defaultCategory === 'ALUMNI';
  const batchLabel = batchDefinition
    ? `${batchDefinition.displayName} Batch`
    : 'Batch';
  const programmeName = programme?.name ?? subject;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <PageHeader
        breadcrumbs={[
          { href: '/', label: 'Home' },
          { href: '/students', label: 'Students' },
          { href: getSubjectPath(subject), label: programmeName },
          { label: batchLabel },
        ]}
        title={`${programmeName} / ${batchLabel}`}
        description={isAlumniBatch ? 'Alumni' : 'Students'}
      />

      {isLoading && <PeopleCardSkeletonGrid count={10} />}
      {error && (
        <p className="text-muted-foreground">Unable to load this batch.</p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {programme &&
          batchStudents.map((student) => (
            <StudentCard key={student.registrationNo} student={student} />
          ))}
      </div>

      {!isLoading && !error && batchStudents.length === 0 && (
        <div className="bg-card rounded-md border p-12 text-center">
          <p className="text-muted-foreground">
            No {isAlumniBatch ? 'alumni' : 'students'} found in {batchLabel} for{' '}
            {programmeName}.
          </p>
        </div>
      )}
    </div>
  );
}
