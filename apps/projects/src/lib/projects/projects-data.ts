import { ProjectSchema } from '@scs/schemas';

import { dataConfig } from '@/config/data.config';
import publicEnvConfig from '@/config/public.env.config';
import type { Project } from '@/lib/projects/types';

type Schema<T> = {
  parse(input: unknown): T;
};

type CacheEntry<T> = {
  expiresAt: number;
  promise: Promise<T>;
};

const projectDataCache = new Map<string, CacheEntry<unknown>>();

const ProjectListSchema = {
  parse(input: unknown): Project[] {
    return ProjectSchema.array().parse(input);
  },
};

const ProjectProfileSchema = {
  parse(input: unknown): Project {
    return ProjectSchema.parse(input);
  },
};

async function fetchProjectData<T>(
  path: string,
  schema: Schema<T>,
  emptyValue: T
): Promise<T> {
  const now = Date.now();
  const cached = projectDataCache.get(path);

  if (cached && cached.expiresAt > now) {
    return cached.promise as Promise<T>;
  }

  const promise = fetchProjectDataUncached(path, schema, emptyValue).catch(() =>
    schema.parse(emptyValue)
  );

  projectDataCache.set(path, {
    expiresAt: now + dataConfig.cacheTtlMs,
    promise,
  });

  return promise;
}

async function fetchProjectDataUncached<T>(
  path: string,
  schema: Schema<T>,
  emptyValue: T
): Promise<T> {
  if (publicEnvConfig.NEXT_PUBLIC_PROJECTS_DATA_BASE_URL === 'local') {
    return schema.parse(emptyValue);
  }

  const response = await fetch(
    `${publicEnvConfig.NEXT_PUBLIC_PROJECTS_DATA_BASE_URL}/${path}`,
    {
      cache: 'no-store',
    }
  );

  if (response.status === 404) {
    return schema.parse(emptyValue);
  }

  if (!response.ok) {
    throw new Error(
      `Failed to fetch projects data from ${path}: ${response.status} ${response.statusText}`
    );
  }

  return schema.parse(await response.json());
}

export function getAllProjectData(): Promise<Project[]> {
  return fetchProjectData('projects.json', ProjectListSchema, []);
}

export async function getProjectDataBySlug(
  slug: string
): Promise<Project | undefined> {
  if (publicEnvConfig.NEXT_PUBLIC_PROJECTS_DATA_BASE_URL === 'local') {
    return undefined;
  }

  const response = await fetch(
    `${publicEnvConfig.NEXT_PUBLIC_PROJECTS_DATA_BASE_URL}/projects/${encodeURIComponent(slug)}.json`,
    {
      cache: 'no-store',
    }
  );

  if (response.status === 404) {
    return undefined;
  }

  if (!response.ok) {
    throw new Error(
      `Failed to fetch project data for ${slug}: ${response.status} ${response.statusText}`
    );
  }

  return ProjectProfileSchema.parse(await response.json());
}
