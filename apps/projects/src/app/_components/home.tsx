'use client';

import { Button } from '@scs/ui/components/button';
import { Input } from '@scs/ui/components/input';
import { Label } from '@scs/ui/components/label';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@scs/ui/components/select';
import { cn } from 'cn';
import { ListFilter, Search, X } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { type FormEvent, useEffect, useMemo, useState } from 'react';

import {
  ProjectErrorPanel,
  ProjectHomeLoading,
} from '@/components/projects/project-states';
import { ProjectGrid } from '@/components/projects/registry-ui';
import { fetchProjects } from '@/lib/projects/api-client';
import {
  buildDiscoveryUrl,
  deriveDiscoveryOptions,
  type DiscoveryOption,
  filterProjects,
  paginateProjects,
  parseProjectDiscoveryParams,
  patchProjectDiscoveryState,
  type ProjectDiscoveryState,
} from '@/lib/projects/discovery';
import type { Project } from '@/lib/projects/types';

type FilterKey = Exclude<keyof ProjectDiscoveryState, 'q' | 'page'>;

const ALL_FILTER_VALUE = '__project_discovery_all__';
const FILTER_OPTION_PREFIX = 'project-discovery-option:';

export default function Home() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const state = useMemo(
    () => parseProjectDiscoveryParams(new URLSearchParams(searchParams)),
    [searchParams]
  );

  useEffect(() => {
    const controller = new AbortController();

    async function loadProjects() {
      setLoading(true);

      try {
        setProjects(await fetchProjects(controller.signal));
        setLoadFailed(false);
      } catch {
        if (!controller.signal.aborted) {
          setProjects([]);
          setLoadFailed(true);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void loadProjects();
    return () => controller.abort();
  }, [reloadKey]);

  const options = useMemo(() => deriveDiscoveryOptions(projects), [projects]);
  const filteredProjects = useMemo(
    () => filterProjects(projects, state),
    [projects, state]
  );
  const projectPage = useMemo(
    () => paginateProjects(filteredProjects, state.page),
    [filteredProjects, state.page]
  );
  const activeFilters = activeFilterLabels(state, options);
  const hasFilters = activeFilters.length > 0;

  function navigate(patch: Partial<ProjectDiscoveryState>) {
    router.push(buildDiscoveryUrl(patchProjectDiscoveryState(state, patch)));
  }

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    navigate({ q: String(formData.get('q') ?? '') });
  }

  if (loading) return <ProjectHomeLoading />;

  return (
    <>
      <section className="bg-card border-b">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:py-12">
          <p className="text-primary text-sm font-medium">
            Department of Statistics & Computer Science
          </p>
          <h1
            className="text-card-foreground mt-3 max-w-3xl text-4xl
              font-semibold tracking-tight text-balance sm:text-5xl"
          >
            Find Projects
          </h1>
          <p className="text-muted-foreground mt-4 max-w-3xl text-base/7">
            Search and browse student projects, research, department systems,
            datasets, open-source work, and collaborations.
          </p>

          <form
            key={state.q}
            onSubmit={handleSearch}
            className="mt-7 max-w-3xl"
          >
            <Label htmlFor="project-search">Search Projects</Label>
            <div className="mt-2 flex gap-2">
              <div className="relative min-w-0 flex-1">
                <Search
                  aria-hidden="true"
                  className="text-muted-foreground pointer-events-none absolute
                    top-1/2 left-3 size-4 -translate-y-1/2"
                />
                <Input
                  id="project-search"
                  name="q"
                  defaultValue={state.q}
                  placeholder="Example: CSC3213, accessibility, or a student name…"
                  autoComplete="off"
                  className="h-11 pl-10"
                />
              </div>
              <Button type="submit" className="h-11">
                Search Projects
              </Button>
            </div>
            <p className="text-muted-foreground mt-2 text-sm">
              Try a title, course code, person, or technology.
            </p>
          </form>
        </div>
      </section>

      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:py-10">
        <section aria-labelledby="filter-heading">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 id="filter-heading" className="font-semibold">
                Narrow the Results
              </h2>
              <p className="text-muted-foreground mt-1 text-sm">
                Choose only the details you already know.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="md:hidden"
                aria-expanded={filtersOpen}
                aria-controls="project-filter-controls"
                onClick={() => setFiltersOpen((open) => !open)}
              >
                <ListFilter aria-hidden="true" />
                {filtersOpen ? 'Hide filters' : 'Show filters'}
              </Button>
              {hasFilters ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => router.push('/')}
                >
                  Clear Filters
                </Button>
              ) : null}
            </div>
          </div>

          <div
            id="project-filter-controls"
            className={cn(
              'mt-4 gap-3 sm:grid-cols-2 lg:grid-cols-3',
              filtersOpen ? 'grid' : 'hidden md:grid'
            )}
          >
            <DiscoverySelect
              id="category-filter"
              label="Category"
              value={state.category}
              options={options.categories}
              onValueChange={(value) => navigate({ category: value })}
            />
            <DiscoverySelect
              id="topic-filter"
              label="Topic"
              value={state.topic}
              options={options.topics}
              onValueChange={(value) => navigate({ topic: value })}
            />
            <DiscoverySelect
              id="course-filter"
              label="Course"
              value={state.course}
              options={options.courses}
              onValueChange={(value) => navigate({ course: value })}
            />
            <DiscoverySelect
              id="status-filter"
              label="Status"
              value={state.status}
              options={options.statuses}
              onValueChange={(value) =>
                navigate({ status: value as ProjectDiscoveryState['status'] })
              }
            />
            <DiscoverySelect
              id="type-filter"
              label="Project Type"
              value={state.type}
              options={options.types}
              onValueChange={(value) =>
                navigate({ type: value as ProjectDiscoveryState['type'] })
              }
            />
            <DiscoverySelect
              id="person-filter"
              label="Person"
              value={state.person}
              options={options.people}
              onValueChange={(value) => navigate({ person: value })}
            />
          </div>

          {hasFilters ? (
            <div
              className="mt-4 flex flex-wrap gap-2"
              aria-label="Active filters"
            >
              {activeFilters.map((filter) => (
                <Button
                  key={filter.key}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="max-w-full overflow-hidden"
                  aria-label={`Remove ${filter.name} ${filter.label}`}
                  onClick={() => navigate({ [filter.key]: '' })}
                >
                  <span className="min-w-0 truncate">{filter.label}</span>
                  <X aria-hidden="true" className="shrink-0" />
                </Button>
              ))}
            </div>
          ) : null}
        </section>

        <section className="mt-10" aria-labelledby="project-results-heading">
          <div
            className="mb-5 flex flex-wrap items-end justify-between gap-3
              border-b pb-4"
          >
            <div>
              <h2
                id="project-results-heading"
                className="text-2xl font-semibold text-balance"
              >
                {hasFilters ? 'Matching Projects' : 'All Projects'}
              </h2>
              <p
                className="text-muted-foreground mt-1 text-sm"
                aria-live="polite"
              >
                {resultCountLabel(projectPage.totalItems)}
              </p>
            </div>
            {projectPage.totalPages > 1 ? (
              <p className="text-muted-foreground text-sm tabular-nums">
                Page {projectPage.page} of {projectPage.totalPages}
              </p>
            ) : null}
          </div>

          {loadFailed ? (
            <ProjectErrorPanel onRetry={() => setReloadKey((key) => key + 1)} />
          ) : (
            <ProjectGrid
              projects={projectPage.projects}
              emptyTitle="No projects match these filters"
              emptyDescription="Remove a filter or try a broader search."
            />
          )}

          {!loadFailed && projectPage.totalPages > 1 ? (
            <nav
              aria-label="Project result pages"
              className="mt-8 flex items-center justify-between gap-3"
            >
              {projectPage.page > 1 ? (
                <Button asChild variant="outline">
                  <Link
                    href={buildDiscoveryUrl(
                      patchProjectDiscoveryState(state, {
                        page: projectPage.page - 1,
                      })
                    )}
                  >
                    Previous
                  </Link>
                </Button>
              ) : (
                <span />
              )}
              {projectPage.page < projectPage.totalPages ? (
                <Button asChild variant="outline">
                  <Link
                    href={buildDiscoveryUrl(
                      patchProjectDiscoveryState(state, {
                        page: projectPage.page + 1,
                      })
                    )}
                  >
                    Next
                  </Link>
                </Button>
              ) : null}
            </nav>
          ) : null}
        </section>
      </div>
    </>
  );
}

