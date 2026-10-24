import { Binary, Database, type LucideIcon, Sigma } from 'lucide-react';

export type SubjectSlug = 'computer-science' | 'data-science' | 'statistics';

export interface SubjectConfig {
  slug: SubjectSlug;
  label: string;
  icon: LucideIcon;
  iconClassName: string;
}

export const SUBJECTS: SubjectConfig[] = [
  {
    slug: 'computer-science',
    label: 'Computer Science',
    icon: Binary,
    iconClassName: 'text-info-surface-foreground',
  },
  {
    slug: 'data-science',
    label: 'Data Science',
    icon: Database,
    iconClassName: 'text-violet-600 dark:text-violet-400',
  },
  {
    slug: 'statistics',
    label: 'Statistics',
    icon: Sigma,
    iconClassName: 'text-warning-surface-foreground',
  },
];

const subjectSlugSet = new Set<string>(SUBJECTS.map((subject) => subject.slug));

export function isSubjectSlug(slug: string): slug is SubjectSlug {
  return subjectSlugSet.has(slug);
}

export function getSubjectPath(slug: SubjectSlug): string {
  return `/students/${slug}`;
}
