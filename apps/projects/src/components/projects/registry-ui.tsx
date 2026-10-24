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

import { EmptyProjectsPanel } from '@/components/projects/project-states';
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
    <section className="bg-card border-b">
      <div className="mx-auto max-w-6xl px-4 py-12">
        <p
          className="text-primary text-xs font-semibold tracking-wide uppercase"
        >
          {eyebrow}
        </p>
        <h1
          className="text-card-foreground mt-3 max-w-4xl text-3xl font-semibold
            tracking-tight sm:text-5xl"
        >
          {title}
        </h1>
        <p className="text-muted-foreground mt-4 max-w-3xl text-base/7">
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
      className="group focus-visible:ring-ring/50 block rounded-md
        focus-visible:ring-[3px] focus-visible:outline-none"
    >
      <Card
        className="group-hover:bg-muted/35 grid w-full gap-4 rounded-md p-4
          transition group-hover:-translate-y-0.5 group-hover:shadow-lg
          md:grid-cols-[2.5rem_minmax(0,1fr)_auto] md:items-start"
      >
        <div
          className="flex min-w-0 items-start justify-between gap-4 md:w-10
            md:justify-start"
        >
          <span
            className="bg-primary/10 text-primary flex size-10 shrink-0
              items-center justify-center rounded-md"
          >
            <Icon className="size-5" />
          </span>
        </div>
        <CardContent className="min-w-0 px-0">
          <CardTitle
            className="text-card-foreground line-clamp-2 text-base/snug
              md:text-lg"
          >
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
          <p className="text-muted-foreground mt-2 line-clamp-1 text-sm/6">
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
        <div
          className="flex items-center justify-end border-t pt-3 md:block
            md:min-w-24 md:border-t-0 md:pt-0"
        >
          <Button asChild size="sm" variant="outline" className="md:mt-1">
            <span>
              View
              <ArrowRight
                className="size-4 transition group-hover:translate-x-0.5"
              />
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
        <div
          className="absolute inset-0
            bg-[linear-gradient(90deg,var(--card)_0%,color-mix(in_srgb,var(--card)_88%,transparent)_68%,transparent_100%)]"
        />
        <div className="relative mx-auto max-w-6xl px-4 py-14">
          <div className="flex max-w-4xl flex-col gap-5">
            <span
              className="bg-primary/10 text-primary flex size-14 items-center
                justify-center rounded-md"
            >
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
                  className="hover:bg-primary hover:text-primary-foreground
                    rounded-md transition-colors"
                >
                  <Link href={`/courses/${project.course.code}/projects`}>
                    {project.course.code}
                  </Link>
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
          <InfoPanel title="Overview">
            <p className="text-muted-foreground text-sm/7">
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
                          {person.role}
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
                        {person.role}
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
                  href={`/topics/${slugify(tag)}`}
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
          <Icon className="text-primary size-4" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-2 px-0">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="text-muted-foreground hover:bg-muted
              hover:text-foreground flex items-center justify-between rounded-md
              p-2 text-sm font-medium transition-colors"
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