function DiscoverySelect({
  id,
  label,
  value,
  options,
  onValueChange,
}: Readonly<{
  id: string;
  label: string;
  value: string;
  options: DiscoveryOption[];
  onValueChange: (value: string) => void;
}>) {
  return (
    <div className="min-w-0">
      <Label htmlFor={id}>{label}</Label>
      <Select
        value={value ? toSelectValue(value) : ALL_FILTER_VALUE}
        onValueChange={(nextValue) => onValueChange(fromSelectValue(nextValue))}
      >
        <SelectTrigger id={id} className="mt-2 w-full">
          <SelectValue placeholder={`All ${label.toLowerCase()}`} />
        </SelectTrigger>
        <SelectContent position="popper" align="start">
          <SelectGroup>
            <SelectItem value={ALL_FILTER_VALUE}>
              All {label.toLowerCase()}
            </SelectItem>
            {options.map((option) => (
              <SelectItem
                key={option.value}
                value={toSelectValue(option.value)}
              >
                {option.label} ({option.count})
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  );
}

function toSelectValue(value: string) {
  return `${FILTER_OPTION_PREFIX}${value}`;
}

function fromSelectValue(value: string) {
  return value === ALL_FILTER_VALUE
    ? ''
    : value.slice(FILTER_OPTION_PREFIX.length);
}

function resultCountLabel(count: number) {
  return `${count} ${count === 1 ? 'project' : 'projects'}`;
}

function activeFilterLabels(
  state: ProjectDiscoveryState,
  options: ReturnType<typeof deriveDiscoveryOptions>
) {
  const labels: Array<{
    key: 'q' | FilterKey;
    name: string;
    label: string;
  }> = [];

  if (state.q) labels.push({ key: 'q', name: 'search', label: state.q });

  const filters: Array<{
    key: FilterKey;
    name: string;
    options: DiscoveryOption[];
  }> = [
    { key: 'category', name: 'category', options: options.categories },
    { key: 'topic', name: 'topic', options: options.topics },
    { key: 'course', name: 'course', options: options.courses },
    { key: 'status', name: 'status', options: options.statuses },
    { key: 'type', name: 'project type', options: options.types },
    { key: 'person', name: 'person', options: options.people },
  ];

  for (const filter of filters) {
    const value = state[filter.key];
    if (!value) continue;
    labels.push({
      key: filter.key,
      name: filter.name,
      label:
        filter.options.find((option) => option.value === value)?.label ?? value,
    });
  }

  return labels;
}
