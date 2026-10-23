'use client';

import { Button } from '@scs/ui/components/button';
import dynamic from 'next/dynamic';
import { useState } from 'react';

import {
  applyAdvancedJson,
  discardAdvancedJson,
  type EditorState,
  type EditorValidator,
  stayOnAdvancedJson,
  updateAdvancedJson,
} from '@/components/editor/editor-state';
import { ValidationSummary } from '@/components/editor/validation-summary';

const JsonEditor = dynamic(
  () =>
    import('@/components/editor/json-editor').then(
      (module) => module.JsonEditor
    ),
  {
    loading: () => (
      <div className="min-h-96 animate-pulse rounded-md border bg-muted/40" />
    ),
    ssr: false,
  }
);

const JsonPreview = dynamic(
  () =>
    import('@/components/editor/json-preview').then(
      (module) => module.JsonPreview
    ),
  {
    loading: () => (
      <div className="min-h-72 animate-pulse rounded-md border bg-muted/40" />
    ),
    ssr: false,
  }
);

interface AdvancedJsonProps<T extends object> {
  canEdit: boolean;
  onStateChange: (state: EditorState<T>) => void;
  state: EditorState<T>;
  validate: EditorValidator<T>;
}

export function AdvancedJson<T extends object>({
  canEdit,
  onStateChange,
  state,
  validate,
}: AdvancedJsonProps<T>) {
  const [editing, setEditing] = useState(false);
  const hasPendingNavigation = state.pendingSurface !== null;

  const applyJson = () => {
    const nextState = applyAdvancedJson(state, validate);
    onStateChange(nextState);
    if (!nextState.json.error && nextState.validationIssues.length === 0) {
      setEditing(false);
    }
  };

  const discardJson = () => {
    onStateChange(discardAdvancedJson(state));
    setEditing(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">Advanced JSON</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            View the same draft as structured data. Editing is intended for
            advanced users and never changes the published record directly.
          </p>
        </div>
        {canEdit && !editing ? (
          <Button
            type="button"
            variant="outline"
            onClick={() => setEditing(true)}
          >
            Edit JSON
          </Button>
        ) : null}
      </div>

      {state.json.error ? (
        <p
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive"
        >
          {state.json.error}
        </p>
      ) : null}
      <ValidationSummary
        heading="The JSON does not match this record"
        issues={state.validationIssues}
      />

      {editing && canEdit ? (
        <JsonEditor
          value={state.json.text}
          onChange={(text) => onStateChange(updateAdvancedJson(state, text))}
        />
      ) : (
        <JsonPreview value={state.draft} enableClipboard monospace />
      )}

      {hasPendingNavigation ? (
        <section
          aria-labelledby="unsaved-json-heading"
          className="rounded-md border border-amber-500/45 bg-amber-500/10 p-4"
        >
          <h3 id="unsaved-json-heading" className="font-semibold">
            Apply or discard your JSON changes
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Your JSON edits have not been applied to the draft. Choose what to
            do before changing views.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button type="button" onClick={applyJson}>
              Apply JSON
            </Button>
            <Button type="button" variant="outline" onClick={discardJson}>
              Discard JSON
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onStateChange(stayOnAdvancedJson(state))}
            >
              Stay here
            </Button>
          </div>
        </section>
      ) : editing && canEdit ? (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            onClick={applyJson}
            disabled={!state.json.dirty}
          >
            Apply JSON
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={discardJson}
            disabled={!state.json.dirty}
          >
            Discard changes
          </Button>
        </div>
      ) : null}
    </div>
  );
}
