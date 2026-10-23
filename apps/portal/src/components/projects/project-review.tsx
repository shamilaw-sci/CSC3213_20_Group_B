'use client';

import { Button } from '@scs/ui/components/button';
import { useState } from 'react';

import {
  type ReviewChange,
  ReviewChanges,
} from '@/components/editor/review-changes';

export type ProjectRecord = Record<string, unknown>;

interface ProjectReviewProps {
  draft: ProjectRecord;
  onChangeField: (field: string) => void;
  published: Readonly<ProjectRecord> | null;
}

function text(value: unknown, fallback = 'Not provided') {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function list(value: unknown) {
  return Array.isArray(value) && value.length > 0
    ? value
        .filter((item): item is string => typeof item === 'string')
        .join(', ')
    : 'None';
}

function people(value: unknown) {
  if (!Array.isArray(value) || value.length === 0) return 'None';
  return value
    .map((person) => {
      if (!person || typeof person !== 'object') return null;
      const record = person as ProjectRecord;
      return text(
        record.name ?? record.username ?? record.email,
        'Unnamed person'
      );
    })
    .filter((person): person is string => Boolean(person))
    .join(', ');
}

function links(value: unknown) {
  if (!value || typeof value !== 'object') return 'None';
  const entries = Object.entries(value as ProjectRecord).filter(
    ([, entry]) => typeof entry === 'string' && entry.trim()
  );
  return entries.length === 0
    ? 'None'
    : entries.map(([label, entry]) => `${label}: ${String(entry)}`).join(', ');
}

function source(value: unknown) {
  if (!value || typeof value !== 'object') return 'Manual';
  const record = value as ProjectRecord;
  return text(record.kind, 'Manual');
}

export function ProjectReview({
  draft,
  onChangeField,
  published,
}: ProjectReviewProps) {
  const [comparePublished, setComparePublished] = useState(false);
  const before = comparePublished ? published : null;
  const changes: ReviewChange[] = [
    {
      field: 'project-title',
      label: 'Title',
      after: text(draft.title),
      before: before ? text(before.title) : undefined,
    },
    {
      field: 'project-title',
      label: 'Description',
      after: text(draft.shortDescription ?? draft.description),
      before: before
        ? text(before.shortDescription ?? before.description)
        : undefined,
    },
    {
      field: 'project-academic',
      label: 'Type and status',
      after: `${text(draft.projectType)} · ${text(draft.status)}`,
      before: before
        ? `${text(before.projectType)} · ${text(before.status)}`
        : undefined,
    },
    {
      field: 'project-academic',
      label: 'Academic context',
      after: `${text(draft.academicYear)} · ${list(draft.departments)}`,
      before: before
        ? `${text(before.academicYear)} · ${list(before.departments)}`
        : undefined,
    },
    {
      field: 'project-people',
      label: 'People',
      after: people(draft.people),
      before: before ? people(before.people) : undefined,
    },
    {
      field: 'project-links',
      label: 'Links',
      after: links(draft.links),
      before: before ? links(before.links) : undefined,
    },
    {
      field: 'project-source',
      label: 'Source',
      after: source(draft.source),
      before: before ? source(before.source) : undefined,
    },
  ];

  return (
    <section className="space-y-4" aria-labelledby="project-review-heading">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="project-review-heading" className="font-semibold">
            Review project changes
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Check the draft in plain language before submitting it for review.
          </p>
        </div>
        {published ? (
          <Button
            type="button"
            variant="outline"
            aria-pressed={comparePublished}
            onClick={() => setComparePublished((current) => !current)}
          >
            Compare with Published
          </Button>
        ) : null}
      </div>
      {comparePublished ? (
        <p className="rounded-md border bg-muted/35 p-3 text-sm text-muted-foreground">
          Published values are shown crossed out. This comparison is read-only
          and does not replace your draft.
        </p>
      ) : null}
      <ReviewChanges changes={changes} onChangeField={onChangeField} />
    </section>
  );
}
