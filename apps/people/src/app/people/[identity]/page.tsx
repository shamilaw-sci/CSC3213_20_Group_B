import PersonProfilePage from '@/app/people/[identity]/_components/person-profile-page';

export function generateStaticParams(): Array<{ identity: string }> {
  return [];
}

export default async function Page({
  params,
}: {
  params: Promise<{ identity: string }>;
}) {
  const { identity } = await params;
  return <PersonProfilePage identity={identity} />;
}
