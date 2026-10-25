import { getAllProjectData } from '@/lib/projects/projects-data';

export async function getAllProjects() {
  const projects = await getAllProjectData();

  return [...projects].sort((a, b) =>
    b.dates.lastUpdatedAt.localeCompare(a.dates.lastUpdatedAt)
  );
}
