'use client';

import { BriefcaseBusiness, GraduationCap, Wrench } from 'lucide-react';
import Link from 'next/link';

import PageHeader from '@/components/layout/page-header';
import {
  prefetchAcademicStaff,
  prefetchAcademicSupportStaff,
  prefetchNonAcademicStaff,
} from '@/lib/data/people-data';

const iconBaseClassName = 'h-8 w-8';
const staffIconClassNames = {
  academic: `${iconBaseClassName} text-primary`,
  academicSupport: `${iconBaseClassName} text-slate-600 dark:text-slate-300`,
  nonAcademic: `${iconBaseClassName} text-orange-700 dark:text-orange-400`,
};

export default function StaffPage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6">
      <PageHeader
        breadcrumbs={[{ href: '/', label: 'Home' }, { label: 'Staff' }]}
        title="Staff"
        description="Department of Statistics & Computer Science, University of Peradeniya"
      />

      <section>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Link
            href="/staff/academic"
            onFocus={prefetchAcademicStaff}
            onMouseEnter={prefetchAcademicStaff}
            className="group flex min-h-36 flex-col items-start justify-between rounded-md border bg-card p-4 text-left transition-colors hover:border-primary/40 hover:bg-muted/50"
          >
            <GraduationCap
              className={staffIconClassNames.academic}
              strokeWidth={2.5}
              aria-hidden="true"
            />
            <h3 className="text-base font-semibold text-card-foreground transition-colors group-hover:text-primary">
              Academic Staff
            </h3>
          </Link>
          <Link
            href="/staff/academic-support"
            onFocus={prefetchAcademicSupportStaff}
            onMouseEnter={prefetchAcademicSupportStaff}
            className="group flex min-h-36 flex-col items-start justify-between rounded-md border bg-card p-4 text-left transition-colors hover:border-primary/40 hover:bg-muted/50"
          >
            <Wrench
              className={staffIconClassNames.academicSupport}
              strokeWidth={2.5}
              aria-hidden="true"
            />
            <h3 className="text-base font-semibold text-card-foreground transition-colors group-hover:text-primary">
              Academic Support
            </h3>
          </Link>
          <Link
            href="/staff/non-academic"
            onFocus={prefetchNonAcademicStaff}
            onMouseEnter={prefetchNonAcademicStaff}
            className="group flex min-h-36 flex-col items-start justify-between rounded-md border bg-card p-4 text-left transition-colors hover:border-primary/40 hover:bg-muted/50"
          >
            <BriefcaseBusiness
              className={staffIconClassNames.nonAcademic}
              strokeWidth={2.5}
              aria-hidden="true"
            />
            <h3 className="text-base font-semibold text-card-foreground transition-colors group-hover:text-primary">
              Non-Academic
            </h3>
          </Link>
        </div>
      </section>
    </div>
  );
}
