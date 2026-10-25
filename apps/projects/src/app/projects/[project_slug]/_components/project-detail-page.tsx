'use client';

import type { Project } from '@scs/schemas';
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
import { canonicalizeCollectionSegment } from '@/lib/projects/collection-navigation';

function getRelatedProjects(project: Project, projects: Project[]) {
  const categories = new Set(
    project.categories.map(canonicalizeCollectionSegment)
  );
  const topics = new Set(project.tags.map(canonicalizeCollectionSegment));

  return projects
    .filter((candidate) => candidate.slug !== project.slug)
    .map((candidate) => {
      const sharedCategories = candidate.categories.filter((category) =>
        categories.has(canonicalizeCollectionSegment(category))
      ).length;
      const sharedTopics = candidate.tags.filter((topic) =>
        topics.has(canonicalizeCollectionSegment(topic))
      ).length;
      const score =
        (candidate.projectType === project.projectType ? 3 : 0) +
        sharedCategories * 2 +
        sharedTopics;

      return { candidate, score };
    })
    .filter(({ score }) => score > 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.candidate.dates.lastUpdatedAt.localeCompare(
          a.candidate.dates.lastUpdatedAt
        ) ||
        a.candidate.slug.localeCompare(b.candidate.slug)
    )
    .slice(0, 3)
    .map(({ candidate }) => candidate);
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
          fetchProjects(controller.signal),
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
          action={{ href: '/', label: 'Find projects' }}
        />
      </div>
    );
  }

  return (
    <>
      <ProjectDetail project={project} />
      {relatedProjects.length ? (
        <section className="mx-auto max-w-6xl px-4 pb-12">
          <h2 className="text-card-foreground mb-5 text-xl font-semibold">
            Related Projects
          </h2>
          <ProjectGrid projects={relatedProjects} />
        </section>
      ) : null}
    </>
  );
}
