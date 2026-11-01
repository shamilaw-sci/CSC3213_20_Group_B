'use client';

import type { Project } from '@scs/schemas';
import { Badge } from '@scs/ui/components/badge';
import { buttonVariants } from '@scs/ui/components/button';
import { Card, CardContent } from '@scs/ui/components/card';
import { ArrowRight, FolderKanban } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import { ProjectSearchForm } from '@/components/projects/project-search-form';
import {
  ProjectErrorPanel,
  ProjectHomeLoading,
  StatePanel,
} from '@/components/projects/project-states';
import { ProjectGrid } from '@/components/projects/registry-ui';
import { fetchProjects } from '@/lib/projects/api-client';
import {
  buildCollectionPath,
  PROJECT_TYPE_SEGMENTS,
} from '@/lib/projects/collection-navigation';
import {
  type CollectionSummary,
  deriveCollectionSummaries,
  recentProjects,
} from '@/lib/projects/collections';

function labelFromSegment(value: string) {
  return value
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function countLabel(count: number) {
  return `${count} ${count === 1 ? 'project' : 'projects'}`;
}

export default function Home() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    async function loadProjects() {
      setLoading(true);
      setLoadFailed(false);

      try {
        setProjects(await fetchProjects(controller.signal));
      } catch {
        if (!controller.signal.aborted) {
          setProjects([]);
          setLoadFailed(true);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void loadProjects();
    return () => controller.abort();
  }, [reloadKey]);

  const summaries = useMemo(
    () => deriveCollectionSummaries(projects),
    [projects]
  );
  const recent = useMemo(() => recentProjects(projects, 6), [projects]);

  if (loading) return <ProjectHomeLoading />;

  return (
    <>
      <section className="bg-card border-b">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:py-16">
          <p className="text-primary text-sm font-medium">
            Department of Statistics &amp; Computer Science
          </p>
          <h1
            className="text-card-foreground mt-3 max-w-3xl text-4xl
              font-semibold tracking-tight text-balance sm:text-5xl"
          >
            Projects from SCS
          </h1>
          <p
            className="text-muted-foreground mt-4 max-w-3xl text-base/7
              sm:text-lg/8"
          >
            Explore student work, research, open-source tools, datasets, and
            department systems published by our community.
          </p>
          <div className="mt-8">
            <ProjectSearchForm />
          </div>
        </div>
      </section>

      <div className="mx-auto w-full max-w-6xl space-y-14 px-4 py-10 sm:py-14">
        {loadFailed ? (
          <ProjectErrorPanel onRetry={() => setReloadKey((key) => key + 1)} />
        ) : projects.length === 0 ? (
          <StatePanel
            title="No projects published yet"
            description="Published projects will appear here when they become available."
          />
        ) : (
          <>
            {summaries.types.length > 0 ? (
              <section aria-labelledby="project-types-heading">
                <SectionHeading
                  id="project-types-heading"
                  title="Explore by project type"
                  description="Start with the kind of work you want to discover."
                />
                <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {summaries.types.map((summary) => {
                    if (summary.collection.kind !== 'type') return null;
                    const title = labelFromSegment(
                      PROJECT_TYPE_SEGMENTS[summary.collection.projectType]
                    );

                    return (
                      <Link
                        key={summary.collection.projectType}
                        href={buildCollectionPath(summary.collection)}
                        className="group focus-visible:ring-ring/50 rounded-md
                          focus-visible:ring-[3px] focus-visible:outline-none"
                      >
                        <Card
                          className="group-hover:border-primary/40 h-full
                            rounded-md py-0 transition-colors"
                        >
                          <CardContent
                            className="flex h-full items-start gap-4 p-5"
                          >
                            <span
                              className="bg-primary/10 text-primary flex size-10
                                shrink-0 items-center justify-center rounded-md"
                            >
                              <FolderKanban
                                aria-hidden="true"
                                className="size-5"
                              />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span
                                className="text-card-foreground block
                                  font-semibold"
                              >
                                {title}
                              </span>
                              <span
                                className="text-muted-foreground mt-1 block
                                  text-sm"
                              >
                                {countLabel(summary.count)}
                              </span>
                            </span>
                            <ArrowRight
                              aria-hidden="true"
                              className="text-muted-foreground mt-1 size-4
                                shrink-0 transition-transform
                                group-hover:translate-x-0.5"
                            />
                          </CardContent>
                        </Card>
                      </Link>
                    );
                  })}
                </div>
              </section>
            ) : null}

            {recent.length > 0 ? (
              <section aria-labelledby="recent-projects-heading">
                <div className="flex flex-wrap items-end justify-between gap-4">
                  <SectionHeading
                    id="recent-projects-heading"
                    title="Recently updated"
                    description="The latest published changes across the project registry."
                  />
                  <Link
                    href="/browse"
                    className={buttonVariants({ variant: 'outline' })}
                  >
                    Browse all projects
                    <ArrowRight aria-hidden="true" className="size-4" />
                  </Link>
                </div>
                <div className="mt-6">
                  <ProjectGrid projects={recent} />
                </div>
              </section>
            ) : null}

            {summaries.categories.length > 0 || summaries.topics.length > 0 ? (
              <div className="grid gap-10 border-t pt-10 lg:grid-cols-2">
                {summaries.categories.length > 0 ? (
                  <CollectionLinks
                    headingId="project-categories-heading"
                    title="Browse by category"
                    description="Explore the broader areas these projects contribute to."
                    summaries={summaries.categories}
                  />
                ) : null}
                {summaries.topics.length > 0 ? (
                  <CollectionLinks
                    headingId="project-topics-heading"
                    title="Explore topics"
                    description="Jump to technologies and subjects used across projects."
                    summaries={summaries.topics}
                  />
                ) : null}
              </div>
            ) : null}
          </>
        )}
      </div>
    </>
  );
}

function SectionHeading({
  id,
  title,
  description,
}: Readonly<{ id: string; title: string; description: string }>) {
  return (
    <div>
      <h2
        id={id}
        className="text-foreground text-2xl font-semibold text-balance"
      >
        {title}
      </h2>
      <p className="text-muted-foreground mt-2 max-w-2xl text-sm/6">
        {description}
      </p>
    </div>
  );
}

function CollectionLinks({
  headingId,
  title,
  description,
  summaries,
}: Readonly<{
  headingId: string;
  title: string;
  description: string;
  summaries: CollectionSummary[];
}>) {
  return (
    <section aria-labelledby={headingId}>
      <SectionHeading id={headingId} title={title} description={description} />
      <div className="mt-5 flex flex-wrap gap-2">
        {summaries.slice(0, 12).map((summary) => (
          <Badge
            key={buildCollectionPath(summary.collection)}
            variant="secondary"
            className="hover:bg-accent hover:text-accent-foreground rounded-md
              px-3 py-1.5 transition-colors"
            render={
              <Link href={buildCollectionPath(summary.collection)}>
                {summary.label}
                <span className="text-muted-foreground ml-1.5 tabular-nums">
                  {summary.count}
                </span>
              </Link>
            }
          />
        ))}
      </div>
    </section>
  );
}
