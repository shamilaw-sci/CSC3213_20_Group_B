'use client';

import { CourseOfferingSchema, CourseSchema } from '@scs/schemas';
import { Button } from '@scs/ui/components/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@scs/ui/components/card';
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from '@scs/ui/components/field';
import { Input } from '@scs/ui/components/input';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@scs/ui/components/select';
import { Copy, RefreshCw } from 'lucide-react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import type { OfferingRecord } from '@/components/courses/course-editor';
import type { CourseRecord } from '@/components/courses/course-review';
import { CourseReview } from '@/components/courses/course-review';
import {
  createEditorState,
  type EditorState,
  type EditorValidator,
} from '@/components/editor/editor-state';
import { EditorWorkspace } from '@/components/editor/editor-workspace';
import { FieldValidationProvider } from '@/components/editor/field-validation';
import { PageHeader, PageShell } from '@/components/layout/page-shell';
import {
  playgroundDefinitions,
  playgroundInitial,
  type PlaygroundKind,
  playgroundPublicPath,
  playgroundRecord,
  playgroundRelatedFiles,
  playgroundTarget,
} from '@/components/playground/playground-data';
import {
  type PlaygroundFile,
  preparePlaygroundFiles,
} from '@/components/playground/playground-files';
import { playgroundValidationIssues } from '@/components/playground/playground-validation';
import type { ProfileRecord } from '@/components/profiles/profile-types';
import { PublicProfileReview } from '@/components/profiles/public-profile-review';
import type {
  CourseCatalogRecord,
  CourseOfferingRecord,
} from '@/components/projects/project-editor';
import { ProjectReview } from '@/components/projects/project-review';
import publicEnvConfig from '@/config/public.env.config';

