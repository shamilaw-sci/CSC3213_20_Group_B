'use client';

import {
  AcademicDepartmentCodeSchema,
  CourseCodeSchema,
  type MutationAccepted,
  ScienceAcademicDepartments,
} from '@scs/schemas';
import { Badge } from '@scs/ui/components/badge';
import { Button } from '@scs/ui/components/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@scs/ui/components/card';
import { Field, FieldGroup, FieldLabel } from '@scs/ui/components/field';
import { Input } from '@scs/ui/components/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@scs/ui/components/select';
import { Separator } from '@scs/ui/components/separator';
import { cn } from 'cn';
import {
  BookOpen,
  Plus,
  RefreshCw,
  Save,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { BackButton } from '@/components/custom/back-button/back-button';
import {
  type EditorModeValue,
  EditorViewControls,
} from '@/components/custom/editor-view-controls/editor-view-controls';
import { PageLoading } from '@/components/custom/loading/PageLoading';
import { Pagination } from '@/components/custom/pagination/Pagination';
import { PageHeader, PageShell } from '@/components/layout/page-shell';
import {
  apiHeaders,
  meApiUrl,
  publicCourseApiUrl,
  publicCoursePrApiUrl,
  publicCourseSchemaApiUrl,
  publicCoursesPageApiUrl,
  publicOfferingPrApiUrl,
  publicOfferingsApiUrl,
  readApiError,
} from '@/lib/api';
import {
  assertMutationSucceeded,
  isOperationPollingAbort,
  waitForMutationOperation,
} from '@/lib/mutation-operation';
import { useOperationPollingSignal } from '@/lib/use-operation-polling';
import { canEditCoursesRole } from '@/types/role';

const JsonEditor = dynamic(
  () =>
    import('@/components/editor/json-editor').then(
      (module) => module.JsonEditor
    ),
  { ssr: false }
);
const JsonPreview = dynamic(
  () =>
    import('@/components/editor/json-preview').then(
      (module) => module.JsonPreview
    ),
  { ssr: false }
);

type EditorMode = 'form' | 'json-view' | 'json-edit';
type CourseTab = 'draft' | 'published';

interface CourseManagementPageProps {
  courseId?: string;
  newCourse?: boolean;
  initialUser?: Record<string, unknown>;
  initialCourses?: unknown[];
  initialSchema?: SchemaResponse;
  initialCourse?: unknown;
  initialPullRequest?: unknown;
  initialOfferings?: unknown[];
  previousHref?: string;
  nextHref?: string;
}

interface CourseRecord {
  id: string;
  primaryCode: string;
  codes: string[];
  title: string;
  credits: 1 | 2 | 3 | 6;
  departments: string[];
}

interface OfferingRecord {
  id: string;
  courseId: string;
  academicYear: string;
  semester: 'SEM1' | 'SEM2';
  staff: {
    staff: string;
    role:
      'COURSE_COORDINATOR' | 'LECTURER' | 'INSTRUCTOR' | 'TEACHING_ASSISTANT';
  }[];
}

interface AcademicPr {
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
  revision?: string;
  canEdit: boolean;
  updatedAt?: string;
  draftRecord?: Record<string, unknown> | null;
}

interface SchemaResponse {
  canEditCourses: boolean;
  identity: {
    email: string;
    username: string;
  };
  lockedFields: string[];
  note: string;
}

const ACADEMIC_DEPARTMENTS = AcademicDepartmentCodeSchema.options;
const DEFAULT_DEPARTMENTS = ['STATISTICS_AND_COMPUTER_SCIENCE'];
const ACADEMIC_DEPARTMENT_LABELS = Object.fromEntries(
  ScienceAcademicDepartments.map((department) => [
    department.code,
    department.name,
  ])
) as Record<(typeof ACADEMIC_DEPARTMENTS)[number], string>;
const CREDIT_OPTIONS = [1, 2, 3, 6] as const;
const STAFF_ROLES = [
  'COURSE_COORDINATOR',
  'LECTURER',
  'INSTRUCTOR',
  'TEACHING_ASSISTANT',
] as const;

function normalizeCourseCode(value: string) {
  const parsed = CourseCodeSchema.safeParse(value);
  return parsed.success ? parsed.data : '';
}

function uniqueCourseCodes(codes: string[]) {
  return Array.from(new Set(codes.map(normalizeCourseCode))).filter(Boolean);
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

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

function enumLabel(value: string) {
  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function courseFromRecord(value: unknown): CourseRecord | null {
  if (!isRecord(value)) return null;
  const id = typeof value.id === 'string' ? value.id : '';
  const primaryCode =
    typeof value.primaryCode === 'string' ? value.primaryCode : '';
  const codes = Array.isArray(value.codes)
    ? value.codes.filter((code): code is string => typeof code === 'string')
    : [];
  const title = typeof value.title === 'string' ? value.title : '';
  const credits = CREDIT_OPTIONS.includes(value.credits as 1 | 2 | 3 | 6)
    ? (value.credits as 1 | 2 | 3 | 6)
    : 3;
  const departments = uniqueDepartments(value.departments);

  if (!id || !primaryCode || !title || codes.length === 0) return null;
  return { id, primaryCode, codes, title, credits, departments };
}

function offeringFromRecord(value: unknown): OfferingRecord | null {
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
    ? value.staff
        .map((item) => {
          if (!isRecord(item)) return null;
          const staffId = typeof item.staff === 'string' ? item.staff : '';
          const role = STAFF_ROLES.includes(
            item.role as (typeof STAFF_ROLES)[number]
          )
            ? (item.role as (typeof STAFF_ROLES)[number])
            : 'LECTURER';
          return staffId ? { staff: staffId, role } : null;
        })
        .filter((item): item is OfferingRecord['staff'][number] =>
          Boolean(item)
        )
    : [];

  if (!id || !courseId || !academicYear) return null;
  return { id, courseId, academicYear, semester, staff };
}

function emptyCourse(): CourseRecord {
  return {
    id: 'new-course',
    primaryCode: 'CSC3213',
    codes: ['CSC3213'],
    title: '',
    credits: 3,
    departments: DEFAULT_DEPARTMENTS,
  };
}

function emptyOffering(course: CourseRecord): OfferingRecord {
  return {
    id: `${course.primaryCode.toLowerCase()}-2025-2026-sem1`,
    courseId: course.id,
    academicYear: '2025/2026',
    semester: 'SEM1',
    staff: [],
  };
}

function prBadgeClass(status: AcademicPr['status']) {
  if (status === 'open') {
    return 'border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950/30 dark:text-green-300';
  }
  if (status === 'closed' || status === 'checks_failed') {
    return 'border-destructive/30 bg-destructive/10 text-destructive';
  }
  if (status === 'merged' || status === 'auto_merge_queued') {
    return 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-300';
  }
  return 'border-muted-foreground/20 text-muted-foreground';
}

export default function CourseManagementPage({
  courseId,
  newCourse = false,
  initialUser,
  initialCourses = [],
  initialSchema,
  initialCourse,
  initialPullRequest,
  initialOfferings = [],
  previousHref,
  nextHref,
}: CourseManagementPageProps) {
  const router = useRouter();
  const beginOperationPolling = useOperationPollingSignal();
  const [user, setUser] = useState<Record<string, unknown> | null>(
    initialUser ?? null
  );
  const [schema, setSchema] = useState<SchemaResponse | null>(
    initialSchema ?? null
  );
  const [courses, setCourses] = useState<CourseRecord[]>(() =>
    initialCourses
      .map(courseFromRecord)
      .filter((item): item is CourseRecord => Boolean(item))
  );
  const [offerings, setOfferings] = useState<OfferingRecord[]>(() =>
    initialOfferings
      .map(offeringFromRecord)
      .filter((item): item is OfferingRecord => Boolean(item))
  );
  const initialPublishedCourse = courseFromRecord(initialCourse);
  const initialPr = isRecord(initialPullRequest)
    ? (initialPullRequest as unknown as AcademicPr)
    : null;
  const initialDraftCourse = courseFromRecord(initialPr?.draftRecord);
  const [course, setCourse] = useState<CourseRecord>(
    initialDraftCourse ?? initialPublishedCourse ?? emptyCourse()
  );
  const [publishedCourse, setPublishedCourse] = useState<CourseRecord | null>(
    initialPublishedCourse
  );
  const [pr, setPr] = useState<AcademicPr | null>(initialPr);
  const [query, setQuery] = useState('');
  const [jsonText, setJsonText] = useState(
    JSON.stringify(
      initialDraftCourse ?? initialPublishedCourse ?? emptyCourse(),
      null,
      2
    )
  );
  const [editorMode, setEditorMode] = useState<EditorMode>('form');
  const [activeTab, setActiveTab] = useState<CourseTab>('draft');
  const [loading, setLoading] = useState(
    !initialUser || ((Boolean(courseId) || newCourse) && !initialSchema)
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canEdit =
    Boolean(schema?.canEditCourses) || canEditCoursesRole(user ?? {});
  const isWorkspace = Boolean(courseId) || newCourse;
  const displayedCourse =
    activeTab === 'published' ? (publishedCourse ?? course) : course;
  const courseOfferings = offerings.filter(
    (offering) => offering.courseId === displayedCourse.id
  );

  const filteredCourses = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return courses;
    return courses.filter(
      (item) =>
        item.id.includes(normalizedQuery) ||
        item.title.toLowerCase().includes(normalizedQuery) ||
        item.codes.some((code) => code.toLowerCase().includes(normalizedQuery))
    );
  }, [courses, query]);

  function syncJson(nextCourse = course) {
    setJsonText(JSON.stringify(nextCourse, null, 2));
  }

  function setEditableCourse(nextCourse: CourseRecord) {
    setCourse(nextCourse);
    syncJson(nextCourse);
    setActiveTab('draft');
  }

  function handleCourseTabChange(tab: CourseTab) {
    setActiveTab(tab);
    if (tab === 'published' && editorMode !== 'json-view') {
      setEditorMode('json-view');
    }
  }

  async function loadMe() {
    const res = await fetch(meApiUrl(), {
      credentials: 'include',
      cache: 'no-store',
      headers: apiHeaders(),
    });
    if (!res.ok) throw new Error((await readApiError(res)).message);
    const nextUser = (await res.json()) as Record<string, unknown>;
    setUser(nextUser);
    return nextUser;
  }

  async function loadCoursePage() {
    const coursesRes = await fetch(publicCoursesPageApiUrl(), {
      credentials: 'include',
      cache: 'no-store',
      headers: apiHeaders(),
    });

    if (!coursesRes.ok)
      throw new Error((await readApiError(coursesRes)).message);
    const coursesValue = (await coursesRes.json().catch(() => ({}))) as {
      items?: unknown[];
    };
    setCourses(
      Array.isArray(coursesValue.items)
        ? coursesValue.items
            .map(courseFromRecord)
            .filter((item): item is CourseRecord => Boolean(item))
        : []
    );
  }

  async function loadOfferings() {
    const offeringsRes = await fetch(publicOfferingsApiUrl(), {
      credentials: 'include',
      cache: 'no-store',
      headers: apiHeaders(),
    });

    if (!offeringsRes.ok) {
      throw new Error((await readApiError(offeringsRes)).message);
    }

    const offeringsValue = (await offeringsRes
      .json()
      .catch(() => [])) as unknown;
    setOfferings(
      Array.isArray(offeringsValue)
        ? offeringsValue
            .map(offeringFromRecord)
            .filter((item): item is OfferingRecord => Boolean(item))
        : []
    );
  }

  async function loadCourse(id: string) {
    const normalizedId = slugify(id);
    const [schemaRes, courseRes, prRes] = await Promise.all([
      fetch(publicCourseSchemaApiUrl(normalizedId), {
        credentials: 'include',
        cache: 'no-store',
        headers: apiHeaders(),
      }),
      fetch(publicCourseApiUrl(normalizedId), {
        credentials: 'include',
        cache: 'no-store',
        headers: apiHeaders(),
      }),
      fetch(publicCoursePrApiUrl(normalizedId), {
        credentials: 'include',
        cache: 'no-store',
        headers: apiHeaders(),
      }),
    ]);

    if (!schemaRes.ok) throw new Error((await readApiError(schemaRes)).message);
    if (!prRes.ok) throw new Error((await readApiError(prRes)).message);

    const nextSchema = (await schemaRes.json()) as SchemaResponse;
    const nextPr = (await prRes.json()) as AcademicPr;
    const publishedValue = courseRes.ok
      ? ((await courseRes.json()) as unknown)
      : null;
    const published = courseFromRecord(publishedValue);
    const draft = courseFromRecord(nextPr.draftRecord);
    const nextCourse = draft ??
      published ?? { ...emptyCourse(), id: normalizedId };

    setSchema(nextSchema);
    setPr(nextPr);
    setPublishedCourse(published);
    setCourse(nextCourse);
    syncJson(nextCourse);
    setActiveTab('draft');
  }

  useEffect(() => {
    if (initialUser && (!courseId && !newCourse ? true : initialSchema)) return;

    let mounted = true;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const nextUser = await loadMe();
        if (!canEditCoursesRole(nextUser)) {
          return;
        }
        const detailPromise = courseId
          ? loadCourse(courseId)
          : newCourse
            ? (async () => {
                const schemaRes = await fetch(
                  publicCourseSchemaApiUrl('new-course'),
                  {
                    credentials: 'include',
                    cache: 'no-store',
                    headers: apiHeaders(),
                  }
                );
                if (!schemaRes.ok) {
                  throw new Error((await readApiError(schemaRes)).message);
                }
                setSchema((await schemaRes.json()) as SchemaResponse);
                const nextCourse = emptyCourse();
                setCourse(nextCourse);
                setPublishedCourse(null);
                setPr(null);
                syncJson(nextCourse);
              })()
            : Promise.resolve();
        await Promise.all([
          courseId || newCourse ? loadOfferings() : loadCoursePage(),
          detailPromise,
        ]);
      } catch (loadError) {
        if (mounted) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : 'Course registry failed to load.'
          );
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void load();
    return () => {
      mounted = false;
    };
    /*
     * Key loading by route state only. Helper identities change with local
     * editor state and must not restart this network request.
     */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId, initialSchema, initialUser, newCourse]);

  function parseJsonEditor() {
    try {
      const value = JSON.parse(jsonText) as unknown;
      const parsed = courseFromRecord(value);
      if (!parsed) {
        toast.error('Course JSON must match the course catalog shape.');
        return null;
      }
      return parsed;
    } catch {
      toast.error('Course JSON is not valid JSON.');
      return null;
    }
  }

  async function saveCourse(nextCourse = course) {
    if (!canEdit) {
      toast.error('Only academic users and super admins can edit courses.');
      return;
    }

    const normalizedId = slugify(nextCourse.id);
    if (!normalizedId) {
      toast.error('Course id is required.');
      return;
    }
    if (courseId && normalizedId !== slugify(courseId)) {
      toast.error('Course id must match the selected course.');
      return;
    }
    const normalizedPrimaryCode = normalizeCourseCode(nextCourse.primaryCode);
    const normalizedCodes = uniqueCourseCodes(nextCourse.codes);
    if (normalizedCodes.length !== nextCourse.codes.length) {
      toast.error('Course codes must be valid and cannot contain duplicates.');
      return;
    }
    if (!normalizedCodes.includes(normalizedPrimaryCode)) {
      toast.error('Primary code must be listed in course codes.');
      return;
    }
    const validatedCourse = {
      ...nextCourse,
      id: normalizedId,
      primaryCode: normalizedPrimaryCode,
      codes: normalizedCodes,
      departments: uniqueDepartments(nextCourse.departments),
    };

    setSaving(true);
    try {
      const res = await fetch(publicCoursePrApiUrl(normalizedId), {
        method: 'PUT',
        credentials: 'include',
        headers: apiHeaders({
          'Content-Type': 'application/json',
          Prefer: 'respond-async',
        }),
        body: JSON.stringify({
          course: validatedCourse,
          ...(pr?.headSha ? { expectedHeadSha: pr.headSha } : {}),
          control: {
            idempotencyKey: crypto.randomUUID(),
            expectedRevision: pr?.revision ?? 'missing',
          },
        }),
      });

      if (!res.ok) throw new Error((await readApiError(res)).message);
      const operation = await waitForMutationOperation(
        (await res.json()) as MutationAccepted,
        'Course update is still queued. Refresh to check its status.',
        { signal: beginOperationPolling() }
      );
      assertMutationSucceeded(operation);
      setCourse(validatedCourse);
      syncJson(validatedCourse);
      await loadCourse(normalizedId);
      router.refresh();
      toast.success('Course PR submitted.');
      if (newCourse) router.push(`/academic/courses/${validatedCourse.id}`);
    } catch (saveError) {
      if (isOperationPollingAbort(saveError)) return;
      toast.error(
        saveError instanceof Error ? saveError.message : 'Course save failed.'
      );
    } finally {
      setSaving(false);
    }
  }

  async function saveOffering(offering: OfferingRecord) {
    if (!canEdit) {
      toast.error('Only academic users and super admins can edit offerings.');
      return;
    }

    setSaving(true);
    try {
      const offeringUrl = publicOfferingPrApiUrl(slugify(offering.id));
      const statusResponse = await fetch(offeringUrl, {
        credentials: 'include',
        cache: 'no-store',
        headers: apiHeaders(),
      });
      if (!statusResponse.ok) {
        throw new Error((await readApiError(statusResponse)).message);
      }
      const offeringPr = (await statusResponse.json()) as AcademicPr;
      const res = await fetch(offeringUrl, {
        method: 'PUT',
        credentials: 'include',
        headers: apiHeaders({
          'Content-Type': 'application/json',
          Prefer: 'respond-async',
        }),
        body: JSON.stringify({
          offering,
          ...(offeringPr.headSha
            ? { expectedHeadSha: offeringPr.headSha }
            : {}),
          control: {
            idempotencyKey: crypto.randomUUID(),
            expectedRevision: offeringPr.revision ?? 'missing',
          },
        }),
      });
      if (!res.ok) throw new Error((await readApiError(res)).message);
      const operation = await waitForMutationOperation(
        (await res.json()) as MutationAccepted,
        'Course offering update is still queued. Refresh to check its status.',
        { signal: beginOperationPolling() }
      );
      assertMutationSucceeded(operation);
      await loadOfferings();
      toast.success('Course offering PR submitted.');
    } catch (operationError) {
      if (isOperationPollingAbort(operationError)) return;
      toast.error(
        operationError instanceof Error
          ? operationError.message
          : 'Course offering update failed.'
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteCourse() {
    if (!courseId || !canEdit) return;
    setSaving(true);
    try {
      const res = await fetch(publicCoursePrApiUrl(slugify(courseId)), {
        method: 'DELETE',
        credentials: 'include',
        headers: apiHeaders({
          'Content-Type': 'application/json',
          Prefer: 'respond-async',
        }),
        body: JSON.stringify({
          ...(pr?.headSha ? { expectedHeadSha: pr.headSha } : {}),
          control: {
            idempotencyKey: crypto.randomUUID(),
            expectedRevision: pr?.revision ?? 'missing',
          },
        }),
      });
      if (!res.ok) throw new Error((await readApiError(res)).message);
      const operation = await waitForMutationOperation(
        (await res.json()) as MutationAccepted,
        'Course deletion is still queued. Refresh to check its status.',
        { signal: beginOperationPolling() }
      );
      assertMutationSucceeded(operation);
      toast.success('Course deletion PR submitted.');
      router.push('/academic/courses');
    } catch (deleteError) {
      if (isOperationPollingAbort(deleteError)) return;
      toast.error(
        deleteError instanceof Error
          ? deleteError.message
          : 'Course deletion failed.'
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <PageLoading />;

  if (!canEditCoursesRole(user ?? {})) {
    return (
      <PageShell>
        <BackButton fallbackHref="/dashboard" label="Back to Dashboard" />
        <PageHeader
          title="Courses"
          description="Only academic users and admins can use the course registry."
        />
        <div className="text-muted-foreground rounded-md border p-6 text-sm">
          Course catalog access is limited to academic users and admins.
        </div>
      </PageShell>
    );
  }

  if (error) {
    return (
      <PageShell>
        <BackButton fallbackHref="/dashboard" label="Back to Dashboard" />
        <PageHeader
          title="Courses"
          description="Course registry unavailable."
        />
        <div className="text-muted-foreground rounded-md border p-6 text-sm">
          {error}
        </div>
      </PageShell>
    );
  }

  if (!isWorkspace) {
    return (
      <PageShell width="wide">
        <BackButton fallbackHref="/dashboard" label="Back to Dashboard" />
        <PageHeader
          title="Courses"
          description="Browse and manage academic course catalog records."
          icon={<BookOpen className="text-muted-foreground size-6" />}
          action={
            canEdit ? (
              <Button asChild>
                <Link href="/academic/courses/new">
                  <Plus data-icon="inline-start" />
                  New Course
                </Link>
              </Button>
            ) : null
          }
        />

        <Card>
          <CardHeader>
            <CardTitle>Course Catalog</CardTitle>
            <CardDescription>
              Search by course id, title, or course code.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search courses"
                className="pl-9"
              />
            </div>
            <Separator />
            {filteredCourses.length === 0 ? (
              <div className="text-muted-foreground flex flex-col items-center gap-2 py-10 text-center">
                <BookOpen className="size-10 opacity-30" />
                <p className="text-sm">No courses found.</p>
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {filteredCourses.map((item) => (
                  <Link
                    key={item.id}
                    href={`/academic/courses/${item.id}`}
                    className="rounded-md border bg-card p-4 shadow-sm transition hover:border-foreground/25 hover:bg-muted/30"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h2 className="font-semibold">{item.title}</h2>
                        <p className="text-muted-foreground text-sm">
                          {item.id}
                        </p>
                      </div>
                      <Badge variant="secondary">{item.primaryCode}</Badge>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {item.codes.map((code) => (
                        <Badge key={code} variant="outline">
                          {code}
                        </Badge>
                      ))}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Pagination previousHref={previousHref} nextHref={nextHref} />
      </PageShell>
    );
  }

  return (
    <PageShell width="wide">
      <BackButton fallbackHref="/academic/courses" label="Back to Courses" />
      <PageHeader
        title={newCourse ? 'New Course' : displayedCourse.title || 'Course'}
        description={
          schema?.note ??
          'Course data is validated before a GitHub pull request is opened.'
        }
        icon={<BookOpen className="text-muted-foreground size-6" />}
        action={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() =>
                void (courseId ? loadCourse(courseId) : loadCoursePage())
              }
            >
              <RefreshCw data-icon="inline-start" />
              Refresh
            </Button>
            {canEdit ? (
              <Button
                disabled={saving}
                onClick={() => {
                  const nextCourse =
                    editorMode === 'json-edit' ? parseJsonEditor() : course;
                  if (nextCourse) void saveCourse(nextCourse);
                }}
              >
                <Save data-icon="inline-start" />
                Save
              </Button>
            ) : null}
          </div>
        }
      />

      {pr ? (
        <div className="flex flex-wrap items-center gap-2">
          <Badge className={prBadgeClass(pr.status)} variant="outline">
            {enumLabel(pr.status)}
          </Badge>
          {pr.url ? (
            <Button asChild variant="outline" size="sm">
              <a href={pr.url} target="_blank" rel="noreferrer">
                PR #{pr.number}
              </a>
            </Button>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <CardTitle>Course</CardTitle>
                  <CardDescription>
                    Stable catalog identity and valid course codes.
                  </CardDescription>
                </div>
                <EditorViewControls<CourseTab>
                  className="md:w-[24rem]"
                  sourceValue={
                    !newCourse && publishedCourse ? activeTab : undefined
                  }
                  sourceOptions={[
                    {
                      value: 'draft',
                      label: pr?.draftRecord ? 'Draft PR' : 'Editor',
                    },
                    { value: 'published', label: 'Published' },
                  ]}
                  onSourceChange={handleCourseTabChange}
                  modeValue={editorMode as EditorModeValue}
                  onModeChange={(value) => setEditorMode(value as EditorMode)}
                  disableJsonEdit={!canEdit || activeTab === 'published'}
                />
              </div>
            </CardHeader>
            <CardContent>
              {editorMode === 'json-view' ? (
                <JsonPreview value={displayedCourse} />
              ) : editorMode === 'json-edit' ? (
                <JsonEditor
                  value={jsonText}
                  onChange={setJsonText}
                  readOnly={!canEdit || activeTab === 'published'}
                  minHeight="420px"
                  height="min(58vh, 680px)"
                />
              ) : (
                <CourseForm
                  course={displayedCourse}
                  readOnly={!canEdit || activeTab === 'published'}
                  onChange={setEditableCourse}
                />
              )}
            </CardContent>
          </Card>

          {!newCourse ? (
            <Card>
              <CardHeader>
                <CardTitle>Offerings</CardTitle>
                <CardDescription>
                  Year and semester instances for this course.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {courseOfferings.length === 0 ? (
                  <div className="text-muted-foreground rounded-md border p-4 text-sm">
                    No offerings are published for this course yet.
                  </div>
                ) : (
                  courseOfferings.map((offering) => (
                    <OfferingForm
                      key={offering.id}
                      offering={offering}
                      readOnly={!canEdit}
                      onSave={(nextOffering) => void saveOffering(nextOffering)}
                    />
                  ))
                )}
                {canEdit && activeTab === 'draft' ? (
                  <>
                    <Separator />
                    <OfferingForm
                      offering={emptyOffering(course)}
                      createMode
                      readOnly={!canEdit}
                      onSave={(nextOffering) => void saveOffering(nextOffering)}
                    />
                  </>
                ) : null}
              </CardContent>
            </Card>
          ) : null}
        </div>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Registry</CardTitle>
            <CardDescription>
              Course editing access and actions.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <p className="text-sm font-medium">Access</p>
              <Badge variant={canEdit ? 'secondary' : 'outline'}>
                {canEdit ? 'Can edit courses' : 'View only'}
              </Badge>
            </div>
            <Separator />
            <div className="space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Primary code</span>
                <span>{displayedCourse.primaryCode}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Credits</span>
                <span>{displayedCourse.credits}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Offerings</span>
                <span>{courseOfferings.length}</span>
              </div>
            </div>
            {!newCourse && canEdit ? (
              <>
                <Separator />
                <Button
                  variant="destructive"
                  className="w-full"
                  disabled={saving}
                  onClick={() => void deleteCourse()}
                >
                  <Trash2 data-icon="inline-start" />
                  Remove Course
                </Button>
              </>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </PageShell>
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
    <Field className="md:col-span-2">
      <FieldLabel>Departments</FieldLabel>
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
    </Field>
  );
}

function CourseForm({
  course,
  readOnly,
  onChange,
}: {
  course: CourseRecord;
  readOnly: boolean;
  onChange: (course: CourseRecord) => void;
}) {
  const [codeDraft, setCodeDraft] = useState('');

  function setField<K extends keyof CourseRecord>(
    field: K,
    value: CourseRecord[K]
  ) {
    onChange({ ...course, [field]: value });
  }

  function addCode() {
    const normalized = normalizeCourseCode(codeDraft);
    if (!normalized) {
      toast.error('Use a valid course code.');
      return;
    }
    if (course.codes.includes(normalized)) {
      toast.error('Course code already exists.');
      setCodeDraft('');
      return;
    }
    setField('codes', uniqueCourseCodes([...course.codes, normalized]));
    setCodeDraft('');
  }

  function removeCode(code: string) {
    if (code === course.primaryCode) {
      toast.error('Primary code cannot be removed.');
      return;
    }
    setField(
      'codes',
      course.codes.filter((item) => item !== code)
    );
  }

  return (
    <FieldGroup className="grid gap-4 md:grid-cols-2">
      <Field>
        <FieldLabel htmlFor="course-id">Course ID</FieldLabel>
        <Input
          id="course-id"
          value={course.id}
          readOnly={readOnly}
          onChange={(event) => setField('id', slugify(event.target.value))}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor="course-primary-code">Primary Code</FieldLabel>
        <Input
          id="course-primary-code"
          value={course.primaryCode}
          readOnly={readOnly}
          placeholder="CSC3213"
          onChange={(event) => {
            const primaryCode = normalizeCourseCode(event.target.value);
            onChange({
              ...course,
              primaryCode,
              codes: uniqueCourseCodes([...course.codes, primaryCode]),
            });
          }}
        />
      </Field>
      <Field className="md:col-span-2">
        <FieldLabel htmlFor="course-title">Title</FieldLabel>
        <Input
          id="course-title"
          value={course.title}
          readOnly={readOnly}
          onChange={(event) => setField('title', event.target.value)}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor="course-credits">Credits</FieldLabel>
        <Select
          value={String(course.credits)}
          disabled={readOnly}
          onValueChange={(value) =>
            setField('credits', Number(value) as 1 | 2 | 3 | 6)
          }
        >
          <SelectTrigger id="course-credits" className="w-full">
            <SelectValue placeholder="Select credits" />
          </SelectTrigger>
          <SelectContent>
            {CREDIT_OPTIONS.map((credits) => (
              <SelectItem key={credits} value={String(credits)}>
                {credits}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field className="md:col-span-2">
        <FieldLabel htmlFor="course-code-draft">
          Additional Course Codes
        </FieldLabel>
        <div className="space-y-2 rounded-md border p-3">
          <div className="flex flex-wrap gap-2">
            {course.codes.length === 0 ? (
              <span className="text-muted-foreground text-sm">
                No course codes added.
              </span>
            ) : (
              course.codes.map((code) => (
                <Badge key={code} variant="outline" className="gap-2">
                  {code}
                  {code === course.primaryCode ? (
                    <span className="text-muted-foreground">Primary</span>
                  ) : !readOnly ? (
                    <button
                      type="button"
                      className="hover:text-destructive"
                      aria-label={`Remove ${code}`}
                      onClick={() => removeCode(code)}
                    >
                      <X className="size-3" />
                    </button>
                  ) : null}
                </Badge>
              ))
            )}
          </div>
          {!readOnly ? (
            <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
              <Input
                id="course-code-draft"
                value={codeDraft}
                placeholder="Enter course code"
                onChange={(event) => setCodeDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    addCode();
                  }
                }}
              />
              <Button
                type="button"
                variant="outline"
                disabled={!codeDraft}
                onClick={addCode}
              >
                <Plus data-icon="inline-start" />
                Add
              </Button>
            </div>
          ) : null}
        </div>
      </Field>
      <DepartmentCheckboxes
        value={course.departments}
        readOnly={readOnly}
        onChange={(departments) => setField('departments', departments)}
      />
    </FieldGroup>
  );
}

function OfferingForm({
  offering,
  readOnly,
  createMode = false,
  onSave,
}: {
  offering: OfferingRecord;
  readOnly: boolean;
  createMode?: boolean;
  onSave: (offering: OfferingRecord) => void;
}) {
  const [draft, setDraft] = useState(offering);
  const staffText = draft.staff
    .map((member) => `${member.staff}:${member.role}`)
    .join(', ');

  function setField<K extends keyof OfferingRecord>(
    field: K,
    value: OfferingRecord[K]
  ) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  return (
    <div className="rounded-md border p-4">
      <FieldGroup className="grid gap-4 md:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="offering-id">Offering ID</FieldLabel>
          <Input
            id="offering-id"
            value={draft.id}
            readOnly={readOnly}
            onChange={(event) => setField('id', slugify(event.target.value))}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="offering-academic-year">
            Academic Year
          </FieldLabel>
          <Input
            id="offering-academic-year"
            value={draft.academicYear}
            readOnly={readOnly}
            onChange={(event) => setField('academicYear', event.target.value)}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="offering-semester">Semester</FieldLabel>
          <Select
            value={draft.semester}
            disabled={readOnly}
            onValueChange={(value) =>
              setField('semester', value as 'SEM1' | 'SEM2')
            }
          >
            <SelectTrigger id="offering-semester" className="w-full">
              <SelectValue placeholder="Select semester" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="SEM1">Semester 1</SelectItem>
              <SelectItem value="SEM2">Semester 2</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field>
          <FieldLabel htmlFor="offering-staff">Staff</FieldLabel>
          <Input
            id="offering-staff"
            value={staffText}
            readOnly={readOnly}
            placeholder="username:LECTURER, username:INSTRUCTOR"
            onChange={(event) =>
              setField(
                'staff',
                event.target.value
                  .split(',')
                  .map((item) => {
                    const [staff, role] = item
                      .split(':')
                      .map((part) => part.trim());
                    if (!staff) return null;
                    return {
                      staff,
                      role: STAFF_ROLES.includes(
                        role as (typeof STAFF_ROLES)[number]
                      )
                        ? (role as (typeof STAFF_ROLES)[number])
                        : 'LECTURER',
                    };
                  })
                  .filter((item): item is OfferingRecord['staff'][number] =>
                    Boolean(item)
                  )
              )
            }
          />
        </Field>
      </FieldGroup>
      {!readOnly ? (
        <div className="mt-4 flex justify-end">
          <Button size="sm" onClick={() => onSave(draft)}>
            <Save data-icon="inline-start" />
            {createMode ? 'Add Offering' : 'Save Offering'}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
