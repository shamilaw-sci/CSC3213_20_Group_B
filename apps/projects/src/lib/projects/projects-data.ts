import { type Project, ProjectSchema } from '@scs/schemas';

import { dataConfig } from '@/config/data.config';
import publicEnvConfig from '@/config/public.env.config';

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