const ProfileForm = dynamic(
  () =>
    import('@/components/profiles/public-profile-editor').then(
      (module) => module.ProfileForm
    ),
  { ssr: false }
);
const ProjectForm = dynamic(
  () =>
    import('@/components/projects/project-editor').then(
      (module) => module.ProjectForm
    ),
  { ssr: false }
);
const CourseForm = dynamic(
  () =>
    import('@/components/courses/course-editor').then(
      (module) => module.CourseForm
    ),
  { ssr: false }
);
const OfferingForm = dynamic(
  () =>
    import('@/components/courses/course-editor').then(
      (module) => module.OfferingForm
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

const kinds = Object.keys(playgroundDefinitions) as PlaygroundKind[];
const profileKinds = [
  'student',
  'academic',
  'academic-support',
  'non-academic',
] as const;
const profileSections = [
  { id: 'profile-about', label: 'About you' },
  { id: 'profile-role', label: 'Role and affiliation' },
  { id: 'profile-work', label: 'Work and studies' },
  { id: 'profile-links', label: 'Links' },
] as const;
const projectSections = [
  { id: 'project-title', label: 'Basics' },
  { id: 'project-people', label: 'People' },
  { id: 'project-academic', label: 'Academic context' },
  { id: 'project-links', label: 'Links' },
  { id: 'project-source', label: 'Source' },
] as const;
const courseSections = [
  { id: 'course-details', label: 'Details' },
  { id: 'course-codes', label: 'Codes' },
  { id: 'course-departments', label: 'Departments' },
] as const;

function isProfileKind(
  kind: PlaygroundKind
): kind is (typeof profileKinds)[number] {
  return profileKinds.some((profileKind) => profileKind === kind);
}

function validateDraft(
  kind: PlaygroundKind
): EditorValidator<Record<string, unknown>> {
  return (value) => {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return {
        success: false,
        issues: [
          {
            field: 'editor-title',
            message: 'JSON must contain one record object.',
          },
        ],
      };
    }
    const result = playgroundRecord(kind, value as Record<string, unknown>);
    if (!result.success) {
      return {
        success: false,
        issues: result.error.issues.map((issue) => ({
          field: 'editor-title',
          message: `${issue.path.join('.') || 'Record'}: ${issue.message}`,
        })),
      };
    }
    return { success: true, data: result.data as Record<string, unknown> };
  };
}

export function PublicDataPlayground() {
  const [kind, setKind] = useState<PlaygroundKind>('student');
  const [editorState, setEditorState] = useState<
    EditorState<Record<string, unknown>>
  >(() => createEditorState(playgroundInitial('student'), null));
  const [identifier, setIdentifier] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [courses, setCourses] = useState<CourseCatalogRecord[]>([]);
  const [offerings, setOfferings] = useState<CourseOfferingRecord[]>([]);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [preparedFiles, setPreparedFiles] = useState<PlaygroundFile[] | null>(
    null
  );
  const [prepareError, setPrepareError] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [existingRecord, setExistingRecord] = useState<Record<
    string,
    unknown
  > | null>(null);

  const draft = editorState.draft;
  const validation = playgroundRecord(kind, draft);
  const visibleIssues = validation.success
    ? { fields: [], summary: [] }
    : playgroundValidationIssues(kind, validation.error.issues);
  const target = playgroundTarget(kind, draft);
  const relatedFiles = playgroundRelatedFiles(
    kind,
    draft,
    editorState.published
  );
  const canCopy = Boolean(
    target && validation.success && !editorState.json.dirty
  );

  useEffect(() => {
    if (kind !== 'project') return;
    const controller = new AbortController();
    const base = new URL(publicEnvConfig.NEXT_PUBLIC_PEOPLE_DATA_BASE_URL)
      .origin;
    async function loadCatalogs() {
      try {
        const [courseResponse, offeringResponse] = await Promise.all([
          fetch(`${base}/academic/v2/courses.json`, {
            signal: controller.signal,
          }),
          fetch(`${base}/academic/v2/offerings.json`, {
            signal: controller.signal,
          }),
        ]);
        if (!courseResponse.ok || !offeringResponse.ok)
          throw new Error('Public course references are unavailable.');
        const [courseValues, offeringValues]: unknown[] = await Promise.all([
          courseResponse.json(),
          offeringResponse.json(),
        ]);
        const parsedCourses = CourseSchema.array().parse(courseValues);
        const parsedOfferings =
          CourseOfferingSchema.array().parse(offeringValues);
        setCourses(parsedCourses);
        setOfferings(
          parsedOfferings.map((offering) => ({
            ...offering,
            academicYear: String(offering.academicYear),
          }))
        );
        setCatalogError(null);
      } catch (error) {
        if (!controller.signal.aborted)
          setCatalogError(
            error instanceof Error
              ? error.message
              : 'Public course references are unavailable.'
          );
      }
    }
    void loadCatalogs();
    return () => controller.abort();
  }, [kind]);

  function changeKind(next: PlaygroundKind) {
    if (editorState.surface === 'advanced' && editorState.json.dirty) {
      toast.error(
        'Apply or discard your JSON edits before changing record type.'
      );
      return;
    }
    setKind(next);
    setEditorState(createEditorState(playgroundInitial(next), null));
    setIdentifier('');
    setLoadError(null);
    setPreparedFiles(null);
    setExistingRecord(null);
    setPrepareError(null);
  }

  function startBlank() {
    setEditorState(createEditorState(playgroundInitial(kind), null));
    setIdentifier('');
    setLoadError(null);
    setPreparedFiles(null);
    setExistingRecord(null);
    setPrepareError(null);
  }

  async function loadPublished() {
    const path = playgroundPublicPath(kind, identifier);
    if (!path) {
      setLoadError(
        'Enter a valid username, project slug, course ID, or offering ID.'
      );
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      const base = new URL(publicEnvConfig.NEXT_PUBLIC_PEOPLE_DATA_BASE_URL)
        .origin;
      const response = await fetch(`${base}/${path}`, { cache: 'no-store' });
      if (response.status === 404)
        throw new Error('No published record was found for that identifier.');
      if (!response.ok)
        throw new Error(`Published data request failed (${response.status}).`);
      const value: unknown = await response.json();
      const parsed = playgroundRecord(kind, value as Record<string, unknown>);
      if (!parsed.success)
        throw new Error(
          'The published record does not match the selected form schema.'
        );
      const record = parsed.data as Record<string, unknown>;
      if (playgroundTarget(kind, record)?.replace(/^public\//, '') !== path) {
        throw new Error(
          'The record identifier does not match its public file path.'
        );
      }
      setEditorState(createEditorState(record, record));
      setPreparedFiles(null);
      setExistingRecord(null);
      toast.success('Published record loaded into the form.');
    } catch (error) {
      setLoadError(
        error instanceof Error
          ? error.message
          : 'Unable to load published data.'
      );
    } finally {
      setLoading(false);
    }
  }

  async function copy(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copied`);
    } catch {
      toast.error(
        'Clipboard access failed. Select and copy the text manually.'
      );
    }
  }

  async function prepareFiles(comparison: Record<string, unknown> | null) {
    if (!target || !validation.success) return;
    setPreparing(true);
    setPrepareError(null);
    try {
      const base = new URL(publicEnvConfig.NEXT_PUBLIC_PEOPLE_DATA_BASE_URL)
        .origin;
      const related = playgroundRelatedFiles(kind, draft, comparison);
      const files = await preparePlaygroundFiles({
        kind,
        record: validation.data as Record<string, unknown>,
        published: comparison,
        target,
        related,
        base,
      });
      setPreparedFiles(files);
    } catch (error) {
      setPrepareError(
        error instanceof Error ? error.message : 'Could not prepare the files.'
      );
    } finally {
      setPreparing(false);
    }
  }

  async function checkAndPrepare() {
    if (!target || !validation.success) return;
    setPreparing(true);
    setPrepareError(null);
    setPreparedFiles(null);
    try {
      const base = new URL(publicEnvConfig.NEXT_PUBLIC_PEOPLE_DATA_BASE_URL)
        .origin;
      const response = await fetch(
        `${base}/${target.replace(/^public\//, '')}`,
        { cache: 'no-store' }
      );
      if (response.status !== 404 && !response.ok)
        throw new Error(
          `Could not check the existing file (${response.status}).`
        );
      if (response.ok) {
        const value: unknown = await response.json();
        const parsed = playgroundRecord(kind, value as Record<string, unknown>);
        if (!parsed.success)
          throw new Error('The published file does not match this form.');
        const record = parsed.data as Record<string, unknown>;
        if (
          editorState.published &&
          playgroundTarget(
            kind,
            editorState.published as Record<string, unknown>
          ) !== target
        ) {
          throw new Error(
            'Another published record already uses this new file path. Choose a different identifier before preparing files.'
          );
        }
        if (
          editorState.published &&
          JSON.stringify(editorState.published) === JSON.stringify(record)
        ) {
          await prepareFiles(record);
        } else {
          setExistingRecord(record);
        }
      } else {
        setExistingRecord(null);
        await prepareFiles(
          editorState.published as Record<string, unknown> | null
        );
      }
    } catch (error) {
      setPrepareError(
        error instanceof Error
          ? error.message
          : 'Could not check the existing file.'
      );
    } finally {
      setPreparing(false);
    }
  }

  function updatePlaygroundState(next: EditorState<Record<string, unknown>>) {
    if (next.draft !== editorState.draft) {
      setPreparedFiles(null);
      setExistingRecord(null);
      setPrepareError(null);
    }
    setEditorState(next);
  }

  return (
    <PageShell width="wide">
      <PageHeader
        title="Public data playground"
        description="Use the same guided editors as the signed-in Portal. Fill a new record or optionally load published data; nothing is submitted here."
      />
      <Card>
        <CardHeader>
          <CardTitle>Choose a record</CardTitle>
          <CardDescription>
            All form fields can be filled manually. Loading a published record
            is optional.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="playground-kind">Record type</FieldLabel>
              <Select
                value={kind}
                onValueChange={(value) => {
                  if (value) changeKind(value as PlaygroundKind);
                }}
              >
                <SelectTrigger id="playground-kind" className="w-full max-w-md">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {kinds.map((item) => (
                      <SelectItem key={item} value={item}>
                        {playgroundDefinitions[item].label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="playground-identifier">
                Load existing public record (optional)
              </FieldLabel>
              <div className="flex flex-wrap gap-2">
                <Input
                  id="playground-identifier"
                  className="max-w-md"
                  value={identifier}
                  onChange={(event) => setIdentifier(event.target.value)}
                  placeholder={
                    isProfileKind(kind)
                      ? 'Institutional username'
                      : kind === 'project'
                        ? 'Project slug'
                        : `${kind === 'course' ? 'Course' : 'Offering'} ID`
                  }
                />
                <Button
                  type="button"
                  variant="outline"
                  disabled={loading || !identifier.trim()}
                  onClick={() => void loadPublished()}
                >
                  <RefreshCw data-icon="inline-start" />
                  {loading ? 'Loading…' : 'Load published'}
                </Button>
                <Button type="button" variant="ghost" onClick={startBlank}>
                  Start blank
                </Button>
              </div>
              <FieldDescription>
                Loads only the public JSON for this record type. The loaded
                record becomes the comparison in Review changes.
              </FieldDescription>
              {loadError ? (
                <p role="alert" className="text-destructive text-sm">
                  {loadError}
                </p>
              ) : null}
            </Field>
          </FieldGroup>
        </CardContent>
      </Card>

      {kind === 'project' && catalogError ? (
        <p role="alert" className="text-destructive text-sm">
          {catalogError} Course and offering choices may be unavailable.
        </p>
      ) : null}

      <Card>
        <CardContent className="pt-6">
          <FieldValidationProvider issues={visibleIssues.fields}>
            <EditorWorkspace
              state={editorState}
              onStateChange={updatePlaygroundState}
              title={playgroundDefinitions[kind].label}
              status={editorState.published ? 'published' : 'new'}
              statusDetail={
                editorState.published
                  ? 'Published data is available for comparison.'
                  : 'Start with a blank public record.'
              }
              sections={
                isProfileKind(kind)
                  ? profileSections
                  : kind === 'project'
                    ? projectSections
                    : kind === 'course'
                      ? courseSections
                      : []
              }
              canEditJson
              canSubmit={false}
              submitLabel="Copy JSON"
              onSubmit={() => {}}
              validateJson={validateDraft(kind)}
              validationIssues={visibleIssues.summary}
              renderEdit={(value, onChange) => {
                if (isProfileKind(kind))
                  return (
                    <ProfileForm
                      profileKind={kind}
                      profile={value as ProfileRecord}
                      lockedFields={[]}
                      onProfileChange={onChange}
                    />
                  );
                if (kind === 'project')
                  return (
                    <ProjectForm
                      project={value}
                      onChange={onChange}
                      canSubmitAnyProject
                      canEditIdentity
                      isNew={!editorState.published}
                      courses={courses}
                      offerings={offerings}
                      publicMode
                    />
                  );
                if (kind === 'course')
                  return (
                    <CourseForm
                      course={value as unknown as CourseRecord}
                      readOnly={false}
                      onChange={(course) => onChange({ ...course })}
                    />
                  );
                return (
                  <OfferingForm
                    offering={value as unknown as OfferingRecord}
                    readOnly={false}
                    standalone
                    onChange={(offering) => onChange({ ...offering })}
                    onSave={() => {}}
                  />
                );
              }}
              renderReview={(value, published, onChangeField) => {
                if (isProfileKind(kind))
                  return (
                    <PublicProfileReview
                      profileKind={kind}
                      draft={value}
                      published={published}
                      onChangeField={onChangeField}
                    />
                  );
                if (kind === 'project')
                  return (
                    <ProjectReview
                      draft={value}
                      published={published}
                      onChangeField={onChangeField}
                    />
                  );
                if (kind === 'course')
                  return (
                    <CourseReview
                      draft={value as unknown as CourseRecord}
                      published={published as unknown as CourseRecord | null}
                      offeringCount={0}
                      onChangeField={onChangeField}
                    />
                  );
                return (
                  <pre className="bg-muted overflow-auto rounded-md p-4 text-sm">
                    {JSON.stringify(value, null, 2)}
                  </pre>
                );
              }}
            />
          </FieldValidationProvider>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Prepare JSON files</CardTitle>
          <CardDescription>
            Check the published file first, then prepare every known JSON file
            with its path and editing guidance.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <code
            className="bg-muted w-fit rounded-md px-3 py-2 text-sm break-all"
          >
            {target ?? 'Complete the record identifier to see the path'}
          </code>
          {!canCopy ? (
            <div role="status" className="text-sm">
              <p>
                Complete the required fields and apply any Advanced JSON edits
                before preparing files.
              </p>
              <ul className="mt-2 list-inside list-disc">
                {!target ? <li>Enter a valid file identifier.</li> : null}
                {validation.success ? null : (
                  <li>
                    Use the linked errors above the form to find each field.
                  </li>
                )}
              </ul>
            </div>
          ) : null}
          <div>
            <Button
              type="button"
              disabled={!canCopy || preparing}
              onClick={() => void checkAndPrepare()}
            >
              {preparing ? 'Checking files…' : 'Check and prepare files'}
            </Button>
          </div>
          {existingRecord ? (
            <div
              className="border-primary/40 bg-primary/5 space-y-3 rounded-md
                border p-4"
            >
              <p className="font-medium">
                A published record already exists at this path.
              </p>
              <p className="text-sm">
                Load it into the form, or keep what you entered and use the
                published record to show what to replace.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setEditorState(
                      createEditorState(existingRecord, existingRecord)
                    );
                    setExistingRecord(null);
                    setPreparedFiles(null);
                  }}
                >
                  Load published into form
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    const comparison = existingRecord;
                    setEditorState({ ...editorState, published: comparison });
                    setExistingRecord(null);
                    void prepareFiles(comparison);
                  }}
                >
                  Keep my draft and compare
                </Button>
              </div>
            </div>
          ) : null}
          {prepareError ? (
            <p role="alert" className="text-destructive text-sm">
              {prepareError}
            </p>
          ) : null}
          <div className="text-muted-foreground space-y-2 text-sm">
            <p>
              Expected files: one record and {relatedFiles.length} related file
              {relatedFiles.length === 1 ? '' : 's'}.
            </p>
            <p>
              The related JSON uses the currently published collections as a
              starting point. Run <code>bun run generate</code> and{' '}
              <code>bun run check</code> in the data repository before the pull
              request. Other repository changes may alter the final generated
              files.
            </p>
            {kind === 'student' ? (
              <p>
                Special-programme files may also change; the repository
                generator determines their membership.
              </p>
            ) : null}
          </div>
          <p className="text-muted-foreground text-sm">
            Open a pull request in the{' '}
            <Link
              className="underline"
              href="https://github.com/csc3213-2026-group-b/data.scs.pdn.ac.lk"
            >
              public data repository
            </Link>
            , include the generated files, and review the proposed changes.
          </p>
        </CardContent>
      </Card>

      {preparedFiles?.map((file) => (
        <Card key={file.path}>
          <CardHeader>
            <CardTitle className="text-base break-all">{file.path}</CardTitle>
            <CardDescription>
              {file.action === 'create'
                ? 'Add'
                : file.action === 'replace'
                  ? 'Update'
                  : file.action === 'remove'
                    ? 'Remove'
                    : 'No change'}{' '}
              · {file.guidance}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void copy(file.path, 'File path')}
              >
                <Copy data-icon="inline-start" /> Copy path
              </Button>
              {file.value !== null ? (
                <Button
                  type="button"
                  size="sm"
                  onClick={() =>
                    void copy(
                      `${JSON.stringify(file.value, null, 2)}\n`,
                      'JSON file'
                    )
                  }
                >
                  <Copy data-icon="inline-start" /> Copy JSON
                </Button>
              ) : null}
            </div>
            {file.value !== null ? (
              <details open={file.path === target}>
                <summary className="cursor-pointer text-sm font-medium">
                  View JSON
                </summary>
                <div
                  className="mt-3 max-h-96 overflow-auto rounded-md border p-2"
                >
                  <JsonPreview value={file.value} monospace />
                </div>
              </details>
            ) : (
              <p className="text-sm">
                This file should be deleted after its last entry is removed.
              </p>
            )}
          </CardContent>
        </Card>
      ))}
    </PageShell>
  );
}
