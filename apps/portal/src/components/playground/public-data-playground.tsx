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
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';

import { PageHeader, PageShell } from '@/components/layout/page-shell';
import {
  playgroundDefinitions,
  type PlaygroundField,
  type PlaygroundKind,
  playgroundRecord,
  playgroundTarget,
} from '@/components/playground/playground-data';

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

  const definition = playgroundDefinitions[kind];
  let current = draft;
  let syntaxError = jsonError;
  if (view === 'json') {
    try {
      const parsed: unknown = JSON.parse(jsonText);
      if (
        typeof parsed !== 'object' ||
        parsed === null ||
        Array.isArray(parsed)
      ) {
        syntaxError = 'JSON must contain one record object.';
      } else {
        current = {
          ...(parsed as Record<string, unknown>),
          _username: draft._username,
        };
        syntaxError = null;
      }
    } catch {
      syntaxError = 'Enter valid JSON before copying or returning to the form.';
    }
  }
  const result = playgroundRecord(kind, current);
  const target = playgroundTarget(kind, current);
  const errors = result.success ? [] : issueText(result.error.issues);
  const canCopy = Boolean(
    target &&
    result.success &&
    !syntaxError &&
    Object.keys(fieldErrors).length === 0
  );
  const recordText = result.success
    ? `${JSON.stringify(result.data, null, 2)}\n`
    : '';

  function changeKind(next: PlaygroundKind) {
    setKind(next);
    setView('form');
    setDraft({ ...playgroundDefinitions[next].initial });
    setFieldText({});
    setFieldErrors({});
    setJsonText('');
    setJsonError(null);
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
      const { _username, ...record } = draft;
      void _username;
      setJsonText(JSON.stringify(record, null, 2));
      setJsonError(null);
      setView('json');
      return;
    }
    if (syntaxError) {
      setJsonError(syntaxError);
      toast.error(syntaxError);
      return;
    }
    const parsed = JSON.parse(jsonText) as Record<string, unknown>;
    setDraft({ ...parsed, _username: draft._username });
    setFieldText({});
    setFieldErrors({});
    setJsonError(null);
    setView('form');
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
            {kind === 'course' || kind === 'offering'
              ? 'Insert or replace this record in the JSON array. Keep the other records.'
              : 'Create or replace this JSON file.'}
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
              <CardTitle>JSON record</CardTitle>
              <CardDescription>
                Edit the complete record here. The form and JSON views share one
                draft when you switch tabs.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <label className="sr-only" htmlFor="playground-json">
                JSON record
              </label>
              <textarea
                id="playground-json"
                value={jsonText}
                onChange={(event) => {
                  setJsonText(event.target.value);
                  setJsonError(null);
                }}
                spellCheck={false}
                aria-invalid={Boolean(syntaxError)}
                className="border-input bg-background focus-visible:outline-ring
                  aria-invalid:border-destructive min-h-96 w-full rounded-md
                  border p-4 font-mono text-sm shadow-xs"
              />
              {syntaxError ? (
                <p role="alert" className="text-destructive mt-2 text-sm">
                  {syntaxError}
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
