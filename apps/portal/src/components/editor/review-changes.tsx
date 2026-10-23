'use client';

import { Button } from '@scs/ui/components/button';
import type { ReactNode } from 'react';

export interface ReviewChange {
  after: ReactNode;
  before?: ReactNode;
  field: string;
  label: string;
}

interface ReviewChangesProps {
  changes: readonly ReviewChange[];
  emptyMessage?: string;
  onChangeField: (field: string) => void;
}

export function ReviewChanges({
  changes,
  emptyMessage = 'No changes to review.',
  onChangeField,
}: ReviewChangesProps) {
  if (changes.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyMessage}</p>;
  }

  return (
    <dl className="divide-y rounded-md border">
      {changes.map((change) => (
        <div
          key={change.field}
          className="grid gap-3 p-4 sm:grid-cols-[minmax(9rem,0.35fr)_1fr_auto] sm:items-start"
        >
          <dt className="text-sm font-medium">{change.label}</dt>
          <dd className="min-w-0 text-sm">
            {change.before !== undefined ? (
              <p className="mb-1 text-muted-foreground line-through">
                {change.before}
              </p>
            ) : null}
            <div>{change.after}</div>
          </dd>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onChangeField(change.field)}
          >
            Change
          </Button>
        </div>
      ))}
    </dl>
  );
}
