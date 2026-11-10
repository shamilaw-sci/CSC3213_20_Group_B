import { type Project, ProjectSchema } from '@scs/schemas';

import { dataConfig } from '@/config/data.config';
import publicEnvConfig from '@/config/public.env.config';

type CacheEntry = {
  expiresAt: number;
  promise: Promise<Project[]>;
};

const projectDataCache = new Map<string, CacheEntry>();
const ProjectListSchema = ProjectSchema.array();

async function fetchProjectData(path: string): Promise<Project[]> {
  const now = Date.now();
  const cached = projectDataCache.get(path);

  if (cached && cached.expiresAt > now) {
    return cached.promise;
  }

  const promise = fetchProjectDataUncached(path).catch((): Project[] => []);

  projectDataCache.set(path, {
    expiresAt: now + dataConfig.cacheTtlMs,
    promise,
  });

  return promise;
}

async function fetchProjectDataUncached(path: string): Promise<Project[]> {
  if (publicEnvConfig.NEXT_PUBLIC_PROJECTS_DATA_BASE_URL === 'local') {
    return [];
  }

  const response = await fetch(
    `${publicEnvConfig.NEXT_PUBLIC_PROJECTS_DATA_BASE_URL}/${path}`,
    {
      cache: 'no-store',
    }
  );

  if (response.status === 404) {
    return [];
  }

  if (!response.ok) {
    throw new Error(
      `Failed to fetch projects data from ${path}: ${response.status} ${response.statusText}`
    );
  }

  return ProjectListSchema.parse(await response.json());
}

export function getAllProjectData(): Promise<Project[]> {
  return fetchProjectData('projects.json');
}
