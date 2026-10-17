'use client';

import { useEffect, useMemo, useState } from 'react';

import {
  ProjectErrorPanel,
  ProjectListLoading,
} from '@/components/custom/StatePanel';
import { fetchProjects } from '@/lib/projects/api-client';
import type { Project } from '@/lib/projects/types';

import { FacetRail, PageIntro, ProjectGrid } from './RegistryUI';

export default function ProjectCollection({
  eyebrow,
  title,
  description,
  filters,
}: Readonly<{
  eyebrow: string;
  title: string;
  description: string;
  filters?: Record<string, string | undefined>;
}>) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const filterKey = JSON.stringify(filters ?? {});
  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    const parsedFilters = JSON.parse(filterKey) as Record<
      string,
      string | undefined
    >;

    for (const [key, value] of Object.entries(parsedFilters)) {
      if (value) {
        params.set(key, value);
      }
    }

    return params;
  }, [filterKey]);

  useEffect(() => {
    const controller = new AbortController();

    async function loadProjects() {
      setLoading(true);

      try {
        setProjects(await fetchProjects(queryParams, controller.signal));
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
  }, [queryParams, reloadKey]);

  return (
    <>
      <PageIntro eyebrow={eyebrow} title={title} description={description} />
      <section className="mx-auto grid max-w-6xl gap-8 px-4 py-10 lg:grid-cols-[1fr_18rem]">
        <div>
          <div className="mb-5 rounded-md border bg-card p-4">
            <p className="text-sm font-medium text-muted-foreground">
              {loading ? 'Loading' : 'Showing'}{' '}
              <span className="font-semibold text-card-foreground">
                {loading ? '...' : projects.length}
              </span>{' '}
              projects.
            </p>
          </div>
          {loading ? (
            <ProjectListLoading />
          ) : loadFailed ? (
            <ProjectErrorPanel
              description="The published project registry could not be loaded. Please retry after a moment."
              onRetry={() => setReloadKey((key) => key + 1)}
            />
          ) : (
            <ProjectGrid
              projects={projects}
              emptyTitle="No projects match this filter"
              emptyDescription="This filter is valid, but there are no published projects under it yet."
            />
          )}
        </div>
        <FacetRail />
      </section>
    </>
  );
}
