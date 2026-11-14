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
import { PageHeader, PageShell } from '@/components/layout/page-shell';
import {
  playgroundDefinitions,
  type PlaygroundKind,
  playgroundPublicPath,
  playgroundRecord,
  playgroundRelatedFiles,
  playgroundTarget,
} from '@/components/playground/playground-data';
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
  >(() =>
    createEditorState({ ...playgroundDefinitions.student.initial }, null)
  );
  const [identifier, setIdentifier] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [courses, setCourses] = useState<CourseCatalogRecord[]>([]);
  const [offerings, setOfferings] = useState<CourseOfferingRecord[]>([]);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  const draft = editorState.draft;
  const validation = playgroundRecord(kind, draft);
  const target = playgroundTarget(kind, draft);
  const relatedFiles = playgroundRelatedFiles(kind, draft);
  const canCopy = Boolean(
    target && validation.success && !editorState.json.dirty
  );
  const recordText = validation.success
    ? `${JSON.stringify(validation.data, null, 2)}\n`
    : '';

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
    setEditorState(
      createEditorState({ ...playgroundDefinitions[next].initial }, null)
    );
    setIdentifier('');
    setLoadError(null);
  }

  function startBlank() {
    setEditorState(
      createEditorState({ ...playgroundDefinitions[kind].initial }, null)
    );
    setIdentifier('');
    setLoadError(null);
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
          <EditorWorkspace
            state={editorState}
            onStateChange={setEditorState}
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>File to change</CardTitle>
          <CardDescription>
            Create or replace this authoritative JSON file in the public data
            repository.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <code className="bg-muted rounded-md px-3 py-2 text-sm break-all">
            {target ?? 'Complete the record identifier to see the path'}
          </code>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!target}
            onClick={() => {
              if (target) void copy(target, 'File path');
            }}
          >
            <Copy data-icon="inline-start" />
            Copy path
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Related generated files</CardTitle>
          <CardDescription>
            Run <code>bun run generate</code> in the data repository and include
            the changed projections in the pull request.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <ul className="flex flex-col gap-2">
            {relatedFiles.map((file) => (
              <li key={file} className="flex flex-wrap items-center gap-2">
                <code
                  className="bg-muted rounded-md px-2 py-1 text-sm break-all"
                >
                  {file}
                </code>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label={`Copy ${file}`}
                  onClick={() => void copy(file, 'Related path')}
                >
                  <Copy data-icon="inline-start" />
                  Copy
                </Button>
              </li>
            ))}
          </ul>
          {kind === 'student' ? (
            <p className="text-muted-foreground text-sm">
              Existing special-programme files under{' '}
              <code>public/people/v2/special/</code> may also be refreshed.
              Membership is not available from this form.
            </p>
          ) : null}
          {kind === 'project' ? (
            <p className="text-muted-foreground text-sm">
              For an existing project, removed people may have old{' '}
              <code>by-person</code> files updated or removed.
            </p>
          ) : null}
          {kind === 'course' || kind === 'offering' ? (
            <p className="text-muted-foreground text-sm">
              If IDs or references change, review related projects and offerings
              in the repository.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Validate and copy</CardTitle>
          <CardDescription>
            Validated against the shared schema bundled with this Portal build.
            Compare an existing file before replacing it.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {canCopy ? (
            <p className="text-sm">Record is valid and ready to copy.</p>
          ) : (
            <div role="status" className="text-sm">
              <p>
                Complete the required fields and apply any Advanced JSON edits
                before copying.
              </p>
              <ul className="mt-2 list-inside list-disc">
                {!target ? <li>Enter a valid file identifier.</li> : null}
                {!validation.success
                  ? validation.error.issues.slice(0, 8).map((issue, index) => (
                      <li key={`${issue.path.join('.')}-${index}`}>
                        {issue.path.join('.') || 'Record'}: {issue.message}
                      </li>
                    ))
                  : null}
              </ul>
            </div>
          )}
          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              disabled={!canCopy}
              onClick={() => {
                if (canCopy) void copy(recordText, 'JSON record');
              }}
            >
              <Copy data-icon="inline-start" />
              Copy JSON record
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={!canCopy || !target}
              onClick={() => {
                if (canCopy && target)
                  void copy(`${target}\n\n${recordText}`, 'Path and JSON');
              }}
            >
              Copy path and JSON
            </Button>
          </div>
          <p className="text-muted-foreground text-sm">
            Open a pull request in the{' '}
            <Link
              className="underline"
              href="https://github.com/csc3213-2026-group-b/data.scs.pdn.ac.lk"
            >
              public data repository
            </Link>
            , edit the path shown above, and run its validation checks.
          </p>
        </CardContent>
      </Card>
    </PageShell>
  );
}
