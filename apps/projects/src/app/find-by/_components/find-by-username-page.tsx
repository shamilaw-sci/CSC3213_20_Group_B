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
      <section className="bg-card border-b">
        <div className="mx-auto max-w-6xl px-4 py-10">
          <p className="text-primary text-sm font-medium">Find by username</p>
          <h1
            className="text-card-foreground mt-3 text-3xl font-semibold
              sm:text-4xl"
          >
            Projects connected to a person
          </h1>
          <form
            key={username}
            onSubmit={handleSubmit}
            className="project-search-control bg-background
              focus-within:ring-ring/50 mt-6 flex max-w-2xl items-center
              overflow-hidden rounded-md border shadow-sm
              focus-within:ring-[3px]"
          >
            <UserRound className="text-muted-foreground ml-3 size-4 shrink-0" />
            <label htmlFor="project-username-search" className="sr-only">
              Username
            </label>
            <input
              id="project-username-search"
              name="username"
              defaultValue={username}
              placeholder="Enter username"
              className="text-foreground placeholder:text-muted-foreground h-11
                min-w-0 flex-1 bg-transparent px-3 text-sm outline-none
                focus-visible:outline-none"
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
          <div className="bg-card mb-5 rounded-md border p-4">
            <p className="text-muted-foreground text-sm font-medium">
              Found{' '}
              <span className="text-card-foreground font-semibold">
                {loading ? '...' : projects.length}
              </span>{' '}
              projects for{' '}
              <span className="text-card-foreground font-semibold">
                {username}
              </span>
              .
            </p>
          </div>
        ) : (
          <div className="bg-card rounded-md border p-6">
            <h2 className="text-card-foreground text-lg font-semibold">
              Enter a username
            </h2>
            <p
              className="text-muted-foreground mt-2 max-w-2xl text-sm leading-6"
            >
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
