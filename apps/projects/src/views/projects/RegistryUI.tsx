'use client';

import {
  type AcademicDepartmentCode,
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
  ArrowRight,
  BookOpen,
  Braces,
  ChartNoAxesCombined,
  Database,
  ExternalLink,
  FileText,
  FolderGit2,
  FolderKanban,
  GraduationCap,
  HeartPulse,
  Layers3,
  Link as LinkIcon,
  Map,
  ShieldCheck,
  Tag,
  Users,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { type ComponentType, type ReactNode, useEffect, useState } from 'react';

import { EmptyProjectsPanel } from '@/components/custom/StatePanel';
import publicEnvConfig from '@/config/public.env.config';
import {
  fetchCategories,
  fetchCourses,
  fetchTags,
  type ProjectCourse,
  type ProjectFacet,
} from '@/lib/projects/api-client';
import {
  projectStatusLabels,
  projectTypeLabels,
  slugify,
} from '@/lib/projects/metadata';
import type { Project, ProjectLinks } from '@/lib/projects/types';

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

export function PageIntro({
  eyebrow,
  title,
  description,
}: Readonly<{
  eyebrow: string;
  title: string;
  description: string;
}>) {
  return (
    <section className="border-b bg-card">
      <div className="mx-auto max-w-6xl px-4 py-12">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">
          {eyebrow}
        </p>
        <h1 className="mt-3 max-w-4xl text-3xl font-semibold tracking-tight text-card-foreground sm:text-5xl">
          {title}
        </h1>
        <p className="mt-4 max-w-3xl text-base leading-7 text-muted-foreground">
          {description}
        </p>
      </div>
    </section>
  );
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
    <div className="grid w-full gap-5">
      {projects.map((project) => (
        <ProjectCard key={project.id} project={project} />
      ))}
    </div>
  );
}

function ProjectCard({ project }: Readonly<{ project: Project }>) {
  const Icon = iconMap[project.media.icon] ?? FolderKanban;
  const visibleTags = project.tags.slice(0, 2);
  const hiddenTagCount = Math.max(project.tags.length - visibleTags.length, 0);

  return (
    <Link
      href={`/projects/${project.slug}`}
      aria-label={`View project ${project.title}`}
      className="group block rounded-md focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      <Card className="grid w-full gap-4 rounded-md p-4 transition group-hover:-translate-y-0.5 group-hover:bg-muted/35 group-hover:shadow-lg md:grid-cols-[2.5rem_minmax(0,1fr)_auto] md:items-start">
        <div className="flex min-w-0 items-start justify-between gap-4 md:w-10 md:justify-start">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Icon className="size-5" />
          </span>
        </div>
        <CardContent className="min-w-0 px-0">
          <CardTitle className="line-clamp-2 text-base leading-snug text-card-foreground md:text-lg">
            {project.title}
          </CardTitle>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Badge variant="secondary" className="rounded-md">
              {projectTypeLabels[project.projectType]}
            </Badge>
            <Badge variant="secondary" className="rounded-md">
              {project.academicYear ?? 'No academic year'}
            </Badge>
            <StatusBadge status={project.status} />
          </div>
          <p className="mt-2 line-clamp-1 text-sm leading-6 text-muted-foreground">
            {project.shortDescription}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {visibleTags.map((tag) => (
              <Badge key={tag} variant="secondary" className="rounded-md">
                {tag}
              </Badge>
            ))}
            {hiddenTagCount > 0 ? (
              <Badge variant="secondary" className="rounded-md">
                +{hiddenTagCount} topics
              </Badge>
            ) : null}
          </div>
        </CardContent>
        <div className="flex items-center justify-end border-t pt-3 md:block md:min-w-24 md:border-t-0 md:pt-0">
          <Button asChild size="sm" variant="outline" className="md:mt-1">
            <span>
              View
              <ArrowRight className="size-4 transition group-hover:translate-x-0.5" />
            </span>
          </Button>
        </div>
      </Card>
    </Link>
  );
}

export function FacetRail() {
  const [categories, setCategories] = useState<ProjectFacet[]>([]);
  const [tags, setTags] = useState<ProjectFacet[]>([]);
  const [courses, setCourses] = useState<ProjectCourse[]>([]);

  useEffect(() => {
    const controller = new AbortController();

    async function loadFacets() {
      try {
        const [nextCategories, nextTags, nextCourses] = await Promise.all([
          fetchCategories(controller.signal),
          fetchTags(controller.signal),
          fetchCourses(controller.signal),
        ]);

        setCategories(nextCategories);
        setTags(nextTags);
        setCourses(nextCourses);
      } catch {
        if (!controller.signal.aborted) {
          setCategories([]);
          setTags([]);
          setCourses([]);
        }
      }
    }

    void loadFacets();

    return () => {
      controller.abort();
    };
  }, []);

  return (
    <aside className="space-y-6">
      <FacetBlock
        title="Collections"
        icon={Layers3}
        items={categories.slice(0, 8).map((category) => ({
          href: `/categories/${category.slug}`,
          label: category.label,
          count: category.count,
        }))}
      />
      <FacetBlock
        title="Subjects and technologies"
        icon={Tag}
        items={tags.slice(0, 10).map((tag) => ({
          href: `/topics/${tag.slug}`,
          label: tag.label,
          count: tag.count,
        }))}
      />
      <FacetBlock
        title="Courses"
        icon={BookOpen}
        items={courses.map((course) => ({
          href: `/courses/${course.code}/projects`,
          label: course.code,
          count: course.count,
        }))}
      />
    </aside>
  );
}

