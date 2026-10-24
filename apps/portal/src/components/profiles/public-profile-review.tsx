'use client';

import type { PublicProfileKind as ProfileKind } from '@scs/schemas';
import { Button } from '@scs/ui/components/button';
import { useState } from 'react';

import {
  type ReviewChange,
  ReviewChanges,
} from '@/components/editor/review-changes';
import type { ProfileRecord } from '@/components/profiles/profile-types';

interface PublicProfileReviewProps {
  draft: ProfileRecord;
  onChangeField: (field: string) => void;
  profileKind: ProfileKind;
  published: Readonly<ProfileRecord> | null;
}

function text(value: unknown, fallback = 'Not provided') {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function list(value: unknown) {
  if (!Array.isArray(value) || value.length === 0) return 'None';
  return value
    .map((item) => {
      if (typeof item === 'string') return item;
      if (!item || typeof item !== 'object') return null;
      const record = item as ProfileRecord;
      return text(
        record.title ?? record.name ?? record.degree ?? record.primaryFocus,
        'Entry'
      );
    })
    .filter((item): item is string => Boolean(item))
    .join(', ');
}

function links(value: unknown) {
  if (!value || typeof value !== 'object') return 'None';
  const record = value as ProfileRecord;
  const urls =
    record.urls && typeof record.urls === 'object'
      ? Object.values(record.urls as ProfileRecord)
      : [];
  return urls.filter((url) => typeof url === 'string' && url.trim()).length > 0
    ? `${urls.length} linked profiles`
    : 'None';
}

export function PublicProfileReview({
  draft,
  onChangeField,
  profileKind,
  published,
}: PublicProfileReviewProps) {
  const [comparePublished, setComparePublished] = useState(false);
  const before = comparePublished ? published : null;
  const changes: ReviewChange[] = [
    {
      field: 'profile-about',
      label: 'Name',
      after: `${text(draft.title, '')} ${text(draft.fullName)}`.trim(),
      before: before
        ? `${text(before.title, '')} ${text(before.fullName)}`.trim()
        : undefined,
    },
    {
      field: 'profile-about',
      label: 'Contact',
      after: text(draft.email ?? draft.personalEmail),
      before: before ? text(before.email ?? before.personalEmail) : undefined,
    },
    {
      field: 'profile-role',
      label: 'Profile type',
      after: profileKind,
    },
    {
      field: 'profile-role',
      label: 'Role and affiliation',
      after:
        [
          draft.academicRank,
          draft.designation,
          draft.department,
          draft.unit,
          draft.studentType,
          draft.studentTrack,
        ]
          .filter(
            (value): value is string =>
              typeof value === 'string' && Boolean(value)
          )
          .join(' · ') || 'Not provided',
      before: before
        ? [
            before.academicRank,
            before.designation,
            before.department,
            before.unit,
            before.studentType,
            before.studentTrack,
          ]
            .filter(
              (value): value is string =>
                typeof value === 'string' && Boolean(value)
            )
            .join(' · ') || 'Not provided'
        : undefined,
    },
    {
      field: 'profile-work',
      label: 'Work and studies',
      after: list(
        draft.publications ??
          draft.projects ??
          draft.qualifications ??
          draft.researchInterests
      ),
      before: before
        ? list(
            before.publications ??
              before.projects ??
              before.qualifications ??
              before.researchInterests
          )
        : undefined,
    },
    {
      field: 'profile-links',
      label: 'Links',
      after: links(draft.socialLinks),
      before: before ? links(before.socialLinks) : undefined,
    },
  ];

  return (
    <section className="space-y-4" aria-labelledby="profile-review-heading">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="profile-review-heading" className="font-semibold">
            Review profile changes
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Check how the important public information reads before submitting
            it.
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
        <p
          className="bg-muted/35 text-muted-foreground rounded-md border p-3
            text-sm"
        >
          Published values are shown crossed out. This comparison is read-only.
        </p>
      ) : null}
      <ReviewChanges changes={changes} onChangeField={onChangeField} />
    </section>
  );
}
