'use client';

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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@scs/ui/components/tabs';
import { Copy } from 'lucide-react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';

import { PageHeader, PageShell } from '@/components/layout/page-shell';
import {
  playgroundDefinitions,
  type PlaygroundField,
  type PlaygroundKind,
  playgroundRecord,
  playgroundRelatedFiles,
  playgroundTarget,
} from '@/components/playground/playground-data';

const JsonEditor = dynamic(
  () =>
    import('@/components/editor/json-editor').then(
      (module) => module.JsonEditor
    ),
  {
    ssr: false,
    loading: () => <div className="bg-muted/40 min-h-96 rounded-md border" />,
  }
);
const JsonPreview = dynamic(
  () =>
    import('@/components/editor/json-preview').then(
      (module) => module.JsonPreview
    ),
  {
    ssr: false,
    loading: () => <div className="bg-muted/40 min-h-72 rounded-md border" />,
  }
);

const kinds = Object.keys(playgroundDefinitions) as PlaygroundKind[];
type View = 'form' | 'json';

function formatFieldValue(field: PlaygroundField, value: unknown) {
  if (field.kind === 'json')
    return value === undefined ? '' : JSON.stringify(value, null, 2);
  return value === undefined ? '' : String(value);
}

function issueText(issues: { path: PropertyKey[]; message: string }[]) {
  return issues.map(
    (issue) => `${issue.path.join('.') || 'Record'}: ${issue.message}`
  );
}

