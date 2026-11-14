'use client';

import type { EditorValidationIssue } from '@/components/editor/editor-state';

interface ValidationSummaryProps {
  heading?: string;
  issues: readonly EditorValidationIssue[];
  onFocusField?: (field: string) => void;
}

export function ValidationSummary({
  heading = 'Check the highlighted fields',
  issues,
  onFocusField,
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
      className="border-destructive/40 bg-destructive/5 rounded-md border p-4"
    >
      <h2
        id="editor-validation-heading"
        className="text-destructive font-semibold"
      >
        {heading}
      </h2>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
        {issues.map((issue, index) => (
          <li key={`${issue.field}-${index}`}>
            <button
              type="button"
              className="hover:text-destructive text-left underline
                underline-offset-2 focus-visible:outline-none"
              onClick={() =>
                onFocusField
                  ? onFocusField(issue.field)
                  : focusField(issue.field)
              }
            >
              {issue.message}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
