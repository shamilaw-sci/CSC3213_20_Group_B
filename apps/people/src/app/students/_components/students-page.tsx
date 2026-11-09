'use client';

import type { StudentStreamDefinition } from '@scs/schemas';
import { Card, CardContent } from '@scs/ui/components/card';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import PageHeader from '@/components/layout/page-header';
import { getSubjectPath, isSubjectSlug, SUBJECTS } from '@/config/subjects';
import {
  getPeopleManifest,
  getStudentStreamDefinitions,
  type PeopleProgramme,
  prefetchPeopleManifest,
  prefetchStudentStreamDefinitions,
  prefetchSubject,
} from '@/lib/data/people-data';

type SubjectCard = {
  slug: (typeof SUBJECTS)[number]['slug'];
  label: string;
  icon: (typeof SUBJECTS)[number]['icon'];
  iconClassName: string;
};

const SUBJECT_FALLBACKS = new Map(
  SUBJECTS.map((subject) => [subject.slug, subject])
);

function cardsFromMetadata(
  programmes: PeopleProgramme[],
  streams: StudentStreamDefinition[]
): SubjectCard[] {
  const visibleStreams = streams.filter((stream) => stream.publicDirectory);

  return visibleStreams.flatMap((stream) => {
    const programme = programmes.find(
      (item) =>
        item.directory === (stream.directory ?? stream.stream) ||
        item.directory === stream.stream
    );
    if (!programme || !isSubjectSlug(programme.slug)) return [];

    const fallback = SUBJECT_FALLBACKS.get(programme.slug);
    if (!fallback) return [];

    return [
      {
        slug: programme.slug,
        label: stream.label || programme.name,
        icon: fallback.icon,
        iconClassName: fallback.iconClassName,
      },
    ];
  });
}

export default function StudentsPage() {
  const [metadataCards, setMetadataCards] = useState<SubjectCard[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function loadStreams() {
      try {
        const [manifest, streams] = await Promise.all([
          getPeopleManifest(),
          getStudentStreamDefinitions(),
        ]);
        if (!cancelled) {
          setMetadataCards(cardsFromMetadata(manifest.programmes, streams));
        }
      } catch {
        if (!cancelled) setMetadataCards([]);
      }
    }

    void loadStreams();

    return () => {
      cancelled = true;
    };
  }, []);

  const subjectCards = useMemo(
    () => (metadataCards.length ? metadataCards : SUBJECTS),
    [metadataCards]
  );

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6">
      <PageHeader
        breadcrumbs={[{ href: '/', label: 'Home' }, { label: 'Students' }]}
        title="Students"
        description="Subjects"
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {subjectCards.map(({ slug, label, icon: Icon, iconClassName }) => (
          <Link
            key={slug}
            href={getSubjectPath(slug)}
            onFocus={() => {
              prefetchPeopleManifest();
              prefetchStudentStreamDefinitions();
              prefetchSubject(slug);
            }}
            onMouseEnter={() => {
              prefetchPeopleManifest();
              prefetchStudentStreamDefinitions();
              prefetchSubject(slug);
            }}
            className="group block text-left"
          >
            <Card
              className="group-hover:border-primary/40 group-hover:bg-muted/50
                min-h-36 rounded-md py-0 transition-colors"
            >
              <CardContent
                className="flex min-h-36 flex-col items-start justify-between
                  p-4"
              >
                <Icon
                  className={`size-8 ${iconClassName}`}
                  strokeWidth={2.5}
                  aria-hidden="true"
                />
                <h3
                  className="text-card-foreground group-hover:text-primary
                    text-base font-semibold transition-colors"
                >
                  {label}
                </h3>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
