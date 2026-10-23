'use client';

import { Button } from '@scs/ui/components/button';
import { type ReactNode, useEffect, useRef } from 'react';

import { AdvancedJson } from '@/components/editor/advanced-json';
import {
  type EditorSection,
  EditorSectionNav,
} from '@/components/editor/editor-section-nav';
import {
  type EditorRecordStatus,
  type EditorState,
  type EditorSurface,
  editorTransitionClass,
  type EditorValidator,
  requestEditorSurface,
  updateEditorDraft,
} from '@/components/editor/editor-state';
import { EditorStatus } from '@/components/editor/editor-status';

interface EditorWorkspaceProps<T extends object> {
  canEditJson?: boolean;
  onStateChange: (state: EditorState<T>) => void;
  onSubmit: () => void;
  renderEdit: (draft: T, onDraftChange: (draft: T) => void) => ReactNode;
  renderReview: (
    draft: T,
    published: Readonly<T> | null,
    onChangeField: (field: string) => void
  ) => ReactNode;
  sections?: readonly EditorSection[];
  state: EditorState<T>;
  status: EditorRecordStatus;
  statusDetail?: string;
  submitLabel: string;
  submitting?: boolean;
  title: string;
  validateJson: EditorValidator<T>;
}

const surfaceLabels: Record<EditorSurface, string> = {
  edit: 'Edit details',
  review: 'Review changes',
  advanced: 'Advanced JSON',
};

export function EditorWorkspace<T extends object>({
  canEditJson = true,
  onStateChange,
  onSubmit,
  renderEdit,
  renderReview,
  sections = [],
  state,
  status,
  statusDetail,
  submitLabel,
  submitting = false,
  title,
  validateJson,
}: EditorWorkspaceProps<T>) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get('view') !== state.surface) {
      url.searchParams.set('view', state.surface);
      window.history.replaceState(window.history.state, '', url);
    }
    headingRef.current?.focus({ preventScroll: true });
  }, [state.surface]);

  const changeSurface = (target: EditorSurface) => {
    onStateChange(requestEditorSurface(state, target));
  };

  const changeField = (field: string) => {
    const nextState = requestEditorSurface(state, 'edit');
    onStateChange(nextState);
    if (nextState.surface !== 'edit') return;

    window.requestAnimationFrame(() => {
      const target = document.getElementById(field);
      target?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      target?.focus({ preventScroll: true });
    });
  };

  return (
    <section className="space-y-6" aria-labelledby="editor-title">
      <header className="space-y-3 border-b pb-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Editor</p>
            <h1
              id="editor-title"
              className="text-2xl font-semibold tracking-tight"
            >
              {title}
            </h1>
          </div>
          <EditorStatus status={status} detail={statusDetail} />
        </div>

        <nav aria-label="Editor views" className="flex flex-wrap gap-2">
          {(['edit', 'review'] as const).map((surface) => (
            <Button
              key={surface}
              type="button"
              variant={state.surface === surface ? 'default' : 'outline'}
              aria-current={state.surface === surface ? 'page' : undefined}
              onClick={() => changeSurface(surface)}
            >
              {surfaceLabels[surface]}
            </Button>
          ))}
          <span className="mx-1 hidden border-l sm:block" aria-hidden="true" />
          <Button
            type="button"
            variant={state.surface === 'advanced' ? 'secondary' : 'ghost'}
            aria-current={state.surface === 'advanced' ? 'page' : undefined}
            onClick={() => changeSurface('advanced')}
          >
            {surfaceLabels.advanced}
          </Button>
        </nav>
      </header>

      <div
        className={`${editorTransitionClass(false)} motion-reduce:transform-none motion-reduce:transition-none`}
      >
        <h2
          ref={headingRef}
          tabIndex={-1}
          className="sr-only focus:not-sr-only focus:mb-3 focus:text-lg focus:font-semibold focus:outline-none"
        >
          {surfaceLabels[state.surface]}
        </h2>

        {state.surface === 'edit' ? (
          <div className="grid gap-6 lg:grid-cols-[13rem_minmax(0,1fr)]">
            {sections.length > 0 ? (
              <EditorSectionNav sections={sections} />
            ) : (
              <div className="hidden lg:block" />
            )}
            <div className="min-w-0 space-y-6">
              {renderEdit(state.draft, (draft) =>
                onStateChange(updateEditorDraft(state, draft))
              )}
              <div className="flex justify-end border-t pt-5">
                <Button type="button" onClick={onSubmit} disabled={submitting}>
                  {submitLabel}
                </Button>
              </div>
            </div>
          </div>
        ) : null}

        {state.surface === 'review' ? (
          <div className="space-y-6">
            {renderReview(state.draft, state.published, changeField)}
            <div className="flex flex-wrap justify-between gap-3 border-t pt-5">
              <Button
                type="button"
                variant="outline"
                onClick={() => changeSurface('edit')}
              >
                Edit details
              </Button>
              <Button type="button" onClick={onSubmit} disabled={submitting}>
                {submitLabel}
              </Button>
            </div>
          </div>
        ) : null}

        {state.surface === 'advanced' ? (
          <AdvancedJson
            state={state}
            canEdit={canEditJson}
            validate={validateJson}
            onStateChange={onStateChange}
          />
        ) : null}
      </div>
    </section>
  );
}
