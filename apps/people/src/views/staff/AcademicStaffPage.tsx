'use client';

import { useEffect, useState } from 'react';

import PageHeader from '@/components/custom/layout/PageHeader';
import {
  PeopleCardSkeletonGrid,
  StaffCard,
} from '@/components/custom/people/PeopleCard';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  getAcademicStaff,
  prefetchPeopleProfiles,
} from '@/lib/data/people-data';
import {
  ACADEMIC_RANK_LABELS,
  type AcademicRank,
  type AcademicTeachingStaff,
} from '@/lib/types';

const RANK_ORDER: AcademicRank[] = [
  'EMERITUS_PROFESSOR',
  'SENIOR_PROFESSOR',
  'PROFESSOR',
  'SENIOR_LECTURER',
  'LECTURER',
  'PROBATIONARY_LECTURER',
  'TEMPORARY_LECTURER',
  'DEMONSTRATOR',
  'TEMPORARY_DEMONSTRATOR',
  'ASSISTANT_DEMONSTRATOR',
];

const ACADEMIC_GROUPS = [
  {
    id: 'PERMANENT',
    label: 'Permanent Staff',
    ranks: [
      'SENIOR_PROFESSOR',
      'PROFESSOR',
      'SENIOR_LECTURER',
      'LECTURER',
      'PROBATIONARY_LECTURER',
    ],
  },
  {
    id: 'EMERITUS',
    label: 'Emeritus',
    ranks: ['EMERITUS_PROFESSOR'],
  },
  {
    id: 'TEMPORARY',
    label: 'Temporary Staff',
    ranks: [
      'TEMPORARY_LECTURER',
      'DEMONSTRATOR',
      'TEMPORARY_DEMONSTRATOR',
      'ASSISTANT_DEMONSTRATOR',
    ],
  },
] as const satisfies readonly {
  id: string;
  label: string;
  ranks: readonly AcademicRank[];
}[];

type AcademicGroupId = (typeof ACADEMIC_GROUPS)[number]['id'];

function hasAcademicRank(
  ranks: readonly AcademicRank[],
  rank: AcademicRank
): boolean {
  return ranks.includes(rank);
}

export default function AcademicStaffPage() {
  const [activeGroupId, setActiveGroupId] =
    useState<AcademicGroupId>('PERMANENT');
  const [academicStaff, setAcademicStaff] = useState<AcademicTeachingStaff[]>(
    []
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);
  const activeGroup =
    ACADEMIC_GROUPS.find((group) => group.id === activeGroupId) ??
    ACADEMIC_GROUPS[0];

  useEffect(() => {
    let cancelled = false;

    async function loadStaff() {
      setIsLoading(true);
      setError(false);

      try {
        const nextStaff = await getAcademicStaff();
        if (!cancelled) setAcademicStaff(nextStaff);
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void loadStaff();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (academicStaff.length === 0) return;

    prefetchPeopleProfiles(
      academicStaff.map((staff) => staff.email?.split('@')[0])
    );
  }, [academicStaff]);

  const grouped = RANK_ORDER.filter((rank) =>
    hasAcademicRank(activeGroup.ranks, rank)
  )
    .map((rank) => ({
      rank,
      members: academicStaff.filter((staff) => staff.academicRank === rank),
    }))
    .filter((group) => group.members.length > 0);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <PageHeader
        breadcrumbs={[
          { href: '/', label: 'Home' },
          { href: '/staff', label: 'Staff' },
          { label: 'Academic Staff' },
        ]}
        title="Academic Staff"
        description="Permanent, emeritus, and temporary academic staff"
      />

      <Tabs
        value={activeGroupId}
        onValueChange={(value) => setActiveGroupId(value as AcademicGroupId)}
        className="mb-8"
      >
        <TabsList className="grid h-auto w-full grid-cols-1 sm:grid-cols-3">
          {ACADEMIC_GROUPS.map((group) => (
            <TabsTrigger key={group.id} value={group.id} className="min-h-9">
              {group.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {isLoading && <PeopleCardSkeletonGrid count={8} />}
      {error && (
        <p className="text-muted-foreground">Unable to load academic staff.</p>
      )}

      {grouped.map(({ rank, members }) => (
        <div key={rank} className="mb-10">
          <h2 className="mb-4 text-xl font-semibold text-card-foreground">
            {ACADEMIC_RANK_LABELS[rank]}s
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {members.map((staff) => (
              <StaffCard key={staff.email} staff={staff} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
