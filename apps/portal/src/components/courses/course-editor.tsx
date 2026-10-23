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
import { BookOpen, Plus, RefreshCw, Save, Trash2, X } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { CourseList } from '@/components/courses/course-list';
import {
  type CourseRecord,
  CourseReview,
} from '@/components/courses/course-review';
import { CourseCodesSection } from '@/components/courses/sections/course-codes-section';
import { CourseDepartmentsSection } from '@/components/courses/sections/course-departments-section';
import { CourseDetailsSection } from '@/components/courses/sections/course-details-section';
import { CourseOfferingsSection } from '@/components/courses/sections/course-offerings-section';
import {
  createEditorState,
  type EditorRecordStatus,
  type EditorState,
} from '@/components/editor/editor-state';
import { EditorWorkspace } from '@/components/editor/editor-workspace';
import { PageLoading } from '@/components/feedback/page-loading';
import { PageHeader, PageShell } from '@/components/layout/page-shell';
import { BackButton } from '@/components/navigation/back-button';
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

interface CourseEditorProps {
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

const COURSE_EDITOR_SECTIONS = [
  { id: 'course-details', label: 'Details' },
  { id: 'course-codes', label: 'Codes' },
  { id: 'course-departments', label: 'Departments' },
  { id: 'course-offerings', label: 'Offerings' },
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

function validateCourseDraft(value: unknown) {
  const course = courseFromRecord(value);
  if (!course) {
    return {
      success: false as const,
      issues: [
        {
          field: 'course-details',
          message: 'Course JSON must match the course catalog fields.',
        },
      ],
    };
  }

  const normalizedCodes = uniqueCourseCodes(course.codes);
  if (normalizedCodes.length !== course.codes.length) {
    return {
      success: false as const,
      issues: [
        {
          field: 'course-codes',
          message: 'Course codes must be valid and cannot contain duplicates.',
        },
      ],
    };
  }
  if (!normalizedCodes.includes(normalizeCourseCode(course.primaryCode))) {
    return {
      success: false as const,
      issues: [
        {
          field: 'course-codes',
          message: 'The primary code must also appear in the course code list.',
        },
      ],
    };
  }

  return { success: true as const, data: course };
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

export default function CourseEditor({
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
}: CourseEditorProps) {
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
  const [editorState, setEditorState] = useState<EditorState<CourseRecord>>(
    () =>
      createEditorState(
        initialDraftCourse ?? initialPublishedCourse ?? emptyCourse(),
        initialPublishedCourse
      )
  );
  const course = editorState.draft;
  const publishedCourse = editorState.published;
  const [pr, setPr] = useState<AcademicPr | null>(initialPr);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(
    !initialUser || ((Boolean(courseId) || newCourse) && !initialSchema)
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canEdit =
    Boolean(schema?.canEditCourses) || canEditCoursesRole(user ?? {});
  const isWorkspace = Boolean(courseId) || newCourse;
  const courseOfferings = offerings.filter(
    (offering) => offering.courseId === course.id
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
  const editorStatus: EditorRecordStatus = saving
    ? 'submitting'
    : newCourse
      ? 'new'
      : pr?.status === 'open'
        ? 'draft'
        : publishedCourse
          ? 'published'
          : 'draft';

  function rejectCourse(field: string, message: string) {
    setEditorState((current) => ({
      ...current,
      validationIssues: [{ field, message }],
    }));
    toast.error(message);
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
    setEditorState(createEditorState(nextCourse, published));
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
                setEditorState(createEditorState(nextCourse, null));
                setPr(null);
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
  }, [courseId, initialSchema, initialUser, newCourse]);

  async function saveCourse(nextCourse = course) {
    if (!canEdit) {
      toast.error('Only academic users and super admins can edit courses.');
      return;
    }

    const normalizedId = slugify(nextCourse.id);
    if (!normalizedId) {
      rejectCourse('course-details', 'Course id is required.');
      return;
    }
    if (courseId && normalizedId !== slugify(courseId)) {
      rejectCourse(
        'course-details',
        'Course id must match the selected course.'
      );
      return;
    }
    const normalizedPrimaryCode = normalizeCourseCode(nextCourse.primaryCode);
    const normalizedCodes = uniqueCourseCodes(nextCourse.codes);
    if (normalizedCodes.length !== nextCourse.codes.length) {
      rejectCourse(
        'course-codes',
        'Course codes must be valid and cannot contain duplicates.'
      );
      return;
    }
    if (!normalizedCodes.includes(normalizedPrimaryCode)) {
      rejectCourse(
        'course-codes',
        'Primary code must be listed in course codes.'
      );
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
      setEditorState((current) =>
        createEditorState(validatedCourse, current.published)
      );
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

        <CourseList
          courses={filteredCourses}
          query={query}
          onQueryChange={setQuery}
          previousHref={previousHref}
          nextHref={nextHref}
        />
      </PageShell>
    );
  }

  return (
    <PageShell width="wide">
      <BackButton fallbackHref="/academic/courses" label="Back to Courses" />
      <PageHeader
        title={newCourse ? 'New Course' : course.title || 'Course'}
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
            <CardContent className="pt-6">
              <EditorWorkspace
                state={editorState}
                onStateChange={setEditorState}
                title={
                  newCourse ? 'New course draft' : course.title || 'Course'
                }
                status={editorStatus}
                statusDetail={
                  pr?.status === 'open'
                    ? 'A pull request draft is open.'
                    : publishedCourse
                      ? 'Published data is available for comparison.'
                      : 'This course has not been published yet.'
                }
                sections={COURSE_EDITOR_SECTIONS}
                canEditJson={canEdit}
                canSubmit={canEdit}
                submitting={saving}
                submitLabel="Submit Course Changes"
                validateJson={validateCourseDraft}
                onSubmit={() => void saveCourse(editorState.draft)}
                renderEdit={(draft, onDraftChange) => (
                  <CourseForm
                    course={draft}
                    readOnly={!canEdit}
                    onChange={onDraftChange}
                  />
                )}
                renderReview={(draft, published, onChangeField) => (
                  <CourseReview
                    draft={draft}
                    published={published}
                    offeringCount={courseOfferings.length}
                    onChangeField={onChangeField}
                  />
                )}
              />
            </CardContent>
          </Card>

          {!newCourse ? (
            <CourseOfferingsSection>
              <Card>
                <CardContent className="space-y-4 pt-6">
                  {courseOfferings.length === 0 ? (
                    <div
                      className="text-muted-foreground rounded-md border p-4
                        text-sm"
                    >
                      No offerings are published for this course yet.
                    </div>
                  ) : (
                    courseOfferings.map((offering) => (
                      <OfferingForm
                        key={offering.id}
                        offering={offering}
                        readOnly={!canEdit}
                        onSave={(nextOffering) =>
                          void saveOffering(nextOffering)
                        }
                      />
                    ))
                  )}
                  {canEdit ? (
                    <>
                      <Separator />
                      <OfferingForm
                        offering={emptyOffering(course)}
                        createMode
                        readOnly={!canEdit}
                        onSave={(nextOffering) =>
                          void saveOffering(nextOffering)
                        }
                      />
                    </>
                  ) : null}
                </CardContent>
              </Card>
            </CourseOfferingsSection>
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
                <span>{course.primaryCode}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Credits</span>
                <span>{course.credits}</span>
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
    <div className="space-y-8">
      <CourseDetailsSection>
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
        </FieldGroup>
      </CourseDetailsSection>

      <CourseCodesSection>
        <FieldGroup className="grid gap-4">
          <Field>
            <FieldLabel htmlFor="course-primary-code">Primary Code</FieldLabel>
            <Select
              value={course.primaryCode}
              disabled={readOnly || course.codes.length === 0}
              onValueChange={(primaryCode) =>
                setField('primaryCode', primaryCode)
              }
            >
              <SelectTrigger id="course-primary-code" className="w-full">
                <SelectValue placeholder="Add a course code first" />
              </SelectTrigger>
              <SelectContent>
                {course.codes.map((code) => (
                  <SelectItem key={code} value={code}>
                    {code}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field>
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
                    Add code
                  </Button>
                </div>
              ) : null}
            </div>
          </Field>
        </FieldGroup>
      </CourseCodesSection>

      <CourseDepartmentsSection>
        <DepartmentCheckboxes
          value={course.departments}
          readOnly={readOnly}
          onChange={(departments) => setField('departments', departments)}
        />
      </CourseDepartmentsSection>
    </div>
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
  const formId = useId();

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
          <FieldLabel htmlFor={`${formId}-id`}>Offering ID</FieldLabel>
          <Input
            id={`${formId}-id`}
            value={draft.id}
            readOnly={readOnly}
            onChange={(event) => setField('id', slugify(event.target.value))}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor={`${formId}-academic-year`}>
            Academic Year
          </FieldLabel>
          <Input
            id={`${formId}-academic-year`}
            value={draft.academicYear}
            readOnly={readOnly}
            onChange={(event) => setField('academicYear', event.target.value)}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor={`${formId}-semester`}>Semester</FieldLabel>
          <Select
            value={draft.semester}
            disabled={readOnly}
            onValueChange={(value) =>
              setField('semester', value as 'SEM1' | 'SEM2')
            }
          >
            <SelectTrigger id={`${formId}-semester`} className="w-full">
              <SelectValue placeholder="Select semester" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="SEM1">Semester 1</SelectItem>
              <SelectItem value="SEM2">Semester 2</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field className="md:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <FieldLabel>Teaching staff</FieldLabel>
            {!readOnly ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setField('staff', [
                    ...draft.staff,
                    { staff: '', role: 'LECTURER' },
                  ])
                }
              >
                <Plus data-icon="inline-start" />
                Add staff member
              </Button>
            ) : null}
          </div>
          {draft.staff.length === 0 ? (
            <p className="text-muted-foreground rounded-md border p-3 text-sm">
              No teaching staff assigned.
            </p>
          ) : (
            <div className="space-y-2">
              {draft.staff.map((member, index) => (
                <div
                  key={`${member.staff}-${index}`}
                  className="grid gap-2 rounded-md border p-3
                    sm:grid-cols-[minmax(0,1fr)_minmax(12rem,0.6fr)_auto]"
                >
                  <div className="space-y-1.5">
                    <FieldLabel htmlFor={`${formId}-staff-${index}`}>
                      Username
                    </FieldLabel>
                    <Input
                      id={`${formId}-staff-${index}`}
                      value={member.staff}
                      readOnly={readOnly}
                      placeholder="Academic username"
                      onChange={(event) => {
                        const staff = draft.staff.map((entry, entryIndex) =>
                          entryIndex === index
                            ? { ...entry, staff: event.target.value.trim() }
                            : entry
                        );
                        setField('staff', staff);
                      }}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <FieldLabel htmlFor={`${formId}-role-${index}`}>
                      Role
                    </FieldLabel>
                    <Select
                      value={member.role}
                      disabled={readOnly}
                      onValueChange={(role) => {
                        const staff = draft.staff.map((entry, entryIndex) =>
                          entryIndex === index
                            ? {
                                ...entry,
                                role: role as OfferingRecord['staff'][number]['role'],
                              }
                            : entry
                        );
                        setField('staff', staff);
                      }}
                    >
                      <SelectTrigger
                        id={`${formId}-role-${index}`}
                        className="w-full"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STAFF_ROLES.map((role) => (
                          <SelectItem key={role} value={role}>
                            {enumLabel(role)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {!readOnly ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="self-end"
                      aria-label={`Remove staff member ${index + 1}`}
                      onClick={() =>
                        setField(
                          'staff',
                          draft.staff.filter(
                            (_, entryIndex) => entryIndex !== index
                          )
                        )
                      }
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </Field>
      </FieldGroup>
      {!readOnly ? (
        <div className="mt-4 flex justify-end">
          <Button
            size="sm"
            onClick={() =>
              onSave({
                ...draft,
                staff: draft.staff
                  .filter((member) => member.staff.trim())
                  .map((member) => ({
                    ...member,
                    staff: member.staff.trim(),
                  })),
              })
            }
          >
            <Save data-icon="inline-start" />
            {createMode ? 'Add Course Offering' : 'Submit Offering Changes'}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
