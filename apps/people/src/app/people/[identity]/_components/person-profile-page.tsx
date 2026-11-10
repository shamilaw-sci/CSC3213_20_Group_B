'use client';

import type { Staff, Student } from '@scs/schemas';
import { useEffect, useState } from 'react';

import PageHeader, {
  type BreadcrumbItem,
} from '@/components/layout/page-header';
import {
  DetailedPersonCard,
  DetailedPersonCardSkeleton,
  type ProfileTab,
} from '@/components/people/people-card';
import publicEnvConfig from '@/config/public.env.config';
import { getSubjectPath } from '@/config/subjects';
import {
  getPerson,
  getPersonProjects,
  getStudentDirectoryContext,
  type PersonProject,
} from '@/lib/data/people-data';

function isStudentPerson(person: Staff | Student): person is Student {
  return 'registrationNo' in person;
}

function ProjectProfileTab({
  projects,
  projectsError,
}: {
  projects: PersonProject[];
  projectsError: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold">Projects</h2>
        <p className="text-muted-foreground text-sm">
          Public project records that list this username.
        </p>
      </div>

      {projectsError ? (
        <p
          className="border-destructive/30 bg-destructive/5 text-destructive
            rounded-md border p-4 text-sm"
        >
          Projects could not be loaded right now.
        </p>
      ) : projects.length === 0 ? (
        <p
          className="bg-muted/30 text-muted-foreground rounded-md border p-4
            text-sm"
        >
          No published projects list this username yet.
        </p>
      ) : (
        <div className="grid gap-3">
          {projects.map((project) => (
            <a
              key={project.id}
              href={`${publicEnvConfig.NEXT_PUBLIC_PROJECTS_SITE_URL}/projects/${encodeURIComponent(
                project.slug
              )}`}
              className="group hover:border-primary/40 hover:bg-primary/5
                focus-visible:ring-ring/50 rounded-md border p-4 transition
                focus-visible:ring-[3px] focus-visible:outline-none"
            >
              <div className="flex flex-wrap items-center gap-2">
                <h3
                  className="group-hover:text-primary min-w-0 flex-1
                    font-semibold transition-colors"
                >
                  {project.title}
                </h3>
                <span
                  className="border-primary/20 bg-primary/10 text-primary
                    rounded-md border px-2 py-1 text-xs font-medium uppercase"
                >
                  {project.role}
                </span>
              </div>
              <p className="text-muted-foreground mt-2 line-clamp-2 text-sm/6">
                {project.shortDescription}
              </p>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

export function MinimalProjectPersonProfile({
  identity,
  projects,
}: {
  identity: string;
  projects: PersonProject[];
}) {
  const username = identity.trim().toLowerCase();
  const initials = username.slice(0, 2).toUpperCase();

  return (
    <article className="grid gap-6 lg:grid-cols-[22rem_1fr] lg:items-start">
      <aside className="bg-card rounded-md border p-5 lg:sticky lg:top-24">
        <div
          role="img"
          aria-label={username}
          className="bg-accent/15 text-primary ring-primary/15 flex h-80 w-full
            shrink-0 items-center justify-center rounded-md text-3xl
            font-semibold ring-1"
        >
          {initials}
        </div>
        <div className="mt-5">
          <h1
            className="text-card-foreground text-2xl/tight font-bold
              wrap-break-word"
          >
            @{username}
          </h1>
          <p className="text-primary mt-2 font-medium">Project-Only Profile</p>
          <p className="text-muted-foreground mt-1 text-sm">
            Roles are listed with each project.
          </p>
        </div>
      </aside>

      <div className="min-w-0">
        <div className="bg-card rounded-md border p-5">
          <div
            className="bg-muted/30 text-muted-foreground mb-5 rounded-md border
              p-4 text-sm/6"
          >
            This username is listed in published project records, but no public
            directory profile is available yet.
          </div>
          <ProjectProfileTab projects={projects} projectsError={false} />
        </div>
      </div>
    </article>
  );
}

export default function PersonProfilePage({ identity }: { identity: string }) {
  const [person, setPerson] = useState<Staff | Student>();
  const [projects, setProjects] = useState<PersonProject[]>([]);
  const [projectsError, setProjectsError] = useState(false);
  const [showMinimalProfile, setShowMinimalProfile] = useState(false);
  const [parentBreadcrumbs, setParentBreadcrumbs] = useState<BreadcrumbItem[]>([
    { href: '/students', label: 'Students' },
  ]);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadPerson() {
      setError(false);
      setPerson(undefined);
      setProjects([]);
      setProjectsError(false);
      setShowMinimalProfile(false);
      setParentBreadcrumbs([{ href: '/students', label: 'Students' }]);

      const [personResult, projectsResult] = await Promise.allSettled([
        getPerson(identity),
        getPersonProjects(identity),
      ]);

      if (cancelled) return;

      if (projectsResult.status === 'fulfilled') {
        setProjects(projectsResult.value);
      } else {
        setProjectsError(true);
      }

      if (personResult.status === 'fulfilled') {
        const nextPerson = personResult.value;
        if (cancelled) return;

        setPerson(nextPerson);

        if ('staffType' in nextPerson) {
          setParentBreadcrumbs([{ href: '/staff', label: 'Staff' }]);
          return;
        }

        const studentContext = isStudentPerson(nextPerson)
          ? await getStudentDirectoryContext(nextPerson.registrationNo)
          : undefined;

        if (cancelled) return;

        if (studentContext) {
          const subjectHref = getSubjectPath(studentContext.subject);
          setParentBreadcrumbs([
            { href: '/students', label: 'Students' },
            {
              href: subjectHref,
              label: studentContext.programme.name,
            },
            {
              href: `${subjectHref}/${studentContext.batch.id.replace(/^s/, '')}`,
              label: `${studentContext.batch.displayName} Batch`,
            },
          ]);
        } else {
          setParentBreadcrumbs([{ href: '/students', label: 'Students' }]);
        }
        return;
      }

      if (
        projectsResult.status === 'fulfilled' &&
        projectsResult.value.length > 0
      ) {
        setShowMinimalProfile(true);
        setParentBreadcrumbs([{ href: '/', label: 'People' }]);
        return;
      }

      setError(true);
    }

    void loadPerson();

    return () => {
      cancelled = true;
    };
  }, [identity]);

  if (error) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-8">
        <PageHeader
          breadcrumbs={[{ href: '/', label: 'Home' }, { label: 'People' }]}
          title="Person not found"
        />
      </div>
    );
  }

  if (showMinimalProfile) {
    const username = identity.trim().toLowerCase();

    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-8">
        <PageHeader
          breadcrumbs={[
            { href: '/', label: 'Home' },
            ...parentBreadcrumbs,
            { label: `@${username}` },
          ]}
          title={`@${username}`}
        />

        <MinimalProjectPersonProfile identity={identity} projects={projects} />
      </div>
    );
  }

  if (!person) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-8">
        <PageHeader
          breadcrumbs={[{ href: '/', label: 'Home' }, { label: 'People' }]}
          title="People"
        />
        <DetailedPersonCardSkeleton />
      </div>
    );
  }

  const extraTabs: ProfileTab[] = [
    {
      id: 'projects',
      label: 'Projects',
      content: (
        <ProjectProfileTab projects={projects} projectsError={projectsError} />
      ),
    },
  ];

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <PageHeader
        breadcrumbs={[
          { href: '/', label: 'Home' },
          ...parentBreadcrumbs,
          { label: person.fullName },
        ]}
        title={`${person.title} ${person.fullName}`}
      />

      <DetailedPersonCard
        person={person}
        showIdentity={false}
        extraTabs={extraTabs}
      />
    </div>
  );
}
