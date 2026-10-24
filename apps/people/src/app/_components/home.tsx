'use client';

import { BriefcaseBusiness, GraduationCap, Wrench } from 'lucide-react';
import Link from 'next/link';

import PageHeader from '@/components/layout/page-header';
import { getSubjectPath, SUBJECTS } from '@/config/subjects';
import {
  prefetchAcademicStaff,
  prefetchAcademicSupportStaff,
  prefetchNonAcademicStaff,
  prefetchPeopleManifest,
  prefetchSubject,
} from '@/lib/data/people-data';

const iconBaseClassName = 'h-8 w-8';
const staffIconClassNames = {
  academic: `${iconBaseClassName} text-primary`,
  academicSupport: `${iconBaseClassName} text-muted-foreground`,
  nonAcademic: `${iconBaseClassName} text-warning-surface-foreground`,
};

export default function Home() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6">
      <PageHeader
        breadcrumbs={[{ label: 'Home' }]}
        eyebrow="Department of Statistics & Computer Science"
        title="SCS People Directory"
        description="Find students, alumni, and staff profiles from the Department of Statistics & Computer Science, University of Peradeniya."
      />

      <section className="mb-8">
        <h2 className="text-card-foreground mb-4 text-2xl font-bold">Staff</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Link
            href="/staff/academic"
            onFocus={prefetchAcademicStaff}
            onMouseEnter={prefetchAcademicStaff}
            className="group bg-card hover:border-primary/40 hover:bg-muted/50
              flex min-h-36 flex-col items-start justify-between rounded-md
              border p-4 text-left transition-colors"
          >
            <GraduationCap
              className={staffIconClassNames.academic}
              strokeWidth={2.5}
              aria-hidden="true"
            />
            <h3
              className="text-card-foreground group-hover:text-primary text-base
                font-semibold transition-colors"
            >
              Academic Staff
            </h3>
          </Link>
          <Link
            href="/staff/academic-support"
            onFocus={prefetchAcademicSupportStaff}
            onMouseEnter={prefetchAcademicSupportStaff}
            className="group bg-card hover:border-primary/40 hover:bg-muted/50
              flex min-h-36 flex-col items-start justify-between rounded-md
              border p-4 text-left transition-colors"
          >
            <Wrench
              className={staffIconClassNames.academicSupport}
              strokeWidth={2.5}
              aria-hidden="true"
            />
            <h3
              className="text-card-foreground group-hover:text-primary text-base
                font-semibold transition-colors"
            >
              Academic Support
            </h3>
          </Link>
          <Link
            href="/staff/non-academic"
            onFocus={prefetchNonAcademicStaff}
            onMouseEnter={prefetchNonAcademicStaff}
            className="group bg-card hover:border-primary/40 hover:bg-muted/50
              flex min-h-36 flex-col items-start justify-between rounded-md
              border p-4 text-left transition-colors"
          >
            <BriefcaseBusiness
              className={staffIconClassNames.nonAcademic}
              strokeWidth={2.5}
              aria-hidden="true"
            />
            <h3
              className="text-card-foreground group-hover:text-primary text-base
                font-semibold transition-colors"
            >
              Non-Academic
            </h3>
          </Link>
        </div>
      </section>

      <section>
        <h2 className="text-card-foreground mb-4 text-2xl font-bold">
          Students
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {SUBJECTS.map(({ slug, label, icon: Icon, iconClassName }) => (
            <Link
              key={slug}
              href={getSubjectPath(slug)}
              onFocus={() => {
                prefetchPeopleManifest();
                prefetchSubject(slug);
              }}
              onMouseEnter={() => {
                prefetchPeopleManifest();
                prefetchSubject(slug);
              }}
              className="group bg-card hover:border-primary/40 hover:bg-muted/50
                flex min-h-36 flex-col items-start justify-between rounded-md
                border p-4 text-left transition-colors"
            >
              <Icon
                className={`${iconBaseClassName} ${iconClassName}`}
                strokeWidth={2.5}
                aria-hidden="true"
              />
              <h3
                className="text-card-foreground group-hover:text-primary
                  text-base font-semibold transition-colors"
              >
                {label}
              </h3>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
