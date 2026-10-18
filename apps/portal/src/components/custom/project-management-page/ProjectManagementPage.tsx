'use client';

import { json } from '@codemirror/lang-json';
import {
  AcademicDepartmentCodeSchema,
  type ProjectLinks,
  type ProjectPerson,
  type ProjectPersonRole,
  ProjectPersonRoleSchema,
  ProjectSchema,
  type ProjectSource,
  ProjectStatusSchema,
  ProjectTypeSchema,
  ScienceAcademicDepartments,
} from '@scs/schemas';
import { Badge } from '@scs/ui/badge';
import CodeMirror from '@uiw/react-codemirror';
import JsonView from '@uiw/react-json-view';
import { githubDarkTheme } from '@uiw/react-json-view/githubDark';
import { githubLightTheme } from '@uiw/react-json-view/githubLight';
import {
  Archive,
  Check,
  Copy,
  ExternalLink,
  Eye,
  FileJson,
  FolderKanban,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Search,
  Trash2,
  UserRound,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

import { BackButton } from '@/components/custom/back-button/back-button';
import {
  type EditorModeValue,
  EditorViewControls,
} from '@/components/custom/editor-view-controls/editor-view-controls';
import {
  PageLoading,
  PageLoadingPanel,
} from '@/components/custom/loading/PageLoading';
import {
  PageHeader,
  PageShell,
} from '@/components/custom/page-shell/page-shell';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import publicEnvConfig from '@/config/public.env.config';
import {
  apiHeaders,
  meApiUrl,
  publicCoursesApiUrl,
  publicOfferingsApiUrl,
  publicProjectApiUrl,
  publicProjectPrApiUrl,
  publicProjectsApiUrl,
  publicProjectSchemaApiUrl,
  readApiError,
} from '@/lib/api';
import { cn } from '@/lib/utils';
import { isSuperAdminRole } from '@/types/role';

type WorkspaceMode = 'list' | 'edit' | 'new';
type ProjectRecord = Record<string, unknown>;
type EditorMode = 'form' | 'json-view' | 'json-edit';
type ProjectTab = 'draft' | 'published';

interface ProjectManagementPageProps {
  admin?: boolean;
  projectSlug?: string;
}

interface UserContext {
  email: string;
  name?: string;
  role?: string;
  accessLevel?: unknown;
}

interface ProjectsResponse {
  projects: ProjectRecord[];
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

interface ProjectResponse {
  project: ProjectRecord | null;
  targetProjectFile?: string;
  targetAggregateFile?: string;
  targetManifestFile?: string;
}

function normalizeProjectResponse(value: unknown): ProjectResponse {
  if (isRecord(value) && 'project' in value) {
    return value as unknown as ProjectResponse;
  }

  return {
    project: isRecord(value) ? value : null,
  };
}

function normalizeProjectsResponse(value: unknown): ProjectsResponse {
  if (Array.isArray(value)) {
    return {
      projects: value.filter(isRecord),
    };
  }

  if (isRecord(value) && Array.isArray(value.projects)) {
    return {
      projects: value.projects.filter(isRecord),
    };
  }

  return { projects: [] };
}

interface ProjectSchemaResponse {
  canSubmitOwnedProjects: boolean;
  canSubmitAnyProject: boolean;
  identity: {
    email: string;
    username: string;
    sNumber: string | null;
  };
  lockedFields: string[];
  note: string;
}

interface ProjectPr {
  status:
    | 'none'
    | 'open'
    | 'merged'
    | 'closed'
    | 'checks_pending'
    | 'checks_failed'
    | 'auto_merge_queued';
  number?: number;
  url?: string;
  branch?: string;
  headSha?: string;
  canEdit: boolean;
  updatedAt?: string;
  targetProjectFile?: string;
  targetAggregateFile?: string;
  targetManifestFile?: string;
  draftProject?: ProjectRecord | null;
}

const PROJECT_PR_STATUS_TIMEOUT_MS = 10000;

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
  }, PROJECT_PR_STATUS_TIMEOUT_MS);

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
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

