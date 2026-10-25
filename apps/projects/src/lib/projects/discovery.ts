import {
  labelFromSlug,
  projectStatusLabels,
  projectTypeLabels,
  slugify,
} from '@/lib/projects/metadata';
import type { Project, ProjectStatus, ProjectType } from '@/lib/projects/types';

export const PROJECTS_PER_PAGE = 12;

export type ProjectDiscoveryState = {
  q: string;
  category: string;
  topic: string;
  course: string;
  status: ProjectStatus | '';
  type: ProjectType | '';
  person: string;
  page: number;
};

export type DiscoveryOption<T extends string = string> = {
  value: T;
  label: string;
  count: number;
};

export type DiscoveryOptions = {
  categories: DiscoveryOption[];
  topics: DiscoveryOption[];
  courses: DiscoveryOption[];
  people: DiscoveryOption[];
  statuses: DiscoveryOption<ProjectStatus>[];
  types: DiscoveryOption<ProjectType>[];
};

export type ProjectPage = {
  projects: Project[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};

const statusValues = Object.keys(projectStatusLabels) as ProjectStatus[];
const typeValues = Object.keys(projectTypeLabels) as ProjectType[];

function enumValue<T extends string>(
  value: string | null,
  values: readonly T[]
): T | '' {
  const normalized = value?.trim().toUpperCase() ?? '';
  return values.includes(normalized as T) ? (normalized as T) : '';
}

function textValue(value: string | null) {
  return value?.trim() ?? '';
}

function positivePage(value: string | null) {
  const page = Number(value);
  return Number.isInteger(page) && page > 0 ? page : 1;
}

export function parseProjectDiscoveryParams(
  params: URLSearchParams
): ProjectDiscoveryState {
  const category = textValue(params.get('category'));
  const topic = textValue(params.get('topic'));

  return {
    q: textValue(params.get('q')),
    category: category ? slugify(category) : '',
    topic: topic ? slugify(topic) : '',
    course: textValue(params.get('course')).toUpperCase(),
    status: enumValue(params.get('status'), statusValues),
    type: enumValue(params.get('type'), typeValues),
    person: textValue(params.get('person')).toLowerCase(),
    page: positivePage(params.get('page')),
  };
}

function searchableProjectText(project: Project) {
  return [
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
}

export function filterProjects(
  projects: Project[],
  state: ProjectDiscoveryState
) {
  const terms = state.q.toLowerCase().split(/\s+/u).filter(Boolean);

  return projects.filter((project) => {
    if (
      state.category &&
      !project.categories.some(
        (category) => slugify(category) === state.category
      )
    ) {
      return false;
    }

    if (
      state.topic &&
      !project.tags.some((topic) => slugify(topic) === state.topic)
    ) {
      return false;
    }

    if (state.course && project.course?.code.toUpperCase() !== state.course) {
      return false;
    }

    if (state.status && project.status !== state.status) return false;
    if (state.type && project.projectType !== state.type) return false;

    if (
      state.person &&
      !project.people.some(
        (person) => person.username?.toLowerCase() === state.person
      )
    ) {
      return false;
    }

    if (terms.length > 0) {
      const searchable = searchableProjectText(project);
      return terms.every((term) => searchable.includes(term));
    }

    return true;
  });
}

export function paginateProjects(
  projects: Project[],
  requestedPage: number
): ProjectPage {
  const totalItems = projects.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / PROJECTS_PER_PAGE));
  const normalizedPage = Number.isInteger(requestedPage) ? requestedPage : 1;
  const page = Math.min(Math.max(normalizedPage, 1), totalPages);
  const start = (page - 1) * PROJECTS_PER_PAGE;

  return {
    projects: projects.slice(start, start + PROJECTS_PER_PAGE),
    page,
    pageSize: PROJECTS_PER_PAGE,
    totalItems,
    totalPages,
  };
}

function countedOptions(
  values: Array<{ value: string; label: string }>
): DiscoveryOption[] {
  const options = new Map<string, DiscoveryOption>();

  for (const value of values) {
    const existing = options.get(value.value);
    options.set(value.value, {
      ...value,
      count: (existing?.count ?? 0) + 1,
    });
  }

  return [...options.values()].sort(
    (a, b) => b.count - a.count || a.value.localeCompare(b.value)
  );
}

export function deriveDiscoveryOptions(projects: Project[]): DiscoveryOptions {
  return {
    categories: countedOptions(
      projects.flatMap((project) =>
        project.categories.map((category) => ({
          value: slugify(category),
          label: labelFromSlug(category),
        }))
      )
    ),
    topics: countedOptions(
      projects.flatMap((project) =>
        project.tags.map((topic) => ({
          value: slugify(topic),
          label: labelFromSlug(topic),
        }))
      )
    ),
    courses: countedOptions(
      projects.flatMap((project) =>
        project.course
          ? [
              {
                value: project.course.code,
                label: `${project.course.code} — ${project.course.title}`,
              },
            ]
          : []
      )
    ),
    people: countedOptions(
      projects.flatMap((project) =>
        project.people.flatMap((person) =>
          person.username
            ? [
                {
                  value: person.username.toLowerCase(),
                  label: `${person.name} (@${person.username.toLowerCase()})`,
                },
              ]
            : []
        )
      )
    ),
    statuses: countedOptions(
      projects.map((project) => ({
        value: project.status,
        label: projectStatusLabels[project.status],
      }))
    ) as DiscoveryOption<ProjectStatus>[],
    types: countedOptions(
      projects.map((project) => ({
        value: project.projectType,
        label: projectTypeLabels[project.projectType],
      }))
    ) as DiscoveryOption<ProjectType>[],
  };
}

const discoveryKeys = [
  'q',
  'category',
  'topic',
  'course',
  'status',
  'type',
  'person',
] as const;

export function buildDiscoveryUrl(state: ProjectDiscoveryState) {
  const params = new URLSearchParams();

  for (const key of discoveryKeys) {
    if (state[key]) params.set(key, state[key]);
  }

  if (state.page > 1) params.set('page', String(state.page));

  const query = params.toString();
  return query ? `/?${query}` : '/';
}

export function patchProjectDiscoveryState(
  state: ProjectDiscoveryState,
  patch: Partial<ProjectDiscoveryState>
) {
  const changesFilter = Object.keys(patch).some((key) => key !== 'page');
  const merged = {
    ...state,
    ...patch,
    page: changesFilter ? 1 : (patch.page ?? state.page),
  };
  const params = new URLSearchParams();

  for (const key of discoveryKeys) {
    if (merged[key]) params.set(key, String(merged[key]));
  }
  params.set('page', String(merged.page));

  return parseProjectDiscoveryParams(params);
}
