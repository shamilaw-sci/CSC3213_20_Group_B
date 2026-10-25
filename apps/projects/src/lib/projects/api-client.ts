import { ProjectSchema } from '@scs/schemas';

import { dataConfig } from '@/config/data.config';
import publicEnvConfig from '@/config/public.env.config';

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
    expiresAt: now + dataConfig.cacheTtlMs,
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

export async function fetchProjects(signal?: AbortSignal) {
  return fetchAllProjectData(signal);
}

export async function fetchProject(projectSlug: string, _signal?: AbortSignal) {
  const path = `projects/${encodeURIComponent(projectSlug)}.json`;
  const project = await fetchJson<unknown>(path);

  return ProjectSchema.parse(project);
}

export function clearProjectDataCacheForTests() {
  jsonCache.clear();
}
