'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import publicEnvConfig from '@/config/public.env.config';
import { fetchProjects } from '@/lib/projects/api-client';
import {
  buildCollectionPath,
  PROJECT_TYPE_SEGMENTS,
} from '@/lib/projects/collection-navigation';
import {
  type CollectionSummary,
  deriveCollectionSummaries,
} from '@/lib/projects/collections';

function labelFromSegment(value: string) {
  return value
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

const departmentSiteUrl =
  publicEnvConfig.NEXT_PUBLIC_DEPARTMENT_SITE_URL.replace(/\/$/u, '');
const footerLinkClassName =
  'text-muted-foreground hover:text-foreground inline-flex min-h-9 items-center text-sm underline-offset-4 transition-colors hover:underline focus-visible:rounded-sm focus-visible:outline-none';

export function SiteFooter() {
  const [typeSummaries, setTypeSummaries] = useState<CollectionSummary[]>([]);

  useEffect(() => {
    const controller = new AbortController();

    fetchProjects(controller.signal)
      .then((projects) => {
        if (!controller.signal.aborted) {
          setTypeSummaries(deriveCollectionSummaries(projects).types);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setTypeSummaries([]);
      });

    return () => controller.abort();
  }, []);

  return (
    <footer className="bg-muted/45 border-t">
      <div
        className="mx-auto grid max-w-6xl gap-8 px-4 py-10
          md:grid-cols-[minmax(0,1fr)_auto_auto]"
      >
        <div>
          <p className="font-semibold">SCS Projects</p>
          <p className="text-muted-foreground mt-1 text-sm">
            Student, research, and departmental work from the University of
            Peradeniya.
          </p>
        </div>
        <nav
          aria-label="Project discovery links"
          className="flex max-w-sm flex-wrap content-start gap-x-4"
        >
          <Link href="/browse" className={footerLinkClassName}>
            Browse projects
          </Link>
          {typeSummaries.map((summary) => {
            if (summary.collection.kind !== 'type') return null;
            const label = labelFromSegment(
              PROJECT_TYPE_SEGMENTS[summary.collection.projectType]
            );

            return (
              <Link
                key={summary.collection.projectType}
                href={buildCollectionPath(summary.collection)}
                className={footerLinkClassName}
              >
                {label}
              </Link>
            );
          })}
        </nav>
        <nav
          aria-label="Department course links"
          className="flex flex-col items-start"
        >
          {[
            {
              href: `${departmentSiteUrl}/undergraduate-courses`,
              label: 'Undergraduate courses',
            },
            {
              href: `${departmentSiteUrl}/postgraduate-courses`,
              label: 'Postgraduate courses',
            },
          ].map((link) => (
            <a key={link.href} href={link.href} className={footerLinkClassName}>
              {link.label}
            </a>
          ))}
        </nav>
      </div>
    </footer>
  );
}