export function ProjectDetail({ project }: Readonly<{ project: Project }>) {
  const Icon = iconMap[project.media.icon] ?? FolderKanban;
  const linkedCategories = project.categories.map((category) => ({
    href: `/categories/${category}`,
    label: category.replaceAll('-', ' '),
  }));

  return (
    <article>
      <section className="relative overflow-hidden border-b bg-card">
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
        <div className="absolute inset-0 bg-[linear-gradient(90deg,var(--card)_0%,rgba(255,255,255,0.88)_68%,rgba(255,255,255,0.35)_100%)] dark:bg-[linear-gradient(90deg,var(--card)_0%,rgba(23,25,35,0.92)_68%,rgba(23,25,35,0.5)_100%)]" />
        <div className="relative mx-auto max-w-6xl px-4 py-14">
          <div className="flex max-w-4xl flex-col gap-5">
            <span className="flex size-14 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Icon className="size-8" />
            </span>
            <div className="flex flex-wrap gap-2">
              <StatusBadge status={project.status} />
              <Badge variant="secondary" className="rounded-md">
                {projectTypeLabels[project.projectType]}
              </Badge>
              {project.course ? (
                <Badge
                  asChild
                  variant="secondary"
                  className="rounded-md transition-colors hover:bg-primary hover:text-primary-foreground"
                >
                  <Link href={`/courses/${project.course.code}/projects`}>
                    {project.course.code}
                  </Link>
                </Badge>
              ) : null}
            </div>
            <h1 className="text-3xl font-semibold leading-tight text-card-foreground sm:text-4xl">
              {project.title}
            </h1>
            <p className="max-w-3xl text-base leading-8 text-muted-foreground">
              {project.shortDescription}
            </p>
            <ProjectLinkButtons links={project.links} />
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-8 px-4 py-10 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-8">
          <InfoPanel title="Overview">
            <p className="text-sm leading-7 text-muted-foreground">
              {project.description}
            </p>
          </InfoPanel>
          <InfoPanel title="Team and contributors">
            <div className="grid gap-3 sm:grid-cols-2">
              {project.people.map((person) =>
                person.username ? (
                  <a
                    key={`${person.name}-${person.role}`}
                    href={peopleProfileHref(person.username)}
                    className="block"
                  >
                    <Card className="rounded-md py-0 transition-colors hover:border-primary/40 hover:bg-muted/30">
                      <CardContent className="p-4">
                        <p className="font-semibold text-card-foreground underline-offset-4 transition-colors hover:text-primary hover:underline">
                          {person.name}
                        </p>
                        <p className="mt-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          {person.role}
                        </p>
                        {person.sNumber ? (
                          <p className="mt-2 text-sm text-muted-foreground">
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
                      <p className="font-semibold text-card-foreground">
                        {person.name}
                      </p>
                      <p className="mt-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        {person.role}
                      </p>
                      {person.sNumber ? (
                        <p className="mt-2 text-sm text-muted-foreground">
                          {person.sNumber}
                        </p>
                      ) : null}
                    </CardContent>
                  </Card>
                )
              )}
            </div>
          </InfoPanel>
          <InfoPanel title="Collections and subjects">
            <div className="flex flex-wrap gap-2">
              {linkedCategories.map((category) => (
                <Link
                  key={category.href}
                  href={category.href}
                  className="inline-flex"
                >
                  <Badge
                    variant="secondary"
                    className="rounded-md capitalize transition-colors hover:bg-primary hover:text-primary-foreground"
                  >
                    {category.label}
                  </Badge>
                </Link>
              ))}
              {project.tags.map((tag) => (
                <Link
                  key={tag}
                  href={`/topics/${slugify(tag)}`}
                  className="inline-flex"
                >
                  <Badge
                    variant="secondary"
                    className="rounded-md transition-colors hover:bg-primary hover:text-primary-foreground"
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
              <MetadataRow
                label="Academic year"
                value={
                  project.academicYear
                    ? String(project.academicYear)
                    : 'Not specified'
                }
              />
              <MetadataRow
                label="Course"
                value={project.course?.code ?? 'Optional'}
              />
              <MetadataRow
                label="Departments"
                value={
                  project.departments.length
                    ? project.departments
                        .map((department) => departmentLabel(department))
                        .join(', ')
                    : 'Optional'
                }
              />
              <MetadataRow label="Batch" value={project.batch ?? 'Optional'} />
              <MetadataRow
                label="Last updated"
                value={project.dates.lastUpdatedAt}
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
          'bg-emerald-100 text-emerald-800 dark:bg-emerald-400/15 dark:text-emerald-200',
        status === 'COMPLETED' &&
          'bg-blue-100 text-blue-800 dark:bg-blue-400/15 dark:text-blue-200',
        status === 'PLANNED' &&
          'bg-amber-100 text-amber-800 dark:bg-amber-400/15 dark:text-amber-200',
        status === 'ARCHIVED' &&
          'bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-300'
      )}
    >
      {projectStatusLabels[status]}
    </Badge>
  );
}

function FacetBlock({
  title,
  icon: Icon,
  items,
}: Readonly<{
  title: string;
  icon: ComponentType<{ className?: string }>;
  items: { href: string; label: string; count: number }[];
}>) {
  return (
    <Card className="rounded-md p-4">
      <CardHeader className="px-0">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Icon className="size-4 text-primary" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-2 px-0">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-center justify-between rounded-md px-2 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <span>{item.label}</span>
            <Badge variant="outline" className="rounded-md">
              {item.count}
            </Badge>
          </Link>
        ))}
      </CardContent>
    </Card>
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
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="px-0">{children}</CardContent>
    </Card>
  );
}

function MetadataRow({
  label,
  value,
}: Readonly<{ label: string; value: string }>) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 font-semibold text-card-foreground">{value}</dd>
    </div>
  );
}