export function PublicDataPlayground() {
  const [kind, setKind] = useState<PlaygroundKind>('student');
  const [view, setView] = useState<View>('form');
  const [draft, setDraft] = useState<Record<string, unknown>>({
    ...playgroundDefinitions.student.initial,
  });
  const [fieldText, setFieldText] = useState<Record<string, string>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [jsonText, setJsonText] = useState('');
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [jsonIssues, setJsonIssues] = useState<string[]>([]);
  const [editingJson, setEditingJson] = useState(false);
  const [pendingForm, setPendingForm] = useState(false);

  const definition = playgroundDefinitions[kind];
  const result = playgroundRecord(kind, draft);
  const target = playgroundTarget(kind, draft);
  const relatedFiles = playgroundRelatedFiles(kind, draft);
  const errors = result.success ? [] : issueText(result.error.issues);
  const canCopy = Boolean(
    target &&
    result.success &&
    !(editingJson && jsonText !== JSON.stringify(draft, null, 2)) &&
    Object.keys(fieldErrors).length === 0
  );
  const recordText = result.success
    ? `${JSON.stringify(result.data, null, 2)}\n`
    : '';

  function changeKind(next: PlaygroundKind) {
    if (editingJson && jsonText !== JSON.stringify(draft, null, 2)) {
      toast.error(
        'Apply or discard your JSON edits before changing record type.'
      );
      return;
    }
    setKind(next);
    setView('form');
    setDraft({ ...playgroundDefinitions[next].initial });
    setFieldText({});
    setFieldErrors({});
    setJsonText('');
    setJsonError(null);
    setJsonIssues([]);
    setEditingJson(false);
    setPendingForm(false);
  }

  function changeField(field: PlaygroundField, text: string) {
    if (field.kind === 'json') {
      setFieldText((previous) => ({ ...previous, [field.key]: text }));
      if (text.trim() === '') {
        setFieldErrors((previous) => {
          const next = { ...previous };
          delete next[field.key];
          return next;
        });
        setDraft((previous) => {
          const next = { ...previous };
          delete next[field.key];
          return next;
        });
        return;
      }
      try {
        const value: unknown = JSON.parse(text);
        setDraft((previous) => ({ ...previous, [field.key]: value }));
        setFieldErrors((previous) => {
          const next = { ...previous };
          delete next[field.key];
          return next;
        });
      } catch {
        setFieldErrors((previous) => ({
          ...previous,
          [field.key]: 'Enter valid JSON for this field.',
        }));
      }
      return;
    }
    setDraft((previous) => {
      const next = { ...previous };
      if (text === '' && field.key !== 'fullName' && field.key !== 'title')
        delete next[field.key];
      else next[field.key] = field.kind === 'number' ? Number(text) : text;
      return next;
    });
  }

  function changeView(next: View) {
    if (next === 'json') {
      if (Object.keys(fieldErrors).length) {
        toast.error('Fix the JSON in the form fields first.');
        return;
      }
      setJsonText(JSON.stringify(draft, null, 2));
      setJsonError(null);
      setJsonIssues([]);
      setEditingJson(false);
      setPendingForm(false);
      setView('json');
      return;
    }
    if (editingJson && jsonText !== JSON.stringify(draft, null, 2)) {
      setPendingForm(true);
      return;
    }
    setView('form');
  }

  function applyJson() {
    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      setJsonError('The JSON is not valid. Fix the syntax before applying it.');
      setJsonIssues([]);
      return;
    }
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      Array.isArray(parsed)
    ) {
      setJsonError('JSON must contain one record object.');
      setJsonIssues([]);
      return;
    }
    const validation = playgroundRecord(
      kind,
      parsed as Record<string, unknown>
    );
    if (!validation.success) {
      setJsonError(null);
      setJsonIssues(issueText(validation.error.issues));
      return;
    }
    setDraft(validation.data as Record<string, unknown>);
    setJsonText(JSON.stringify(validation.data, null, 2));
    setJsonError(null);
    setJsonIssues([]);
    setFieldText({});
    setFieldErrors({});
    setEditingJson(false);
    if (pendingForm) setView('form');
    setPendingForm(false);
  }

  function discardJson() {
    setJsonText(JSON.stringify(draft, null, 2));
    setJsonError(null);
    setJsonIssues([]);
    setEditingJson(false);
    if (pendingForm) setView('form');
    setPendingForm(false);
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
        description="Build a public record for a manual data repository pull request. Nothing is submitted or saved here."
      />
      <Card>
        <CardHeader>
          <CardTitle>Choose a record</CardTitle>
          <CardDescription>
            Select the public record you want to create or edit.
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
              <FieldDescription>{definition.description}</FieldDescription>
            </Field>
          </FieldGroup>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>File to change</CardTitle>
          <CardDescription>
            Create or replace this authoritative JSON file.
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
            The data repository generator may update these files after the
            authoritative record changes. Run <code>bun run generate</code>{' '}
            there and include the changed projections in the pull request.
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
                  onClick={() => void copy(file, 'Related path')}
                  aria-label={`Copy ${file}`}
                >
                  <Copy data-icon="inline-start" />
                  Copy
                </Button>
              </li>
            ))}
          </ul>
          {kind === 'student' ? (
            <p className="text-muted-foreground text-sm">
              Existing special-programme membership files under{' '}
              <code>public/people/v2/special/</code> may also be refreshed. The
              playground cannot know membership without reading the repository.
            </p>
          ) : null}
          {kind === 'project' ? (
            <p className="text-muted-foreground text-sm">
              For an existing project, removed people may have old{' '}
              <code>by-person</code> files updated or removed too.
            </p>
          ) : null}
          {kind === 'course' || kind === 'offering' ? (
            <p className="text-muted-foreground text-sm">
              If IDs or references change, review related projects and offerings
              in the repository; the playground does not resolve cross-record
              references.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Tabs value={view} onValueChange={(value) => changeView(value as View)}>
        <TabsList aria-label="Playground view">
          <TabsTrigger value="form">Form</TabsTrigger>
          <TabsTrigger value="json">JSON</TabsTrigger>
        </TabsList>
        <TabsContent value="form">
          <Card>
            <CardHeader>
              <CardTitle>{definition.label}</CardTitle>
              <CardDescription>
                Optional fields may be left blank. Structured fields accept JSON
                arrays or objects.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                {definition.fields.map((field) => {
                  const fieldId = `playground-${field.key}`;
                  const value =
                    fieldText[field.key] ??
                    formatFieldValue(field, draft[field.key]);
                  const error =
                    fieldErrors[field.key] ??
                    errors.find((issue) => issue.startsWith(`${field.key}:`));
                  return (
                    <Field key={field.key} data-invalid={Boolean(error)}>
                      <FieldLabel htmlFor={fieldId}>{field.label}</FieldLabel>
                      {field.options ? (
                        <Select
                          value={value || null}
                          onValueChange={(next) =>
                            changeField(field, next ?? '')
                          }
                        >
                          <SelectTrigger
                            id={fieldId}
                            className="w-full"
                            aria-invalid={Boolean(error)}
                          >
                            <SelectValue placeholder="Select a value" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectGroup>
                              {field.options.map((option) => (
                                <SelectItem key={option} value={option}>
                                  {option}
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                      ) : field.kind === 'json' || field.kind === 'textarea' ? (
                        <textarea
                          id={fieldId}
                          value={value}
                          onChange={(event) =>
                            changeField(field, event.target.value)
                          }
                          aria-invalid={Boolean(error)}
                          rows={field.kind === 'json' ? 5 : 3}
                          className="border-input bg-background
                            focus-visible:ring-ring/50
                            aria-invalid:border-destructive min-h-20 w-full
                            rounded-md border px-3 py-2 font-mono text-sm
                            shadow-xs focus-visible:ring-3
                            focus-visible:outline-none"
                        />
                      ) : (
                        <Input
                          id={fieldId}
                          type={field.kind === 'number' ? 'number' : 'text'}
                          value={value}
                          onChange={(event) =>
                            changeField(field, event.target.value)
                          }
                          aria-invalid={Boolean(error)}
                        />
                      )}
                      {field.hint ? (
                        <FieldDescription>{field.hint}</FieldDescription>
                      ) : null}
                      {error ? (
                        <FieldDescription>{error}</FieldDescription>
                      ) : null}
                    </Field>
                  );
                })}
              </FieldGroup>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="json">
          <Card>
            <CardHeader>
              <CardTitle>Advanced JSON</CardTitle>
              <CardDescription>
                View the same draft as structured data. Apply valid edits before
                returning to the form or copying.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {!editingJson ? (
                <div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setEditingJson(true)}
                  >
                    Edit JSON
                  </Button>
                </div>
              ) : null}
              {jsonError ? (
                <p role="alert" className="text-destructive mt-2 text-sm">
                  {jsonError}
                </p>
              ) : null}
              {jsonIssues.length ? (
                <div role="alert" className="text-destructive text-sm">
                  <p>The JSON does not match this record:</p>
                  <ul className="mt-2 list-inside list-disc">
                    {jsonIssues.map((issue, index) => (
                      <li key={`${issue}-${index}`}>{issue}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {editingJson ? (
                <JsonEditor
                  value={jsonText}
                  onChange={(text) => {
                    setJsonText(text);
                    setJsonError(null);
                    setJsonIssues([]);
                  }}
                />
              ) : (
                <JsonPreview
                  value={
                    result.success &&
                    typeof result.data === 'object' &&
                    result.data !== null
                      ? result.data
                      : draft
                  }
                  enableClipboard
                  monospace
                />
              )}
              {editingJson ? (
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    onClick={applyJson}
                    disabled={jsonText === JSON.stringify(draft, null, 2)}
                  >
                    Apply JSON
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={discardJson}
                    disabled={jsonText === JSON.stringify(draft, null, 2)}
                  >
                    Discard changes
                  </Button>
                  {pendingForm ? (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setPendingForm(false)}
                    >
                      Stay here
                    </Button>
                  ) : null}
                </div>
              ) : null}
              {pendingForm ? (
                <p className="text-muted-foreground text-sm">
                  Apply or discard your JSON edits before switching to the form.
                </p>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle>Validate and copy</CardTitle>
          <CardDescription>
            Validated against the schema bundled with this Portal build. For an
            existing file, compare with its current content before replacing it.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {canCopy ? (
            <p className="text-sm">Record is valid and ready to copy.</p>
          ) : (
            <div role="status" className="text-sm">
              <p>Complete the required fields to copy a validated record.</p>
              <ul className="mt-2 list-inside list-disc">
                {!target ? <li>Enter a valid file identifier.</li> : null}
                {Object.values(fieldErrors).map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
                {errors.slice(0, 8).map((error, index) => (
                  <li key={`${error}-${index}`}>{error}</li>
                ))}
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
            Generated indexes are refreshed by repository tooling.
          </p>
        </CardContent>
      </Card>
    </PageShell>
  );
}