function isRecord(value: unknown): value is ProjectRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
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
    id: `prj-${slug}`,
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
    media: {
      icon: 'FolderKanban',
    },
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
    return 'border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950/30 dark:text-green-300';
  }
  if (status === 'checks_failed' || status === 'closed') {
    return 'border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300';
  }
  if (status === 'checks_pending' || status === 'auto_merge_queued') {
    return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300';
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

function JsonPreview({ value }: { value: object | undefined }) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  return (
    <div className="max-w-full overflow-x-auto rounded-md border bg-[#f6f8fa] p-3 text-sm sm:p-4 dark:bg-[#0d1117]">
      <JsonView
        value={value}
        style={{
          ...(isDark ? githubDarkTheme : githubLightTheme),
          backgroundColor: 'transparent',
          fontSize: '0.875rem',
        }}
        displayDataTypes={false}
        enableClipboard={false}
        collapsed={2}
      />
    </div>
  );
}

function JsonEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  return (
    <div className="max-w-full overflow-x-auto rounded-md border">
      <CodeMirror
        className="w-full max-w-full"
        value={value}
        minHeight="520px"
        height="min(62vh, 720px)"
        extensions={[json()]}
        basicSetup={{
          lineNumbers: true,
          foldGutter: true,
          highlightActiveLine: true,
        }}
        theme={isDark ? 'dark' : 'light'}
        onChange={onChange}
      />
    </div>
  );
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
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <textarea
        className="border-input bg-background min-h-28 w-full rounded-md border px-3 py-2 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
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
      <Select value={value} disabled={disabled} onValueChange={onChange}>
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
  slugLocked,
  courses,
  offerings,
  readOnly = false,
}: {
  project: ProjectRecord;
  onChange: (project: ProjectRecord) => void;
  canSubmitAnyProject: boolean;
  slugLocked: boolean;
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
  const source = isRecord(project.source) ? project.source : { kind: 'MANUAL' };
  const dates = isRecord(project.dates) ? project.dates : {};
  const people = Array.isArray(project.people)
    ? (project.people.filter(isRecord) as ProjectPerson[])
    : [];
  const projectTypeOptions: readonly string[] = canSubmitAnyProject
    ? PROJECT_TYPE_OPTIONS
    : USER_PROJECT_TYPES;
  const projectType =
    typeof project.projectType === 'string' ? project.projectType : 'OTHER';
  const sourceKind = typeof source.kind === 'string' ? source.kind : 'MANUAL';
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
      <section className="space-y-4">
        <h3 className="text-base font-semibold">Identity</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <TextField
            label="Title"
            value={typeof project.title === 'string' ? project.title : ''}
            required
            readOnly={readOnly}
            onChange={(title) => {
              const currentSlug =
                typeof project.slug === 'string' ? project.slug : '';
              const nextSlug =
                slugLocked ||
                (currentSlug !== '' && currentSlug !== 'new-project')
                  ? currentSlug
                  : slugify(title);
              const shouldFollowSlug =
                typeof project.id !== 'string' ||
                project.id === `prj-${currentSlug || 'new-project'}`;
              onChange({
                ...project,
                title,
                slug: nextSlug,
                id: shouldFollowSlug
                  ? `prj-${nextSlug || 'new-project'}`
                  : project.id,
              });
            }}
          />
          <TextField
            label="Slug"
            value={typeof project.slug === 'string' ? project.slug : ''}
            required
            readOnly={readOnly || slugLocked}
            onChange={(slug) => {
              const currentSlug =
                typeof project.slug === 'string' ? project.slug : '';
              const nextSlug = slugify(slug);
              const shouldFollowSlug =
                typeof project.id !== 'string' ||
                project.id === `prj-${currentSlug || 'new-project'}`;
              onChange({
                ...project,
                slug: nextSlug,
                id: shouldFollowSlug
                  ? `prj-${nextSlug || 'new-project'}`
                  : project.id,
              });
            }}
          />
          <TextField
            label="ID"
            value={typeof project.id === 'string' ? project.id : ''}
            required
            readOnly={readOnly}
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
      </section>

      <section className="space-y-4">
        <h3 className="text-base font-semibold">Classification</h3>
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
      </section>

      {projectType === 'COURSE_PROJECT' ? (
        <section className="space-y-4">
          <h3 className="text-base font-semibold">Course Project</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label>Course Offering</Label>
              <Select
                value={selectedOfferingId}
                disabled={readOnly}
                onValueChange={selectCourseOffering}
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

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-base font-semibold">People</h3>
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
              <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_16rem_auto]">
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
                <div className="text-muted-foreground mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm">
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
      </section>

      <section className="space-y-4">
        <h3 className="text-base font-semibold">Links</h3>
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
                setNested('links', nextLinks);
              }}
            />
          ))}
        </div>
      </section>

      {canSubmitAnyProject ? (
        <section className="space-y-4">
          <h3 className="text-base font-semibold">Registry Metadata</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <SelectField
              label="Source Type"
              value={sourceKind}
              options={['MANUAL', 'GITHUB_REPO', 'TEMPLATE_INDEX_JSON']}
              disabled={readOnly}
              onChange={(value) => {
                const nextSource: ProjectSource =
                  value === 'MANUAL'
                    ? { kind: 'MANUAL', curator: 'SCS Projects Team' }
                    : value === 'GITHUB_REPO'
                      ? {
                          kind: 'GITHUB_REPO',
                          repositoryOwner: '',
                          repositoryName: '',
                        }
                      : {
                          kind: 'TEMPLATE_INDEX_JSON',
                          repositoryOwner: '',
                          repositoryName: '',
                          metadataPath: '.docs/index.json',
                        };
                setNested('source', nextSource);
              }}
            />
            {sourceKind === 'MANUAL' ? (
              <TextField
                label="Curator"
                value={typeof source.curator === 'string' ? source.curator : ''}
                readOnly={readOnly}
                onChange={(value) =>
                  setNested('source', { ...source, curator: value })
                }
              />
            ) : (
              <>
                <TextField
                  label="Repository Owner"
                  value={
                    typeof source.repositoryOwner === 'string'
                      ? source.repositoryOwner
                      : ''
                  }
                  readOnly={readOnly}
                  onChange={(value) =>
                    setNested('source', { ...source, repositoryOwner: value })
                  }
                />
                <TextField
                  label="Repository Name"
                  value={
                    typeof source.repositoryName === 'string'
                      ? source.repositoryName
                      : ''
                  }
                  readOnly={readOnly}
                  onChange={(value) =>
                    setNested('source', { ...source, repositoryName: value })
                  }
                />
                {sourceKind === 'TEMPLATE_INDEX_JSON' ? (
                  <TextField
                    label="Metadata Path"
                    value={
                      typeof source.metadataPath === 'string'
                        ? source.metadataPath
                        : ''
                    }
                    readOnly={readOnly}
                    onChange={(value) =>
                      setNested('source', { ...source, metadataPath: value })
                    }
                  />
                ) : null}
              </>
            )}
            <TextField
              label="Icon"
              value={typeof media.icon === 'string' ? media.icon : ''}
              placeholder="FolderKanban"
              readOnly={readOnly}
              onChange={(value) =>
                setNested('media', { ...media, icon: value })
              }
            />
            <TextField
              label="Cover Image"
              value={
                typeof media.coverImage === 'string' ? media.coverImage : ''
              }
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
        </section>
      ) : null}

      <section className="space-y-4">
        <h3 className="text-base font-semibold">Dates</h3>
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
      </section>
    </div>
  );
}

