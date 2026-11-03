import { notFound } from 'next/navigation';

import ProjectDetailPage from '@/app/projects/[project_slug]/_components/project-detail-page';
import {
  fetchProject,
  fetchProjects,
  ProjectDataNotFoundError,
} from '@/lib/projects/api-client';
import { resolveProjectRepositoryMetadata } from '@/lib/projects/repository-metadata';

type PageProps = {
  params: Promise<{
    project_slug: string;
  }>;
};

async function loadProjectRouteData(projectSlug: string) {
  try {
    const project = await fetchProject(projectSlug);
    const projects = await fetchProjects();
    return {
      project: await resolveProjectRepositoryMetadata(project),
      projects,
    };
  } catch (error) {
    if (error instanceof ProjectDataNotFoundError) notFound();
    throw error;
  }
}

export default async function Page({ params }: PageProps) {
  const { project_slug: projectSlug } = await params;
  const { project, projects } = await loadProjectRouteData(projectSlug);

  return <ProjectDetailPage project={project} projects={projects} />;
}
