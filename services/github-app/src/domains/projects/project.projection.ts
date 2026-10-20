import type { Project } from '@scs/schemas';

export interface ProjectManifest {
  version: string;
  updatedAt?: string;
  projects: ProjectManifestEntry[];
}

interface ProjectManifestEntry {
  id: string;
  slug: string;
  title: string;
  href: string;
}

export interface ProjectByPersonEntry {
  id: string;
  slug: string;
  title: string;
  shortDescription: string;
  projectType: Project['projectType'];
  status: Project['status'];
  categories: string[];
  tags: string[];
  academicYear?: Project['academicYear'];
  role: Project['people'][number]['role'];
  href: string;
  lastUpdatedAt: string;
}

export function normalizeProjectSlug(slug: string): string {
  return slug.trim().toLowerCase();
}

function isProject(value: unknown): value is Project {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const candidate = value as Partial<Project>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.slug === 'string' &&
    typeof candidate.title === 'string' &&
    typeof candidate.shortDescription === 'string' &&
    Array.isArray(candidate.categories) &&
    Array.isArray(candidate.tags) &&
    Array.isArray(candidate.people) &&
    candidate.dates !== null &&
    typeof candidate.dates === 'object' &&
    typeof candidate.dates.lastUpdatedAt === 'string'
  );
}

export function upsertProjectAggregate(
  existingValue: unknown,
  project: Project
): Project[] {
  const records = Array.isArray(existingValue) ? existingValue : [];
  const nextRecords = records.filter(
    (record): record is Project =>
      isProject(record) && (record as { slug?: unknown }).slug !== project.slug
  );

  nextRecords.push(project);
  return nextRecords.sort((left, right) =>
    left.title.localeCompare(right.title)
  );
}

export function removeProjectFromAggregate(
  existingValue: unknown,
  slug: string
): Project[] {
  const normalizedSlug = normalizeProjectSlug(slug);
  const records = Array.isArray(existingValue) ? existingValue : [];
  return records
    .filter(
      (record): record is Project =>
        isProject(record) &&
        (record as { slug?: unknown }).slug !== normalizedSlug
    )
    .sort((left, right) => left.title.localeCompare(right.title));
}

export function hasProjectInAggregate(
  existingValue: unknown,
  slug: string
): boolean {
  const normalizedSlug = normalizeProjectSlug(slug);
  const records = Array.isArray(existingValue) ? existingValue : [];
  return records.some(
    (record) =>
      isProject(record) &&
      (record as { slug?: unknown }).slug === normalizedSlug
  );
}

export function projectFromAggregate(
  aggregateValue: unknown,
  slug: string
): Project | undefined {
  const normalizedSlug = normalizeProjectSlug(slug);
  const records = Array.isArray(aggregateValue) ? aggregateValue : [];
  return records.find(
    (record): record is Project =>
      isProject(record) &&
      (record as { slug?: unknown }).slug === normalizedSlug
  );
}

export function usernamesForProject(project: Project | undefined): Set<string> {
  const usernames = new Set<string>();
  if (!project) return usernames;

  for (const person of project.people) {
    if (person.username) {
      usernames.add(normalizeProjectSlug(person.username));
    }
  }
  return usernames;
}

function byPersonEntryForProject(
  project: Project,
  role: ProjectByPersonEntry['role']
): ProjectByPersonEntry {
  return {
    id: project.id,
    slug: project.slug,
    title: project.title,
    shortDescription: project.shortDescription,
    projectType: project.projectType,
    status: project.status,
    categories: project.categories,
    tags: project.tags,
    ...(project.academicYear ? { academicYear: project.academicYear } : {}),
    role,
    href: `projects/${project.slug}.json`,
    lastUpdatedAt: project.dates.lastUpdatedAt,
  };
}

export function buildProjectByPersonIndex(
  aggregateValue: unknown,
  username: string
): ProjectByPersonEntry[] {
  const normalizedUsername = normalizeProjectSlug(username);
  const records = Array.isArray(aggregateValue) ? aggregateValue : [];
  const entries: ProjectByPersonEntry[] = [];

  for (const record of records) {
    if (!isProject(record)) continue;
    const member = record.people.find(
      (person) =>
        person.username &&
        normalizeProjectSlug(person.username) === normalizedUsername
    );
    if (member) entries.push(byPersonEntryForProject(record, member.role));
  }

  return entries.sort(
    (left, right) =>
      left.title.localeCompare(right.title) ||
      left.slug.localeCompare(right.slug)
  );
}

function manifestEntryForProject(project: Project): ProjectManifestEntry {
  return {
    id: project.id,
    slug: project.slug,
    title: project.title,
    href: `projects/${project.slug}.json`,
  };
}

function asManifest(value: unknown): Partial<ProjectManifest> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value
    : {};
}

function manifestUpdatedAt(
  existing: Partial<ProjectManifest>,
  updatedAt?: string
): string | undefined {
  if (updatedAt) return updatedAt;
  return typeof existing.updatedAt === 'string'
    ? existing.updatedAt
    : undefined;
}

export function upsertProjectManifest(
  existingValue: unknown,
  project: Project,
  updatedAt?: string
): ProjectManifest {
  const existing = asManifest(existingValue);
  const records = Array.isArray(existing.projects) ? existing.projects : [];
  const nextProjects = records.filter(
    (record): record is ProjectManifestEntry =>
      record !== null &&
      typeof record === 'object' &&
      !Array.isArray(record) &&
      (record as { slug?: unknown }).slug !== project.slug
  );
  nextProjects.push(manifestEntryForProject(project));

  return {
    version: typeof existing.version === 'string' ? existing.version : '1',
    updatedAt: manifestUpdatedAt(existing, updatedAt),
    projects: nextProjects.sort((left, right) =>
      left.title.localeCompare(right.title)
    ),
  };
}

export function hasProjectInManifest(
  existingValue: unknown,
  slug: string
): boolean {
  const normalizedSlug = normalizeProjectSlug(slug);
  const records = asManifest(existingValue).projects;
  return Array.isArray(records)
    ? records.some(
        (record) =>
          record !== null &&
          typeof record === 'object' &&
          !Array.isArray(record) &&
          (record as { slug?: unknown }).slug === normalizedSlug
      )
    : false;
}

export function removeProjectManifest(
  existingValue: unknown,
  slug: string,
  updatedAt?: string
): ProjectManifest {
  const normalizedSlug = normalizeProjectSlug(slug);
  const existing = asManifest(existingValue);
  const records = Array.isArray(existing.projects) ? existing.projects : [];
  const nextProjects = records.filter(
    (record): record is ProjectManifestEntry =>
      record !== null &&
      typeof record === 'object' &&
      !Array.isArray(record) &&
      (record as { slug?: unknown }).slug !== normalizedSlug
  );

  return {
    version: typeof existing.version === 'string' ? existing.version : '1',
    updatedAt: manifestUpdatedAt(existing, updatedAt),
    projects: nextProjects.sort((left, right) =>
      left.title.localeCompare(right.title)
    ),
  };
}