export default function ProjectManagementPage({
  admin = false,
  projectSlug,
}: ProjectManagementPageProps) {
  const router = useRouter();
  const [user, setUser] = useState<UserContext | null>(null);
  const [schema, setSchema] = useState<ProjectSchemaResponse | null>(null);
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [courses, setCourses] = useState<CourseCatalogRecord[]>([]);
  const [offerings, setOfferings] = useState<CourseOfferingRecord[]>([]);
  const [publishedProject, setPublishedProject] =
    useState<ProjectRecord | null>(null);
  const [project, setProject] = useState<ProjectRecord>(() => emptyProject());
  const latestProjectRef = useRef(project);
  const [pr, setPr] = useState<ProjectPr | null>(null);
  const routeProjectSlug = projectSlug ? slugify(projectSlug) : null;
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>(
    routeProjectSlug ? 'edit' : 'list'
  );
  const [selectedSlug, setSelectedSlug] = useState<string | null>(
    routeProjectSlug
  );
  const [editorMode, setEditorMode] = useState<EditorMode>('form');
  const [activeTab, setActiveTab] = useState<ProjectTab>('draft');
  const [jsonText, setJsonText] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
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

  function syncJson(nextProject = project) {
    setJsonText(JSON.stringify(nextProject, null, 2));
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
    const [projectsRes, coursesRes, offeringsRes] = await Promise.all([
      fetch(publicProjectsApiUrl(), {
        credentials: 'include',
        cache: 'no-store',
        headers: apiHeaders(),
      }),
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
    if (!projectsRes.ok) {
      throw new Error((await readApiError(projectsRes)).message);
    }
    if (!coursesRes.ok) {
      throw new Error((await readApiError(coursesRes)).message);
    }
    if (!offeringsRes.ok) {
      throw new Error((await readApiError(offeringsRes)).message);
    }
    const body = normalizeProjectsResponse(await projectsRes.json());
    const coursesBody = (await coursesRes.json().catch(() => [])) as unknown;
    const offeringsBody = (await offeringsRes
      .json()
      .catch(() => [])) as unknown;
    setProjects(body.projects ?? []);
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

    if (nextUser) {
      setUser(nextUser);
    }
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

      await Promise.all([
        loadProjectList(nextUser),
        routeProjectSlug ? loadProject(routeProjectSlug) : Promise.resolve(),
      ]);
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
          setProject(draft);
          syncJson(draft);
          setActiveTab('draft');
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
          setPublishedProject(null);
          setSchema(nextSchema);
          setWorkspaceMode('edit');
          setEditorMode('form');
          setActiveTab('draft');
          return;
        }

        toast.info('Project is no longer available.');
        returnToProjectList();
        return;
      }

      const nextProject =
        projectBody.project ?? emptyProject(nextSchema.identity);

      setSelectedSlug(normalizedSlug);
      setPublishedProject(projectBody.project);
      setProject(nextProject);
      latestProjectRef.current = nextProject;
      syncJson(nextProject);
      setWorkspaceMode('edit');
      setEditorMode('form');
      setActiveTab('draft');
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
    const timeout = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [admin, routeProjectSlug]);

  async function startNewProject() {
    setProjectLoading(true);
    setError(null);

    try {
      const schemaRes = await fetch(publicProjectSchemaApiUrl('new-project'), {
        credentials: 'include',
        cache: 'no-store',
        headers: apiHeaders(),
      });
      if (!schemaRes.ok) {
        throw new Error((await readApiError(schemaRes)).message);
      }
      const nextSchema = (await schemaRes.json()) as ProjectSchemaResponse;
      const nextProject = emptyProject(nextSchema.identity);
      setSchema(nextSchema);
      setSelectedSlug(null);
      setPublishedProject(null);
      setPr(null);
      setPrError(null);
      latestProjectRef.current = nextProject;
      setProject(nextProject);
      syncJson(nextProject);
      setWorkspaceMode('new');
      setEditorMode('form');
      setActiveTab('draft');
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
    setPublishedProject(null);
    setPr(null);
    const nextProject = emptyProject();
    latestProjectRef.current = nextProject;
    setProject(nextProject);
    syncJson(nextProject);
    setError(null);
    setPrError(null);
  }

  function applyJson() {
    try {
      const parsed = JSON.parse(jsonText) as unknown;
      if (!isRecord(parsed)) {
        toast.error('Project JSON must be an object.');
        return null;
      }
      latestProjectRef.current = parsed;
      setProject(parsed);
      return parsed;
    } catch (jsonError) {
      toast.error(
        jsonError instanceof Error ? jsonError.message : 'Invalid JSON.'
      );
      return null;
    }
  }

  function setEditableProject(nextProject: ProjectRecord) {
    latestProjectRef.current = nextProject;
    setProject(nextProject);
    syncJson(nextProject);
    setActiveTab('draft');
  }

  function loadPublishedAsEditBase(nextMode: EditorMode = 'form') {
    if (!publishedProject) {
      toast.error('No published project exists yet.');
      return;
    }

    setEditableProject(publishedProject);
    setEditorMode(nextMode);
    toast.success('Published project loaded into the editor');
  }

  function handleEditorModeChange(nextMode: EditorMode) {
    if (activeTab === 'published' && nextMode !== 'json-view') {
      if (!canEdit) {
        setEditorMode(nextMode);
        return;
      }
      loadPublishedAsEditBase(nextMode);
      return;
    }

    if (nextMode === 'json-edit') syncJson();
    setEditorMode(nextMode);
  }

  function handleTabChange(nextTab: ProjectTab) {
    if (activeTab === nextTab) return;

    setActiveTab(nextTab);
    if (nextTab === 'published') {
      setEditorMode(canEdit ? 'json-view' : 'form');
    }
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
      toast.error('Project validation failed.');
      setError(
        validation.error.issues
          .map((issue) => {
            const path = issue.path.length ? issue.path.join('.') : 'project';
            return `${path}: ${issue.message}`;
          })
          .join('\n')
      );
      return;
    }

    const targetSlug = validation.data.slug;
    if (!targetSlug) return;
    if (!isNew && selectedSlug !== targetSlug) {
      toast.error('Project slug must match the selected project.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const mutationPr = await getProjectPrForMutation(
        targetSlug,
        Boolean(
          prError || prLoading || (!isNew && selectedSlug === targetSlug && !pr)
        )
      );
      const res = await fetch(publicProjectPrApiUrl(targetSlug), {
        method: 'PUT',
        credentials: 'include',
        headers: apiHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          project: validation.data,
          ...(mutationPr?.status === 'open' && mutationPr.headSha
            ? { expectedHeadSha: mutationPr.headSha }
            : {}),
        }),
      });

      if (!res.ok) {
        throw new Error((await readApiError(res)).message);
      }

      const nextPr = await readProjectPrResponse(res);
      setPr(nextPr);
      setPrError(null);
      setSelectedSlug(targetSlug);
      latestProjectRef.current = validation.data;
      setProject(validation.data);
      syncJson(validation.data);
      setWorkspaceMode('edit');
      setActiveTab('draft');
      await loadProjectList();
      toast.success('Project PR submitted.');
    } catch (saveError) {
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
        headers: apiHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          ...(mutationPr?.status === 'open' && mutationPr.headSha
            ? { expectedHeadSha: mutationPr.headSha }
            : {}),
        }),
      });

      if (!res.ok) {
        throw new Error((await readApiError(res)).message);
      }

      const nextPr = await readProjectPrResponse(res);
      setPr(nextPr);
      setPrError(null);
      setDeleteDialogOpen(false);
      setDeleteConfirmation('');
      await loadProjectList();
      toast.success(
        nextPr.status === 'none'
          ? 'Project is already removed.'
          : 'Delete PR submitted.'
      );
      returnToProjectList();
    } catch (deleteError) {
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
    return <PageLoading variant="table" />;
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
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
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
  const displayedProject =
    activeTab === 'published' ? (publishedProject ?? project) : project;
  const showRegistry = !routeProjectSlug && workspaceMode === 'list';
  const showWorkspace = routeProjectSlug || workspaceMode !== 'list';
  const deleteConfirmationMatches =
    selectedSlug !== null && deleteConfirmation.trim() === selectedSlug;

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
          <div className="grid w-full grid-cols-1 gap-2 min-[420px]:grid-cols-2 sm:flex sm:w-auto sm:flex-wrap">
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
        <pre className="border-destructive/30 bg-destructive/5 text-destructive whitespace-pre-wrap rounded-md border p-4 text-sm">
          {error}
        </pre>
      ) : null}

      <div className="grid gap-5">
        {showRegistry ? (
          <Card>
            <CardHeader className="px-4 sm:px-6">
              <CardTitle>Project Registry</CardTitle>
              <CardDescription>
                Open a project workspace or start a new registry draft.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 px-4 sm:px-6">
              <div className="relative">
                <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search projects..."
                  className="pl-9"
                />
              </div>
              <Separator />
              {filteredProjects.length === 0 ? (
                <div className="text-muted-foreground flex flex-col items-center gap-2 py-10 text-center">
                  <FolderKanban className="size-10 opacity-30" />
                  <p className="text-sm">No projects found.</p>
                </div>
              ) : (
                <ul className="divide-border divide-y">
                  {filteredProjects.map((item) => {
                    const itemSlug =
                      typeof item.slug === 'string' ? item.slug : '';
                    const selected = itemSlug === selectedSlug;
                    const canEditItem = userCanEditProject(
                      user,
                      item,
                      effectiveAdmin
                    );

                    return (
                      <li key={itemSlug} className="py-3 first:pt-0 last:pb-0">
                        <article
                          className={cn(
                            'w-full rounded-md border p-3 text-left transition hover:border-foreground/25 hover:bg-muted/30',
                            selected && 'border-foreground/30 bg-muted/40'
                          )}
                        >
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                            <span className="min-w-0 flex-1 wrap-break-word font-medium sm:truncate">
                              {projectTitle(item)}
                            </span>
                            {typeof item.status === 'string' ? (
                              <Badge variant="secondary">
                                {enumLabel(item.status)}
                              </Badge>
                            ) : null}
                          </div>
                          <p className="text-muted-foreground mt-1 line-clamp-2 text-sm leading-6">
                            {typeof item.shortDescription === 'string'
                              ? item.shortDescription
                              : itemSlug}
                          </p>
                          <div className="mt-3 grid gap-2 sm:flex sm:flex-wrap">
                            <Button
                              asChild
                              size="sm"
                              className="w-full sm:w-auto"
                            >
                              <Link href={`${projectsHref}/${itemSlug}`}>
                                {canEditItem ? (
                                  <Pencil className="size-4" />
                                ) : (
                                  <Eye className="size-4" />
                                )}
                                {canEditItem
                                  ? 'Manage Project'
                                  : 'View Project'}
                              </Link>
                            </Button>
                          </div>
                        </article>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        ) : null}

        {showWorkspace ? (
          <Card>
            <CardHeader className="px-4 sm:px-6">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 space-y-1.5">
                  <CardTitle>
                    {isNew ? 'New Project' : projectTitle(displayedProject)}
                  </CardTitle>
                  <CardDescription>
                    {schema?.note ??
                      'Project data is validated before a GitHub pull request is opened.'}
                  </CardDescription>
                </div>
                <div className="grid w-full gap-2 sm:flex sm:w-auto sm:flex-wrap">
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
                    <div className="flex flex-col gap-3 rounded-md border bg-muted/30 p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
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
                      <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap">
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
                          <Button
                            variant="outline"
                            size="sm"
                            asChild
                            className="w-full sm:w-auto"
                          >
                            <a href={pr.url} target="_blank" rel="noreferrer">
                              <ExternalLink className="size-4" />
                              Open PR
                            </a>
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  ) : null}

                  <EditorViewControls<ProjectTab>
                    className="rounded-md border bg-muted/20 p-3 md:w-[24rem]"
                    sourceValue={
                      !isNew && publishedProject ? activeTab : undefined
                    }
                    sourceOptions={[
                      {
                        value: 'draft',
                        label: pr?.draftProject ? 'Draft PR' : 'Editor',
                      },
                      { value: 'published', label: 'Published' },
                    ]}
                    onSourceChange={handleTabChange}
                    modeValue={editorMode as EditorModeValue}
                    onModeChange={(value) =>
                      handleEditorModeChange(value as EditorMode)
                    }
                    disableJsonEdit={!canEdit && editorMode !== 'json-edit'}
                  />

                  {editorMode === 'form' ? (
                    <ProjectForm
                      project={displayedProject ?? project}
                      onChange={setProject}
                      canSubmitAnyProject={canSubmitAnyProject}
                      slugLocked={!isNew}
                      courses={courses}
                      offerings={offerings}
                      readOnly={!canEdit}
                    />
                  ) : editorMode === 'json-view' ? (
                    <JsonPreview value={displayedProject ?? project} />
                  ) : (
                    <JsonEditor value={jsonText} onChange={setJsonText} />
                  )}

                  {canEdit ? (
                    <div className="flex flex-col gap-3 border-t pt-5 sm:flex-row sm:items-center sm:justify-between">
                      <div className="text-muted-foreground flex items-start gap-2 text-sm sm:items-center">
                        <UserRound className="size-4" />
                        {canSubmitAnyProject
                          ? 'Admin submission can update any project.'
                          : 'Owner submission requires your identity in People.'}
                      </div>
                      <div className="grid w-full grid-cols-1 gap-2 min-[420px]:grid-cols-2 sm:flex sm:w-auto sm:flex-wrap">
                        {editorMode === 'json-edit' ? (
                          <Button
                            variant="outline"
                            onClick={applyJson}
                            className="w-full sm:w-auto"
                          >
                            <FileJson className="size-4" />
                            Apply JSON
                          </Button>
                        ) : null}
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
                              'w-full border-destructive/40 text-destructive hover:bg-destructive/10 sm:w-auto'
                            )}
                          >
                            <Trash2 className="size-4" />
                            {deleting ? 'Deleting...' : 'Remove'}
                          </Button>
                        ) : null}
                        <Button
                          onClick={() => {
                            const nextProject =
                              editorMode === 'json-edit'
                                ? applyJson()
                                : project;
                            if (nextProject) void saveProject(nextProject);
                          }}
                          disabled={saving}
                          className="w-full sm:w-auto"
                        >
                          <Save className="size-4" />
                          {saving ? 'Saving...' : 'Submit PR'}
                        </Button>
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
                  <code className="bg-background min-w-0 flex-1 truncate rounded-sm border px-2.5 py-2 font-mono text-sm">
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
