import type { Project, ProjectType } from '@scs/schemas';

import {
  canonicalizeCollectionSegment,
  canonicalizeSearchSegment,
  PROJECT_TYPE_SEGMENTS,
  type ProjectCollection,
} from '@/lib/projects/collection-navigation';
import {
  projectStatusLabels,
  projectTypeLabels,
} from '@/lib/projects/metadata';

export const PROJECTS_PER_PAGE = 12;

export type ProjectPage = {
  projects: Project[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};

type SummaryCollection = Exclude<
  ProjectCollection,
  { kind: 'browse' | 'search' }
>;
type TypeCollection = Extract<ProjectCollection, { kind: 'type' }>;
type ValueCollection = Extract<
  ProjectCollection,
  { kind: 'category' | 'topic' }
>;

export type CollectionSummary<
  TCollection extends SummaryCollection = SummaryCollection,
> = {
  collection: TCollection;
  label: string;
  count: number;
};

export type CollectionSummaries = {
  types: CollectionSummary<TypeCollection>[];
  categories: CollectionSummary<ValueCollection>[];
  topics: CollectionSummary<ValueCollection>[];
};

function searchableProjectText(project: Project) {
  return [
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
    .normalize('NFKC')
    .toLowerCase();
}

export function filterProjectsByCollection(
  projects: Project[],
  collection: ProjectCollection
) {
  switch (collection.kind) {
    case 'browse':
      return projects;
    case 'type':
      return projects.filter(
        (project) => project.projectType === collection.projectType
      );
    case 'category': {
      const segment = canonicalizeCollectionSegment(collection.value);
      return projects.filter((project) =>
        project.categories.some(
          (category) => canonicalizeCollectionSegment(category) === segment
        )
      );
    }
    case 'topic': {
      const segment = canonicalizeCollectionSegment(collection.value);
      return projects.filter((project) =>
        project.tags.some(
          (topic) => canonicalizeCollectionSegment(topic) === segment
        )
      );
    }
    case 'search': {
      const terms = canonicalizeSearchSegment(collection.query)
        .split('-')
        .filter(Boolean);
      return projects.filter((project) => {
        const searchable = searchableProjectText(project);
        return terms.every((term) => searchable.includes(term));
      });
    }
  }
}

export function paginateProjects(
  projects: Project[],
  requestedPage: number
): ProjectPage {
  const totalItems = projects.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / PROJECTS_PER_PAGE));
  const normalizedPage = Number.isInteger(requestedPage) ? requestedPage : 1;
  const page = Math.min(Math.max(normalizedPage, 1), totalPages);
  const start = (page - 1) * PROJECTS_PER_PAGE;

  return {
    projects: projects.slice(start, start + PROJECTS_PER_PAGE),
    page,
    pageSize: PROJECTS_PER_PAGE,
    totalItems,
    totalPages,
  };
}

function displayCollectionLabel(value: string) {
  return value
    .normalize('NFKC')
    .trim()
    .replace(/[\s/\\_-]+/gu, ' ')
    .replace(/(^|\s)\p{L}/gu, (letter) => letter.toUpperCase());
}

function deriveValueSummaries(projects: Project[], kind: 'category' | 'topic') {
  const summaries = new Map<string, CollectionSummary<ValueCollection>>();

  for (const project of projects) {
    const values = kind === 'category' ? project.categories : project.tags;
    const uniqueSegments = new Set<string>();

    for (const value of values) {
      const segment = canonicalizeCollectionSegment(value);
      if (!segment || uniqueSegments.has(segment)) continue;
      uniqueSegments.add(segment);

      const existing = summaries.get(segment);
      summaries.set(segment, {
        collection: { kind, value: segment },
        label: existing?.label ?? displayCollectionLabel(value),
        count: (existing?.count ?? 0) + 1,
      });
    }
  }

  return [...summaries.values()].sort(
    (a, b) =>
      b.count - a.count || a.collection.value.localeCompare(b.collection.value)
  );
}

export function deriveCollectionSummaries(
  projects: Project[]
): CollectionSummaries {
  const types: CollectionSummary<TypeCollection>[] = [];

  for (const projectType of Object.keys(
    PROJECT_TYPE_SEGMENTS
  ) as ProjectType[]) {
    const count = projects.filter(
      (project) => project.projectType === projectType
    ).length;
    if (count === 0) continue;

    types.push({
      collection: { kind: 'type', projectType },
      label: projectTypeLabels[projectType],
      count,
    });
  }

  return {
    types,
    categories: deriveValueSummaries(projects, 'category'),
    topics: deriveValueSummaries(projects, 'topic'),
  };
}

export function recentProjects(projects: Project[], limit: number) {
  return [...projects]
    .sort(
      (a, b) =>
        b.dates.lastUpdatedAt.localeCompare(a.dates.lastUpdatedAt) ||
        a.slug.localeCompare(b.slug)
    )
    .slice(0, Math.max(0, limit));
}
