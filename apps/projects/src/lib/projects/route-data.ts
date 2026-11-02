import type { Project } from '@scs/schemas';
import { notFound } from 'next/navigation';

import { fetchProjects } from '@/lib/projects/api-client';
import type { ProjectCollection } from '@/lib/projects/collection-navigation';
import {
  filterProjectsByCollection,
  paginateProjects,
} from '@/lib/projects/collections';

export async function requireProjectCollectionPage(
  collection: ProjectCollection,
  page: number
): Promise<Project[]> {
  const projects = await fetchProjects();
  const filteredProjects = filterProjectsByCollection(projects, collection);

  if (
    (collection.kind === 'category' || collection.kind === 'topic') &&
    filteredProjects.length === 0
  ) {
    notFound();
  }

  if (paginateProjects(filteredProjects, page).page !== page) notFound();

  return projects;
}
