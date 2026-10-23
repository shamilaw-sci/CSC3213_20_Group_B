'use client';

import { Button } from '@scs/ui/components/button';
import { useState } from 'react';

import {
  type ReviewChange,
  ReviewChanges,
} from '@/components/editor/review-changes';

export interface CourseRecord {
  codes: string[];
  credits: 1 | 2 | 3 | 6;
  departments: string[];
  id: string;
  primaryCode: string;
  title: string;
}

interface CourseReviewProps {
  draft: CourseRecord;
  offeringCount: number;
  onChangeField: (field: string) => void;
  published: Readonly<CourseRecord> | null;
}

export function CourseReview({
  draft,
  offeringCount,
  onChangeField,
  published,
}: CourseReviewProps) {
  const [comparePublished, setComparePublished] = useState(false);
  const before = comparePublished ? published : null;
  const changes: ReviewChange[] = [
    {
      field: 'course-details',
      label: 'Course',
      after: `${draft.title} (${draft.id})`,
      before: before ? `${before.title} (${before.id})` : undefined,
    },
    {
      field: 'course-details',
      label: 'Credits',
      after: String(draft.credits),
      before: before ? String(before.credits) : undefined,
    },
    {
      field: 'course-codes',
      label: 'Codes',
      after: `${draft.primaryCode} primary · ${draft.codes.join(', ')}`,
      before: before
        ? `${before.primaryCode} primary · ${before.codes.join(', ')}`
        : undefined,
    },
    {
      field: 'course-departments',
      label: 'Departments',
      after: draft.departments.join(', ') || 'None',
      before: before ? before.departments.join(', ') || 'None' : undefined,
    },
    {
      field: 'course-offerings',
      label: 'Published offerings',
      after: String(offeringCount),
    },
  ];

  return (
    <section className="space-y-4" aria-labelledby="course-review-heading">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="course-review-heading" className="font-semibold">
            Review course changes
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Confirm the catalog information before submitting it for review.
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
          Published values are shown crossed out. The comparison cannot replace
          the current course draft.
        </p>
      ) : null}
      <ReviewChanges changes={changes} onChangeField={onChangeField} />
    </section>
  );
}
