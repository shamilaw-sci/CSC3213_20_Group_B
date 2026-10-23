'use client';

import { useEffect, useState } from 'react';

import {
  ProjectDetailLoading,
  ProjectErrorPanel,
  StatePanel,
} from '@/components/projects/project-states';
import { ProjectDetail, ProjectGrid } from '@/components/projects/registry-ui';
import {
  fetchProject,
  fetchProjects,
  ProjectDataNotFoundError,
} from '@/lib/projects/api-client';
import type { Project } from '@/lib/projects/types';

function getRelatedProjects(project: Project, projects: Project[]) {
  return projects
    .filter((candidate) => candidate.slug !== project.slug)
    .filter((candidate) =>
      candidate.categories.some((category) =>
        project.categories.includes(category)
      )
    )
    .slice(0, 3);
}

export default function ProjectDetailPage({
  projectSlug,
}: Readonly<{ projectSlug: string }>) {
  const [project, setProject] = useState<Project>();
  const [relatedProjects, setRelatedProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [projectMissing, setProjectMissing] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    async function loadProject() {
      setLoading(true);
      setLoadFailed(false);
      setProjectMissing(false);

      try {
        const [nextProject, allProjects] = await Promise.all([
          fetchProject(projectSlug, controller.signal),
          fetchProjects(undefined, controller.signal),
        ]);

        setProject(nextProject);
        setRelatedProjects(
          nextProject ? getRelatedProjects(nextProject, allProjects) : []
        );
      } catch (error) {
        if (!controller.signal.aborted) {
          setProject(undefined);
          setRelatedProjects([]);
          setProjectMissing(error instanceof ProjectDataNotFoundError);
          setLoadFailed(!(error instanceof ProjectDataNotFoundError));
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void loadProject();

    return () => {
      controller.abort();
    };
  }, [projectSlug, reloadKey]);

  if (loading) {
    return <ProjectDetailLoading />;
  }

  if (loadFailed) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-16">
        <ProjectErrorPanel
          title="Project could not be loaded"
          description="The project exists in the route, but the published project data did not load successfully."
          onRetry={() => setReloadKey((key) => key + 1)}
        />
      </div>
    );
  }

  if (projectMissing || !project) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-16">
        <StatePanel
          title="Project not found"
          description="This project page is not in the published registry. It may have been moved, renamed, or removed."
          action={{ href: '/search', label: 'Search projects' }}
          secondaryAction={{ href: '/categories', label: 'Browse collections' }}
        />
      </div>
    );
  }

  return (
    <>
      <ProjectDetail project={project} />
      <section className="mx-auto max-w-6xl px-4 pb-12">
        <h2 className="mb-5 text-xl font-semibold text-card-foreground">
          Related projects
        </h2>
        <ProjectGrid projects={relatedProjects} />
      </section>
    </>
  );
}
