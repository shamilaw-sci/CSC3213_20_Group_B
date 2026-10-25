import type { ProjectType } from '@scs/schemas';

export const PROJECT_TYPE_SEGMENTS = {
  COURSE_PROJECT: 'course-projects',
  RESEARCH_PROJECT: 'research-projects',
  STUDENT_INNOVATION: 'student-innovations',
  OPEN_SOURCE: 'open-source',
  DEPARTMENT_SYSTEM: 'department-systems',
  DATASET: 'datasets',
  PUBLICATION_ARTIFACT: 'publication-artifacts',
  INDUSTRY_COLLABORATION: 'industry-collaborations',
  FACULTY_COLLABORATION: 'faculty-collaborations',
  HACKATHON: 'hackathons',
  OTHER: 'other',
} satisfies Record<ProjectType, string>;

export type ProjectCollection =
  | { kind: 'browse' }
  | { kind: 'type'; projectType: ProjectType }
  | { kind: 'category'; value: string }
  | { kind: 'topic'; value: string }
  | { kind: 'search'; query: string };

const projectTypeBySegment = new Map(
  Object.entries(PROJECT_TYPE_SEGMENTS).map(([projectType, segment]) => [
    segment,
    projectType as ProjectType,
  ])
);

function canonicalizePathValue(value: string) {
  return value
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/[\s/\\]+/gu, '-')
    .replace(/-+/gu, '-')
    .replace(/^-|-$/gu, '');
}

export function canonicalizeCollectionSegment(value: string) {
  return canonicalizePathValue(value);
}

export function canonicalizeSearchSegment(value: string) {
  return canonicalizePathValue(value);
}

export function resolveProjectTypeSegment(segment: string) {
  return projectTypeBySegment.get(segment) ?? null;
}

export function parseCollectionPage(segments?: string[]) {
  if (!segments || segments.length === 0) return 1;
  if (segments.length !== 2 || segments[0] !== 'page') return null;

  const page = Number(segments[1]);
  return Number.isInteger(page) && page > 0 ? page : null;
}

function collectionBasePath(collection: ProjectCollection) {
  switch (collection.kind) {
    case 'browse':
      return '/browse';
    case 'type':
      return `/types/${PROJECT_TYPE_SEGMENTS[collection.projectType]}`;
    case 'category':
      return `/categories/${encodeURIComponent(canonicalizeCollectionSegment(collection.value))}`;
    case 'topic':
      return `/topics/${encodeURIComponent(canonicalizeCollectionSegment(collection.value))}`;
    case 'search':
      return `/search/${encodeURIComponent(canonicalizeSearchSegment(collection.query))}`;
  }
}

export function buildCollectionPath(collection: ProjectCollection, page = 1) {
  const basePath = collectionBasePath(collection);
  return page > 1 ? `${basePath}/page/${page}` : basePath;
}
