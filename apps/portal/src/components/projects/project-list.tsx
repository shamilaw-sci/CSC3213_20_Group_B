'use client';

import { Badge } from '@scs/ui/components/badge';
import { Button } from '@scs/ui/components/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@scs/ui/components/card';
import { Input } from '@scs/ui/components/input';
import { Separator } from '@scs/ui/components/separator';
import { cn } from 'cn';
import { Eye, FolderKanban, Pencil, Search } from 'lucide-react';
import Link from 'next/link';

import { Pagination } from '@/components/navigation/pagination';
import type { ProjectRecord } from '@/components/projects/project-review';

interface ProjectListProps {
  canEditProject: (project: ProjectRecord) => boolean;
  nextHref?: string;
  onSearchChange: (value: string) => void;
  previousHref?: string;
  projects: readonly ProjectRecord[];
  projectsHref: string;
  search: string;
  selectedSlug: string | null;
}

function enumLabel(value: string) {
  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function projectTitle(project: ProjectRecord, fallback = 'Project') {
  return typeof project.title === 'string' && project.title.trim()
    ? project.title
    : fallback;
}

export function ProjectList({
  canEditProject,
  nextHref,
  onSearchChange,
  previousHref,
  projects,
  projectsHref,
  search,
  selectedSlug,
}: ProjectListProps) {
  return (
    <>
      <Card>
        <CardHeader className="px-4 sm:px-6">
          <CardTitle>Project Registry</CardTitle>
          <CardDescription>
            Find a project to view or update, or start a new registry draft.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 px-4 sm:px-6">
          <div className="relative">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Search by title, type, status, or tag"
              aria-label="Search projects"
              className="pl-9"
            />
          </div>
          <Separator />
          {projects.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center text-muted-foreground">
              <FolderKanban className="size-10 opacity-30" />
              <p className="text-sm">No projects match this search.</p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {projects.map((project) => {
                const slug =
                  typeof project.slug === 'string' ? project.slug : '';
                const canEdit = canEditProject(project);
                return (
                  <li key={slug} className="py-3 first:pt-0 last:pb-0">
                    <article
                      className={cn(
                        'w-full rounded-md border p-3 text-left transition-[color,background-color,border-color] hover:border-foreground/25 hover:bg-muted/30',
                        slug === selectedSlug &&
                          'border-foreground/30 bg-muted/40'
                      )}
                    >
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        <span className="min-w-0 flex-1 wrap-break-word font-medium sm:truncate">
                          {projectTitle(project)}
                        </span>
                        {typeof project.status === 'string' ? (
                          <Badge variant="secondary">
                            {enumLabel(project.status)}
                          </Badge>
                        ) : null}
                      </div>
                      <p className="mt-1 line-clamp-2 text-sm leading-6 text-muted-foreground">
                        {typeof project.shortDescription === 'string'
                          ? project.shortDescription
                          : slug}
                      </p>
                      <div className="mt-3">
                        <Button asChild size="sm" className="w-full sm:w-auto">
                          <Link href={`${projectsHref}/${slug}`}>
                            {canEdit ? (
                              <Pencil className="size-4" />
                            ) : (
                              <Eye className="size-4" />
                            )}
                            {canEdit ? 'Edit project' : 'View project'}
                          </Link>
                        </Button>
                      </div>
                    </article>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
      <Pagination previousHref={previousHref} nextHref={nextHref} />
    </>
  );
}
