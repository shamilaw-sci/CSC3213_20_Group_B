import { ProjectSchema } from '@scs/schemas';

import publicEnvConfig from '@/config/public.env.config';

import type { Project } from './types';

const PROJECTS_DATA_TTL_MS = 5 * 60 * 1000;

type Schema<T> = {
  parse(input: unknown): T;
};

type CacheEntry<T> = {
  expiresAt: number;
  promise: Promise<T>;
};

type ProjectsManifest = {
  version: string;
  projects: Array<{
    id: string;
    slug: string;
    title: string;
    projectType: Project['projectType'];
    status: Project['status'];
    academicYear?: Project['academicYear'];
    lastUpdatedAt: string;
  }>;
};

const projectDataCache = new Map<string, CacheEntry<unknown>>();

const ProjectListSchema = {
  parse(input: unknown): Project[] {
    return ProjectSchema.array().parse(input);
  },
};

const ProjectsManifestSchema = {
  parse(input: unknown): ProjectsManifest {
    if (!input || typeof input !== 'object') {
      throw new TypeError('Expected projects manifest to be an object');
    }

    const manifest = input as Partial<ProjectsManifest>;
    if (
      typeof manifest.version !== 'string' ||
      !Array.isArray(manifest.projects)
    ) {
      throw new TypeError('Invalid projects manifest');
    }

    return {
      version: manifest.version,
      projects: manifest.projects.map((project) => ({
        id: project.id,
        slug: project.slug,
        title: project.title,
        projectType: project.projectType,
        status: project.status,
        academicYear: project.academicYear,
        lastUpdatedAt: project.lastUpdatedAt,
      })),
    };
  },
};

const ProjectProfileSchema = {
  parse(input: unknown): Project {
    return ProjectSchema.parse(input);
  },
};

function getEmptyManifest(): ProjectsManifest {
  return {
    version: 'published',
    projects: [],
  };
}

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
    expiresAt: now + PROJECTS_DATA_TTL_MS,
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

export function getProjectsManifest(): Promise<ProjectsManifest> {
  return fetchProjectData(
    'manifest.json',
    ProjectsManifestSchema,
    getEmptyManifest()
  );
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
