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
      <section className="bg-card border-b">
        <div className="mx-auto max-w-6xl px-4 py-10">
          <p className="text-primary text-sm font-medium">Search</p>
          <h1
            className="text-card-foreground mt-3 text-3xl font-semibold
              sm:text-4xl"
          >
            Search by anything
          </h1>
          <form
            key={query}
            onSubmit={handleSubmit}
            className="project-search-control bg-background
              focus-within:ring-ring/50 mt-6 flex max-w-2xl items-center
              overflow-hidden rounded-md border shadow-sm
              focus-within:ring-[3px]"
          >
            <Search className="text-muted-foreground ml-3 size-4 shrink-0" />
            <label htmlFor="project-search-page" className="sr-only">
              Search projects
            </label>
            <input
              id="project-search-page"
              name="q"
              defaultValue={query}
              placeholder="Search projects"
              className="text-foreground placeholder:text-muted-foreground h-11
                min-w-0 flex-1 bg-transparent px-3 text-sm outline-none
                focus-visible:outline-none"
            />
            <Button
              type="submit"
              size="icon"
              className="size-11 shrink-0 rounded-none"
              aria-label="Search projects"
            >
              <Search className="size-4" />
            </Button>
          </form>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-10">
        {hasQuery ? (
          <div className="bg-card mb-5 rounded-md border p-4">
            <p className="text-muted-foreground text-sm font-medium">
              Found{' '}
              <span className="text-card-foreground font-semibold">
                {loading ? '...' : projects.length}
              </span>{' '}
              projects for{' '}
              <span className="text-card-foreground font-semibold">
                {query}
              </span>
              .
            </p>
          </div>
        ) : (
          <div className="bg-card rounded-md border p-6">
            <h2 className="text-card-foreground text-lg font-semibold">
              Search anything in projects
            </h2>
            <p className="text-muted-foreground mt-2 max-w-2xl text-sm/6">
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
