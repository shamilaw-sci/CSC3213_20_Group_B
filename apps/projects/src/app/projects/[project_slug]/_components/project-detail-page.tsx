import type { Project } from '@scs/schemas';

import { ProjectDetail, ProjectGrid } from '@/components/projects/registry-ui';
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
  project,
  projects,
}: Readonly<{ project: Project; projects: Project[] }>) {
  const relatedProjects = getRelatedProjects(project, projects);

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
