'use client';

import { Button } from '@scs/ui/components/button';
import { Search } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { type FormEvent, useEffect, useState } from 'react';

import {
  ProjectErrorPanel,
  ProjectListLoading,
} from '@/components/projects/project-states';
import { ProjectGrid } from '@/components/projects/registry-ui';
import { fetchProjectSearch } from '@/lib/projects/api-client';
import type { Project } from '@/lib/projects/types';

export default function SearchPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const query = searchParams.get('q') ?? '';
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const hasQuery = query.trim().length > 0;

  useEffect(() => {
    if (!hasQuery) {
      return;
    }

    const controller = new AbortController();

    async function loadProjects() {
      setLoading(true);

      try {
        setProjects(await fetchProjectSearch(query, controller.signal));
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
  }, [hasQuery, query, reloadKey]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const nextQuery = String(formData.get('q') ?? '').trim();
    router.push(
      nextQuery ? `/search?q=${encodeURIComponent(nextQuery)}` : '/search'
    );
  }

  return (
    <>
      <section className="border-b bg-card">
        <div className="mx-auto max-w-6xl px-4 py-10">
          <p className="text-sm font-medium text-primary">Search</p>
          <h1 className="mt-3 text-3xl font-semibold text-card-foreground sm:text-4xl">
            Search by anything
          </h1>
          <form
            key={query}
            onSubmit={handleSubmit}
            className="project-search-control mt-6 flex max-w-2xl items-center overflow-hidden rounded-md border bg-background shadow-sm focus-within:ring-[3px] focus-within:ring-ring/50"
          >
            <Search className="ml-3 size-4 shrink-0 text-muted-foreground" />
            <label htmlFor="project-search-page" className="sr-only">
              Search projects
            </label>
            <input
              id="project-search-page"
              name="q"
              defaultValue={query}
              placeholder="Search projects"
              className="h-11 min-w-0 flex-1 bg-transparent px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:outline-none"
            />
            <Button
              type="submit"
              size="icon"
              className="h-11 w-11 shrink-0 rounded-none"
              aria-label="Search projects"
            >
              <Search className="size-4" />
            </Button>
          </form>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-10">
        {hasQuery ? (
          <div className="mb-5 rounded-md border bg-card p-4">
            <p className="text-sm font-medium text-muted-foreground">
              Found{' '}
              <span className="font-semibold text-card-foreground">
                {loading ? '...' : projects.length}
              </span>{' '}
              projects for{' '}
              <span className="font-semibold text-card-foreground">
                {query}
              </span>
              .
            </p>
          </div>
        ) : (
          <div className="rounded-md border bg-card p-6">
            <h2 className="text-lg font-semibold text-card-foreground">
              Search anything in projects
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Try a course code, project title, technology, academic year,
              student group, supervisor, status, collection, or project type.
            </p>
          </div>
        )}

        {hasQuery && loading ? (
          <ProjectListLoading label="Searching projects" />
        ) : null}

        {hasQuery && !loading && loadFailed ? (
          <ProjectErrorPanel
            title="Search is unavailable"
            description="The published project registry could not be searched right now."
            onRetry={() => setReloadKey((key) => key + 1)}
          />
        ) : null}

        {hasQuery && !loading && !loadFailed ? (
          <ProjectGrid
            projects={projects}
            emptyTitle="No matching projects"
            emptyDescription="Nothing in the published registry matches this search yet. Try a course code, project title, person, or technology."
          />
        ) : null}
      </section>
    </>
  );
}
