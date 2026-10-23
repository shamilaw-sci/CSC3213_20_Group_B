'use client';

import { useEffect, useState } from 'react';

import PageHeader from '@/components/layout/page-header';
import {
  PeopleCardSkeletonGrid,
  StaffCard,
} from '@/components/people/people-card';
import {
  getAcademicSupportStaff,
  prefetchPeopleProfiles,
} from '@/lib/data/people-data';
import type { AcademicSupportStaff } from '@/lib/types';

export default function AcademicSupportStaffPage() {
  const [academicSupportStaff, setAcademicSupportStaff] = useState<
    AcademicSupportStaff[]
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadStaff() {
      setIsLoading(true);
      setError(false);

      try {
        const nextStaff = await getAcademicSupportStaff();
        if (!cancelled) setAcademicSupportStaff(nextStaff);
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void loadStaff();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (academicSupportStaff.length === 0) return;

    prefetchPeopleProfiles(
      academicSupportStaff.map((staff) => staff.email?.split('@')[0])
    );
  }, [academicSupportStaff]);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <PageHeader
        breadcrumbs={[
          { href: '/', label: 'Home' },
          { href: '/staff', label: 'Staff' },
          { label: 'Academic Support Staff' },
        ]}
        title="Academic Support Staff"
        description="Technical and IT support for the Department of Statistics & Computer Science"
      />

      {isLoading && <PeopleCardSkeletonGrid count={8} />}
      {error && (
        <p className="text-muted-foreground">
          Unable to load academic support staff.
        </p>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {academicSupportStaff.map((staff) => (
          <StaffCard key={staff.email} staff={staff} />
        ))}
      </div>

      {!isLoading && !error && academicSupportStaff.length === 0 && (
        <div className="rounded-md border bg-card p-12 text-center">
          <p className="text-muted-foreground">
            No academic support staff found.
          </p>
        </div>
      )}
    </div>
  );
}
