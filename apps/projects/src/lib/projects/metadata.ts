import type { ProjectStatus, ProjectType } from '@/lib/projects/types';

export const projectTypeLabels: Record<ProjectType, string> = {
  COURSE_PROJECT: 'Course Project',
  RESEARCH_PROJECT: 'Research Project',
  STUDENT_INNOVATION: 'Student Innovation',
  OPEN_SOURCE: 'Open Source',
  DEPARTMENT_SYSTEM: 'Department System',
  DATASET: 'Dataset',
  PUBLICATION_ARTIFACT: 'Publication Artifact',
  INDUSTRY_COLLABORATION: 'Industry Collaboration',
  FACULTY_COLLABORATION: 'Faculty Collaboration',
  HACKATHON: 'Hackathon',
  OTHER: 'Other',
};

export const projectStatusLabels: Record<ProjectStatus, string> = {
  PLANNED: 'Planned',
  ACTIVE: 'Active',
  COMPLETED: 'Completed',
  ARCHIVED: 'Archived',
};

export function labelFromSlug(value: string) {
  return value
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
