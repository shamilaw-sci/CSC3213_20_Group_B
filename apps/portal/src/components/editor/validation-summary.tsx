'use client';

import type { EditorValidationIssue } from '@/components/editor/editor-state';

interface ValidationSummaryProps {
  heading?: string;
  issues: readonly EditorValidationIssue[];
}

export function ValidationSummary({
  heading = 'Check the highlighted fields',
  issues,
}: ValidationSummaryProps) {
  if (issues.length === 0) return null;

  const focusField = (field: string) => {
    const target = document.getElementById(field);
    target?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    target?.focus({ preventScroll: true });
  };

  return (
    <section
      aria-labelledby="editor-validation-heading"
      className="rounded-md border border-destructive/40 bg-destructive/5 p-4"
    >
      <h2
        id="editor-validation-heading"
        className="font-semibold text-destructive"
      >
        {heading}
      </h2>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
        {issues.map((issue, index) => (
          <li key={`${issue.field}-${index}`}>
            <button
              type="button"
              className="text-left underline underline-offset-2 hover:text-destructive focus-visible:outline-none"
              onClick={() => focusField(issue.field)}
            >
              {issue.message}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

interface InlineValidationErrorProps {
  id: string;
  message?: string;
}

export function InlineValidationError({
  id,
  message,
}: InlineValidationErrorProps) {
  if (!message) return null;

  return (
    <p id={id} className="mt-1 text-sm text-destructive">
      {message}
    </p>
  );
}
