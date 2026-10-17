import {
  labelFromSlug,
  projectStatusLabels,
  projectTypeLabels,
  slugify,
} from './metadata';
import { getAllProjectData, getProjectDataBySlug } from './projects-data';
import type { Project, ProjectType } from './types';

export async function getAllProjects() {
  const projects = await getAllProjectData();

  return [...projects].sort((a, b) =>
    b.dates.lastUpdatedAt.localeCompare(a.dates.lastUpdatedAt)
  );
}

export function getProjectBySlug(slug: string) {
  return getProjectDataBySlug(slug);
}

export async function getProjectsByCategory(category: string) {
  return (await getAllProjects()).filter((project) =>
    project.categories.includes(category)
  );
}

export async function getProjectsByTag(tag: string) {
  const normalizedTag = slugify(tag);

  return (await getAllProjects()).filter((project) =>
    project.tags.some((projectTag) => slugify(projectTag) === normalizedTag)
  );
}

export async function getProjectsByCourse(courseCode: string) {
  return (await getAllProjects()).filter(
    (project) => project.course?.code.toLowerCase() === courseCode.toLowerCase()
  );
}

export async function filterProjects({
  query,
  category,
  tag,
  course,
  status,
  type,
}: {
  query?: string | null;
  category?: string | null;
  tag?: string | null;
  course?: string | null;
  status?: string | null;
  type?: string | null;
}) {
  let results = await getAllProjects();

  if (category) {
    results = results.filter((project) =>
      project.categories.includes(slugify(category))
    );
  }

  if (tag) {
    const normalizedTag = slugify(tag);
    results = results.filter((project) =>
      project.tags.some((projectTag) => slugify(projectTag) === normalizedTag)
    );
  }

  if (course) {
    results = results.filter(
      (project) => project.course?.code.toLowerCase() === course.toLowerCase()
    );
  }

  if (status) {
    results = results.filter(
      (project) => project.status.toLowerCase() === status.toLowerCase()
    );
  }

  if (type) {
    results = results.filter(
      (project) => project.projectType.toLowerCase() === type.toLowerCase()
    );
  }

  if (query?.trim()) {
    const projectIds = new Set(
      (await searchProjects(query)).map((project) => project.id)
    );
    results = results.filter((project) => projectIds.has(project.id));
  }

  return results;
}

export async function searchProjects(query: string) {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);

  if (terms.length === 0) {
    return [];
  }

  return (await getAllProjects()).filter((project) => {
    const searchable = [
      project.title,
      project.shortDescription,
      project.description,
      projectTypeLabels[project.projectType],
      projectStatusLabels[project.status],
      project.academicYear,
      project.batch,
      project.groupNumber,
      project.course?.code,
      project.course?.title,
      ...project.categories,
      ...project.tags,
      ...project.people.flatMap((person) => [
        person.name,
        person.role,
        person.username,
        person.email,
        person.sNumber,
      ]),
      ...Object.values(project.links),
    ]
      .filter(Boolean)
      .map(String)
      .join(' ')
      .toLowerCase();

    return terms.every((term) => searchable.includes(term));
  });
}

export async function getFeaturedProjects() {
  const priorityTypes: ProjectType[] = [
    'DEPARTMENT_SYSTEM',
    'RESEARCH_PROJECT',
    'PUBLICATION_ARTIFACT',
    'COURSE_PROJECT',
  ];

  return (await getAllProjects())
    .sort((a, b) => {
      const typeScore =
        priorityTypes.indexOf(a.projectType) -
        priorityTypes.indexOf(b.projectType);

      if (typeScore !== 0) {
        return typeScore;
      }

      return b.dates.lastUpdatedAt.localeCompare(a.dates.lastUpdatedAt);
    })
    .slice(0, 4);
}

export async function getRecentProjects() {
  return (await getAllProjects()).slice(0, 6);
}

export async function getCategories() {
  return countValues(
    (await getAllProjects()).flatMap((project) => project.categories)
  );
}

export async function getTags() {
  return countValues(
    (await getAllProjects()).flatMap((project) => project.tags.map(slugify))
  );
}

export async function getCourses() {
  const courseMap = new Map<
    string,
    { code: string; title: string; count: number }
  >();

  for (const project of await getAllProjects()) {
    if (!project.course) {
      continue;
    }

    const existing = courseMap.get(project.course.code);

    courseMap.set(project.course.code, {
      ...project.course,
      count: (existing?.count ?? 0) + 1,
    });
  }

  return [...courseMap.values()].sort((a, b) => a.code.localeCompare(b.code));
}

export async function getProjectStats() {
  const projects = await getAllProjects();

  return {
    total: projects.length,
    active: projects.filter((project) => project.status === 'ACTIVE').length,
    research: projects.filter((project) =>
      [
        'RESEARCH_PROJECT',
        'FACULTY_COLLABORATION',
        'PUBLICATION_ARTIFACT',
      ].includes(project.projectType)
    ).length,
    courseLinked: projects.filter((project) => project.course).length,
    openSource: projects.filter(
      (project) => project.projectType === 'OPEN_SOURCE'
    ).length,
  };
}

export async function getRelatedProjects(project: Project) {
  return (await getAllProjects())
    .filter((candidate) => candidate.slug !== project.slug)
    .filter((candidate) =>
      candidate.categories.some((category) =>
        project.categories.includes(category)
      )
    )
    .slice(0, 3);
}

function countValues(values: string[]) {
  const counts = new Map<string, number>();

  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([slug, count]) => ({
      slug,
      label: labelFromSlug(slug),
      count,
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}
