'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import {
  ProjectErrorPanel,
  ProjectListLoading,
} from '@/components/custom/StatePanel';
import { Button } from '@/components/ui/button';
import { fetchProjects } from '@/lib/projects/api-client';
import type { Project, ProjectType } from '@/lib/projects/types';
import { ProjectGrid } from '@/views/projects/RegistryUI';

const browseLinks = [
  {
    href: '/categories/research',
    title: 'Research',
  },
  {
    href: '/courses',
    title: 'Course projects',
  },
  {
    href: '/categories/department-systems',
    title: 'Department systems',
  },
  {
    href: '/categories/open-source',
    title: 'Open source',
  },
  {
    href: '/categories/datasets',
    title: 'Datasets',
  },
  {
    href: '/categories/student-innovation',
    title: 'Student innovation',
  },
];

const featuredPriorityTypes: ProjectType[] = [
  'DEPARTMENT_SYSTEM',
  'RESEARCH_PROJECT',
  'PUBLICATION_ARTIFACT',
  'COURSE_PROJECT',
];

function getFeaturedProjects(projects: Project[]) {
  return [...projects]
    .sort((a, b) => {
      const typeScore =
        featuredPriorityTypes.indexOf(a.projectType) -
        featuredPriorityTypes.indexOf(b.projectType);

      if (typeScore !== 0) {
        return typeScore;
      }

      return b.dates.lastUpdatedAt.localeCompare(a.dates.lastUpdatedAt);
    })
    .slice(0, 4);
}

export default function Home() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    async function loadProjects() {
      try {
        setProjects(await fetchProjects(undefined, controller.signal));
        setLoadFailed(false);
      } catch {
        if (!controller.signal.aborted) {
          setProjects([]);
          setLoadFailed(true);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void loadProjects();

    return () => {
      controller.abort();
    };
  }, [reloadKey]);

  const featuredProjects = getFeaturedProjects(projects);
  const recentProjects = projects.slice(0, 3);

  return (
    <>
      <section className="border-b bg-card">
        <div className="mx-auto max-w-6xl px-4 py-12">
          <p className="text-sm font-medium text-primary">
            Department of Statistics & Computer Science
          </p>
          <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-tight text-card-foreground sm:text-5xl">
            SCS Projects
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
            Browse student projects, research work, department systems, open
            source tools, datasets, and collaborations.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Button asChild>
              <Link href="/search">Search by anything</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/find-by">Find by username</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-10">
        <SectionTitle
          title="Start with a collection"
          actionHref="/categories"
          actionLabel="See more"
        />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {browseLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-md border bg-card p-4 text-sm font-medium text-card-foreground transition-colors hover:bg-muted"
            >
              {link.title}
            </Link>
          ))}
        </div>
      </section>

      <section className="border-y bg-card">
        <div className="mx-auto max-w-6xl px-4 py-12">
          <SectionTitle title="Featured projects" />
          {loading ? (
            <ProjectListLoading count={4} label="Loading featured projects" />
          ) : loadFailed ? (
            <ProjectErrorPanel
              description="Featured projects could not be loaded from the published registry."
              onRetry={() => setReloadKey((key) => key + 1)}
            />
          ) : (
            <ProjectGrid
              projects={featuredProjects}
              emptyTitle="No featured projects yet"
              emptyDescription="The published registry is online, but there are no projects ready to feature."
            />
          )}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12">
        <SectionTitle title="Recently updated" />
        {loading ? (
          <ProjectListLoading label="Loading recently updated projects" />
        ) : loadFailed ? (
          <ProjectErrorPanel
            description="Recently updated projects could not be loaded from the published registry."
            onRetry={() => setReloadKey((key) => key + 1)}
          />
        ) : (
          <ProjectGrid
            projects={recentProjects}
            emptyTitle="No recent updates yet"
            emptyDescription="Published projects will appear here as soon as the registry has entries."
          />
        )}
      </section>
    </>
  );
}

function SectionTitle({
  title,
  actionHref,
  actionLabel,
}: Readonly<{
  title: string;
  actionHref?: string;
  actionLabel?: string;
}>) {
  return (
    <div className="mb-6 flex items-center justify-between gap-3">
      <h2 className="mt-2 text-2xl font-semibold text-card-foreground">
        {title}
      </h2>
      {actionHref && actionLabel ? (
        <Button asChild variant="outline" size="sm">
          <Link href={actionHref}>{actionLabel}</Link>
        </Button>
      ) : null}
    </div>
  );
}
