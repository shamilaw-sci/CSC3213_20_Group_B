'use client';

import {
  AcademicDepartmentCodeSchema,
  type MutationAccepted,
  ProjectIndexSchemaUrl,
  type ProjectLinks,
  type ProjectPerson,
  type ProjectPersonRole,
  ProjectPersonRoleSchema,
  ProjectSchema,
  projectSlugBaseFromTitle,
  type ProjectSource,
  ProjectStatusSchema,
  ProjectTypeSchema,
  type PublicProjectPr as ProjectPr,
  type PublicProjectResponse as ProjectResponse,
  type PublicProjectSchemaResponse as ProjectSchemaResponse,
  ScienceAcademicDepartments,
} from '@scs/schemas';
import { Badge } from '@scs/ui/components/badge';
import { Button, buttonVariants } from '@scs/ui/components/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@scs/ui/components/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@scs/ui/components/dialog';
import { Input } from '@scs/ui/components/input';
import { Label } from '@scs/ui/components/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@scs/ui/components/select';
import { cn } from 'cn';
import {
  Archive,
  Check,
  Copy,
  ExternalLink,
  Eye,
  FolderKanban,
  Plus,
  RefreshCw,
  Trash2,
  UserRound,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

import {
  createEditorState,
  type EditorRecordStatus,
  type EditorState,
  type EditorValidationIssue,
} from '@/components/editor/editor-state';
import { EditorWorkspace } from '@/components/editor/editor-workspace';
import {
  EditorPageLoading,
  PageLoadingPanel,
} from '@/components/feedback/page-loading';
import { PageHeader, PageShell } from '@/components/layout/page-shell';
import { BackButton } from '@/components/navigation/back-button';
import { ProjectList } from '@/components/projects/project-list';
import {
  type ProjectRecord,
  ProjectReview,
} from '@/components/projects/project-review';
import { ProjectAcademicSection } from '@/components/projects/sections/project-academic-section';
import { ProjectBasicsSection } from '@/components/projects/sections/project-basics-section';
import { ProjectLinksSection } from '@/components/projects/sections/project-links-section';
import { ProjectPeopleSection } from '@/components/projects/sections/project-people-section';
import { ProjectSourceSection } from '@/components/projects/sections/project-source-section';
import { projectConfig } from '@/config/project.config';
import publicEnvConfig from '@/config/public.env.config';
import {
  apiHeaders,
  meApiUrl,
  publicCoursesApiUrl,
  publicOfferingsApiUrl,
  publicProjectApiUrl,
  publicProjectPrApiUrl,
  publicProjectSchemaApiUrl,
  publicProjectSourcePreviewApiUrl,
  publicProjectsPageApiUrl,
  readApiError,
} from '@/lib/api';
import {
  assertMutationSucceeded,
  isOperationPollingAbort,
  waitForMutationOperation,
} from '@/lib/mutation-operation';
import { useOperationPollingSignal } from '@/lib/use-operation-polling';
import { isSuperAdminRole } from '@/types/role';

type WorkspaceMode = 'list' | 'edit' | 'new';

interface ProjectEditorProps {
  admin?: boolean;
  projectSlug?: string;
  initialUser?: UserContext;
  initialProjects?: ProjectRecord[];
  initialSchema?: ProjectSchemaResponse;
  initialProject?: ProjectRecord | null;
  initialCourses?: unknown[];
  initialOfferings?: unknown[];
  previousHref?: string;
  nextHref?: string;
}

interface UserContext {
  email: string;
  name?: string;
  role?: string;
  accessLevel?: unknown;
}

interface CourseCatalogRecord {
  id: string;
  primaryCode: string;
  codes: string[];
  title: string;
  credits: number;
  departments: string[];
}

interface CourseOfferingRecord {
  id: string;
  courseId: string;
  academicYear: string;
  semester: 'SEM1' | 'SEM2';
  staff: {
    staff: string;
    role: string;
  }[];
}

interface PeopleDirectoryProfile {
  fullName?: string;
  email?: string;
  registrationNo?: string;
}

function normalizeProjectResponse(value: unknown): ProjectResponse {
  if (isRecord(value) && 'project' in value) {
    return value as unknown as ProjectResponse;
  }

  return {
    project: isRecord(value) ? value : null,
  };
}

function emptyProjectPr(): ProjectPr {
  return {
    status: 'none',
    canEdit: false,
  };
}

async function readProjectPrResponse(response: Response): Promise<ProjectPr> {
  if (response.status === 204) {
    return emptyProjectPr();
  }

  return (await response.json()) as ProjectPr;
}

async function fetchProjectPrStatus(slug: string): Promise<Response> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => {
    controller.abort();
  }, projectConfig.pullRequestStatusTimeoutMs);

  try {
    return await fetch(publicProjectPrApiUrl(slug), {
      credentials: 'include',
      cache: 'no-store',
      headers: apiHeaders(),
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('Project PR status request timed out.');
    }

    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

const PROJECT_TYPE_OPTIONS = ProjectTypeSchema.options;
const PERSON_ROLE_OPTIONS = ProjectPersonRoleSchema.options;
const ACADEMIC_DEPARTMENTS = AcademicDepartmentCodeSchema.options;
const DEFAULT_DEPARTMENTS = ['STATISTICS_AND_COMPUTER_SCIENCE'];
const ACADEMIC_DEPARTMENT_LABELS = Object.fromEntries(
  ScienceAcademicDepartments.map((department) => [
    department.code,
    department.name,
  ])
) as Record<(typeof ACADEMIC_DEPARTMENTS)[number], string>;
const LINK_FIELDS = [
  'repository',
  'website',
  'documentation',
  'demo',
  'dataset',
  'publication',
  'video',
] as const;
const USER_PROJECT_TYPES = [
  'COURSE_PROJECT',
  'STUDENT_INNOVATION',
  'OPEN_SOURCE',
  'DATASET',
  'PUBLICATION_ARTIFACT',
  'HACKATHON',
  'OTHER',
] as const;

const PROJECT_EDITOR_SECTIONS = [
  { id: 'project-title', label: 'Basics' },
  { id: 'project-people', label: 'People' },
  { id: 'project-academic', label: 'Academic context' },
  { id: 'project-links', label: 'Links' },
  { id: 'project-source', label: 'Source' },
] as const;

function enumLabel(value: string) {
  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function slugify(value: string) {
  return value
    .trim()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

function generatedProjectKey(title: string, previousKey?: string) {
  const base = projectSlugBaseFromTitle(title);
  const previousSuffix = previousKey?.match(/-([a-f0-9]{6})$/)?.[1];
  if (previousSuffix) return `${base}-${previousSuffix}`;
  const bytes = crypto.getRandomValues(new Uint8Array(3));
  return `${base}-${Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')}`;
}

function githubRepositorySource(value: string): ProjectSource | null {
  try {
    const url = new URL(value);
    const parts = url.pathname.replace(/\/$/, '').split('/').filter(Boolean);
    if (
      url.protocol !== 'https:' ||
      url.hostname !== 'github.com' ||
      parts.length !== 2
    )
      return null;
    const [repositoryOwner, rawName] = parts;
    const repositoryName = rawName?.replace(/\.git$/i, '');
    if (
      !repositoryOwner ||
      !repositoryName ||
      !/^[a-z\d](?:[a-z\d-]{0,38})$/i.test(repositoryOwner) ||
      !/^[a-z\d._-]+$/i.test(repositoryName)
    )
      return null;
    return {
      kind: 'TEMPLATE_INDEX_JSON',
      repositoryOwner,
      repositoryName,
      metadataPath: '.docs/index.json',
      indexUrl: `https://api.github.com/repos/${repositoryOwner}/${repositoryName}/contents/.docs/index.json`,
    };
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is ProjectRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function projectIssueField(path: PropertyKey[]) {
  const root = String(path[0] ?? 'project');
  if (root === 'people') return 'project-people';
  if (root === 'links') return 'project-links';
  if (root === 'source' || root === 'media') return 'project-source';
  if (
    [
      'title',
      'slug',
      'id',
      'status',
      'shortDescription',
      'description',
      'dates',
    ].includes(root)
  ) {
    return 'project-title';
  }
  return 'project-academic';
}

function validateProjectDraft(value: unknown) {
  if (!isRecord(value)) {
    return {
      success: false as const,
      issues: [
        {
          field: 'project-title',
          message: 'Project JSON must contain one project object.',
        },
      ],
    };
  }

  const result = ProjectSchema.safeParse(value);
  if (!result.success) {
    return {
      success: false as const,
      issues: result.error.issues.map((issue) => ({
        field: projectIssueField(issue.path),
        message: `${issue.path.join('.') || 'Project'}: ${issue.message}`,
      })),
    };
  }

  return { success: true as const, data: result.data as ProjectRecord };
}

function courseCatalogRecord(value: unknown): CourseCatalogRecord | null {
  if (!isRecord(value)) return null;
  const id = typeof value.id === 'string' ? value.id : '';
  const primaryCode =
    typeof value.primaryCode === 'string' ? value.primaryCode : '';
  const title = typeof value.title === 'string' ? value.title : '';
  const codes = Array.isArray(value.codes)
    ? value.codes.filter((code): code is string => typeof code === 'string')
    : [];
  const credits = typeof value.credits === 'number' ? value.credits : 3;
  const departments = uniqueDepartments(value.departments);
  if (!id || !primaryCode || !title || codes.length === 0) return null;
  return { id, primaryCode, codes, title, credits, departments };
}

function courseOfferingRecord(value: unknown): CourseOfferingRecord | null {
  if (!isRecord(value)) return null;
  const id = typeof value.id === 'string' ? value.id : '';
  const courseId = typeof value.courseId === 'string' ? value.courseId : '';
  const academicYear =
    typeof value.academicYear === 'string' ? value.academicYear : '';
  const semester =
    value.semester === 'SEM1' || value.semester === 'SEM2'
      ? value.semester
      : 'SEM1';
  const staff = Array.isArray(value.staff)
    ? value.staff.filter(isRecord).map((member) => ({
        staff: typeof member.staff === 'string' ? member.staff : '',
        role: typeof member.role === 'string' ? member.role : 'LECTURER',
      }))
    : [];
  if (!id || !courseId || !academicYear) return null;
  return { id, courseId, academicYear, semester, staff };
}

function normalizeStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];

  const seen = new Set<string>();
  const nextItems: string[] = [];

  for (const item of value) {
    if (typeof item !== 'string') continue;
    const trimmed = item.trim();
    const key = trimmed.toLowerCase();
    if (!trimmed || seen.has(key)) continue;
    seen.add(key);
    nextItems.push(trimmed);
  }

  return nextItems;
}

function uniqueDepartments(departments: unknown) {
  if (!Array.isArray(departments)) return [];

  return Array.from(
    new Set(
      departments.filter((item): item is string => typeof item === 'string')
    )
  ).filter((department) =>
    ACADEMIC_DEPARTMENTS.includes(
      department as (typeof ACADEMIC_DEPARTMENTS)[number]
    )
  );
}

function stringArrayValue(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

function normalizeAcademicUsername(value: string) {
  return value.trim().toLowerCase();
}

function peopleProfileUrl(username: string) {
  return `${publicEnvConfig.NEXT_PUBLIC_PEOPLE_DATA_BASE_URL}/users/${encodeURIComponent(
    username
  )}.json`;
}

function normalizeProjectPeople(value: unknown): ProjectPerson[] {
  if (!Array.isArray(value)) return [];

  return value.filter(isRecord).flatMap((person) => {
    const username =
      typeof person.username === 'string'
        ? normalizeAcademicUsername(person.username)
        : '';
    const email = typeof person.email === 'string' ? person.email.trim() : '';
    const sNumber =
      typeof person.sNumber === 'string'
        ? person.sNumber.trim().toUpperCase()
        : '';
    const name = typeof person.name === 'string' ? person.name.trim() : '';
    const fallbackName = name || username || email || sNumber;

    if (!fallbackName) return [];

    return {
      name: fallbackName,
      role: PERSON_ROLE_OPTIONS.includes(person.role as ProjectPersonRole)
        ? (person.role as ProjectPersonRole)
        : 'contributor',
      ...(username ? { username } : {}),
      ...(email ? { email } : {}),
      ...(sNumber ? { sNumber } : {}),
    };
  });
}

function projectPersonFromProfile(
  username: string,
  role: ProjectPersonRole,
  profile: PeopleDirectoryProfile | null
): ProjectPerson {
  return {
    name: profile?.fullName?.trim() ?? '',
    role,
    username,
    ...(profile?.email?.trim() ? { email: profile.email.trim() } : {}),
    ...(profile?.registrationNo?.trim()
      ? { sNumber: profile.registrationNo.trim().toUpperCase() }
      : {}),
  };
}

function emptyProject(
  identity?: ProjectSchemaResponse['identity']
): ProjectRecord {
  const slug = 'new-project';
  return {
    id: slug,
    slug,
    title: '',
    shortDescription: '',
    description: '',
    projectType: 'COURSE_PROJECT',
    status: 'PLANNED',
    departments: DEFAULT_DEPARTMENTS,
    categories: ['coursework'],
    tags: [],
    academicYear: '2025/2026',
    course: {
      courseId: 'software-engineering-project',
      code: 'CSC3213',
      title: 'Project in Computer Science',
      academicYear: '2025/2026',
      semester: 'SEM2',
      departments: DEFAULT_DEPARTMENTS,
    },
    people: [
      {
        name: identity?.username ?? 'Project Owner',
        role: 'student',
        ...(identity?.email ? { email: identity.email } : {}),
        ...(identity?.username ? { username: identity.username } : {}),
        ...(identity?.sNumber ? { sNumber: identity.sNumber } : {}),
      },
    ],
    links: {},
    source: {
      kind: 'MANUAL',
      curator: identity?.email ?? 'SCS Projects Team',
    },
    media: {},
    dates: {
      lastUpdatedAt: today(),
    },
  };
}

function projectTitle(project: ProjectRecord | null, fallback = 'Project') {
  return typeof project?.title === 'string' && project.title.trim()
    ? project.title
    : fallback;
}

function statusBadgeClass(status: ProjectPr['status']) {
  if (status === 'open') {
    return 'border-success-border bg-success-surface text-success-surface-foreground';
  }
  if (status === 'checks_failed' || status === 'closed') {
    return 'border-destructive-border bg-destructive-surface text-destructive-surface-foreground';
  }
  if (status === 'checks_pending' || status === 'auto_merge_queued') {
    return 'border-warning-border bg-warning-surface text-warning-surface-foreground';
  }
  return 'border-border bg-muted text-muted-foreground';
}

function userCanEditProject(
  user: UserContext | null,
  project: ProjectRecord | null,
  adminMode: boolean
) {
  if (!user || !project) return false;
  if (adminMode || isSuperAdminRole(user)) return true;

  const parsed = ProjectSchema.safeParse(project);
  if (!parsed.success) return false;

  const email = user.email.toLowerCase();
  const username = email.split('@')[0];
  const sNumber = /^s\d{2}(sp)?\d{3}$/i.test(username)
    ? username.toLowerCase()
    : null;

  return parsed.data.people.some((person) => {
    return (
      person.email?.toLowerCase() === email ||
      person.username?.toLowerCase() === username ||
      (sNumber !== null && person.sNumber?.toLowerCase() === sNumber)
    );
  });
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
  required,
  type = 'text',
  readOnly = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  type?: string;
  readOnly?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label>
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </Label>
      <Input
        type={type}
        value={value}
        placeholder={placeholder}
        readOnly={readOnly}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
  placeholder,
  readOnly = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  readOnly?: boolean;
}) {
  const fieldId = useId();

  return (
    <div className="space-y-1.5">
      <Label htmlFor={fieldId}>{label}</Label>
      <textarea
        id={fieldId}
        className="border-input bg-background focus-visible:border-ring
          focus-visible:ring-ring/50 min-h-28 w-full rounded-md border px-3 py-2
          text-sm shadow-xs transition-[color,box-shadow] outline-none
          focus-visible:ring-[3px]"
        value={value}
        placeholder={placeholder}
        readOnly={readOnly}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
  disabled = false,
}: {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Select
        value={value}
        disabled={disabled}
        items={options.map((option) => ({
          value: option,
          label: enumLabel(option),
        }))}
        onValueChange={(nextValue) => {
          if (nextValue !== null) onChange(nextValue);
        }}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Select" />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option} value={option}>
              {enumLabel(option)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function StringListEditor({
  label,
  value,
  onChange,
  placeholder,
  readOnly = false,
}: {
  label: string;
  value: string[];
  onChange: (value: string[]) => void;
  placeholder: string;
  readOnly?: boolean;
}) {
  const items = Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];

  function addItem() {
    if (items.some((item) => !item.trim())) return;
    onChange([...items, '']);
  }

  function updateItem(index: number, nextValue: string) {
    const trimmed = nextValue.trim();
    const duplicate = items.some(
      (item, itemIndex) =>
        itemIndex !== index &&
        trimmed &&
        item.toLowerCase() === trimmed.toLowerCase()
    );
    if (duplicate) {
      toast.error(`${label} cannot contain duplicates.`);
      return;
    }

    const nextItems = items.map((item, itemIndex) =>
      itemIndex === index ? nextValue : item
    );
    onChange(nextItems);
  }

  function normalizeItem(index: number, nextValue: string) {
    const nextItems = items
      .map((item, itemIndex) => (itemIndex === index ? nextValue.trim() : item))
      .filter((item) => item.trim());
    onChange(normalizeStringArray(nextItems));
  }

  function removeItem(index: number) {
    onChange(items.filter((_, itemIndex) => itemIndex !== index));
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label>{label}</Label>
        {!readOnly ? (
          <Button type="button" variant="outline" size="sm" onClick={addItem}>
            <Plus className="size-4" />
            Add
          </Button>
        ) : null}
      </div>
      {items.length ? (
        <div className="space-y-2">
          {items.map((item, index) => (
            <div
              key={`${label}-${index}`}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2"
            >
              <Input
                value={item}
                placeholder={placeholder}
                readOnly={readOnly}
                onChange={(event) => updateItem(index, event.target.value)}
                onBlur={(event) => normalizeItem(index, event.target.value)}
              />
              {!readOnly ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => removeItem(index)}
                  aria-label={`Remove ${label} item ${index + 1}`}
                >
                  <Trash2 className="size-4" />
                </Button>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground text-sm">No entries</p>
      )}
    </div>
  );
}

function DepartmentCheckboxes({
  value,
  readOnly,
  onChange,
}: {
  value: string[];
  readOnly: boolean;
  onChange: (value: string[]) => void;
}) {
  const fieldId = useId();
  const selected = new Set(value);

  function toggleDepartment(department: string, checked: boolean) {
    const next = new Set(selected);
    if (checked) {
      next.add(department);
    } else {
      next.delete(department);
    }
    onChange(uniqueDepartments(Array.from(next)));
  }

  return (
    <div className="space-y-2 md:col-span-2">
      <Label>Departments</Label>
      <div className="grid gap-2 rounded-md border p-3 sm:grid-cols-2">
        {ACADEMIC_DEPARTMENTS.map((department) => (
          <label
            key={department}
            className={cn(
              'flex items-start gap-2 rounded-md border px-3 py-2 text-sm',
              selected.has(department) ? 'bg-muted/60' : 'bg-background',
              readOnly ? 'cursor-default opacity-75' : 'cursor-pointer'
            )}
          >
            <input
              id={`${fieldId}-${department}`}
              type="checkbox"
              className="mt-0.5 size-4 accent-current"
              checked={selected.has(department)}
              disabled={readOnly}
              onChange={(event) =>
                toggleDepartment(department, event.target.checked)
              }
            />
            <span>{ACADEMIC_DEPARTMENT_LABELS[department]}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

function ProjectForm({
  project,
  onChange,
  canSubmitAnyProject,
  canEditIdentity,
  isNew,
  courses,
  offerings,
  readOnly = false,
}: {
  project: ProjectRecord;
  onChange: (project: ProjectRecord) => void;
  canSubmitAnyProject: boolean;
  canEditIdentity: boolean;
  isNew: boolean;
  courses: CourseCatalogRecord[];
  offerings: CourseOfferingRecord[];
  readOnly?: boolean;
}) {
  function setField(key: string, value: unknown) {
    onChange({ ...project, [key]: value });
  }

  function setNested(key: string, value: unknown) {
    onChange({ ...project, [key]: value });
  }

  const media = isRecord(project.media) ? project.media : {};
  const links = isRecord(project.links) ? project.links : {};
  const source = isRecord(project.source) ? project.source : {};
  const [sourcePreview, setSourcePreview] = useState<{
    draft: ProjectRecord;
    project: ProjectRecord;
    changedFields: string[];
    indexUrl: string;
  } | null>(null);
  const [sourcePreviewLoading, setSourcePreviewLoading] = useState(false);
  const [sourcePreviewError, setSourcePreviewError] = useState<string | null>(
    null
  );
  const dates = isRecord(project.dates) ? project.dates : {};
  const people = Array.isArray(project.people)
    ? (project.people.filter(isRecord) as ProjectPerson[])
    : [];
  const projectTypeOptions: readonly string[] = canSubmitAnyProject
    ? PROJECT_TYPE_OPTIONS
    : USER_PROJECT_TYPES;
  const projectType =
    typeof project.projectType === 'string' ? project.projectType : 'OTHER';
  const courseOffering = isRecord(project.courseOffering)
    ? project.courseOffering
    : {};
  const selectedOfferingId =
    typeof courseOffering.id === 'string' ? courseOffering.id : '';
  const courseOfferingOptions = offerings.map((offering) => {
    const catalogCourse = courses.find((item) => item.id === offering.courseId);
    return {
      offering,
      course: catalogCourse,
      label: `${catalogCourse?.primaryCode ?? offering.courseId} - ${
        catalogCourse?.title ?? offering.courseId
      } (${offering.academicYear} ${offering.semester})`,
    };
  });

  async function checkRepositoryIndex() {
    const slug = typeof project.slug === 'string' ? project.slug : '';
    if (!slug) return;
    setSourcePreviewLoading(true);
    setSourcePreviewError(null);
    try {
      const response = await fetch(publicProjectSourcePreviewApiUrl(slug), {
        method: 'POST',
        credentials: 'include',
        cache: 'no-store',
        headers: apiHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ project }),
      });
      if (!response.ok) throw new Error((await readApiError(response)).message);
      const result = (await response.json()) as {
        project: ProjectRecord;
        changedFields: string[];
        indexUrl: string;
      };
      setSourcePreview({ ...result, draft: project });
    } catch (error) {
      setSourcePreviewError(
        error instanceof Error
          ? error.message
          : 'Unable to check repository index.'
      );
    } finally {
      setSourcePreviewLoading(false);
    }
  }

  async function copyProjectSchema(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copied.`);
    } catch {
      toast.error(`Unable to copy ${label.toLowerCase()}.`);
    }
  }

  async function applyPersonLookup(
    index: number,
    person: ProjectPerson,
    inputUsername = person.username ?? ''
  ) {
    const username = normalizeAcademicUsername(inputUsername);
    if (!username) {
      const next = [...people];
      next[index] = {
        name: '',
        role: person.role ?? 'contributor',
      };
      setField('people', next);
      return;
    }

    const role = person.role ?? 'contributor';
    try {
      const response = await fetch(peopleProfileUrl(username));
      if (response.status === 404) {
        const next = [...people];
        next[index] = projectPersonFromProfile(username, role, null);
        setField('people', next);
        return;
      }
      if (!response.ok) {
        toast.error('Unable to look up that username.');
        return;
      }

      const profile = (await response.json()) as PeopleDirectoryProfile;
      const next = [...people];
      next[index] = projectPersonFromProfile(username, role, profile);
      setField('people', next);
    } catch {
      toast.error('Unable to look up that username.');
    }
  }

  function selectCourseOffering(offeringId: string) {
    const selected = courseOfferingOptions.find(
      (option) => option.offering.id === offeringId
    );
    if (!selected) {
      onChange({
        ...project,
        courseOffering: undefined,
        course: undefined,
      });
      return;
    }

    onChange({
      ...project,
      academicYear: selected.offering.academicYear,
      courseOffering: {
        id: selected.offering.id,
      },
      course: {
        courseId: selected.offering.courseId,
        offeringId: selected.offering.id,
        code: selected.course?.primaryCode,
        title: selected.course?.title ?? selected.offering.courseId,
        academicYear: selected.offering.academicYear,
        semester: selected.offering.semester,
        departments: selected.course?.departments ?? [],
      },
      departments:
        selected.course?.departments ?? stringArrayValue(project.departments),
    });
  }

  return (
    <div className="space-y-8">
      <ProjectBasicsSection>
        <div className="grid gap-4 md:grid-cols-2">
          <TextField
            label="Title"
            value={typeof project.title === 'string' ? project.title : ''}
            required
            readOnly={readOnly}
            onChange={(title) => {
              const currentSlug =
                typeof project.slug === 'string' ? project.slug : '';
              const previousBase = projectSlugBaseFromTitle(
                typeof project.title === 'string' ? project.title : ''
              );
              const followsTitle =
                currentSlug === 'new-project' ||
                Boolean(
                  previousBase &&
                  new RegExp(`^${previousBase}-[a-f0-9]{6}$`).test(currentSlug)
                );
              const nextSlug =
                isNew && followsTitle && title.trim()
                  ? generatedProjectKey(title, currentSlug)
                  : currentSlug;
              onChange({
                ...project,
                title,
                slug: nextSlug,
                id: isNew && project.id === currentSlug ? nextSlug : project.id,
              });
            }}
          />
          <TextField
            label="Slug"
            value={typeof project.slug === 'string' ? project.slug : ''}
            required
            readOnly={readOnly || !canEditIdentity}
            onChange={(slug) => {
              const currentSlug =
                typeof project.slug === 'string' ? project.slug : '';
              const nextSlug = slugify(slug);
              onChange({
                ...project,
                slug: nextSlug,
                id: project.id === currentSlug ? nextSlug : project.id,
              });
            }}
          />
          <TextField
            label="ID"
            value={typeof project.id === 'string' ? project.id : ''}
            required
            readOnly={readOnly || !canEditIdentity}
            onChange={(value) => setField('id', value)}
          />
          <SelectField
            label="Status"
            value={
              typeof project.status === 'string' ? project.status : 'PLANNED'
            }
            options={ProjectStatusSchema.options}
            disabled={readOnly}
            onChange={(value) => setField('status', value)}
          />
        </div>
        <TextAreaField
          label="Short Description"
          value={
            typeof project.shortDescription === 'string'
              ? project.shortDescription
              : ''
          }
          readOnly={readOnly}
          onChange={(value) => setField('shortDescription', value)}
        />
        <TextAreaField
          label="Description"
          value={
            typeof project.description === 'string' ? project.description : ''
          }
          readOnly={readOnly}
          onChange={(value) => setField('description', value)}
        />
        <div className="space-y-4 border-t pt-5">
          <h4 className="text-sm font-semibold">Project dates</h4>
          <div className="grid gap-4 md:grid-cols-3">
            <TextField
              label="Started At"
              type="date"
              value={typeof dates.startedAt === 'string' ? dates.startedAt : ''}
              readOnly={readOnly}
              onChange={(value) =>
                setNested('dates', {
                  ...dates,
                  startedAt: value.trim() ? value : undefined,
                })
              }
            />
            <TextField
              label="Completed At"
              type="date"
              value={
                typeof dates.completedAt === 'string' ? dates.completedAt : ''
              }
              readOnly={readOnly}
              onChange={(value) =>
                setNested('dates', {
                  ...dates,
                  completedAt: value.trim() ? value : undefined,
                })
              }
            />
            <TextField
              label="Last Updated At"
              type="date"
              value={
                typeof dates.lastUpdatedAt === 'string'
                  ? dates.lastUpdatedAt
                  : today()
              }
              readOnly={readOnly}
              onChange={(value) =>
                setNested('dates', { ...dates, lastUpdatedAt: value })
              }
            />
          </div>
        </div>
      </ProjectBasicsSection>

      <ProjectAcademicSection>
        <div className="grid gap-4 md:grid-cols-2">
          <SelectField
            label="Project Type"
            value={
              projectTypeOptions.includes(projectType) ? projectType : 'OTHER'
            }
            options={projectTypeOptions}
            disabled={readOnly}
            onChange={(value) => {
              onChange({
                ...project,
                projectType: value,
                ...(value === 'COURSE_PROJECT'
                  ? {}
                  : {
                      batch: undefined,
                      course: undefined,
                      courseOffering: undefined,
                      groupNumber: undefined,
                    }),
              });
            }}
          />
          <TextField
            label="Academic Year"
            value={
              typeof project.academicYear === 'string'
                ? project.academicYear
                : ''
            }
            placeholder="2025/2026"
            readOnly={readOnly}
            onChange={(value) =>
              setField('academicYear', value.trim() ? value : undefined)
            }
          />
          <StringListEditor
            label="Categories"
            value={stringArrayValue(project.categories)}
            placeholder="coursework, software"
            readOnly={readOnly}
            onChange={(value) => setField('categories', value)}
          />
          <StringListEditor
            label="Tags"
            value={stringArrayValue(project.tags)}
            placeholder="Next.js, Research"
            readOnly={readOnly}
            onChange={(value) => setField('tags', value)}
          />
          <DepartmentCheckboxes
            value={uniqueDepartments(project.departments)}
            readOnly={readOnly}
            onChange={(value) => setField('departments', value)}
          />
        </div>

        {projectType === 'COURSE_PROJECT' ? (
          <section className="space-y-4">
            <h3 className="text-base font-semibold">Course Project</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label>Course Offering</Label>
                <Select
                  value={selectedOfferingId}
                  disabled={readOnly}
                  items={courseOfferingOptions.map((option) => ({
                    value: option.offering.id,
                    label: option.label,
                  }))}
                  onValueChange={(nextValue) => {
                    if (nextValue !== null) selectCourseOffering(nextValue);
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a course offering" />
                  </SelectTrigger>
                  <SelectContent>
                    {courseOfferingOptions.map((option) => (
                      <SelectItem
                        key={option.offering.id}
                        value={option.offering.id}
                      >
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-muted-foreground text-xs">
                  Course projects must reference an existing course offering.
                </p>
              </div>
              <TextField
                label="Batch"
                value={typeof project.batch === 'string' ? project.batch : ''}
                placeholder="2021"
                readOnly={readOnly}
                onChange={(value) =>
                  setField('batch', value.trim() ? value : undefined)
                }
              />
              <TextField
                label="Group Number"
                value={
                  typeof project.groupNumber === 'string'
                    ? project.groupNumber
                    : ''
                }
                readOnly={readOnly}
                onChange={(value) =>
                  setField('groupNumber', value.trim() ? value : undefined)
                }
              />
            </div>
          </section>
        ) : null}
      </ProjectAcademicSection>

      <ProjectPeopleSection>
        <div className="flex items-center justify-end gap-3">
          {!readOnly ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                setField('people', [
                  ...people,
                  {
                    name: '',
                    role: 'contributor',
                    username: '',
                  } satisfies ProjectPerson,
                ])
              }
            >
              <Plus className="size-4" />
              Add
            </Button>
          ) : null}
        </div>
        <div className="space-y-3">
          {people.map((person, index) => (
            <div key={index} className="rounded-md border p-4">
              <div
                className="grid gap-4 md:grid-cols-[minmax(0,1fr)_16rem_auto]"
              >
                <div className="space-y-1.5">
                  <Label>Username</Label>
                  <Input
                    value={person.username ?? ''}
                    placeholder="s21513"
                    readOnly={readOnly}
                    onChange={(event) => {
                      const username = normalizeAcademicUsername(
                        event.target.value
                      );
                      const next = [...people];
                      next[index] = {
                        ...person,
                        username,
                        name: '',
                        email: undefined,
                        sNumber: undefined,
                      };
                      setField('people', next);
                    }}
                    onBlur={(event) => {
                      if (!readOnly) {
                        void applyPersonLookup(
                          index,
                          person,
                          event.target.value
                        );
                      }
                    }}
                  />
                </div>
                <SelectField
                  label="Role"
                  value={person.role ?? 'contributor'}
                  options={PERSON_ROLE_OPTIONS}
                  disabled={readOnly}
                  onChange={(value) => {
                    const next = [...people];
                    next[index] = {
                      ...person,
                      role: value as ProjectPersonRole,
                    };
                    setField('people', next);
                  }}
                />
                {!readOnly ? (
                  <div className="flex items-end">
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      onClick={() =>
                        setField(
                          'people',
                          people.filter(
                            (_, personIndex) => personIndex !== index
                          )
                        )
                      }
                    >
                      <Trash2 className="size-4" />
                      Remove
                    </Button>
                  </div>
                ) : null}
              </div>
              {person.name || person.email || person.sNumber ? (
                <div
                  className="text-muted-foreground mt-3 flex flex-wrap gap-x-6
                    gap-y-2 text-sm"
                >
                  {person.name ? <span>Name: {person.name}</span> : null}
                  {person.email ? <span>Email: {person.email}</span> : null}
                  {person.sNumber ? (
                    <span>S Number: {person.sNumber}</span>
                  ) : null}
                </div>
              ) : (
                <p className="text-muted-foreground mt-3 text-sm">
                  Directory details not found yet.
                </p>
              )}
            </div>
          ))}
        </div>
      </ProjectPeopleSection>

      <ProjectLinksSection>
        <div className="grid gap-4 md:grid-cols-2">
          {LINK_FIELDS.map((field) => (
            <TextField
              key={field}
              label={enumLabel(field)}
              value={
                typeof links[field] === 'string' ? (links[field] as string) : ''
              }
              placeholder="https://example.com"
              readOnly={readOnly}
              onChange={(value) => {
                const nextLinks = { ...links } as ProjectLinks;
                if (value.trim()) {
                  nextLinks[field] = value.trim();
                } else {
                  delete nextLinks[field];
                }
                const nextProject: ProjectRecord = {
                  ...project,
                  links: nextLinks,
                };
                if (field === 'repository') {
                  const repoSource = githubRepositorySource(value.trim());
                  nextProject.source = repoSource ?? {
                    kind: 'MANUAL',
                    curator: 'SCS Projects Team',
                  };
                }
                onChange(nextProject);
              }}
            />
          ))}
        </div>
      </ProjectLinksSection>

      <ProjectSourceSection>
        {source.kind === 'TEMPLATE_INDEX_JSON' ||
        source.kind === 'GITHUB_REPO' ? (
          <div className="bg-muted/35 space-y-3 rounded-md border p-4 text-sm">
            <p>
              Add a <code>$schema</code> entry to the root{' '}
              <code>.docs/index.json</code> for editor help with valid project
              fields. Project ID and slug stay in the registry.
            </p>
            <code className="block overflow-auto break-all">
              {`"$schema": "${ProjectIndexSchemaUrl}"`}
            </code>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  void copyProjectSchema(ProjectIndexSchemaUrl, 'Schema URL')
                }
              >
                <Copy className="size-4" /> Copy schema URL
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  void copyProjectSchema(
                    `"$schema": "${ProjectIndexSchemaUrl}"`,
                    'JSON entry'
                  )
                }
              >
                <Copy className="size-4" /> Copy JSON entry
              </Button>
              <a
                href={ProjectIndexSchemaUrl}
                target="_blank"
                rel="noreferrer"
                className="text-primary underline"
              >
                View schema
              </a>
            </div>
          </div>
        ) : null}
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={
              readOnly || source.kind === 'MANUAL' || sourcePreviewLoading
            }
            onClick={() => void checkRepositoryIndex()}
          >
            <RefreshCw className="size-4" />
            {sourcePreviewLoading
              ? 'Checking repository…'
              : 'Check repository index'}
          </Button>
          {sourcePreviewError ? (
            <p role="alert" className="text-destructive text-sm">
              {sourcePreviewError}
            </p>
          ) : null}
        </div>
        {sourcePreview?.draft === project ? (
          <div className="space-y-3 rounded-md border p-4 text-sm">
            <p className="font-medium">
              {sourcePreview.changedFields.length === 0
                ? 'Repository index matches this draft.'
                : `${sourcePreview.changedFields.length} field(s) differ from this draft.`}
            </p>
            <a
              className="text-primary underline"
              href={sourcePreview.indexUrl}
              target="_blank"
              rel="noreferrer"
            >
              View index source
            </a>
            {sourcePreview.changedFields.map((field) => (
              <details key={field} className="rounded-md border p-3">
                <summary className="cursor-pointer font-medium">
                  {field}
                </summary>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <div>
                    <p className="text-muted-foreground mb-1">Portal draft</p>
                    <pre className="overflow-auto break-all whitespace-pre-wrap">
                      {JSON.stringify(project[field], null, 2) ?? 'Not set'}
                    </pre>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-1">
                      Repository index
                    </p>
                    <pre className="overflow-auto break-all whitespace-pre-wrap">
                      {JSON.stringify(sourcePreview.project[field], null, 2) ??
                        'Not set'}
                    </pre>
                  </div>
                </div>
              </details>
            ))}
          </div>
        ) : null}
        <div className="grid gap-4 md:grid-cols-2">
          <TextField
            label="Cover Image"
            value={typeof media.coverImage === 'string' ? media.coverImage : ''}
            placeholder="/images/project-categories-hero.png"
            readOnly={readOnly}
            onChange={(value) =>
              setNested('media', {
                ...media,
                coverImage: value.trim() ? value : undefined,
              })
            }
          />
        </div>
      </ProjectSourceSection>
    </div>
  );
}

export default function ProjectEditor({
  admin = false,
  projectSlug,
  initialUser,
  initialProjects = [],
  initialSchema,
  initialProject,
  initialCourses = [],
  initialOfferings = [],
  previousHref,
  nextHref,
}: ProjectEditorProps) {
  const router = useRouter();
  const beginOperationPolling = useOperationPollingSignal();
  const [user, setUser] = useState<UserContext | null>(initialUser ?? null);
  const [schema, setSchema] = useState<ProjectSchemaResponse | null>(
    initialSchema ?? null
  );
  const [projects, setProjects] = useState<ProjectRecord[]>(initialProjects);
  const [courses, setCourses] = useState<CourseCatalogRecord[]>(() =>
    initialCourses
      .map(courseCatalogRecord)
      .filter((item): item is CourseCatalogRecord => Boolean(item))
  );
  const [offerings, setOfferings] = useState<CourseOfferingRecord[]>(() =>
    initialOfferings
      .map(courseOfferingRecord)
      .filter((item): item is CourseOfferingRecord => Boolean(item))
  );
  const [editorState, setEditorState] = useState<EditorState<ProjectRecord>>(
    () =>
      createEditorState(
        initialProject ?? emptyProject(initialSchema?.identity),
        initialProject ?? null
      )
  );
  const project = editorState.draft;
  const publishedProject = editorState.published;
  const latestProjectRef = useRef(project);
  const [pr, setPr] = useState<ProjectPr | null>(null);
  const routeProjectSlug = projectSlug ? slugify(projectSlug) : null;
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>(
    routeProjectSlug ? 'edit' : 'list'
  );
  const [selectedSlug, setSelectedSlug] = useState<string | null>(
    routeProjectSlug
  );
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(
    !initialUser || (Boolean(projectSlug) && !initialSchema)
  );
  const [projectLoading, setProjectLoading] = useState(false);
  const [prLoading, setPrLoading] = useState(false);
  const [prError, setPrError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [deleteSlugCopied, setDeleteSlugCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const effectiveAdmin = admin && isSuperAdminRole(user ?? {});
  const canSubmitAnyProject =
    effectiveAdmin ||
    schema?.canSubmitAnyProject === true ||
    isSuperAdminRole(user ?? {});
  const projectsHref = admin ? '/admin/projects' : '/user/projects';
  const isNew = workspaceMode === 'new';
  const canEdit = isNew
    ? true
    : userCanEditProject(user, publishedProject ?? project, effectiveAdmin);

  const filteredProjects = useMemo(() => {
    const term = search.trim().toLowerCase();
    return projects.filter((item) => {
      if (!term) return true;
      return [
        item.title,
        item.slug,
        item.projectType,
        item.status,
        ...(Array.isArray(item.tags) ? item.tags : []),
        ...(Array.isArray(item.categories) ? item.categories : []),
      ]
        .filter((value): value is string => typeof value === 'string')
        .some((value) => value.toLowerCase().includes(term));
    });
  }, [projects, search]);

  useEffect(() => {
    latestProjectRef.current = project;
  }, [project]);

  function resetEditor(
    nextProject: ProjectRecord,
    published: Readonly<ProjectRecord> | null
  ) {
    latestProjectRef.current = nextProject;
    setEditorState(createEditorState(nextProject, published));
  }

  function returnToProjectList() {
    if (!routeProjectSlug) {
      showProjectList();
      return;
    }

    if (window.history.length > 1) {
      router.back();
      return;
    }

    router.replace(projectsHref);
  }

  async function loadProjectList(nextUser?: UserContext) {
    const projectsRes = await fetch(publicProjectsPageApiUrl(), {
      credentials: 'include',
      cache: 'no-store',
      headers: apiHeaders(),
    });
    if (!projectsRes.ok) {
      throw new Error((await readApiError(projectsRes)).message);
    }
    const body = (await projectsRes.json()) as { items?: unknown[] };
    setProjects(Array.isArray(body.items) ? body.items.filter(isRecord) : []);

    if (nextUser) setUser(nextUser);
  }

  async function loadProjectReferences() {
    const [coursesRes, offeringsRes] = await Promise.all([
      fetch(publicCoursesApiUrl(), {
        credentials: 'include',
        cache: 'no-store',
        headers: apiHeaders(),
      }),
      fetch(publicOfferingsApiUrl(), {
        credentials: 'include',
        cache: 'no-store',
        headers: apiHeaders(),
      }),
    ]);
    if (!coursesRes.ok) {
      throw new Error((await readApiError(coursesRes)).message);
    }
    if (!offeringsRes.ok) {
      throw new Error((await readApiError(offeringsRes)).message);
    }
    const coursesBody = (await coursesRes.json().catch(() => [])) as unknown;
    const offeringsBody = (await offeringsRes
      .json()
      .catch(() => [])) as unknown;
    setCourses(
      Array.isArray(coursesBody)
        ? coursesBody
            .map(courseCatalogRecord)
            .filter((item): item is CourseCatalogRecord => Boolean(item))
        : []
    );
    setOfferings(
      Array.isArray(offeringsBody)
        ? offeringsBody
            .map(courseOfferingRecord)
            .filter((item): item is CourseOfferingRecord => Boolean(item))
        : []
    );
  }

  async function load() {
    await Promise.resolve();
    setLoading(true);
    setError(null);

    try {
      const meRes = await fetch(meApiUrl(), {
        credentials: 'include',
        cache: 'no-store',
        headers: apiHeaders(),
      });
      if (!meRes.ok) {
        throw new Error('Please sign in again to manage projects.');
      }
      const nextUser = (await meRes.json()) as UserContext;
      setUser(nextUser);
      if (admin && !isSuperAdminRole(nextUser)) {
        throw new Error('Only super admins can use the admin projects area.');
      }

      await Promise.all(
        routeProjectSlug
          ? [loadProjectReferences(), loadProject(routeProjectSlug)]
          : [loadProjectList(nextUser)]
      );
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Failed to load projects.'
      );
    } finally {
      setLoading(false);
    }
  }

  async function refresh() {
    if (routeProjectSlug) {
      await loadProject(routeProjectSlug);
      return;
    }

    if (workspaceMode === 'list') {
      setError(null);
      try {
        await loadProjectList();
      } catch (refreshError) {
        setError(
          refreshError instanceof Error
            ? refreshError.message
            : 'Failed to refresh projects.'
        );
      }
    }
  }

  async function loadProjectPr(
    slug: string,
    options: {
      applyDraft?: boolean;
      draftBaseProject?: ProjectRecord;
      throwOnError?: boolean;
    } = {}
  ) {
    const normalizedSlug = slugify(slug);
    if (!normalizedSlug) return null;

    setPrLoading(true);
    setPrError(null);

    try {
      const prRes = await fetchProjectPrStatus(normalizedSlug);

      if (!prRes.ok) {
        throw new Error((await readApiError(prRes)).message);
      }

      const nextPr = await readProjectPrResponse(prRes);
      setPr(nextPr);

      const draft = isRecord(nextPr.draftProject) ? nextPr.draftProject : null;
      if (options.applyDraft && draft) {
        const currentProjectJson = JSON.stringify(latestProjectRef.current);
        const baseProjectJson = JSON.stringify(options.draftBaseProject);

        if (
          !options.draftBaseProject ||
          currentProjectJson === baseProjectJson
        ) {
          latestProjectRef.current = draft;
          setEditorState((current) =>
            createEditorState(draft, current.published)
          );
        }
      }

      return nextPr;
    } catch (prLoadError) {
      const message =
        prLoadError instanceof Error
          ? prLoadError.message
          : 'Failed to load project PR status.';
      setPrError(message);
      setPr(null);

      if (options.throwOnError) {
        throw new Error(message);
      }

      return null;
    } finally {
      setPrLoading(false);
    }
  }

  async function getProjectPrForMutation(
    slug: string,
    requiresFreshPr: boolean
  ) {
    if (!requiresFreshPr && !prError) {
      return pr;
    }

    return await loadProjectPr(slug, { throwOnError: true });
  }

  async function loadProject(slug: string) {
    const normalizedSlug = slugify(slug);
    if (!normalizedSlug) return;

    setProjectLoading(true);
    setError(null);
    setPr(null);
    setPrError(null);

    try {
      const [schemaRes, projectRes] = await Promise.all([
        fetch(publicProjectSchemaApiUrl(normalizedSlug), {
          credentials: 'include',
          cache: 'no-store',
          headers: apiHeaders(),
        }),
        fetch(publicProjectApiUrl(normalizedSlug), {
          credentials: 'include',
          cache: 'no-store',
          headers: apiHeaders(),
        }),
      ]);
      if (!schemaRes.ok) {
        throw new Error((await readApiError(schemaRes)).message);
      }
      const nextSchema = (await schemaRes.json()) as ProjectSchemaResponse;
      setSchema(nextSchema);

      if (!projectRes.ok && projectRes.status !== 404) {
        throw new Error((await readApiError(projectRes)).message);
      }

      const projectBody =
        projectRes.status === 404
          ? { project: null }
          : normalizeProjectResponse(await projectRes.json());

      if (routeProjectSlug && !projectBody.project) {
        const nextPr = await loadProjectPr(normalizedSlug, {
          applyDraft: true,
        });
        const draft = isRecord(nextPr?.draftProject)
          ? nextPr.draftProject
          : null;
        if (draft && nextPr?.status === 'open') {
          setSelectedSlug(normalizedSlug);
          resetEditor(draft, null);
          setSchema(nextSchema);
          setWorkspaceMode('edit');
          return;
        }

        toast.info('Project is no longer available.');
        returnToProjectList();
        return;
      }

      const nextProject =
        projectBody.project ?? emptyProject(nextSchema.identity);

      setSelectedSlug(normalizedSlug);
      setEditorState(createEditorState(nextProject, projectBody.project));
      latestProjectRef.current = nextProject;
      setWorkspaceMode('edit');
      void loadProjectPr(normalizedSlug, {
        applyDraft: true,
        draftBaseProject: nextProject,
      });
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Failed to load project.'
      );
    } finally {
      setProjectLoading(false);
    }
  }

  useEffect(() => {
    if (!routeProjectSlug && initialUser) return;

    if (routeProjectSlug && initialUser && initialSchema) {
      const timeout = window.setTimeout(() => {
        void (async () => {
          const nextPr = await loadProjectPr(routeProjectSlug, {
            applyDraft: true,
            draftBaseProject: initialProject ?? undefined,
          });
          if (
            !initialProject &&
            (!isRecord(nextPr?.draftProject) || nextPr.status !== 'open')
          ) {
            toast.info('Project is no longer available.');
            returnToProjectList();
          }
        })();
      }, 0);
      return () => window.clearTimeout(timeout);
    }

    const timeout = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [admin, initialProject, initialSchema, initialUser, routeProjectSlug]);

  async function startNewProject() {
    setProjectLoading(true);
    setError(null);

    try {
      const [schemaRes] = await Promise.all([
        fetch(publicProjectSchemaApiUrl('new-project'), {
          credentials: 'include',
          cache: 'no-store',
          headers: apiHeaders(),
        }),
        loadProjectReferences(),
      ]);
      if (!schemaRes.ok) {
        throw new Error((await readApiError(schemaRes)).message);
      }
      const nextSchema = (await schemaRes.json()) as ProjectSchemaResponse;
      const nextProject = emptyProject(nextSchema.identity);
      setSchema(nextSchema);
      setSelectedSlug(null);
      setPr(null);
      setPrError(null);
      resetEditor(nextProject, null);
      setWorkspaceMode('new');
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Failed to start a new project.'
      );
    } finally {
      setProjectLoading(false);
    }
  }

  function showProjectList() {
    if (routeProjectSlug) {
      router.replace(projectsHref);
      return;
    }
    setWorkspaceMode('list');
    setSelectedSlug(null);
    setSchema(null);
    setPr(null);
    const nextProject = emptyProject();
    resetEditor(nextProject, null);
    setError(null);
    setPrError(null);
  }

  async function saveProject(nextProject = project) {
    const course = isRecord(nextProject.course)
      ? {
          ...nextProject.course,
          departments: uniqueDepartments(nextProject.course.departments),
        }
      : undefined;
    const normalizedProject: ProjectRecord = {
      ...nextProject,
      categories: normalizeStringArray(nextProject.categories),
      tags: normalizeStringArray(nextProject.tags),
      departments: uniqueDepartments(nextProject.departments),
      people: normalizeProjectPeople(nextProject.people),
      ...(course ? { course } : {}),
    };

    if (normalizedProject.projectType !== 'COURSE_PROJECT') {
      delete normalizedProject.course;
      delete normalizedProject.courseOffering;
    }

    if (
      normalizedProject.projectType === 'COURSE_PROJECT' &&
      (!isRecord(normalizedProject.courseOffering) ||
        typeof normalizedProject.courseOffering.id !== 'string' ||
        !normalizedProject.courseOffering.id.trim())
    ) {
      toast.error(
        'Select a course offering before submitting a course project.'
      );
      return;
    }

    const validation = ProjectSchema.safeParse(normalizedProject);
    if (!validation.success) {
      const validationIssues: EditorValidationIssue[] =
        validation.error.issues.map((issue) => ({
          field: projectIssueField(issue.path),
          message: `${issue.path.join('.') || 'Project'}: ${issue.message}`,
        }));
      setEditorState((current) => ({
        ...current,
        validationIssues,
      }));
      toast.error('Project validation failed.');
      setError(validationIssues.map((issue) => issue.message).join('\n'));
      return;
    }

    const targetSlug = validation.data.slug;
    if (!targetSlug) return;
    if (
      !isNew &&
      selectedSlug !== targetSlug &&
      !isSuperAdminRole(user ?? {})
    ) {
      toast.error('Project slug must match the selected project.');
      return;
    }

    const mutationSlug = isNew ? targetSlug : (selectedSlug ?? targetSlug);

    setSaving(true);
    setError(null);
    try {
      const mutationPr = await getProjectPrForMutation(
        mutationSlug,
        Boolean(
          prError ||
          prLoading ||
          (!isNew && selectedSlug === mutationSlug && !pr)
        )
      );
      const res = await fetch(publicProjectPrApiUrl(mutationSlug), {
        method: 'PUT',
        credentials: 'include',
        headers: apiHeaders({
          'Content-Type': 'application/json',
          Prefer: 'respond-async',
        }),
        body: JSON.stringify({
          project: validation.data,
          ...(mutationPr?.status === 'open' && mutationPr.headSha
            ? { expectedHeadSha: mutationPr.headSha }
            : {}),
          control: {
            idempotencyKey: crypto.randomUUID(),
            expectedRevision: mutationPr?.revision ?? 'missing',
          },
        }),
      });

      if (!res.ok) {
        throw new Error((await readApiError(res)).message);
      }

      const operation = await waitForMutationOperation(
        (await res.json()) as MutationAccepted,
        'Project update is still queued. Refresh to check its status.',
        { signal: beginOperationPolling() }
      );
      assertMutationSucceeded(operation);
      const nextPr = await loadProjectPr(mutationSlug, { throwOnError: true });
      if (!nextPr) throw new Error('Project PR status is unavailable.');
      setPrError(null);
      setSelectedSlug(mutationSlug);
      resetEditor(validation.data, publishedProject);
      setWorkspaceMode('edit');
      router.refresh();
      toast.success('Project PR submitted.');
    } catch (saveError) {
      if (isOperationPollingAbort(saveError)) return;
      setError(
        saveError instanceof Error
          ? saveError.message
          : 'Failed to save project.'
      );
      toast.error('Failed to save project.');
    } finally {
      setSaving(false);
    }
  }

  async function archiveProject() {
    const archivedProject = {
      ...project,
      status: 'ARCHIVED',
      dates: {
        ...(isRecord(project.dates) ? project.dates : {}),
        lastUpdatedAt: today(),
      },
    };
    const parsed = ProjectSchema.safeParse(archivedProject);
    if (!parsed.success) {
      toast.error('Project must be valid before it can be archived.');
      return;
    }

    await saveProject(archivedProject);
  }

  function openDeleteDialog() {
    if (!selectedSlug || !canSubmitAnyProject) return;

    setDeleteConfirmation('');
    setDeleteSlugCopied(false);
    setDeleteDialogOpen(true);
  }

  async function copyDeleteSlug() {
    if (!selectedSlug) return;

    try {
      await navigator.clipboard.writeText(selectedSlug);
      setDeleteSlugCopied(true);
      toast.success('Project slug copied.');
      window.setTimeout(() => setDeleteSlugCopied(false), 2000);
    } catch {
      toast.error('Could not copy project slug.');
    }
  }

  async function deleteProject() {
    if (!selectedSlug || !canSubmitAnyProject) return;

    const slugToDelete = selectedSlug;
    if (deleteConfirmation.trim() !== slugToDelete) {
      toast.error('Type the project slug to confirm removal.');
      return;
    }

    setDeleting(true);
    setError(null);
    try {
      const mutationPr = await getProjectPrForMutation(
        slugToDelete,
        Boolean(prError || prLoading || !pr)
      );
      const res = await fetch(publicProjectPrApiUrl(slugToDelete), {
        method: 'DELETE',
        credentials: 'include',
        headers: apiHeaders({
          'Content-Type': 'application/json',
          Prefer: 'respond-async',
        }),
        body: JSON.stringify({
          ...(mutationPr?.status === 'open' && mutationPr.headSha
            ? { expectedHeadSha: mutationPr.headSha }
            : {}),
          control: {
            idempotencyKey: crypto.randomUUID(),
            expectedRevision: mutationPr?.revision ?? 'missing',
          },
        }),
      });

      if (!res.ok) {
        throw new Error((await readApiError(res)).message);
      }

      const operation = await waitForMutationOperation(
        (await res.json()) as MutationAccepted,
        'Project deletion is still queued. Refresh to check its status.',
        { signal: beginOperationPolling() }
      );
      assertMutationSucceeded(operation);
      const nextPr = await loadProjectPr(slugToDelete, {
        throwOnError: true,
      });
      if (!nextPr) throw new Error('Project PR status is unavailable.');
      setPrError(null);
      setDeleteDialogOpen(false);
      setDeleteConfirmation('');
      router.refresh();
      toast.success(
        nextPr.status === 'none'
          ? 'Project is already removed.'
          : 'Delete PR submitted.'
      );
      returnToProjectList();
    } catch (deleteError) {
      if (isOperationPollingAbort(deleteError)) return;
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : 'Failed to delete project.'
      );
      toast.error('Failed to delete project.');
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return <EditorPageLoading />;
  }

  if (admin && user && !effectiveAdmin) {
    return (
      <PageShell width="wide">
        <BackButton
          fallbackHref="/dashboard"
          label="Back to Dashboard"
          preferFallback
        />
        <PageHeader
          title="Projects"
          description="Only super admins can use the admin projects area."
          icon={<FolderKanban className="text-muted-foreground size-6" />}
        />
        <div
          className="border-destructive/30 bg-destructive/5 text-destructive
            rounded-md border p-4 text-sm"
        >
          {error ?? 'Only super admins can use the admin projects area.'}
        </div>
      </PageShell>
    );
  }

  const backHref = routeProjectSlug
    ? projectsHref
    : effectiveAdmin
      ? '/admin'
      : '/dashboard';
  const backLabel = routeProjectSlug
    ? 'Back to Projects'
    : effectiveAdmin
      ? 'Back to Admin'
      : 'Back to Dashboard';
  const showRegistry = !routeProjectSlug && workspaceMode === 'list';
  const showWorkspace = routeProjectSlug || workspaceMode !== 'list';
  const deleteConfirmationMatches =
    selectedSlug !== null && deleteConfirmation.trim() === selectedSlug;
  const editorStatus: EditorRecordStatus = saving
    ? 'submitting'
    : error
      ? 'failed'
      : isNew
        ? 'new'
        : pr?.status === 'open'
          ? 'draft'
          : publishedProject
            ? 'published'
            : 'draft';

  return (
    <PageShell width="wide" className="px-3 sm:px-4">
      <BackButton fallbackHref={backHref} label={backLabel} preferFallback />
      <PageHeader
        title={effectiveAdmin ? 'Manage Projects' : 'Projects'}
        description={
          effectiveAdmin
            ? 'Create, review, edit, archive, and remove public project records.'
            : 'Create and manage public project records where you are listed.'
        }
        icon={<FolderKanban className="text-muted-foreground size-6" />}
        action={
          <div
            className="grid w-full grid-cols-1 gap-2 min-[420px]:grid-cols-2
              sm:flex sm:w-auto sm:flex-wrap"
          >
            <Button
              variant="outline"
              onClick={() => void refresh()}
              disabled={projectLoading}
              className="w-full sm:w-auto"
            >
              <RefreshCw className="size-4" />
              Refresh
            </Button>
            {!routeProjectSlug ? (
              <Button
                onClick={() => void startNewProject()}
                className="w-full sm:w-auto"
              >
                <Plus className="size-4" />
                New Project
              </Button>
            ) : null}
          </div>
        }
      />

      {error ? (
        <pre
          className="border-destructive/30 bg-destructive/5 text-destructive
            rounded-md border p-4 text-sm whitespace-pre-wrap"
        >
          {error}
        </pre>
      ) : null}

      <div className="grid gap-5">
        {showRegistry ? (
          <ProjectList
            projects={filteredProjects}
            projectsHref={projectsHref}
            selectedSlug={selectedSlug}
            search={search}
            onSearchChange={setSearch}
            canEditProject={(item) =>
              userCanEditProject(user, item, effectiveAdmin)
            }
            previousHref={previousHref}
            nextHref={nextHref}
          />
        ) : null}

        {showWorkspace ? (
          <Card>
            <CardHeader className="px-4 sm:px-6">
              <div
                className="flex flex-col gap-3 lg:flex-row lg:items-start
                  lg:justify-between"
              >
                <div className="min-w-0 space-y-1.5">
                  <CardTitle>
                    {isNew ? 'New Project' : projectTitle(project)}
                  </CardTitle>
                  <CardDescription>
                    {schema?.note ??
                      'Project data is validated before a GitHub pull request is opened.'}
                  </CardDescription>
                </div>
                <div
                  className="grid w-full gap-2 sm:flex sm:w-auto sm:flex-wrap"
                >
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={showProjectList}
                    className="w-full sm:w-auto"
                  >
                    <Eye className="size-4" />
                    Projects
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6 px-4 sm:px-6">
              {projectLoading ? (
                <PageLoadingPanel variant="detail" />
              ) : (
                <>
                  {pr || prLoading || prError ? (
                    <div
                      className="bg-muted/30 flex flex-col gap-3 rounded-md
                        border p-3 sm:flex-row sm:items-center
                        sm:justify-between sm:p-4"
                    >
                      <div className="min-w-0 space-y-2 sm:space-y-0">
                        <div className="flex flex-wrap items-center gap-2">
                          {pr ? (
                            <Badge
                              variant="outline"
                              className={statusBadgeClass(pr.status)}
                            >
                              PR {enumLabel(pr.status)}
                            </Badge>
                          ) : (
                            <Badge variant="outline">
                              PR {prLoading ? 'loading' : 'unavailable'}
                            </Badge>
                          )}
                          {pr?.branch ? (
                            <span className="text-muted-foreground text-sm">
                              {pr.branch}
                            </span>
                          ) : null}
                          {prError ? (
                            <span className="text-muted-foreground text-sm">
                              {prError}
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <div
                        className="grid w-full grid-cols-2 gap-2 sm:flex
                          sm:w-auto sm:flex-wrap"
                      >
                        {selectedSlug ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              void loadProjectPr(selectedSlug, {
                                applyDraft: true,
                              })
                            }
                            disabled={prLoading}
                            className="w-full sm:w-auto"
                          >
                            <RefreshCw className="size-4" />
                            Retry
                          </Button>
                        ) : null}
                        {pr?.url ? (
                          <a
                            href={pr.url}
                            target="_blank"
                            rel="noreferrer"
                            className={buttonVariants({
                              variant: 'outline',
                              size: 'sm',
                              className: 'w-full sm:w-auto',
                            })}
                          >
                            <ExternalLink className="size-4" />
                            Open PR
                          </a>
                        ) : null}
                      </div>
                    </div>
                  ) : null}

                  <EditorWorkspace
                    state={editorState}
                    onStateChange={(nextState) => {
                      latestProjectRef.current = nextState.draft;
                      setEditorState(nextState);
                    }}
                    title={isNew ? 'New project draft' : projectTitle(project)}
                    status={editorStatus}
                    statusDetail={
                      pr?.status === 'open'
                        ? 'A pull request draft is open.'
                        : publishedProject
                          ? 'Published data is available for comparison.'
                          : 'This project has not been published yet.'
                    }
                    sections={PROJECT_EDITOR_SECTIONS}
                    canEditJson={canEdit}
                    canSubmit={canEdit}
                    submitting={saving}
                    submitLabel="Submit Project Changes"
                    validateJson={validateProjectDraft}
                    onSubmit={() => void saveProject(editorState.draft)}
                    renderEdit={(draft, onDraftChange) => (
                      <ProjectForm
                        project={draft}
                        onChange={onDraftChange}
                        canSubmitAnyProject={canSubmitAnyProject}
                        canEditIdentity={isSuperAdminRole(user ?? {})}
                        isNew={isNew}
                        courses={courses}
                        offerings={offerings}
                        readOnly={!canEdit}
                      />
                    )}
                    renderReview={(draft, published, onChangeField) => (
                      <ProjectReview
                        draft={draft}
                        published={published}
                        onChangeField={onChangeField}
                      />
                    )}
                  />

                  {canEdit ? (
                    <div
                      className="flex flex-col gap-3 border-t pt-5 sm:flex-row
                        sm:items-center sm:justify-between"
                    >
                      <div
                        className="text-muted-foreground flex items-start gap-2
                          text-sm sm:items-center"
                      >
                        <UserRound className="size-4" />
                        {canSubmitAnyProject
                          ? 'Admin submission can update any project.'
                          : 'Owner submission requires your identity in People.'}
                      </div>
                      <div
                        className="grid w-full grid-cols-1 gap-2
                          min-[420px]:grid-cols-2 sm:flex sm:w-auto
                          sm:flex-wrap"
                      >
                        {!isNew ? (
                          <Button
                            variant="outline"
                            onClick={() => void archiveProject()}
                            disabled={saving}
                            className="w-full sm:w-auto"
                          >
                            <Archive className="size-4" />
                            Archive
                          </Button>
                        ) : null}
                        {!isNew && canSubmitAnyProject ? (
                          <Button
                            variant="outline"
                            onClick={openDeleteDialog}
                            disabled={deleting}
                            className={cn(
                              `border-destructive/40 text-destructive
                                hover:bg-destructive/10 w-full sm:w-auto`
                            )}
                          >
                            <Trash2 className="size-4" />
                            {deleting ? 'Deleting...' : 'Remove'}
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                </>
              )}
            </CardContent>
          </Card>
        ) : null}
      </div>
      <Dialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          if (deleting) return;

          setDeleteDialogOpen(open);
          if (!open) {
            setDeleteConfirmation('');
            setDeleteSlugCopied(false);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove project?</DialogTitle>
            <DialogDescription>
              Submit a delete PR for this project.
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (deleteConfirmationMatches) {
                void deleteProject();
              }
            }}
          >
            <div className="space-y-3">
              <div className="bg-muted/40 rounded-md border p-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <code
                    className="bg-background min-w-0 flex-1 truncate rounded-sm
                      border px-2.5 py-2 font-mono text-sm"
                  >
                    {selectedSlug}
                  </code>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void copyDeleteSlug()}
                    disabled={deleting || !selectedSlug}
                    className="w-full sm:w-auto"
                  >
                    {deleteSlugCopied ? (
                      <Check className="size-4" />
                    ) : (
                      <Copy className="size-4" />
                    )}
                    {deleteSlugCopied ? 'Copied' : 'Copy'}
                  </Button>
                </div>
              </div>
              <Label htmlFor="project-delete-confirmation">Project slug</Label>
              <Input
                id="project-delete-confirmation"
                value={deleteConfirmation}
                onChange={(event) => setDeleteConfirmation(event.target.value)}
                placeholder={selectedSlug ?? ''}
                autoComplete="off"
                disabled={deleting}
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setDeleteDialogOpen(false);
                  setDeleteConfirmation('');
                  setDeleteSlugCopied(false);
                }}
                disabled={deleting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="destructive"
                disabled={deleting || !deleteConfirmationMatches}
              >
                <Trash2 className="size-4" />
                {deleting ? 'Submitting...' : 'Submit delete PR'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
