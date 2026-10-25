'use client';

import {
  type AcademicDepartmentCode,
  type Project,
  type ProjectLinks,
  ScienceAcademicDepartments,
} from '@scs/schemas';
import { Badge } from '@scs/ui/components/badge';
import { Button } from '@scs/ui/components/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@scs/ui/components/card';
import { cn } from 'cn';
import {
  Activity,
  Braces,
  ChartNoAxesCombined,
  Database,
  ExternalLink,
  FileText,
  FolderGit2,
  FolderKanban,
  GraduationCap,
  HeartPulse,
  Link as LinkIcon,
  Map,
  ShieldCheck,
  Users,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { type ComponentType, type ReactNode } from 'react';

import { EmptyProjectsPanel } from '@/components/projects/project-states';
import publicEnvConfig from '@/config/public.env.config';
import {
  buildCollectionPath,
  PROJECT_TYPE_SEGMENTS,
} from '@/lib/projects/collection-navigation';
import {
  labelFromSlug,
  projectStatusLabels,
  projectTypeLabels,
} from '@/lib/projects/metadata';

const iconMap: Record<string, ComponentType<{ className?: string }>> = {
  Activity,
  Braces,
  ChartNoAxesCombined,
  Database,
  FileText,
  FolderKanban,
  GraduationCap,
  HeartPulse,
  Map,
  ShieldCheck,
  Users,
};

const DEPARTMENT_LABELS = Object.fromEntries(
  ScienceAcademicDepartments.map((department) => [
    department.code,
    department.name,
  ])
) as Record<AcademicDepartmentCode, string>;

function departmentLabel(department: AcademicDepartmentCode): string {
  return DEPARTMENT_LABELS[department] ?? department;
}

function peopleProfileHref(username: string) {
  return `${publicEnvConfig.NEXT_PUBLIC_PEOPLE_SITE_URL}/people/${encodeURIComponent(
    username.toLowerCase()
  )}`;
}

function labelFromSegment(value: string) {
  return value
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function ProjectGrid({
  projects,
  emptyTitle = 'No projects to show',
  emptyDescription = 'Try a broader search or browse the project collections.',
}: Readonly<{
  projects: Project[];
  emptyTitle?: string;
  emptyDescription?: string;
}>) {
  if (projects.length === 0) {
    return (
      <EmptyProjectsPanel title={emptyTitle} description={emptyDescription} />
    );
  }

  return (
    <div className="grid w-full gap-5 md:grid-cols-2 xl:grid-cols-3">
      {projects.map((project) => (
        <ProjectCard key={project.id} project={project} />
      ))}
    </div>
  );
}

function ProjectCard({ project }: Readonly<{ project: Project }>) {
  const Icon = iconMap[project.media.icon] ?? FolderKanban;
  const visibleTags = project.tags.slice(0, 2);

  return (
    <Link
      href={`/projects/${project.slug}`}
      aria-label={project.title}
      className="group focus-visible:ring-ring/50 block min-w-0 overflow-hidden
        rounded-md focus-visible:ring-[3px] focus-visible:outline-none"
    >
      <Card
        className="group-hover:border-primary/40 h-full min-w-0 gap-0
          overflow-hidden rounded-md py-0
          transition-[border-color,box-shadow,transform]
          group-hover:-translate-y-0.5 group-hover:shadow-lg"
      >
        <div
          className="bg-muted/45 relative flex aspect-16/7 items-center
            justify-center overflow-hidden border-b"
        >
          {project.media.coverImage ? (
            <Image
              src={project.media.coverImage}
              alt=""
              fill
              unoptimized
              sizes="(min-width: 1280px) 22rem, (min-width: 768px) 50vw, 100vw"
              className="object-cover transition-transform duration-300
                group-hover:scale-[1.02]"
            />
          ) : (
            <span
              className="bg-primary/10 text-primary flex size-12 items-center
                justify-center rounded-md"
            >
              <Icon aria-hidden="true" className="size-6" />
            </span>
          )}
        </div>
        <CardContent className="min-w-0 p-5">
          <CardTitle
            className="text-card-foreground line-clamp-2 text-base/snug
              wrap-break-word md:text-lg"
          >
            {project.title}
          </CardTitle>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Badge variant="secondary" className="rounded-md">
              {projectTypeLabels[project.projectType]}
            </Badge>
            <StatusBadge status={project.status} />
            {project.course ? (
              <Badge variant="outline" className="rounded-md">
                {project.course.code}
              </Badge>
            ) : null}
            {project.academicYear ? (
              <Badge variant="outline" className="rounded-md">
                {project.academicYear}
              </Badge>
            ) : null}
          </div>
          <p className="text-muted-foreground mt-2 line-clamp-2 text-sm/6">
            {project.shortDescription}
          </p>
          {visibleTags.length ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {visibleTags.map((tag) => (
                <Badge key={tag} variant="secondary" className="rounded-md">
                  {tag}
                </Badge>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </Link>
  );
}

export function ProjectDetail({ project }: Readonly<{ project: Project }>) {
  const Icon = iconMap[project.media.icon] ?? FolderKanban;
  const linkedCategories = project.categories.map((category) => ({
    href: buildCollectionPath({ kind: 'category', value: category }),
    label: category.replaceAll('-', ' '),
  }));
  const typeCollection = {
    kind: 'type' as const,
    projectType: project.projectType,
  };
  const typeCollectionLabel = labelFromSegment(
    PROJECT_TYPE_SEGMENTS[project.projectType]
  );

  return (
    <article>
      <section className="bg-card relative overflow-hidden border-b">
        {project.media.coverImage ? (
          <Image
            src={project.media.coverImage}
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover opacity-12 dark:opacity-10"
          />
        ) : null}
        <div className="bg-card/90 absolute inset-0" />
        <div className="relative mx-auto max-w-6xl px-4 py-14">
          <div className="flex max-w-4xl flex-col gap-5">
            <nav
              aria-label="Breadcrumb"
              className="text-muted-foreground text-sm"
            >
              <ol className="flex min-w-0 items-center gap-2">
                <li>
                  <Link
                    href="/"
                    className="hover:text-foreground transition-colors"
                  >
                    Home
                  </Link>
                </li>
                <li aria-hidden="true">/</li>
                <li>
                  <Link
                    href={buildCollectionPath(typeCollection)}
                    className="hover:text-foreground transition-colors"
                  >
                    {typeCollectionLabel}
                  </Link>
                </li>
                <li aria-hidden="true">/</li>
                <li className="text-foreground min-w-0 truncate">
                  {project.title}
                </li>
              </ol>
            </nav>
            <span
              className="bg-primary/10 text-primary flex size-14 items-center
                justify-center rounded-md"
            >
              <Icon aria-hidden="true" className="size-8" />
            </span>
            <div className="flex flex-wrap gap-2">
              <StatusBadge status={project.status} />
              <Badge asChild variant="secondary" className="rounded-md">
                <Link href={buildCollectionPath(typeCollection)}>
                  {projectTypeLabels[project.projectType]}
                </Link>
              </Badge>
              {project.course ? (
                <Badge variant="outline" className="rounded-md">
                  {project.course.code}
                </Badge>
              ) : null}
            </div>
            <h1
              className="text-card-foreground text-3xl/tight font-semibold
                sm:text-4xl"
            >
              {project.title}
            </h1>
            <p className="text-muted-foreground max-w-3xl text-base/8">
              {project.shortDescription}
            </p>
            <ProjectLinkButtons links={project.links} />
          </div>
        </div>
      </section>

      <section
        className="mx-auto grid max-w-6xl gap-8 px-4 py-10
          lg:grid-cols-[1fr_20rem]"
      >
        <div className="space-y-8">
          <InfoPanel title="About This Project">
            <p className="text-muted-foreground text-sm/7">
              {project.description}
            </p>
          </InfoPanel>
          <InfoPanel title="People">
            <div className="grid gap-3 sm:grid-cols-2">
              {project.people.map((person) =>
                person.username ? (
                  <a
                    key={`${person.name}-${person.role}`}
                    href={peopleProfileHref(person.username)}
                    className="block"
                  >
                    <Card
                      className="hover:border-primary/40 hover:bg-muted/30
                        rounded-md py-0 transition-colors"
                    >
                      <CardContent className="p-4">
                        <p
                          className="text-card-foreground hover:text-primary
                            font-semibold underline-offset-4 transition-colors
                            hover:underline"
                        >
                          {person.name}
                        </p>
                        <p
                          className="text-muted-foreground mt-1 text-xs
                            font-medium tracking-wide uppercase"
                        >
                          {labelFromSlug(person.role)}
                        </p>
                        {person.sNumber ? (
                          <p className="text-muted-foreground mt-2 text-sm">
                            {person.sNumber}
                          </p>
                        ) : null}
                      </CardContent>
                    </Card>
                  </a>
                ) : (
                  <Card
                    key={`${person.name}-${person.role}`}
                    className="rounded-md py-0"
                  >
                    <CardContent className="p-4">
                      <p className="text-card-foreground font-semibold">
                        {person.name}
                      </p>
                      <p
                        className="text-muted-foreground mt-1 text-xs
                          font-medium tracking-wide uppercase"
                      >
                        {labelFromSlug(person.role)}
                      </p>
                      {person.sNumber ? (
                        <p className="text-muted-foreground mt-2 text-sm">
                          {person.sNumber}
                        </p>
                      ) : null}
                    </CardContent>
                  </Card>
                )
              )}
            </div>
          </InfoPanel>
          <InfoPanel title="Categories and Topics">
            <div className="flex flex-wrap gap-2">
              {linkedCategories.map((category) => (
                <Link
                  key={category.href}
                  href={category.href}
                  className="inline-flex"
                >
                  <Badge
                    variant="secondary"
                    className="hover:bg-primary hover:text-primary-foreground
                      rounded-md capitalize transition-colors"
                  >
                    {category.label}
                  </Badge>
                </Link>
              ))}
              {project.tags.map((tag) => (
                <Link
                  key={tag}
                  href={buildCollectionPath({ kind: 'topic', value: tag })}
                  className="inline-flex"
                >
                  <Badge
                    variant="secondary"
                    className="hover:bg-primary hover:text-primary-foreground
                      rounded-md transition-colors"
                  >
                    {tag}
                  </Badge>
                </Link>
              ))}
              {project.departments.map((department) => (
                <Badge
                  key={department}
                  variant="outline"
                  className="rounded-md"
                >
                  {departmentLabel(department)}
                </Badge>
              ))}
            </div>
          </InfoPanel>
        </div>

        <aside className="space-y-5">
          <InfoPanel title="Project details">
            <dl className="grid gap-4 text-sm">
              <MetadataRow
                label="Status"
                value={projectStatusLabels[project.status]}
              />
              <MetadataRow
                label="Project type"
                value={projectTypeLabels[project.projectType]}
              />
              {project.academicYear ? (
                <MetadataRow
                  label="Academic year"
                  value={String(project.academicYear)}
                />
              ) : null}
              {project.course ? (
                <MetadataRow
                  label="Course"
                  value={`${project.course.code} — ${project.course.title}`}
                />
              ) : null}
              {project.departments.length ? (
                <MetadataRow
                  label="Departments"
                  value={project.departments
                    .map((department) => departmentLabel(department))
                    .join(', ')}
                />
              ) : null}
              {project.batch ? (
                <MetadataRow label="Batch" value={project.batch} />
              ) : null}
              <MetadataRow
                label="Last updated"
                value={formatProjectDate(project.dates.lastUpdatedAt)}
              />
            </dl>
          </InfoPanel>
        </aside>
      </section>
    </article>
  );
}

function StatusBadge({ status }: Readonly<{ status: Project['status'] }>) {
  return (
    <Badge
      className={cn(
        'rounded-md font-black',
        status === 'ACTIVE' &&
          'bg-success-surface text-success-surface-foreground',
        status === 'COMPLETED' &&
          'bg-info-surface text-info-surface-foreground',
        status === 'PLANNED' &&
          'bg-warning-surface text-warning-surface-foreground',
        status === 'ARCHIVED' && 'bg-muted text-muted-foreground'
      )}
    >
      {projectStatusLabels[status]}
    </Badge>
  );
}

function ProjectLinkButtons({ links }: Readonly<{ links: ProjectLinks }>) {
  const entries = [
    ['Repository', links.repository, FolderGit2],
    ['Website', links.website, ExternalLink],
    ['Demo', links.demo, ExternalLink],
    ['Docs', links.documentation, FileText],
    ['Dataset', links.dataset, Database],
    ['Publication', links.publication, FileText],
    ['Video', links.video, LinkIcon],
  ] as const;

  return (
    <div className="flex flex-wrap gap-3">
      {entries.map(([label, href, Icon]) =>
        href ? (
          <Button key={label} asChild variant="outline">
            <a href={href} target="_blank" rel="noreferrer">
              <Icon className="size-4" />
              {label}
            </a>
          </Button>
        ) : null
      )}
    </div>
  );
}

function InfoPanel({
  title,
  children,
}: Readonly<{ title: string; children: ReactNode }>) {
  return (
    <Card className="rounded-md p-5">
      <CardHeader className="px-0">
        <h2 className="text-base font-semibold">{title}</h2>
      </CardHeader>
      <CardContent className="px-0">{children}</CardContent>
    </Card>
  );
}

function formatProjectDate(value: string) {
  const date = /^\d{4}-\d{2}-\d{2}$/u.test(value)
    ? new Date(`${value}T00:00:00Z`)
    : new Date(value);

  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

function MetadataRow({
  label,
  value,
}: Readonly<{ label: string; value: string }>) {
  return (
    <div>
      <dt
        className="text-muted-foreground text-xs font-medium tracking-wide
          uppercase"
      >
        {label}
      </dt>
      <dd className="text-card-foreground mt-1 font-semibold">{value}</dd>
    </div>
  );
}
