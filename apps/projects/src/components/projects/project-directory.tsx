'use client';

import type { Project } from '@scs/schemas';
import { buttonVariants } from '@scs/ui/components/button';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import { ProjectSearchForm } from '@/components/projects/project-search-form';
import {
  EmptyProjectsPanel,
  ProjectDirectoryLoading,
  ProjectErrorPanel,
  StatePanel,
} from '@/components/projects/project-states';
import { ProjectGrid } from '@/components/projects/registry-ui';
import { fetchProjects } from '@/lib/projects/api-client';
import {
  buildCollectionPath,
  canonicalizeCollectionSegment,
  PROJECT_TYPE_SEGMENTS,
  type ProjectCollection,
} from '@/lib/projects/collection-navigation';
import {
  type CollectionSummary,
  deriveCollectionSummaries,
  filterProjectsByCollection,
  paginateProjects,
} from '@/lib/projects/collections';
import { projectTypeLabels } from '@/lib/projects/metadata';

function CollectionLinkGroup({
  title,
  summaries,
}: Readonly<{
  title: string;
  summaries: CollectionSummary[];
}>) {
  if (summaries.length === 0) return null;

  return (
    <div className="min-w-0">
      <h3
        className="text-muted-foreground text-xs font-semibold tracking-wide
          uppercase"
      >
        {title}
      </h3>
      <div className="mt-3 flex flex-wrap gap-2">
        {summaries.slice(0, 8).map((summary) => (
          <Link
            key={buildCollectionPath(summary.collection)}
            href={buildCollectionPath(summary.collection)}
            className="border-border bg-card text-card-foreground
              hover:border-primary/40 hover:bg-muted focus-visible:ring-ring/50
              inline-flex min-h-9 items-center rounded-md border px-3 text-sm
              font-medium transition-colors focus-visible:ring-[3px]
              focus-visible:outline-none"
          >
            {summary.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

function labelFromSegment(value: string) {
  return value
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function collectionTitle(collection: ProjectCollection) {
  switch (collection.kind) {
    case 'browse':
      return 'All Projects';
    case 'type':
      return labelFromSegment(PROJECT_TYPE_SEGMENTS[collection.projectType]);
    case 'category':
    case 'topic':
      return labelFromSegment(collection.value);
    case 'search':
      return `Search results for “${collection.query.replaceAll('-', ' ')}”`;
  }
}

function collectionDescription(collection: ProjectCollection) {
  switch (collection.kind) {
    case 'browse':
      return 'Browse every published project from the department.';
    case 'type':
      return `Explore published work classified as ${projectTypeLabels[collection.projectType].toLowerCase()}.`;
    case 'category':
      return 'Projects grouped under this published category.';
    case 'topic':
      return 'Projects connected by this published topic.';
    case 'search':
      return 'Projects matching every term in your search.';
  }
}

export function ProjectDirectory({
  collection,
  page,
}: Readonly<{ collection: ProjectCollection; page: number }>) {
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
  const filteredProjects = useMemo(
    () => filterProjectsByCollection(projects, collection),
    [collection, projects]
  );
  const projectPage = useMemo(
    () => paginateProjects(filteredProjects, page),
    [filteredProjects, page]
  );
  const missingTitle = useMemo(() => {
    if (collection.kind !== 'category' && collection.kind !== 'topic') {
      return null;
    }

    const summariesForKind =
      collection.kind === 'category' ? summaries.categories : summaries.topics;
    const segment = canonicalizeCollectionSegment(collection.value);
    return summariesForKind.some(
      (summary) => summary.collection.value === segment
    )
      ? null
      : collection.kind === 'category'
        ? 'Category not found'
        : 'Topic not found';
  }, [collection, summaries]);

  if (loading) return <ProjectDirectoryLoading />;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:py-12">
      <nav aria-label="Breadcrumb" className="text-muted-foreground text-sm">
        <Link href="/" className="hover:text-foreground transition-colors">
          Home
        </Link>
        <span aria-hidden="true" className="px-2">
          /
        </span>
        <Link
          href="/browse"
          aria-current={collection.kind === 'browse' ? 'page' : undefined}
          className="hover:text-foreground transition-colors"
        >
          Browse
        </Link>
      </nav>

      <header className="mt-6 border-b pb-7">
        <p className="text-primary text-sm font-medium">Project directory</p>
        <h1
          className="text-foreground mt-2 text-3xl font-semibold tracking-tight
            text-balance sm:text-4xl"
        >
          {collectionTitle(collection)}
        </h1>
        <p className="text-muted-foreground mt-3 max-w-2xl text-base/7">
          {collectionDescription(collection)}
        </p>
        <div className="mt-6">
          <ProjectSearchForm
            defaultValue={
              collection.kind === 'search'
                ? collection.query.replaceAll('-', ' ')
                : ''
            }
          />
        </div>
      </header>

      {collection.kind === 'browse' &&
      (summaries.types.length > 0 ||
        summaries.categories.length > 0 ||
        summaries.topics.length > 0) ? (
        <section
          className="border-b py-7"
          aria-labelledby="collections-heading"
        >
          <h2 id="collections-heading" className="text-lg font-semibold">
            Explore collections
          </h2>
          <div className="mt-5 grid gap-6 md:grid-cols-3">
            <CollectionLinkGroup title="Types" summaries={summaries.types} />
            <CollectionLinkGroup
              title="Categories"
              summaries={summaries.categories}
            />
            <CollectionLinkGroup title="Topics" summaries={summaries.topics} />
          </div>
        </section>
      ) : null}

      <section className="mt-8" aria-labelledby="directory-results-heading">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2
              id="directory-results-heading"
              className="text-xl font-semibold"
            >
              Projects
            </h2>
            {!loadFailed && !missingTitle ? (
              <p
                className="text-muted-foreground mt-1 text-sm"
                aria-live="polite"
              >
                {projectPage.totalItems}{' '}
                {projectPage.totalItems === 1 ? 'project' : 'projects'}
              </p>
            ) : null}
          </div>
          {projectPage.totalPages > 1 ? (
            <p className="text-muted-foreground text-sm tabular-nums">
              Page {projectPage.page} of {projectPage.totalPages}
            </p>
          ) : null}
        </div>

        {loadFailed ? (
          <ProjectErrorPanel onRetry={() => setReloadKey((key) => key + 1)} />
        ) : missingTitle ? (
          <StatePanel
            title={missingTitle}
            description="This collection is not present in the published project data."
            action={{ href: '/browse', label: 'Browse all projects' }}
          />
        ) : projectPage.projects.length === 0 ? (
          <EmptyProjectsPanel
            title={
              collection.kind === 'type'
                ? `No ${projectTypeLabels[collection.projectType]} projects yet`
                : 'No matching projects'
            }
            description="There are no published projects in this view yet."
          />
        ) : (
          <ProjectGrid projects={projectPage.projects} />
        )}

        {!loadFailed && !missingTitle && projectPage.totalPages > 1 ? (
          <nav
            aria-label="Project directory pages"
            className="mt-8 flex items-center justify-between gap-3"
          >
            {projectPage.page > 1 ? (
              <Link
                href={buildCollectionPath(collection, projectPage.page - 1)}
                className={buttonVariants({ variant: 'outline' })}
              >
                Previous
              </Link>
            ) : (
              <span />
            )}
            {projectPage.page < projectPage.totalPages ? (
              <Link
                href={buildCollectionPath(collection, projectPage.page + 1)}
                className={buttonVariants({ variant: 'outline' })}
              >
                Next
              </Link>
            ) : null}
          </nav>
        ) : null}
      </section>
    </div>
  );
}
