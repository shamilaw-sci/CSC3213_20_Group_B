'use client';

import { Button } from '@scs/ui/components/button';
import { Search, UserRound } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { type FormEvent, useEffect, useState } from 'react';

import {
  ProjectErrorPanel,
  ProjectListLoading,
} from '@/components/projects/project-states';
import { ProjectGrid } from '@/components/projects/registry-ui';
import { fetchProjectsByUsername } from '@/lib/projects/api-client';
import type { Project } from '@/lib/projects/types';

function normalizeUsername(value: string) {
  return value.trim().toLowerCase();
}

export default function FindByUsernamePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const username = normalizeUsername(searchParams.get('username') ?? '');
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const hasUsername = username.length > 0;

  useEffect(() => {
    if (!hasUsername) {
      return;
    }

    const controller = new AbortController();

    async function loadProjects() {
      setLoading(true);

      try {
        setProjects(await fetchProjectsByUsername(username, controller.signal));
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
  }, [hasUsername, username, reloadKey]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const nextUsername = normalizeUsername(
      String(formData.get('username') ?? '')
    );
    router.push(
      nextUsername
        ? `/find-by?username=${encodeURIComponent(nextUsername)}`
        : '/find-by'
    );
  }

  return (
    <>
      <section className="border-b bg-card">
        <div className="mx-auto max-w-6xl px-4 py-10">
          <p className="text-sm font-medium text-primary">Find by username</p>
          <h1 className="mt-3 text-3xl font-semibold text-card-foreground sm:text-4xl">
            Projects connected to a person
          </h1>
          <form
            key={username}
            onSubmit={handleSubmit}
            className="project-search-control mt-6 flex max-w-2xl items-center overflow-hidden rounded-md border bg-background shadow-sm focus-within:ring-[3px] focus-within:ring-ring/50"
          >
            <UserRound className="ml-3 size-4 shrink-0 text-muted-foreground" />
            <label htmlFor="project-username-search" className="sr-only">
              Username
            </label>
            <input
              id="project-username-search"
              name="username"
              defaultValue={username}
              placeholder="Enter username"
              className="h-11 min-w-0 flex-1 bg-transparent px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:outline-none"
            />
            <Button
              type="submit"
              size="icon"
              className="h-11 w-11 shrink-0 rounded-none"
              aria-label="Find projects"
            >
              <Search className="size-4" />
            </Button>
          </form>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-10">
        {hasUsername ? (
          <div className="mb-5 rounded-md border bg-card p-4">
            <p className="text-sm font-medium text-muted-foreground">
              Found{' '}
              <span className="font-semibold text-card-foreground">
                {loading ? '...' : projects.length}
              </span>{' '}
              projects for{' '}
              <span className="font-semibold text-card-foreground">
                {username}
              </span>
              .
            </p>
          </div>
        ) : (
          <div className="rounded-md border bg-card p-6">
            <h2 className="text-lg font-semibold text-card-foreground">
              Enter a username
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Find projects using the username published in project team
              records.
            </p>
          </div>
        )}

        {hasUsername && loading ? (
          <ProjectListLoading label="Finding projects" />
        ) : null}

        {hasUsername && !loading && loadFailed ? (
          <ProjectErrorPanel
            title="Username lookup is unavailable"
            description="The published project-person index could not be loaded right now."
            onRetry={() => setReloadKey((key) => key + 1)}
          />
        ) : null}

        {hasUsername && !loading && !loadFailed ? (
          <ProjectGrid
            projects={projects}
            emptyTitle="No projects for this username"
            emptyDescription="No published project currently lists this username."
          />
        ) : null}
      </section>
    </>
  );
}
