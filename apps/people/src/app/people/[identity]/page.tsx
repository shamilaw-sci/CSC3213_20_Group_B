import { notFound } from 'next/navigation';

import PersonProfilePage from '@/app/people/[identity]/_components/person-profile-page';
import {
  getPerson,
  getPersonProjects,
  PeopleDataNotFoundError,
} from '@/lib/data/people-data';

export const dynamic = 'force-dynamic';

export default async function Page({
  params,
}: {
  params: Promise<{ identity: string }>;
}) {
  const { identity } = await params;

  try {
    await getPerson(identity);
  } catch (error) {
    if (!(error instanceof PeopleDataNotFoundError)) throw error;
    if ((await getPersonProjects(identity)).length === 0) notFound();
  }

  return <PersonProfilePage identity={identity} />;
}
