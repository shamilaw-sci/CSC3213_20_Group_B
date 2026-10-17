import { ProjectSchema } from '@csc3213-2026-group-b/academic-domain-schemas';

import publicEnvConfig from '@/config/public.env.config';

import {
  labelFromSlug,
  projectStatusLabels,
  projectTypeLabels,
  slugify,
} from './metadata';
import type { Project } from './types';

export type ProjectFacet = {
  slug: string;
  label: string;
  count: number;
};

export type ProjectCourse = {
  code: string;
  title: string;
  count: number;
};

type ProjectByPersonEntry = {
  slug: string;
};

const PROJECTS_DATA_CACHE_TTL_MS = 5 * 60 * 1000;

type CacheEntry = {
  expiresAt: number;
  promise: Promise<unknown>;
};

const jsonCache = new Map<string, CacheEntry>();

export class ProjectDataNotFoundError extends Error {
  constructor(path: string) {
    super(`Project data not found for ${path}`);
    this.name = 'ProjectDataNotFoundError';
  }
}

async function fetchJson<T>(path: string): Promise<T> {
  const url = `${publicEnvConfig.NEXT_PUBLIC_PROJECTS_DATA_BASE_URL}/${path}`;
  const now = Date.now();
  const cached = jsonCache.get(url);

  if (cached && cached.expiresAt > now) {
    return cached.promise as Promise<T>;
  }

  const promise = fetch(url)
    .then(async (response) => {
      if (response.status === 404) {
        throw new ProjectDataNotFoundError(path);
      }

      if (!response.ok) {
        throw new Error(`Request failed for ${path}`);
      }

      return response.json() as Promise<T>;
    })
    .catch((error: unknown) => {
      jsonCache.delete(url);
      throw error;
    });

  jsonCache.set(url, {
    expiresAt: now + PROJECTS_DATA_CACHE_TTL_MS,
    promise,
  });

  return promise;
}

async function fetchAllProjectData(_signal?: AbortSignal) {
  const projects = await fetchJson<unknown>('projects.json');

  return ProjectSchema.array()
    .parse(projects)
    .sort((a, b) => b.dates.lastUpdatedAt.localeCompare(a.dates.lastUpdatedAt));
}

export async function fetchProjects(
  params?: URLSearchParams,
  signal?: AbortSignal
) {
  let projects = await fetchAllProjectData(signal);
  const category = params?.get('category');
  const tag = params?.get('tag');
  const course = params?.get('course');
  const status = params?.get('status');
  const type = params?.get('type');
  const query = params?.get('q');

  if (category) {
    projects = projects.filter((project) =>
      project.categories.includes(slugify(category))
    );
  }

  if (tag) {
    const normalizedTag = slugify(tag);
    projects = projects.filter((project) =>
      project.tags.some((projectTag) => slugify(projectTag) === normalizedTag)
    );
  }

  if (course) {
    projects = projects.filter(
      (project) => project.course?.code.toLowerCase() === course.toLowerCase()
    );
  }

  if (status) {
    projects = projects.filter(
      (project) => project.status.toLowerCase() === status.toLowerCase()
    );
  }

  if (type) {
    projects = projects.filter(
      (project) => project.projectType.toLowerCase() === type.toLowerCase()
    );
  }

  if (query?.trim()) {
    const projectIds = new Set(
      searchProjectList(projects, query).map((project) => project.id)
    );
    projects = projects.filter((project) => projectIds.has(project.id));
  }

  return projects;
}

export async function fetchProject(projectSlug: string, _signal?: AbortSignal) {
  const path = `projects/${encodeURIComponent(projectSlug)}.json`;
  const project = await fetchJson<unknown>(path);

  return ProjectSchema.parse(project);
}

export async function fetchProjectSearch(query: string, signal?: AbortSignal) {
  return searchProjectList(await fetchAllProjectData(signal), query);
}

function parseByPersonEntries(value: unknown): ProjectByPersonEntry[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((entry) =>
      entry &&
      typeof entry === 'object' &&
      !Array.isArray(entry) &&
      typeof (entry as { slug?: unknown }).slug === 'string'
        ? { slug: (entry as { slug: string }).slug }
        : null
    )
    .filter((entry): entry is ProjectByPersonEntry => Boolean(entry));
}

function normalizeUsername(username: string) {
  return username.trim().toLowerCase();
}

export async function fetchProjectsByUsername(
  username: string,
  _signal?: AbortSignal
) {
  const normalizedUsername = normalizeUsername(username);
  if (!normalizedUsername) return [];

  let entries: ProjectByPersonEntry[];
  try {
    entries = parseByPersonEntries(
      await fetchJson<unknown>(
        `by-person/${encodeURIComponent(normalizedUsername)}.json`
      )
    );
  } catch (error) {
    if (error instanceof ProjectDataNotFoundError) return [];
    throw error;
  }

  const projects = await Promise.all(
    entries.map((entry) => fetchProject(entry.slug))
  );

  return projects.sort((a, b) =>
    b.dates.lastUpdatedAt.localeCompare(a.dates.lastUpdatedAt)
  );
}

export async function fetchCategories(signal?: AbortSignal) {
  return countValues(
    (await fetchAllProjectData(signal)).flatMap((project) => project.categories)
  );
}

export async function fetchTags(signal?: AbortSignal) {
  return countValues(
    (await fetchAllProjectData(signal)).flatMap((project) =>
      project.tags.map(slugify)
    )
  );
}

export async function fetchCourses(signal?: AbortSignal) {
  const courseMap = new Map<string, ProjectCourse>();

  for (const project of await fetchAllProjectData(signal)) {
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

function searchProjectList(projects: Project[], query: string) {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);

  if (terms.length === 0) {
    return [];
  }

  return projects.filter((project) => {
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

function countValues(values: string[]): ProjectFacet[] {
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

export function clearProjectDataCacheForTests() {
  jsonCache.clear();
}
