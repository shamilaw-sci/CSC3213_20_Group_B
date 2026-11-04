'use client';

import { useEffect, useState } from 'react';

import PageHeader from '@/components/layout/page-header';
import {
  PeopleCardSkeletonGrid,
  StaffCard,
} from '@/components/people/people-card';
import {
  getNonAcademicStaff,
  prefetchPeopleProfiles,
} from '@/lib/data/people-data';
import type { NonAcademicStaff } from '@/lib/types';

export default function NonAcademicStaffPage() {
  const [nonAcademicStaff, setNonAcademicStaff] = useState<NonAcademicStaff[]>(
    []
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadStaff() {
      setIsLoading(true);
      setError(false);

      try {
        const nextStaff = await getNonAcademicStaff();
        if (!cancelled) setNonAcademicStaff(nextStaff);
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
    if (nonAcademicStaff.length === 0) return;

    prefetchPeopleProfiles(
      nonAcademicStaff.map((staff) => staff.email?.split('@')[0])
    );
  }, [nonAcademicStaff]);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <PageHeader
        breadcrumbs={[
          { href: '/', label: 'Home' },
          { href: '/staff', label: 'Staff' },
          { label: 'Non-Academic Staff' },
        ]}
        title="Non-Academic Staff"
        description="Administrative and operational staff of the Department of Statistics & Computer Science"
      />

      {isLoading && <PeopleCardSkeletonGrid count={8} />}
      {error && (
        <p className="text-muted-foreground">
          Unable to load non-academic staff.
        </p>
      )}

      <div
        className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-4
          xl:grid-cols-5"
      >
        {nonAcademicStaff.map((staff) => (
          <StaffCard key={staff.email} staff={staff} />
        ))}
      </div>

      {!isLoading && !error && nonAcademicStaff.length === 0 && (
        <div className="bg-card rounded-md border p-12 text-center">
          <p className="text-muted-foreground">No non-academic staff found.</p>
        </div>
      )}
    </div>
  );
}
