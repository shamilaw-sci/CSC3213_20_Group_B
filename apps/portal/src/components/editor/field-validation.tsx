'use client';

import { createContext, type ReactNode, useContext } from 'react';

export interface FieldIssue {
  path: string;
  message: string;
}

const FieldValidationContext = createContext<readonly FieldIssue[] | null>(
  null
);

export function FieldValidationProvider({
  issues,
  children,
}: {
  issues: readonly FieldIssue[];
  children: ReactNode;
}) {
  return (
    <FieldValidationContext value={issues}>{children}</FieldValidationContext>
  );
}

export function validationFieldId(path: string) {
  return `playground-field-${path.replaceAll(/[^a-zA-Z0-9-]/g, '-')}`;
}

export function useFieldValidation(path?: string) {
  const issues = useContext(FieldValidationContext);
  if (!issues || !path) return { id: undefined, error: undefined };
  const issue = issues.find(
    (item) => item.path === path || item.path.startsWith(`${path}.`)
  );
  return { id: validationFieldId(path), error: issue?.message };
}
